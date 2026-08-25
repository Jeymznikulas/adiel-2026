using System.Transactions;
using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using AdielSystem.Application.Settings;
using Npgsql;

namespace AdielSystem.Infrastructure.Settings;

internal sealed class SettingsRepository(NpgsqlDataSource dataSource) : ISettingsRepository
{
    public async Task<CompanySettings> GetCompanyAsync(CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand(CompanySelectSql);
        return await ReadCompanyAsync(command, cancellationToken);
    }

    public async Task<CompanySettings> UpdateCompanyAsync(CompanySettings settings, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(cancellationToken) : null;
        await using (var update = connection.CreateCommand())
        {
            update.Transaction = transaction;
            update.CommandText = """
                update public.company_settings
                set company_name=@company_name, address=@address, main_office_number=@main_office_number,
                    client_relations_number=@client_relations_number, accounts_number=@accounts_number,
                    new_accounts_number=@new_accounts_number, email=@email, tin=@tin
                where id=true and version=@version
                returning id
                """;
            update.Parameters.AddWithValue("company_name", settings.CompanyName);
            update.Parameters.AddWithValue("address", settings.Address);
            update.Parameters.AddWithValue("main_office_number", settings.MainOfficeNumber);
            update.Parameters.AddWithValue("client_relations_number", settings.ClientRelationsNumber);
            update.Parameters.AddWithValue("accounts_number", settings.AccountsNumber);
            update.Parameters.AddWithValue("new_accounts_number", settings.NewAccountsNumber);
            update.Parameters.AddWithValue("email", settings.Email);
            update.Parameters.AddWithValue("tin", settings.Tin);
            update.Parameters.AddWithValue("version", expectedVersion);
            if (await update.ExecuteScalarAsync(cancellationToken) is null) throw Stale();
        }
        await InsertAuditAsync(connection, transaction, null, "Updated", "Company profile", "Company identity and contact details were updated.", actor, cancellationToken);
        var saved = await GetCompanyAsync(connection, transaction, cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return saved;
    }

    public async Task<DocumentDefaults> GetDocumentDefaultsAsync(CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand(DocumentSelectSql);
        return await ReadDocumentDefaultsAsync(command, cancellationToken);
    }

    public async Task<DocumentDefaults> UpdateDocumentDefaultsAsync(DocumentDefaults settings, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(cancellationToken) : null;
        await using (var update = connection.CreateCommand())
        {
            update.Transaction = transaction;
            update.CommandText = """
                update public.document_defaults
                set quotation_terms=@quotation_terms, purchase_order_terms=@purchase_order_terms,
                    statement_payment_instructions=@statement_payment_instructions, pdf_footer=@pdf_footer,
                    late_charge_enabled=@late_charge_enabled, late_charge_grace_days=@late_charge_grace_days,
                    late_charge_type=@late_charge_type, late_charge_value=@late_charge_value
                where id=true and version=@version
                returning id
                """;
            update.Parameters.AddWithValue("quotation_terms", settings.QuotationTerms);
            update.Parameters.AddWithValue("purchase_order_terms", settings.PurchaseOrderTerms);
            update.Parameters.AddWithValue("statement_payment_instructions", settings.StatementPaymentInstructions);
            update.Parameters.AddWithValue("pdf_footer", settings.PdfFooter);
            update.Parameters.AddWithValue("late_charge_enabled", settings.LateChargeEnabled);
            update.Parameters.AddWithValue("late_charge_grace_days", settings.LateChargeGraceDays);
            update.Parameters.AddWithValue("late_charge_type", settings.LateChargeType);
            update.Parameters.AddWithValue("late_charge_value", settings.LateChargeValue);
            update.Parameters.AddWithValue("version", expectedVersion);
            if (await update.ExecuteScalarAsync(cancellationToken) is null) throw Stale();
        }
        await InsertAuditAsync(connection, transaction, null, "Updated", "Document defaults", "Document wording and payment defaults were updated.", actor, cancellationToken);
        var saved = await GetDocumentDefaultsAsync(connection, transaction, cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return saved;
    }

    public async Task<IReadOnlyList<DocumentNumberingRule>> GetDocumentNumberingRulesAsync(CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand(DocumentNumberingSelectSql);
        return await ReadDocumentNumberingRulesAsync(command, cancellationToken);
    }

    public async Task<IReadOnlyList<DocumentNumberingRule>> UpdateDocumentNumberingRulesAsync(IReadOnlyList<DocumentNumberingRule> rules, CurrentUser actor, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(cancellationToken) : null;
        try
        {
            await using (var lockRules = connection.CreateCommand())
            {
                lockRules.Transaction = transaction;
                lockRules.CommandText = "select document_type from public.document_numbering_rules order by document_type for update";
                await lockRules.ExecuteNonQueryAsync(cancellationToken);
            }
            foreach (var rule in rules)
            {
                await using var update = connection.CreateCommand();
                update.Transaction = transaction;
                update.CommandText = "update public.document_numbering_rules set prefix=@prefix, starting_number=@starting_number, digits=@digits, include_year=@include_year, reset_yearly=@reset_yearly where document_type=@document_type and version=@version returning document_type";
                update.Parameters.AddWithValue("prefix", rule.Prefix);
                update.Parameters.AddWithValue("starting_number", rule.StartingNumber);
                update.Parameters.AddWithValue("digits", rule.Digits);
                update.Parameters.AddWithValue("include_year", rule.IncludeYear);
                update.Parameters.AddWithValue("reset_yearly", rule.ResetYearly);
                update.Parameters.AddWithValue("document_type", rule.DocumentType);
                update.Parameters.AddWithValue("version", rule.Version);
                if (await update.ExecuteScalarAsync(cancellationToken) is null) throw Stale();
            }
            await InsertAuditAsync(connection, transaction, null, "Updated", "Document numbering", "Document numbering rules were updated.", actor, cancellationToken);
            var saved = await GetDocumentNumberingRulesAsync(connection, transaction, cancellationToken);
            if (transaction is not null) await transaction.CommitAsync(cancellationToken);
            return saved;
        }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            throw new ResourceConflictException("Document prefixes must be unique.");
        }
    }

    public async Task<string> PreviewDocumentNumberAsync(string documentType, DateOnly documentDate, CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand("select public.preview_document_number(@document_type, @document_date)");
        command.Parameters.AddWithValue("document_type", documentType);
        command.Parameters.AddWithValue("document_date", documentDate);
        return (string?)await command.ExecuteScalarAsync(cancellationToken) ?? throw new InvalidOperationException("The document number could not be previewed.");
    }

    public async Task<string> ReserveDocumentNumberAsync(string documentType, DateOnly documentDate, CurrentUser actor, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(cancellationToken) : null;
        await using var reserve = connection.CreateCommand();
        reserve.Transaction = transaction;
        reserve.CommandText = "select public.next_document_number(@document_type, @document_date)";
        reserve.Parameters.AddWithValue("document_type", documentType);
        reserve.Parameters.AddWithValue("document_date", documentDate);
        var number = (string?)await reserve.ExecuteScalarAsync(cancellationToken) ?? throw new InvalidOperationException("The document number could not be reserved.");
        await InsertAuditAsync(connection, transaction, null, "Created", number, string.Concat(DisplayType(documentType), " number was reserved."), actor, cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return number;
    }

    public async Task<IReadOnlyList<BusinessOption>> ListOptionsAsync(string type, CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand(OptionSelectSql(type) + " where option.option_type=@type order by option.sort_order, lower(option.name), option.id");
        command.Parameters.AddWithValue("type", type);
        return await ReadOptionsAsync(command, cancellationToken);
    }

    public async Task<BusinessOption> CreateOptionAsync(string type, string name, CurrentUser actor, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(cancellationToken) : null;
        try
        {
            Guid id;
            await using (var insert = connection.CreateCommand())
            {
                insert.Transaction = transaction;
                insert.CommandText = """
                    insert into public.business_options (option_type, name, is_active, sort_order)
                    values (@type, @name, true, coalesce((select max(sort_order) + 1 from public.business_options where option_type=@type), 1))
                    returning id
                    """;
                insert.Parameters.AddWithValue("type", type);
                insert.Parameters.AddWithValue("name", name);
                id = (Guid)(await insert.ExecuteScalarAsync(cancellationToken) ?? throw new InvalidOperationException("The option was not created."));
            }
            await InsertAuditAsync(connection, transaction, id, "Created", name, $"{DisplayType(type)} was added.", actor, cancellationToken);
            var saved = await GetOptionAsync(connection, transaction, id, cancellationToken);
            if (transaction is not null) await transaction.CommitAsync(cancellationToken);
            return saved;
        }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            throw new ResourceConflictException("That option already exists.");
        }
    }

    public async Task<BusinessOption> RenameOptionAsync(Guid id, string name, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(cancellationToken) : null;
        try
        {
            var previous = await GetOptionAsync(connection, transaction, id, cancellationToken);
            await using (var update = connection.CreateCommand())
            {
                update.Transaction = transaction;
                update.CommandText = "update public.business_options set name=@name where id=@id and version=@version returning id";
                update.Parameters.AddWithValue("name", name);
                update.Parameters.AddWithValue("id", id);
                update.Parameters.AddWithValue("version", expectedVersion);
                if (await update.ExecuteScalarAsync(cancellationToken) is null) throw Stale();
            }
            await RenameUsagesAsync(connection, transaction, previous.Type, previous.Name, name, actor.Id, cancellationToken);
            await InsertAuditAsync(connection, transaction, id, "Updated", name, $"{DisplayType(previous.Type)} was renamed from {previous.Name} to {name}.", actor, cancellationToken);
            var saved = await GetOptionAsync(connection, transaction, id, cancellationToken);
            if (transaction is not null) await transaction.CommitAsync(cancellationToken);
            return saved;
        }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            throw new ResourceConflictException("That option already exists or its rename would duplicate an existing record classification.");
        }
    }

    public async Task<BusinessOption> SetOptionActiveAsync(Guid id, bool isActive, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(cancellationToken) : null;
        var previous = await GetOptionAsync(connection, transaction, id, cancellationToken);
        if (!isActive && previous.IsActive)
        {
            await using var active = connection.CreateCommand();
            active.Transaction = transaction;
            active.CommandText = "select count(*) from public.business_options where option_type=@type and is_active";
            active.Parameters.AddWithValue("type", previous.Type);
            if ((long)(await active.ExecuteScalarAsync(cancellationToken) ?? 0L) <= 1) throw new ResourceConflictException("At least one option of this type must remain active.");
        }
        await using (var update = connection.CreateCommand())
        {
            update.Transaction = transaction;
            update.CommandText = "update public.business_options set is_active=@is_active where id=@id and version=@version returning id";
            update.Parameters.AddWithValue("is_active", isActive);
            update.Parameters.AddWithValue("id", id);
            update.Parameters.AddWithValue("version", expectedVersion);
            if (await update.ExecuteScalarAsync(cancellationToken) is null) throw Stale();
        }
        await InsertAuditAsync(connection, transaction, id, "Status changed", previous.Name, $"{DisplayType(previous.Type)} was {(isActive ? "activated" : "deactivated")}.", actor, cancellationToken);
        var saved = await GetOptionAsync(connection, transaction, id, cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return saved;
    }

    public async Task<IReadOnlyList<BusinessOption>> ReorderOptionsAsync(string type, IReadOnlyList<ReorderBusinessOption> items, CurrentUser actor, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(cancellationToken) : null;
        await using (var count = connection.CreateCommand())
        {
            count.Transaction = transaction;
            count.CommandText = "select count(*) from public.business_options where option_type=@type";
            count.Parameters.AddWithValue("type", type);
            if ((long)(await count.ExecuteScalarAsync(cancellationToken) ?? 0L) != items.Count) throw new RequestValidationException("The option list changed. Reload before reordering.");
        }
        for (var index = 0; index < items.Count; index++)
        {
            await using var update = connection.CreateCommand();
            update.Transaction = transaction;
            update.CommandText = "update public.business_options set sort_order=@sort_order where id=@id and option_type=@type and version=@version returning id";
            update.Parameters.AddWithValue("sort_order", index + 1);
            update.Parameters.AddWithValue("id", items[index].Id);
            update.Parameters.AddWithValue("type", type);
            update.Parameters.AddWithValue("version", items[index].Version);
            if (await update.ExecuteScalarAsync(cancellationToken) is null) throw Stale();
        }
        await InsertAuditAsync(connection, transaction, null, "Updated", DisplayType(type), $"{DisplayType(type)} display order was updated.", actor, cancellationToken);
        var saved = await ListOptionsAsync(connection, transaction, type, cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return saved;
    }

    public async Task DeleteOptionAsync(Guid id, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(cancellationToken) : null;
        var option = await GetOptionAsync(connection, transaction, id, cancellationToken);
        if (option.UsageCount > 0) throw new ResourceConflictException($"{option.Name} is currently used and cannot be deleted.");
        if (option.IsActive)
        {
            await using var active = connection.CreateCommand();
            active.Transaction = transaction;
            active.CommandText = "select count(*) from public.business_options where option_type=@type and is_active";
            active.Parameters.AddWithValue("type", option.Type);
            if ((long)(await active.ExecuteScalarAsync(cancellationToken) ?? 0L) <= 1) throw new ResourceConflictException("At least one option of this type must remain active.");
        }
        await InsertAuditAsync(connection, transaction, id, "Deleted", option.Name, $"{DisplayType(option.Type)} was deleted.", actor, cancellationToken);
        await using (var delete = connection.CreateCommand())
        {
            delete.Transaction = transaction;
            delete.CommandText = "delete from public.business_options where id=@id and version=@version";
            delete.Parameters.AddWithValue("id", id);
            delete.Parameters.AddWithValue("version", expectedVersion);
            if (await delete.ExecuteNonQueryAsync(cancellationToken) != 1) throw Stale();
        }
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
    }

    private const string CompanySelectSql = "select company_name, address, main_office_number, client_relations_number, accounts_number, new_accounts_number, email, tin, updated_at, version from public.company_settings where id=true";
    private const string DocumentSelectSql = "select quotation_terms, purchase_order_terms, statement_payment_instructions, pdf_footer, late_charge_enabled, late_charge_grace_days, late_charge_type, late_charge_value, updated_at, version from public.document_defaults where id=true";
    private const string DocumentNumberingSelectSql = "select document_type, prefix, starting_number, digits, include_year, reset_yearly, updated_at, version from public.document_numbering_rules order by document_type";

    private static string OptionSelectSql(string type) => $"""
        select option.id, option.option_type, option.name, option.is_active, option.sort_order,
               {UsageExpression(type)} as usage_count, option.updated_at, option.version
        from public.business_options option
        """;

    private static string UsageExpression(string type) => type switch
    {
        "client_industry" => "(select count(*) from public.clients record where record.deleted_at is null and lower(record.industry)=lower(option.name))",
        "supplier_category" => "(select count(*) from public.supplier_categories record join public.suppliers supplier on supplier.id=record.supplier_id where supplier.deleted_at is null and lower(record.category)=lower(option.name))",
        "item_category" => "(select count(*) from public.items record where record.deleted_at is null and lower(record.category)=lower(option.name))",
        "expense_category" => "(select count(*) from public.expenses record where record.deleted_at is null and lower(record.category)=lower(option.name))",
        "payment_method" => "(select count(*) from public.expenses record where record.deleted_at is null and lower(record.payment_method)=lower(option.name))",
        _ => throw new RequestValidationException("Unsupported business-option type."),
    };

    private static async Task RenameUsagesAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, string type, string previousName, string name, Guid actorId, CancellationToken cancellationToken)
    {
        var sql = type switch
        {
            "client_industry" => "update public.clients set industry=@name, updated_by=@actor_id where deleted_at is null and lower(industry)=lower(@previous_name)",
            "supplier_category" => "update public.supplier_categories set category=@name where lower(category)=lower(@previous_name)",
            "item_category" => "update public.items set category=@name, updated_by=@actor_id where deleted_at is null and lower(category)=lower(@previous_name)",
            "expense_category" => "update public.expenses set category=@name, updated_by=@actor_id where deleted_at is null and lower(category)=lower(@previous_name)",
            "payment_method" => "update public.expenses set payment_method=@name, updated_by=@actor_id where deleted_at is null and lower(payment_method)=lower(@previous_name)",
            _ => throw new RequestValidationException("Unsupported business-option type."),
        };
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        command.Parameters.AddWithValue("name", name);
        command.Parameters.AddWithValue("previous_name", previousName);
        command.Parameters.AddWithValue("actor_id", actorId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task InsertAuditAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid? recordId, string action, string entity, string description, CurrentUser actor, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "insert into public.audit_records (record_id, module, action, entity, description, actor_id, actor_name, tone, status) values (@record_id, 'Settings', @action, @entity, @description, @actor_id, @actor_name, 'info', 'Active')";
        command.Parameters.AddWithValue("record_id", (object?)recordId ?? DBNull.Value);
        command.Parameters.AddWithValue("action", action);
        command.Parameters.AddWithValue("entity", entity);
        command.Parameters.AddWithValue("description", description);
        command.Parameters.AddWithValue("actor_id", actor.Id);
        command.Parameters.AddWithValue("actor_name", actor.Username);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<CompanySettings> GetCompanyAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, CancellationToken cancellationToken) { await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = CompanySelectSql; return await ReadCompanyAsync(command, cancellationToken); }
    private static async Task<DocumentDefaults> GetDocumentDefaultsAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, CancellationToken cancellationToken) { await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = DocumentSelectSql; return await ReadDocumentDefaultsAsync(command, cancellationToken); }
    private static async Task<IReadOnlyList<DocumentNumberingRule>> GetDocumentNumberingRulesAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, CancellationToken cancellationToken) { await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = DocumentNumberingSelectSql; return await ReadDocumentNumberingRulesAsync(command, cancellationToken); }
    private static async Task<BusinessOption> GetOptionAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid id, CancellationToken cancellationToken)
    {
        await using var typeCommand = connection.CreateCommand(); typeCommand.Transaction = transaction; typeCommand.CommandText = "select option_type from public.business_options where id=@id"; typeCommand.Parameters.AddWithValue("id", id);
        var type = (string?)await typeCommand.ExecuteScalarAsync(cancellationToken) ?? throw new ResourceNotFoundException($"Business option '{id}' was not found.");
        await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = OptionSelectSql(type) + " where option.id=@id"; command.Parameters.AddWithValue("id", id);
        return (await ReadOptionsAsync(command, cancellationToken)).Single();
    }
    private static async Task<IReadOnlyList<BusinessOption>> ListOptionsAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, string type, CancellationToken cancellationToken) { await using var command = connection.CreateCommand(); command.Transaction = transaction; command.CommandText = OptionSelectSql(type) + " where option.option_type=@type order by option.sort_order, lower(option.name), option.id"; command.Parameters.AddWithValue("type", type); return await ReadOptionsAsync(command, cancellationToken); }
    private static async Task<CompanySettings> ReadCompanyAsync(NpgsqlCommand command, CancellationToken cancellationToken) { await using var reader = await command.ExecuteReaderAsync(cancellationToken); if (!await reader.ReadAsync(cancellationToken)) throw new InvalidOperationException("Company settings are missing."); return new(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4), reader.GetString(5), reader.GetString(6), reader.GetString(7), reader.GetFieldValue<DateTimeOffset>(8), reader.GetInt64(9)); }
    private static async Task<DocumentDefaults> ReadDocumentDefaultsAsync(NpgsqlCommand command, CancellationToken cancellationToken) { await using var reader = await command.ExecuteReaderAsync(cancellationToken); if (!await reader.ReadAsync(cancellationToken)) throw new InvalidOperationException("Document defaults are missing."); return new(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetBoolean(4), reader.GetInt32(5), reader.GetString(6), reader.GetDecimal(7), reader.GetFieldValue<DateTimeOffset>(8), reader.GetInt64(9)); }
    private static async Task<IReadOnlyList<DocumentNumberingRule>> ReadDocumentNumberingRulesAsync(NpgsqlCommand command, CancellationToken cancellationToken) { var results = new List<DocumentNumberingRule>(); await using var reader = await command.ExecuteReaderAsync(cancellationToken); while (await reader.ReadAsync(cancellationToken)) results.Add(new(reader.GetString(0), reader.GetString(1), reader.GetInt32(2), reader.GetInt32(3), reader.GetBoolean(4), reader.GetBoolean(5), reader.GetFieldValue<DateTimeOffset>(6), reader.GetInt64(7))); return results; }
    private static async Task<IReadOnlyList<BusinessOption>> ReadOptionsAsync(NpgsqlCommand command, CancellationToken cancellationToken) { var results = new List<BusinessOption>(); await using var reader = await command.ExecuteReaderAsync(cancellationToken); while (await reader.ReadAsync(cancellationToken)) results.Add(new(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetBoolean(3), reader.GetInt32(4), reader.GetInt64(5), reader.GetFieldValue<DateTimeOffset>(6), reader.GetInt64(7))); return results; }
    private static ConcurrencyConflictException Stale() => new("These settings changed after you opened them. Reload and try again.");
    private static string DisplayType(string type) => type.Replace('_', ' ');
}
