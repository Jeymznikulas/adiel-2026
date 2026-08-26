using System.Transactions;
using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using AdielSystem.Application.Storage;
using Npgsql;

namespace AdielSystem.Infrastructure.Storage;

internal sealed class ImageReferenceRepository(NpgsqlDataSource dataSource) : IImageReferenceRepository
{
    public async Task<ImageReference> GetAsync(BusinessImageKind kind, Guid entityId, Guid? variantId, CancellationToken token)
    {
        await using var connection = await dataSource.OpenConnectionAsync(token);
        var target = Target(kind, entityId, variantId);
        await using var command = connection.CreateCommand(); command.CommandText = target.SelectSql; AddIds(command, entityId, variantId);
        await using var reader = await command.ExecuteReaderAsync(token);
        if (!await reader.ReadAsync(token)) throw new ResourceNotFoundException("The image target was not found.");
        return new(reader.IsDBNull(0) ? null : reader.GetString(0), reader.GetInt64(1));
    }

    public async Task<ImageReference> ReplaceAsync(BusinessImageKind kind, Guid entityId, Guid? variantId, string? objectPath, long expectedVersion, CurrentUser actor, CancellationToken token)
    {
        await using var connection = await dataSource.OpenConnectionAsync(token);
        await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(token) : null;
        var target = Target(kind, entityId, variantId);
        string? previous; string entity;
        await using (var select = connection.CreateCommand())
        {
            select.Transaction = transaction; select.CommandText = target.LockSql; AddIds(select, entityId, variantId);
            await using var reader = await select.ExecuteReaderAsync(token);
            if (!await reader.ReadAsync(token)) throw new ResourceNotFoundException("The image target was not found.");
            previous = reader.IsDBNull(0) ? null : reader.GetString(0); var currentVersion = reader.GetInt64(1); entity = reader.GetString(2);
            if (currentVersion != expectedVersion) throw new ConcurrencyConflictException("This record changed after you opened it. Reload and try again.");
        }
        long newVersion;
        await using (var update = connection.CreateCommand())
        {
            update.Transaction = transaction; update.CommandText = target.UpdateSql; AddIds(update, entityId, variantId); update.Parameters.AddWithValue("photo_url", (object?)objectPath ?? DBNull.Value); update.Parameters.AddWithValue("version", expectedVersion); update.Parameters.AddWithValue("actor_id", actor.Id);
            var value = await update.ExecuteScalarAsync(token); if (value is null) throw new ConcurrencyConflictException("This record changed after you opened it. Reload and try again."); newVersion = (long)value;
        }
        await using (var audit = connection.CreateCommand())
        {
            audit.Transaction = transaction; audit.CommandText = "insert into public.audit_records(record_id,module,action,entity,description,actor_id,actor_name,tone) values(@record_id,@module,'Updated',@entity,@description,@actor_id,@actor_name,'info')";
            audit.Parameters.AddWithValue("record_id", variantId ?? entityId); audit.Parameters.AddWithValue("module", target.Module); audit.Parameters.AddWithValue("entity", entity); audit.Parameters.AddWithValue("description", objectPath is null ? "Private image removed." : previous is null ? "Private image uploaded." : "Private image replaced."); audit.Parameters.AddWithValue("actor_id", actor.Id); audit.Parameters.AddWithValue("actor_name", actor.Username); await audit.ExecuteNonQueryAsync(token);
        }
        if (transaction is not null) await transaction.CommitAsync(token);
        return new(objectPath, newVersion, previous);
    }

    private static TargetSql Target(BusinessImageKind kind, Guid entityId, Guid? variantId) => kind switch
    {
        BusinessImageKind.Client => new("Clients", "select photo_url,version from public.clients where id=@id and deleted_at is null", "select photo_url,version,name from public.clients where id=@id and archived_at is null and deleted_at is null for update", "update public.clients set photo_url=@photo_url,updated_by=@actor_id where id=@id and archived_at is null and deleted_at is null and version=@version returning version"),
        BusinessImageKind.Supplier => new("Suppliers", "select logo_url,version from public.suppliers where id=@id and deleted_at is null", "select logo_url,version,name from public.suppliers where id=@id and archived_at is null and deleted_at is null for update", "update public.suppliers set logo_url=@photo_url,updated_by=@actor_id where id=@id and archived_at is null and deleted_at is null and version=@version returning version"),
        BusinessImageKind.Item => new("Items", "select photo_url,version from public.items where id=@id and deleted_at is null", "select photo_url,version,name from public.items where id=@id and archived_at is null and deleted_at is null for update", "update public.items set photo_url=@photo_url,updated_by=@actor_id where id=@id and archived_at is null and deleted_at is null and version=@version returning version"),
        BusinessImageKind.Variant when variantId.HasValue => new("Items", "select v.photo_url,v.version from public.item_variants v join public.items i on i.id=v.item_id where i.id=@id and v.id=@variant_id and i.deleted_at is null", "select v.photo_url,v.version,i.name||' - '||v.name||': '||v.value from public.item_variants v join public.items i on i.id=v.item_id where i.id=@id and v.id=@variant_id and i.archived_at is null and i.deleted_at is null for update of v", "update public.item_variants set photo_url=@photo_url where id=@variant_id and item_id=@id and version=@version returning version"),
        _ => throw new RequestValidationException("The image target is invalid.")
    };
    private static void AddIds(NpgsqlCommand command, Guid id, Guid? variantId) { command.Parameters.AddWithValue("id", id); if (variantId.HasValue) command.Parameters.AddWithValue("variant_id", variantId.Value); }
    private sealed record TargetSql(string Module, string SelectSql, string LockSql, string UpdateSql);
}
