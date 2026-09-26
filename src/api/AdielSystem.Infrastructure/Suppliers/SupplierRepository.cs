using System.Transactions;
using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using AdielSystem.Application.Suppliers;
using AdielSystem.Domain.Suppliers;
using Npgsql;
using NpgsqlTypes;

namespace AdielSystem.Infrastructure.Suppliers;

internal sealed class SupplierRepository(NpgsqlDataSource dataSource) : ISupplierRepository
{
    public async Task<SupplierSearchResult> SearchAsync(SupplierSearchCriteria criteria, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var records = new List<SupplierRecord>();
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = $"""
                select id, name, logo_url, supplier_type, status, tin, company_email, company_phone, address, catalog_url, created_at, updated_at, archived_at, version
                from public.suppliers
                where {(criteria.ArchivedOnly ? "archived_at is not null" : criteria.IncludeArchived ? "true" : "archived_at is null")}
                  and deleted_at is null
                  and (@type = '' or supplier_type=@type)
                  and (@search_pattern = '' or name ilike @search_pattern escape '\' or company_email ilike @search_pattern escape '\' or company_phone ilike @search_pattern escape '\')
                order by {SortExpression(criteria.Sort)}
                limit @limit offset @offset
                """;
            AddSearchParameters(command.Parameters, criteria);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken)) records.Add(ReadSupplierRecord(reader));
        }

        var supplierIds = records.Select(record => record.Id).ToArray();
        await using var batch = new NpgsqlBatch(connection);
        foreach (var sql in new[]
        {
            "select supplier_id,id,name,email,phone,is_primary,sort_order from public.supplier_contacts where supplier_id=any(@supplier_ids) order by supplier_id,sort_order,id",
            "select supplier_id,category from public.supplier_categories where supplier_id=any(@supplier_ids) order by supplier_id,sort_order,lower(category)",
            "select supplier_id,id,note from public.supplier_performance_notes where supplier_id=any(@supplier_ids) order by supplier_id,created_at,id"
        })
        {
            var childCommand = new NpgsqlBatchCommand(sql);
            childCommand.Parameters.Add("supplier_ids", NpgsqlDbType.Array | NpgsqlDbType.Uuid).Value = supplierIds;
            batch.BatchCommands.Add(childCommand);
        }
        var countCommand = new NpgsqlBatchCommand($"""
            select count(*) from public.suppliers
            where {(criteria.ArchivedOnly ? "archived_at is not null" : criteria.IncludeArchived ? "true" : "archived_at is null")}
              and deleted_at is null and (@type = '' or supplier_type=@type)
              and (@search_pattern = '' or name ilike @search_pattern escape '\' or company_email ilike @search_pattern escape '\' or company_phone ilike @search_pattern escape '\')
            """);
        AddSearchParameters(countCommand.Parameters, criteria);
        batch.BatchCommands.Add(countCommand);
        batch.BatchCommands.Add(new NpgsqlBatchCommand("select count(*),count(*) filter (where status='Active'),(select count(distinct lower(category.category)) from public.supplier_categories category join public.suppliers category_supplier on category_supplier.id=category.supplier_id where category_supplier.archived_at is null and category_supplier.deleted_at is null) from public.suppliers where archived_at is null and deleted_at is null"));

        var contacts = new Dictionary<Guid, List<SupplierContact>>();
        var categories = new Dictionary<Guid, List<string>>();
        var notes = new Dictionary<Guid, List<SupplierPerformanceNote>>();
        await using var batchReader = await batch.ExecuteReaderAsync(cancellationToken);
        while (await batchReader.ReadAsync(cancellationToken))
        {
            var supplierId = batchReader.GetGuid(0);
            if (!contacts.TryGetValue(supplierId, out var entries)) contacts[supplierId] = entries = [];
            entries.Add(SupplierContact.Create(batchReader.GetGuid(1), batchReader.GetString(2), batchReader.GetString(3), batchReader.GetString(4), batchReader.GetBoolean(5), batchReader.GetInt32(6)));
        }
        await batchReader.NextResultAsync(cancellationToken);
        while (await batchReader.ReadAsync(cancellationToken))
        {
            var supplierId = batchReader.GetGuid(0);
            if (!categories.TryGetValue(supplierId, out var entries)) categories[supplierId] = entries = [];
            entries.Add(batchReader.GetString(1));
        }
        await batchReader.NextResultAsync(cancellationToken);
        while (await batchReader.ReadAsync(cancellationToken))
        {
            var supplierId = batchReader.GetGuid(0);
            if (!notes.TryGetValue(supplierId, out var entries)) notes[supplierId] = entries = [];
            entries.Add(SupplierPerformanceNote.Create(batchReader.GetGuid(1), batchReader.GetString(2)));
        }
        await batchReader.NextResultAsync(cancellationToken);
        await batchReader.ReadAsync(cancellationToken);
        var total = batchReader.GetInt64(0);
        await batchReader.NextResultAsync(cancellationToken);
        await batchReader.ReadAsync(cancellationToken);
        var summary = new SupplierDirectorySummary(batchReader.GetInt64(0), batchReader.GetInt64(1), batchReader.GetInt64(2));
        var items = records.Select(record => Supplier.Rehydrate(record.Id, record.Name, record.LogoUrl, ParseType(record.Type), ParseStatus(record.Status), record.Tin, record.CompanyEmail, record.CompanyPhone, record.Address, record.CatalogUrl, contacts.GetValueOrDefault(record.Id, []), categories.GetValueOrDefault(record.Id, []), notes.GetValueOrDefault(record.Id, []), record.CreatedAt, record.UpdatedAt, record.ArchivedAt, record.Version)).ToArray();
        return new SupplierSearchResult(items, total, summary);
    }

    public async Task<Supplier?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        return await GetAsync(connection, null, id, cancellationToken);
    }

    public async Task<bool> AreActiveCategoriesAsync(IReadOnlyList<string> categories, CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand("select count(*) from public.business_options where option_type='supplier_category' and is_active and lower(name)=any(@categories)");
        command.Parameters.Add("categories", NpgsqlDbType.Array | NpgsqlDbType.Text).Value = categories.Select(category => category.ToLowerInvariant()).ToArray();
        return (long)(await command.ExecuteScalarAsync(cancellationToken) ?? 0L) == categories.Count;
    }

    public async Task<Supplier> CreateAsync(Supplier supplier, CurrentUser actor, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(cancellationToken) : null;
        try
        {
            await using (var insert = connection.CreateCommand())
            {
                insert.Transaction = transaction;
                insert.CommandText = "insert into public.suppliers (id, name, logo_url, supplier_type, status, tin, company_email, company_phone, address, catalog_url, created_by, updated_by) values (@id, @name, @logo_url, @supplier_type, @status, @tin, @company_email, @company_phone, @address, @catalog_url, @actor_id, @actor_id)";
                AddSupplierParameters(insert, supplier, actor.Id);
                await insert.ExecuteNonQueryAsync(cancellationToken);
            }
            await ReplaceChildrenAsync(connection, transaction, supplier, actor, cancellationToken);
            await InsertAuditAsync(connection, transaction, supplier.Id, "Created", supplier.Name, string.Concat(DisplayType(supplier.Type), " added to the supplier directory."), actor, cancellationToken);
            var saved = await GetRequiredAsync(connection, transaction, supplier.Id, cancellationToken);
            if (transaction is not null) await transaction.CommitAsync(cancellationToken);
            return saved;
        }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.UniqueViolation) { throw new ResourceConflictException("An active Supplier with that name already exists."); }
    }

    public async Task<Supplier> UpdateAsync(Supplier supplier, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(cancellationToken) : null;
        try
        {
            await using (var update = connection.CreateCommand())
            {
                update.Transaction = transaction;
                update.CommandText = "update public.suppliers set name=@name, logo_url=@logo_url, supplier_type=@supplier_type, status=@status, tin=@tin, company_email=@company_email, company_phone=@company_phone, address=@address, catalog_url=@catalog_url, updated_by=@actor_id where id=@id and archived_at is null and deleted_at is null and version=@version returning id";
                AddSupplierParameters(update, supplier, actor.Id);
                update.Parameters.AddWithValue("version", expectedVersion);
                if (await update.ExecuteScalarAsync(cancellationToken) is null) throw Stale();
            }
            await ReplaceChildrenAsync(connection, transaction, supplier, actor, cancellationToken);
            await InsertAuditAsync(connection, transaction, supplier.Id, "Updated", supplier.Name, "Supplier profile, contacts, categories, and notes were updated.", actor, cancellationToken);
            var saved = await GetRequiredAsync(connection, transaction, supplier.Id, cancellationToken);
            if (transaction is not null) await transaction.CommitAsync(cancellationToken);
            return saved;
        }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.UniqueViolation) { throw new ResourceConflictException("An active Supplier with that name already exists."); }
    }

    public async Task<Supplier> SetArchivedAsync(Supplier supplier, long expectedVersion, bool archived, CurrentUser actor, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(cancellationToken) : null;
        await using (var update = connection.CreateCommand())
        {
            update.Transaction = transaction;
            update.CommandText = archived
                ? "update public.suppliers set archived_at=now(), archived_by=@actor_id, updated_by=@actor_id where id=@id and archived_at is null and deleted_at is null and version=@version returning id"
                : "update public.suppliers set archived_at=null, archived_by=null, updated_by=@actor_id where id=@id and archived_at is not null and deleted_at is null and version=@version returning id";
            update.Parameters.AddWithValue("actor_id", actor.Id);
            update.Parameters.AddWithValue("id", supplier.Id);
            update.Parameters.AddWithValue("version", expectedVersion);
            if (await update.ExecuteScalarAsync(cancellationToken) is null) throw Stale();
        }
        await InsertAuditAsync(connection, transaction, supplier.Id, archived ? "Archived" : "Restored", supplier.Name, archived ? "Supplier was archived with purchasing history retained." : "Supplier was restored to the directory.", actor, cancellationToken);
        var saved = await GetRequiredAsync(connection, transaction, supplier.Id, cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return saved;
    }

    private static async Task<Supplier?> GetAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid id, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "select id, name, logo_url, supplier_type, status, tin, company_email, company_phone, address, catalog_url, created_at, updated_at, archived_at, version from public.suppliers where id=@id and deleted_at is null";
        command.Parameters.AddWithValue("id", id);
        SupplierRecord supplier;
        await using (var reader = await command.ExecuteReaderAsync(cancellationToken))
        {
            if (!await reader.ReadAsync(cancellationToken)) return null;
            supplier = ReadSupplierRecord(reader);
        }
        var contacts = await ReadContactsAsync(connection, transaction, id, cancellationToken);
        var categories = await ReadCategoriesAsync(connection, transaction, id, cancellationToken);
        var notes = await ReadNotesAsync(connection, transaction, id, cancellationToken);
        return Supplier.Rehydrate(supplier.Id, supplier.Name, supplier.LogoUrl, ParseType(supplier.Type), ParseStatus(supplier.Status), supplier.Tin, supplier.CompanyEmail, supplier.CompanyPhone, supplier.Address, supplier.CatalogUrl, contacts, categories, notes, supplier.CreatedAt, supplier.UpdatedAt, supplier.ArchivedAt, supplier.Version);
    }

    private static async Task<Supplier> GetRequiredAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid id, CancellationToken cancellationToken) => await GetAsync(connection, transaction, id, cancellationToken) ?? throw new ResourceNotFoundException($"Supplier '{id}' was not found.");
    private static SupplierRecord ReadSupplierRecord(NpgsqlDataReader reader) => new(reader.GetGuid(0), reader.GetString(1), reader.IsDBNull(2) ? null : reader.GetString(2), reader.GetString(3), reader.GetString(4), reader.GetString(5), reader.GetString(6), reader.GetString(7), reader.GetString(8), reader.IsDBNull(9) ? null : reader.GetString(9), reader.GetFieldValue<DateTimeOffset>(10), reader.GetFieldValue<DateTimeOffset>(11), reader.IsDBNull(12) ? null : reader.GetFieldValue<DateTimeOffset>(12), reader.GetInt64(13));
    private static async Task<IReadOnlyList<SupplierContact>> ReadContactsAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid supplierId, CancellationToken cancellationToken) { await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = "select id, name, email, phone, is_primary, sort_order from public.supplier_contacts where supplier_id=@supplier_id order by sort_order, id"; command.Parameters.AddWithValue("supplier_id", supplierId); var results = new List<SupplierContact>(); await using var reader = await command.ExecuteReaderAsync(cancellationToken); while (await reader.ReadAsync(cancellationToken)) results.Add(SupplierContact.Create(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetBoolean(4), reader.GetInt32(5))); return results; }
    private static async Task<IReadOnlyList<string>> ReadCategoriesAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid supplierId, CancellationToken cancellationToken) { await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = "select category from public.supplier_categories where supplier_id=@supplier_id order by sort_order, lower(category)"; command.Parameters.AddWithValue("supplier_id", supplierId); var results = new List<string>(); await using var reader = await command.ExecuteReaderAsync(cancellationToken); while (await reader.ReadAsync(cancellationToken)) results.Add(reader.GetString(0)); return results; }
    private static async Task<IReadOnlyList<SupplierPerformanceNote>> ReadNotesAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid supplierId, CancellationToken cancellationToken) { await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = "select id, note from public.supplier_performance_notes where supplier_id=@supplier_id order by created_at, id"; command.Parameters.AddWithValue("supplier_id", supplierId); var results = new List<SupplierPerformanceNote>(); await using var reader = await command.ExecuteReaderAsync(cancellationToken); while (await reader.ReadAsync(cancellationToken)) results.Add(SupplierPerformanceNote.Create(reader.GetGuid(0), reader.GetString(1))); return results; }
    private static async Task ReplaceChildrenAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Supplier supplier, CurrentUser actor, CancellationToken cancellationToken)
    {
        await DeleteChildrenAsync(connection, transaction, supplier.Id, cancellationToken);
        foreach (var contact in supplier.Contacts) { await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = "insert into public.supplier_contacts (id, supplier_id, name, email, phone, is_primary, sort_order) values (@id, @supplier_id, @name, @email, @phone, @is_primary, @sort_order)"; command.Parameters.AddWithValue("id", contact.Id); command.Parameters.AddWithValue("supplier_id", supplier.Id); command.Parameters.AddWithValue("name", contact.Name); command.Parameters.AddWithValue("email", contact.Email); command.Parameters.AddWithValue("phone", contact.Phone); command.Parameters.AddWithValue("is_primary", contact.IsPrimary); command.Parameters.AddWithValue("sort_order", contact.SortOrder); await command.ExecuteNonQueryAsync(cancellationToken); }
        for (var index = 0; index < supplier.Categories.Count; index++) { await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = "insert into public.supplier_categories (supplier_id, category, sort_order) values (@supplier_id, @category, @sort_order)"; command.Parameters.AddWithValue("supplier_id", supplier.Id); command.Parameters.AddWithValue("category", supplier.Categories[index]); command.Parameters.AddWithValue("sort_order", index); await command.ExecuteNonQueryAsync(cancellationToken); }
        foreach (var note in supplier.PerformanceNotes) { await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = "insert into public.supplier_performance_notes (id, supplier_id, note, created_by) values (@id, @supplier_id, @note, @actor_id)"; command.Parameters.AddWithValue("id", note.Id); command.Parameters.AddWithValue("supplier_id", supplier.Id); command.Parameters.AddWithValue("note", note.Text); command.Parameters.AddWithValue("actor_id", actor.Id); await command.ExecuteNonQueryAsync(cancellationToken); }
    }
    private static async Task DeleteChildrenAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid supplierId, CancellationToken cancellationToken) { foreach (var table in new[] { "supplier_contacts", "supplier_categories", "supplier_performance_notes" }) { await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = string.Concat("delete from public.", table, " where supplier_id=@supplier_id"); command.Parameters.AddWithValue("supplier_id", supplierId); await command.ExecuteNonQueryAsync(cancellationToken); } }
    private static void AddSupplierParameters(NpgsqlCommand command, Supplier supplier, Guid actorId) { command.Parameters.AddWithValue("id", supplier.Id); command.Parameters.AddWithValue("name", supplier.Name); command.Parameters.AddWithValue("logo_url", (object?)supplier.LogoPath ?? DBNull.Value); command.Parameters.AddWithValue("supplier_type", DisplayType(supplier.Type)); command.Parameters.AddWithValue("status", supplier.Status.ToString()); command.Parameters.AddWithValue("tin", supplier.Tin); command.Parameters.AddWithValue("company_email", supplier.CompanyEmail); command.Parameters.AddWithValue("company_phone", supplier.CompanyPhone); command.Parameters.AddWithValue("address", supplier.Address); command.Parameters.AddWithValue("catalog_url", (object?)supplier.CatalogUrl ?? DBNull.Value); command.Parameters.AddWithValue("actor_id", actorId); }
    private static async Task InsertAuditAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid id, string action, string entity, string description, CurrentUser actor, CancellationToken cancellationToken) { await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = "insert into public.audit_records (record_id, module, action, entity, description, actor_id, actor_name, tone, status) values (@record_id, 'Suppliers', @action, @entity, @description, @actor_id, @actor_name, @tone, @status)"; command.Parameters.AddWithValue("record_id", id); command.Parameters.AddWithValue("action", action); command.Parameters.AddWithValue("entity", entity); command.Parameters.AddWithValue("description", description); command.Parameters.AddWithValue("actor_id", actor.Id); command.Parameters.AddWithValue("actor_name", actor.Username); command.Parameters.AddWithValue("tone", action == "Created" ? "success" : "info"); command.Parameters.AddWithValue("status", "Active"); await command.ExecuteNonQueryAsync(cancellationToken); }
    private static void AddSearchParameters(NpgsqlParameterCollection parameters, SupplierSearchCriteria criteria) { parameters.AddWithValue("type", criteria.Type ?? string.Empty); parameters.AddWithValue("search_pattern", string.IsNullOrWhiteSpace(criteria.Search) ? string.Empty : "%" + EscapeLike(criteria.Search) + "%"); parameters.AddWithValue("limit", criteria.PageSize); parameters.AddWithValue("offset", (criteria.Page - 1) * criteria.PageSize); }
    private static string SortExpression(string sort) => sort switch { "newest" => "created_at desc, name", "type" => "supplier_type, name", _ => "name" };
    private static string EscapeLike(string value) => value.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("%", "\\%", StringComparison.Ordinal).Replace("_", "\\_", StringComparison.Ordinal);
    private static SupplierType ParseType(string value) => value switch { "Contractor" => SupplierType.Contractor, "Distributor" => SupplierType.Distributor, "Manufacturer" => SupplierType.Manufacturer, "Service provider" => SupplierType.ServiceProvider, _ => SupplierType.Other };
    private static SupplierStatus ParseStatus(string value) => value == "Inactive" ? SupplierStatus.Inactive : SupplierStatus.Active;
    private static string DisplayType(SupplierType value) => value == SupplierType.ServiceProvider ? "Service provider" : value.ToString();
    private static ConcurrencyConflictException Stale() => new("This supplier changed after you opened it. Reload and try again.");
    private sealed record SupplierRecord(Guid Id, string Name, string? LogoUrl, string Type, string Status, string Tin, string CompanyEmail, string CompanyPhone, string Address, string? CatalogUrl, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DateTimeOffset? ArchivedAt, long Version);
}
