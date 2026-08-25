using AdielSystem.Application.Clients;
using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using Npgsql;
using NpgsqlTypes;

namespace AdielSystem.Infrastructure.Clients;

internal sealed partial class ClientRepository
{
    public async Task<ClientSearchResult> SearchAsync(ClientSearchCriteria criteria, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var condition = """
            c.deleted_at is null
            and (@archived_only = false or c.archived_at is not null)
            and (@archived_only or @include_archived or c.archived_at is null)
            and (@industry = '' or lower(c.industry) = lower(@industry))
            and (
                @search_pattern = ''
                or c.name ilike @search_pattern escape '\'
                or c.address ilike @search_pattern escape '\'
                or c.industry ilike @search_pattern escape '\'
                or exists (
                    select 1 from public.client_contacts search_contact
                    where search_contact.client_id = c.id
                      and (search_contact.name ilike @search_pattern escape '\'
                           or search_contact.email ilike @search_pattern escape '\'
                           or search_contact.phone ilike @search_pattern escape '\')
                )
            )
            """;

        await using var count = connection.CreateCommand();
        count.CommandText = $"select count(*) from public.clients c where {condition}";
        AddSearchParameters(count, criteria);
        var total = (long)(await count.ExecuteScalarAsync(cancellationToken) ?? 0L);

        await using var summaryCommand = connection.CreateCommand();
        summaryCommand.CommandText = """
            select count(*) filter (where c.archived_at is null),
                   count(*) filter (where c.archived_at is null and c.status = 'Active'),
                   count(distinct c.industry) filter (where c.archived_at is null),
                   coalesce((select sum(q.total_amount)
                             from public.quotations q
                             where q.status = 'Approved' and q.deleted_at is null), 0)
            from public.clients c
            where c.deleted_at is null
            """;
        ClientDirectorySummary summary;
        await using (var reader = await summaryCommand.ExecuteReaderAsync(cancellationToken))
        {
            await reader.ReadAsync(cancellationToken);
            summary = new ClientDirectorySummary(reader.GetInt64(0), reader.GetInt64(1), reader.GetInt64(2), reader.GetDecimal(3));
        }

        if (total == 0) return new ClientSearchResult([], 0, summary);

        var orderBy = criteria.Sort switch
        {
            "newest" => "c.client_since desc, c.created_at desc, c.id",
            "industry" => "lower(c.industry), lower(c.name), c.id",
            _ => "lower(c.name), c.id",
        };
        await using var idsCommand = connection.CreateCommand();
        idsCommand.CommandText = $"""
            select c.id
            from public.clients c
            where {condition}
            order by {orderBy}
            limit @page_size offset @offset
            """;
        AddSearchParameters(idsCommand, criteria);
        idsCommand.Parameters.AddWithValue("page_size", criteria.PageSize);
        idsCommand.Parameters.AddWithValue("offset", (criteria.Page - 1) * criteria.PageSize);
        var ids = new List<Guid>();
        await using (var reader = await idsCommand.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken)) ids.Add(reader.GetGuid(0));
        }
        if (ids.Count == 0) return new ClientSearchResult([], total, summary);

        await using var details = connection.CreateCommand();
        details.CommandText = SelectSql + """

            where c.id = any(@ids)
            order by array_position(@ids, c.id), cc.sort_order, cc.created_at
            """;
        details.Parameters.Add("ids", NpgsqlDbType.Array | NpgsqlDbType.Uuid).Value = ids.ToArray();
        return new ClientSearchResult(await ReadAsync(details, cancellationToken), total, summary);
    }

    public async Task<IReadOnlyList<ClientTimelineEntry>> ListTimelineAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand("""
            select entry_id, kind, source, occurred_at, reference, title, description, amount, balance, status, href
            from (
                select a.id as entry_id,
                       'Activity'::text as kind,
                       'Clients'::text as source,
                       a.occurred_at,
                       a.action as reference,
                       a.action || ': ' || a.entity as title,
                       a.description,
                       a.amount,
                       null::numeric as balance,
                       coalesce(a.status, '') as status,
                       '/clients/' || @client_id::text as href
                from public.audit_records a
                where a.module = 'Clients' and a.record_id = @client_id

                union all

                select q.id,
                       case when q.status = 'Approved' then 'Sale' else 'Quotation' end,
                       case when q.status = 'Approved' then 'Sales' else 'Quotations' end,
                       q.quotation_date::timestamptz,
                       q.quotation_number,
                       coalesce(nullif(q.subject, ''), 'Quotation'),
                       coalesce(nullif(q.project_location, ''), 'Quotation record'),
                       q.total_amount,
                       null::numeric,
                       q.status,
                       '/quotations/' || q.id::text
                from public.quotations q
                where q.client_id = @client_id and q.deleted_at is null

                union all

                select s.id,
                       'SOA',
                       'Statements of Account',
                       s.statement_date::timestamptz,
                       s.soa_number,
                       'Statement of Account issued',
                       'Coverage ' || s.coverage_from::text || ' to ' || s.coverage_to::text,
                       s.opening_balance + s.total_charges,
                       s.balance,
                       s.status,
                       '/statement-of-account/' || s.id::text
                from public.statements_of_account s
                where s.client_id = @client_id and s.deleted_at is null

                union all

                select p.id,
                       'Payment',
                       'Payments',
                       p.payment_date::timestamptz,
                       coalesce(nullif(p.reference_number, ''), s.soa_number),
                       case when p.entry_type = 'Reversal' then 'Payment reversed for ' else 'Payment received for ' end || s.soa_number,
                       coalesce(nullif(p.method, ''), p.entry_type),
                       case when p.entry_type = 'Reversal' then -p.amount else p.amount end,
                       null::numeric,
                       case when p.entry_type = 'Reversal' then 'Reversed' else 'Received' end,
                       '/statement-of-account/' || s.id::text
                from public.statement_payments p
                join public.statements_of_account s on s.id = p.statement_id
                where s.client_id = @client_id and s.deleted_at is null
            ) timeline
            order by occurred_at desc, entry_id desc
            """);
        command.Parameters.AddWithValue("client_id", id);
        var entries = new List<ClientTimelineEntry>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            entries.Add(new ClientTimelineEntry(
                reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetFieldValue<DateTimeOffset>(3),
                reader.GetString(4), reader.GetString(5), reader.GetString(6), reader.IsDBNull(7) ? null : reader.GetDecimal(7),
                reader.IsDBNull(8) ? null : reader.GetDecimal(8), reader.GetString(9), reader.GetString(10)));
        }
        return entries;
    }

    public async Task<bool> IsActiveIndustryAsync(string name, CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand("select exists(select 1 from public.business_options where option_type='client_industry' and is_active and lower(name)=lower(@name))");
        command.Parameters.AddWithValue("name", name);
        return (bool)(await command.ExecuteScalarAsync(cancellationToken) ?? false);
    }

    public async Task<IReadOnlyList<ClientIndustry>> ListIndustriesAsync(CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand(IndustrySelectSql + " order by option.sort_order, lower(option.name), option.id");
        return await ReadIndustriesAsync(command, cancellationToken);
    }

    public async Task<ClientIndustry> CreateIndustryAsync(string name, CancellationToken cancellationToken)
    {
        try
        {
            await using var command = dataSource.CreateCommand("""
                insert into public.business_options (option_type, name, is_active, sort_order)
                values ('client_industry', @name, true, coalesce((select max(sort_order) + 1 from public.business_options where option_type='client_industry'), 1))
                returning id
                """);
            command.Parameters.AddWithValue("name", name);
            var id = (Guid)(await command.ExecuteScalarAsync(cancellationToken) ?? throw new InvalidOperationException("The Client industry was not created."));
            return await GetIndustryRequiredAsync(id, cancellationToken);
        }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            throw new ResourceConflictException("That Client industry already exists.");
        }
    }

    public async Task<ClientIndustry> RenameIndustryAsync(Guid id, string name, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        try
        {
            string previousName;
            await using (var update = connection.CreateCommand())
            {
                update.Transaction = transaction;
                update.CommandText = """
                    with current_option as (
                        select id, name
                        from public.business_options
                        where id=@id and option_type='client_industry' and version=@version
                        for update
                    ), updated as (
                        update public.business_options option
                        set name=@name
                        from current_option
                        where option.id=current_option.id
                        returning current_option.name
                    )
                    select name from updated
                    """;
                update.Parameters.AddWithValue("id", id);
                update.Parameters.AddWithValue("name", name);
                update.Parameters.AddWithValue("version", expectedVersion);
                previousName = (string?)await update.ExecuteScalarAsync(cancellationToken) ?? throw StaleIndustry();
            }
            await using (var updateClients = connection.CreateCommand())
            {
                updateClients.Transaction = transaction;
                updateClients.CommandText = """
                    update public.clients set industry=@name, updated_by=@actor_id
                    where lower(industry)=lower(@previous_name) and deleted_at is null
                    """;
                updateClients.Parameters.AddWithValue("name", name);
                updateClients.Parameters.AddWithValue("previous_name", previousName);
                updateClients.Parameters.AddWithValue("actor_id", actor.Id);
                await updateClients.ExecuteNonQueryAsync(cancellationToken);
            }
            await transaction.CommitAsync(cancellationToken);
            return await GetIndustryRequiredAsync(id, cancellationToken);
        }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            throw new ResourceConflictException("That Client industry already exists.");
        }
    }

    public async Task<ClientIndustry> SetIndustryActiveAsync(Guid id, bool isActive, long expectedVersion, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        if (!isActive)
        {
            await using var activeCount = connection.CreateCommand();
            activeCount.CommandText = "select count(*) from public.business_options where option_type='client_industry' and is_active";
            if ((long)(await activeCount.ExecuteScalarAsync(cancellationToken) ?? 0L) <= 1)
                throw new ResourceConflictException("At least one Client industry must remain active.");
        }
        await using var command = connection.CreateCommand();
        command.CommandText = """
            update public.business_options set is_active=@is_active
            where id=@id and option_type='client_industry' and version=@version
            returning id
            """;
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("is_active", isActive);
        command.Parameters.AddWithValue("version", expectedVersion);
        if (await command.ExecuteScalarAsync(cancellationToken) is null) throw StaleIndustry();
        return await GetIndustryRequiredAsync(id, cancellationToken);
    }

    public async Task<IReadOnlyList<ClientIndustry>> ReorderIndustriesAsync(IReadOnlyList<Guid> ids, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await using (var count = connection.CreateCommand())
        {
            count.Transaction = transaction;
            count.CommandText = "select count(*) from public.business_options where option_type='client_industry' and id=any(@ids)";
            count.Parameters.Add("ids", NpgsqlDbType.Array | NpgsqlDbType.Uuid).Value = ids.ToArray();
            var matched = (long)(await count.ExecuteScalarAsync(cancellationToken) ?? 0L);
            await using var total = connection.CreateCommand();
            total.Transaction = transaction;
            total.CommandText = "select count(*) from public.business_options where option_type='client_industry'";
            var expected = (long)(await total.ExecuteScalarAsync(cancellationToken) ?? 0L);
            if (matched != expected || ids.Count != expected) throw new RequestValidationException("The Client industry order is stale. Reload and try again.");
        }
        for (var index = 0; index < ids.Count; index++)
        {
            await using var update = connection.CreateCommand();
            update.Transaction = transaction;
            update.CommandText = "update public.business_options set sort_order=@sort_order where id=@id and option_type='client_industry'";
            update.Parameters.AddWithValue("id", ids[index]);
            update.Parameters.AddWithValue("sort_order", index + 1);
            await update.ExecuteNonQueryAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);
        return await ListIndustriesAsync(cancellationToken);
    }

    public async Task DeleteIndustryAsync(Guid id, long expectedVersion, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await using (var usage = connection.CreateCommand())
        {
            usage.Transaction = transaction;
            usage.CommandText = "select count(*) from public.clients c join public.business_options option on option.id=@id where c.deleted_at is null and lower(c.industry)=lower(option.name)";
            usage.Parameters.AddWithValue("id", id);
            if ((long)(await usage.ExecuteScalarAsync(cancellationToken) ?? 0L) > 0)
                throw new ResourceConflictException("Industries used by Client records cannot be deleted.");
        }
        await using (var available = connection.CreateCommand())
        {
            available.Transaction = transaction;
            available.CommandText = "select count(*) from public.business_options where option_type='client_industry'";
            if ((long)(await available.ExecuteScalarAsync(cancellationToken) ?? 0L) <= 1)
                throw new ResourceConflictException("At least one Client industry must remain available.");
        }
        await using (var delete = connection.CreateCommand())
        {
            delete.Transaction = transaction;
            delete.CommandText = "delete from public.business_options where id=@id and option_type='client_industry' and version=@version returning id";
            delete.Parameters.AddWithValue("id", id);
            delete.Parameters.AddWithValue("version", expectedVersion);
            if (await delete.ExecuteScalarAsync(cancellationToken) is null) throw StaleIndustry();
        }
        await transaction.CommitAsync(cancellationToken);
    }

    private const string IndustrySelectSql = """
        select option.id, option.name, option.is_active, option.sort_order,
               (select count(*) from public.clients c where c.deleted_at is null and lower(c.industry)=lower(option.name)) as usage_count,
               option.version
        from public.business_options option
        where option.option_type='client_industry'
        """;

    private async Task<ClientIndustry> GetIndustryRequiredAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand(IndustrySelectSql + " and option.id=@id");
        command.Parameters.AddWithValue("id", id);
        return (await ReadIndustriesAsync(command, cancellationToken)).SingleOrDefault() ?? throw new ResourceNotFoundException("The Client industry was not found.");
    }

    private static async Task<IReadOnlyList<ClientIndustry>> ReadIndustriesAsync(NpgsqlCommand command, CancellationToken cancellationToken)
    {
        var options = new List<ClientIndustry>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
            options.Add(new ClientIndustry(reader.GetGuid(0), reader.GetString(1), reader.GetBoolean(2), reader.GetInt32(3), reader.GetInt64(4), reader.GetInt64(5)));
        return options;
    }

    private static void AddSearchParameters(NpgsqlCommand command, ClientSearchCriteria criteria)
    {
        command.Parameters.AddWithValue("archived_only", criteria.ArchivedOnly);
        command.Parameters.AddWithValue("include_archived", criteria.IncludeArchived);
        command.Parameters.AddWithValue("industry", criteria.Industry ?? string.Empty);
        command.Parameters.AddWithValue("search_pattern", string.IsNullOrWhiteSpace(criteria.Search) ? string.Empty : $"%{EscapeLike(criteria.Search)}%");
    }

    private static string EscapeLike(string value) => value.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("%", "\\%", StringComparison.Ordinal).Replace("_", "\\_", StringComparison.Ordinal);
    private static ConcurrencyConflictException StaleIndustry() => new("This Client industry changed after you opened it. Reload and try again.");
}
