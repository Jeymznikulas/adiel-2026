using AdielSystem.Application.Clients;
using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using AdielSystem.Domain.Clients;
using Npgsql;
using NpgsqlTypes;
using System.Transactions;

namespace AdielSystem.Infrastructure.Clients;

internal sealed partial class ClientRepository : IClientRepository
{
    private readonly NpgsqlDataSource dataSource;

    public ClientRepository(NpgsqlDataSource dataSource)
    {
        this.dataSource = dataSource;
    }

    private const string SelectSql = """
        select c.id, c.name, c.photo_url, c.address, c.industry, c.client_since, c.status,
               c.created_at, c.updated_at, c.archived_at, c.version,
               cc.id, cc.name, cc.email, cc.phone, cc.is_primary, cc.sort_order
        from public.clients c
        left join public.client_contacts cc on cc.client_id = c.id
        """;

    public async Task<Client?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand(SelectSql + "\n" + """
            where c.id = @id and c.deleted_at is null
            order by cc.sort_order, cc.created_at
            """);
        command.Parameters.AddWithValue("id", id);
        return (await ReadAsync(command, cancellationToken)).SingleOrDefault();
    }

    public async Task<Client> CreateAsync(Client client, CurrentUser actor, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(cancellationToken) : null;
        try
        {
            await using (var command = connection.CreateCommand())
            {
                command.Transaction = transaction;
                command.CommandText = """
                    insert into public.clients (id, name, photo_url, address, industry, client_since, status, created_by, updated_by)
                    values (@id, @name, @photo_url, @address, @industry, @client_since, @status, @actor_id, @actor_id)
                    """;
                AddClientParameters(command, client, actor.Id);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
            await ReplaceContactsAsync(connection, transaction, client, cancellationToken);
            await InsertAuditAsync(connection, transaction, client, actor, "Created", "Client was added to the directory.", "success", cancellationToken);
            var saved = await GetAsync(connection, transaction, client.Id, cancellationToken);
            if (transaction is not null) await transaction.CommitAsync(cancellationToken);
            return saved;
        }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            throw new ResourceConflictException("A client with this name already exists.");
        }
    }

    public async Task<Client> UpdateAsync(Client client, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(cancellationToken) : null;
        try
        {
            await using (var command = connection.CreateCommand())
            {
                command.Transaction = transaction;
                command.CommandText = """
                    update public.clients
                    set name=@name, photo_url=@photo_url, address=@address, industry=@industry,
                        client_since=@client_since, status=@status, updated_by=@actor_id
                    where id=@id and version=@expected_version and archived_at is null and deleted_at is null
                    returning id
                    """;
                AddClientParameters(command, client, actor.Id);
                command.Parameters.AddWithValue("expected_version", expectedVersion);
                if (await command.ExecuteScalarAsync(cancellationToken) is null) throw Stale();
            }
            await ReplaceContactsAsync(connection, transaction, client, cancellationToken);
            await InsertAuditAsync(connection, transaction, client, actor, "Updated", "Client profile and contacts were updated.", "info", cancellationToken);
            var saved = await GetAsync(connection, transaction, client.Id, cancellationToken);
            if (transaction is not null) await transaction.CommitAsync(cancellationToken);
            return saved;
        }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            throw new ResourceConflictException("A client with this name already exists.");
        }
    }

    public async Task<Client> SetArchivedAsync(Client client, long expectedVersion, bool archived, CurrentUser actor, CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(cancellationToken) : null;
        await using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = """
                update public.clients
                set archived_at=case when @archived then now() else null end,
                    archived_by=case when @archived then @actor_id else null end,
                    updated_by=@actor_id
                where id=@id and version=@expected_version and deleted_at is null
                returning id
                """;
            command.Parameters.AddWithValue("id", client.Id);
            command.Parameters.AddWithValue("expected_version", expectedVersion);
            command.Parameters.AddWithValue("archived", archived);
            command.Parameters.AddWithValue("actor_id", actor.Id);
            if (await command.ExecuteScalarAsync(cancellationToken) is null) throw Stale();
        }
        await InsertAuditAsync(connection, transaction, client, actor, archived ? "Archived" : "Restored", archived ? "Client was archived with linked history retained." : "Client was restored to the active directory.", "info", cancellationToken);
        var saved = await GetAsync(connection, transaction, client.Id, cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return saved;
    }

    private static ConcurrencyConflictException Stale() => new("This client changed after you opened it. Reload and try again.");

    private static void AddClientParameters(NpgsqlCommand command, Client client, Guid actorId)
    {
        command.Parameters.AddWithValue("id", client.Id);
        command.Parameters.AddWithValue("name", client.Name);
        command.Parameters.Add("photo_url", NpgsqlDbType.Text).Value = (object?)client.PhotoPath ?? DBNull.Value;
        command.Parameters.AddWithValue("address", client.Address);
        command.Parameters.AddWithValue("industry", client.Industry);
        command.Parameters.AddWithValue("client_since", client.ClientSince);
        command.Parameters.AddWithValue("status", client.Status.ToString());
        command.Parameters.AddWithValue("actor_id", actorId);
    }

    private static async Task ReplaceContactsAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Client client, CancellationToken cancellationToken)
    {
        await using (var delete = connection.CreateCommand())
        {
            delete.Transaction = transaction;
            delete.CommandText = "delete from public.client_contacts where client_id=@client_id";
            delete.Parameters.AddWithValue("client_id", client.Id);
            await delete.ExecuteNonQueryAsync(cancellationToken);
        }
        foreach (var contact in client.Contacts)
        {
            await using var insert = connection.CreateCommand();
            insert.Transaction = transaction;
            insert.CommandText = """
                insert into public.client_contacts (id, client_id, name, email, phone, is_primary, sort_order)
                values (@id, @client_id, @name, @email, @phone, @is_primary, @sort_order)
                """;
            insert.Parameters.AddWithValue("id", contact.Id);
            insert.Parameters.AddWithValue("client_id", client.Id);
            insert.Parameters.AddWithValue("name", contact.Name);
            insert.Parameters.AddWithValue("email", contact.Email);
            insert.Parameters.AddWithValue("phone", contact.Phone);
            insert.Parameters.AddWithValue("is_primary", contact.IsPrimary);
            insert.Parameters.AddWithValue("sort_order", contact.SortOrder);
            await insert.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private static async Task InsertAuditAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Client client, CurrentUser actor, string action, string description, string tone, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            insert into public.audit_records (record_id, module, action, entity, description, actor_id, actor_name, tone, status)
            values (@record_id, 'Clients', @action, @entity, @description, @actor_id, @actor_name, @tone, @status)
            """;
        command.Parameters.AddWithValue("record_id", client.Id);
        command.Parameters.AddWithValue("action", action);
        command.Parameters.AddWithValue("entity", client.Name);
        command.Parameters.AddWithValue("description", description);
        command.Parameters.AddWithValue("actor_id", actor.Id);
        command.Parameters.AddWithValue("actor_name", actor.Username);
        command.Parameters.AddWithValue("tone", tone);
        command.Parameters.AddWithValue("status", client.Status.ToString());
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<Client> GetAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid id, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = SelectSql + " where c.id=@id and c.deleted_at is null order by cc.sort_order, cc.created_at";
        command.Parameters.AddWithValue("id", id);
        return (await ReadAsync(command, cancellationToken)).Single();
    }

    private static async Task<IReadOnlyList<Client>> ReadAsync(NpgsqlCommand command, CancellationToken cancellationToken)
    {
        var rows = new Dictionary<Guid, ClientRow>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var id = reader.GetGuid(0);
            if (!rows.TryGetValue(id, out var row))
            {
                row = new ClientRow(id, reader.GetString(1), reader.IsDBNull(2) ? null : reader.GetString(2), reader.GetString(3), reader.GetString(4), reader.GetFieldValue<DateOnly>(5), Enum.Parse<ClientStatus>(reader.GetString(6)), reader.GetFieldValue<DateTimeOffset>(7), reader.GetFieldValue<DateTimeOffset>(8), reader.IsDBNull(9) ? null : reader.GetFieldValue<DateTimeOffset>(9), reader.GetInt64(10));
                rows.Add(id, row);
            }
            if (!reader.IsDBNull(11)) row.Contacts.Add(ClientContact.Create(reader.GetGuid(11), reader.GetString(12), reader.GetString(13), reader.GetString(14), reader.GetBoolean(15), reader.GetInt32(16)));
        }
        return rows.Values.Select(row => Client.Rehydrate(row.Id, row.Name, row.PhotoPath, row.Address, row.Industry, row.ClientSince, row.Status, row.Contacts, row.CreatedAt, row.UpdatedAt, row.ArchivedAt, row.Version)).ToArray();
    }

    private sealed record ClientRow(Guid Id, string Name, string? PhotoPath, string Address, string Industry, DateOnly ClientSince, ClientStatus Status, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DateTimeOffset? ArchivedAt, long Version)
    {
        public List<ClientContact> Contacts { get; } = [];
    }
}
