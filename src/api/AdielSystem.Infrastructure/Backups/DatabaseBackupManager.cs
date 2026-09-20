using System.Data;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AdielSystem.Application.Backups;
using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;

namespace AdielSystem.Infrastructure.Backups;

internal sealed class DatabaseBackupManager(NpgsqlDataSource dataSource, ILogger<DatabaseBackupManager> logger) : IDatabaseBackupManager
{
    private const string ArchiveFormat = "adiel-database-backup";
    private const int ArchiveVersion = 1;
    private const long MaximumExpandedBytes = 256L * 1024 * 1024;
    private const int MaximumManifestBytes = 1024 * 1024;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private static readonly string[] Tables =
    [
        "company_settings", "document_defaults", "document_numbering_rules", "document_sequences",
        "business_options", "clients", "client_contacts", "suppliers", "supplier_contacts",
        "supplier_categories", "supplier_performance_notes", "items", "item_variants",
        "item_variant_specifications", "item_price_adjustments", "quotations", "quotation_lines",
        "quotation_charges", "purchase_orders", "purchase_order_lines", "purchase_order_charges",
        "purchase_order_payments", "expenses", "statements_of_account", "statement_quotations",
        "statement_items", "statement_quotation_charges", "payment_schedules", "statement_late_charges",
        "statement_payments", "tasks", "subtasks", "audit_records"
    ];
    private static readonly HashSet<string> TableSet = Tables.ToHashSet(StringComparer.Ordinal);
    private readonly SemaphoreSlim operationGate = new(1, 1);

    public async Task<DatabaseBackupFile> CreateAsync(string kind, CurrentUser actor, CancellationToken cancellationToken)
    {
        await EnterAsync(cancellationToken);
        try { return await CreateCoreAsync(kind, actor, cancellationToken); }
        finally { operationGate.Release(); }
    }

    public async Task<IReadOnlyList<DatabaseBackupSummaryDto>> ListAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            select id, kind, file_name, created_at, created_by_name, schema_fingerprint,
                   table_count, row_count, size_bytes, archive_sha256
            from public.system_backups
            order by created_at desc
            limit 50
            """;
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var results = new List<DatabaseBackupSummaryDto>();
        while (await reader.ReadAsync(cancellationToken)) results.Add(ReadSummary(reader));
        return results;
    }

    public async Task<DatabaseBackupFile?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        const string sql = """
            select id, kind, file_name, created_at, created_by_name, schema_fingerprint,
                   table_count, row_count, size_bytes, archive_sha256, archive_data
            from public.system_backups
            where id = @id
            """;
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", id);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken)
            ? new DatabaseBackupFile(ReadSummary(reader), reader.GetFieldValue<byte[]>(10))
            : null;
    }

    public async Task<DatabaseBackupPreviewDto> ValidateAsync(byte[] archive, string fileName, CancellationToken cancellationToken)
    {
        await EnterAsync(cancellationToken);
        try { return (await ValidateArchiveAsync(archive, fileName, cancellationToken)).Preview; }
        finally { operationGate.Release(); }
    }

    public async Task<DatabaseRestoreResultDto> RestoreAsync(byte[] archive, string fileName, CurrentUser actor, CancellationToken cancellationToken)
    {
        await EnterAsync(cancellationToken);
        try
        {
            var source = await ValidateArchiveAsync(archive, fileName, cancellationToken);
            var safetyBackup = await CreateCoreAsync("Pre-restore", actor, cancellationToken);
            var restoredAt = DateTimeOffset.UtcNow;

            await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
            await using var transaction = await connection.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
            try
            {
                await using (var prepare = new NpgsqlCommand("select public.prepare_database_restore()", connection, transaction))
                {
                    prepare.CommandTimeout = 120;
                    await prepare.ExecuteNonQueryAsync(cancellationToken);
                }

                foreach (var tableName in Tables)
                {
                    var table = source.Manifest.Tables.Single(candidate => candidate.Name == tableName);
                    var payload = Encoding.UTF8.GetString(source.TableContents[tableName]);
                    await using var restore = new NpgsqlCommand("select public.restore_database_table(@table_name, @payload)", connection, transaction);
                    restore.CommandTimeout = 120;
                    restore.Parameters.AddWithValue("table_name", tableName);
                    restore.Parameters.Add(new NpgsqlParameter("payload", NpgsqlDbType.Jsonb) { Value = payload });
                    var restoredRows = Convert.ToInt64(await restore.ExecuteScalarAsync(cancellationToken), System.Globalization.CultureInfo.InvariantCulture);
                    if (restoredRows != table.RowCount)
                        throw new InvalidDataException($"The restored row count for {tableName} did not match the backup manifest.");
                }

                const string historySql = """
                    insert into public.system_restore_history
                      (source_file_name, source_created_at, restored_at, restored_by, restored_by_name,
                       safety_backup_id, schema_fingerprint, table_count, row_count)
                    values
                      (@file_name, @source_created_at, @restored_at, @actor_id, @actor_name,
                       @safety_backup_id, @schema_fingerprint, @table_count, @row_count)
                    """;
                await using var history = new NpgsqlCommand(historySql, connection, transaction);
                history.Parameters.AddWithValue("file_name", fileName);
                history.Parameters.AddWithValue("source_created_at", source.Manifest.CreatedAt);
                history.Parameters.AddWithValue("restored_at", restoredAt);
                history.Parameters.AddWithValue("actor_id", actor.Id);
                history.Parameters.AddWithValue("actor_name", actor.Username);
                history.Parameters.AddWithValue("safety_backup_id", safetyBackup.Summary.Id);
                history.Parameters.AddWithValue("schema_fingerprint", source.Manifest.SchemaFingerprint);
                history.Parameters.AddWithValue("table_count", source.Manifest.Tables.Count);
                history.Parameters.AddWithValue("row_count", source.Manifest.TotalRows);
                await history.ExecuteNonQueryAsync(cancellationToken);

                await transaction.CommitAsync(cancellationToken);
            }
            catch (Exception exception) when (exception is PostgresException or InvalidDataException)
            {
                await transaction.RollbackAsync(CancellationToken.None);
                logger.LogError(exception, "Database restore failed after safety backup {SafetyBackupId} was created.", safetyBackup.Summary.Id);
                throw new ResourceConflictException($"The restore failed and no business data was changed. Safety backup {safetyBackup.Summary.FileName} is available in Backup History.");
            }

            return new DatabaseRestoreResultDto(restoredAt, fileName, source.Manifest.TotalRows, safetyBackup.Summary);
        }
        finally { operationGate.Release(); }
    }

    private async Task<DatabaseBackupFile> CreateCoreAsync(string kind, CurrentUser actor, CancellationToken cancellationToken)
    {
        if (kind is not ("Manual" or "Pre-restore")) throw new ArgumentOutOfRangeException(nameof(kind));
        var createdAt = DateTimeOffset.UtcNow;
        var fileName = $"adiel-database-{createdAt:yyyyMMdd-HHmmss}-{Guid.NewGuid():N}.zip";
        var tableContents = new List<(BackupTableManifest Manifest, byte[] Content)>(Tables.Length);

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(IsolationLevel.RepeatableRead, cancellationToken);
        var fingerprint = await GetSchemaFingerprintAsync(connection, transaction, cancellationToken);
        long expandedBytes = 0;
        long totalRows = 0;

        foreach (var tableName in Tables)
        {
            var sql = $"select count(*)::bigint, coalesce(jsonb_agg(to_jsonb(source)), '[]'::jsonb)::text from public.{tableName} source";
            await using var command = new NpgsqlCommand(sql, connection, transaction) { CommandTimeout = 120 };
            await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SingleRow, cancellationToken);
            await reader.ReadAsync(cancellationToken);
            var rowCount = reader.GetInt64(0);
            var content = Encoding.UTF8.GetBytes(reader.GetString(1));
            expandedBytes = checked(expandedBytes + content.LongLength);
            totalRows = checked(totalRows + rowCount);
            if (expandedBytes > MaximumExpandedBytes)
                throw new ResourceConflictException("The database backup is larger than the supported 256 MB expanded limit.");
            var entryName = $"tables/{tableName}.json";
            var manifest = new BackupTableManifest(tableName, entryName, rowCount, content.LongLength, Sha256(content));
            tableContents.Add((manifest, content));
        }

        var archiveManifest = new BackupManifest(ArchiveFormat, ArchiveVersion, createdAt, fingerprint, totalRows, tableContents.Select(item => item.Manifest).ToArray());
        var archiveBytes = CreateZip(archiveManifest, tableContents);
        var archiveHash = Sha256(archiveBytes);

        const string insertSql = """
            insert into public.system_backups
              (kind, file_name, created_at, created_by, created_by_name, schema_fingerprint,
               table_count, row_count, size_bytes, archive_sha256, archive_data)
            values
              (@kind, @file_name, @created_at, @created_by, @created_by_name, @schema_fingerprint,
               @table_count, @row_count, @size_bytes, @archive_sha256, @archive_data)
            returning id
            """;
        await using var insert = new NpgsqlCommand(insertSql, connection, transaction);
        insert.Parameters.AddWithValue("kind", kind);
        insert.Parameters.AddWithValue("file_name", fileName);
        insert.Parameters.AddWithValue("created_at", createdAt);
        insert.Parameters.AddWithValue("created_by", actor.Id);
        insert.Parameters.AddWithValue("created_by_name", actor.Username);
        insert.Parameters.AddWithValue("schema_fingerprint", fingerprint);
        insert.Parameters.AddWithValue("table_count", Tables.Length);
        insert.Parameters.AddWithValue("row_count", totalRows);
        insert.Parameters.AddWithValue("size_bytes", archiveBytes.LongLength);
        insert.Parameters.AddWithValue("archive_sha256", archiveHash);
        insert.Parameters.AddWithValue("archive_data", archiveBytes);
        var id = (Guid)(await insert.ExecuteScalarAsync(cancellationToken) ?? throw new InvalidOperationException("The database backup record was not created."));
        await transaction.CommitAsync(cancellationToken);

        var summary = new DatabaseBackupSummaryDto(id, kind, fileName, createdAt, actor.Username, fingerprint, Tables.Length, totalRows, archiveBytes.LongLength, archiveHash);
        return new DatabaseBackupFile(summary, archiveBytes);
    }

    private async Task<ValidatedArchive> ValidateArchiveAsync(byte[] archiveBytes, string fileName, CancellationToken cancellationToken)
    {
        try
        {
            using var archiveStream = new MemoryStream(archiveBytes, writable: false);
            using var archive = new ZipArchive(archiveStream, ZipArchiveMode.Read, leaveOpen: false);
            if (archive.Entries.Count != Tables.Length + 1) throw new InvalidDataException("The backup has an unexpected number of files.");
            if (archive.Entries.GroupBy(entry => entry.FullName, StringComparer.Ordinal).Any(group => group.Count() != 1))
                throw new InvalidDataException("The backup contains duplicate files.");

            var manifestEntry = archive.GetEntry("manifest.json") ?? throw new InvalidDataException("The backup manifest is missing.");
            if (manifestEntry.Length is <= 0 or > MaximumManifestBytes) throw new InvalidDataException("The backup manifest size is invalid.");
            var manifestBytes = await ReadEntryAsync(manifestEntry, MaximumManifestBytes, cancellationToken);
            var manifest = JsonSerializer.Deserialize<BackupManifest>(manifestBytes, JsonOptions) ?? throw new InvalidDataException("The backup manifest is invalid.");
            if (manifest.Format != ArchiveFormat || manifest.Version != ArchiveVersion) throw new InvalidDataException("This backup format is not supported.");
            if (manifest.Tables.Count != Tables.Length || manifest.Tables.Select(table => table.Name).ToHashSet(StringComparer.Ordinal).SetEquals(TableSet) is false)
                throw new InvalidDataException("The backup table list is incomplete.");
            if (manifest.Tables.Any(table => table.RowCount < 0 || table.SizeBytes < 2 || !string.Equals(table.EntryName, $"tables/{table.Name}.json", StringComparison.Ordinal)))
                throw new InvalidDataException("The backup table metadata is invalid.");

            long expandedBytes = manifestBytes.LongLength;
            long totalRows = 0;
            var contents = new Dictionary<string, byte[]>(StringComparer.Ordinal);
            foreach (var tableName in Tables)
            {
                var table = manifest.Tables.Single(candidate => candidate.Name == tableName);
                var entry = archive.GetEntry(table.EntryName) ?? throw new InvalidDataException($"The backup data for {tableName} is missing.");
                if (entry.Length != table.SizeBytes) throw new InvalidDataException($"The backup data size for {tableName} does not match its manifest.");
                expandedBytes = checked(expandedBytes + entry.Length);
                totalRows = checked(totalRows + table.RowCount);
                if (expandedBytes > MaximumExpandedBytes) throw new InvalidDataException("The expanded backup exceeds the 256 MB safety limit.");
                var content = await ReadEntryAsync(entry, table.SizeBytes, cancellationToken);
                if (!CryptographicOperations.FixedTimeEquals(Convert.FromHexString(table.Sha256), SHA256.HashData(content)))
                    throw new InvalidDataException($"The backup checksum for {tableName} is invalid.");
                using var document = JsonDocument.Parse(content, new JsonDocumentOptions { MaxDepth = 64 });
                if (document.RootElement.ValueKind != JsonValueKind.Array || document.RootElement.GetArrayLength() != table.RowCount)
                    throw new InvalidDataException($"The backup row count for {tableName} is invalid.");
                contents.Add(tableName, content);
            }
            if (totalRows != manifest.TotalRows) throw new InvalidDataException("The backup total row count is invalid.");

            await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
            var currentFingerprint = await GetSchemaFingerprintAsync(connection, null, cancellationToken);
            if (!string.Equals(manifest.SchemaFingerprint, currentFingerprint, StringComparison.Ordinal))
                throw new ResourceConflictException("This backup was created with a different database structure and cannot be restored by the current application version.");

            var tableDtos = manifest.Tables.Select(table => new DatabaseBackupTableDto(table.Name, table.RowCount, table.SizeBytes, table.Sha256)).ToArray();
            var preview = new DatabaseBackupPreviewDto(fileName, manifest.CreatedAt, manifest.SchemaFingerprint, manifest.Tables.Count, manifest.TotalRows, archiveBytes.LongLength, tableDtos);
            return new ValidatedArchive(manifest, contents, preview);
        }
        catch (ResourceConflictException) { throw; }
        catch (Exception exception) when (exception is InvalidDataException or JsonException or FormatException or OverflowException)
        {
            throw new RequestValidationException("The selected file is not a valid, complete database backup created by this system.");
        }
    }

    private static byte[] CreateZip(BackupManifest manifest, IReadOnlyList<(BackupTableManifest Manifest, byte[] Content)> tables)
    {
        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            var manifestEntry = archive.CreateEntry("manifest.json", CompressionLevel.Optimal);
            using (var stream = manifestEntry.Open()) JsonSerializer.Serialize(stream, manifest, JsonOptions);
            foreach (var table in tables)
            {
                var entry = archive.CreateEntry(table.Manifest.EntryName, CompressionLevel.Optimal);
                using var stream = entry.Open();
                stream.Write(table.Content);
            }
        }
        return output.ToArray();
    }

    private async Task<string> GetSchemaFingerprintAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, CancellationToken cancellationToken)
    {
        const string sql = """
            select table_name, column_name, ordinal_position, data_type, udt_schema, udt_name,
                   is_nullable, coalesce(column_default, ''), is_generated, coalesce(identity_generation, '')
            from information_schema.columns
            where table_schema = 'public' and table_name = any(@tables)
            order by table_name, ordinal_position
            """;
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("tables", Tables);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var schema = new StringBuilder();
        var foundTables = new HashSet<string>(StringComparer.Ordinal);
        while (await reader.ReadAsync(cancellationToken))
        {
            foundTables.Add(reader.GetString(0));
            for (var index = 0; index < reader.FieldCount; index++) schema.Append(reader.GetValue(index)).Append('|');
            schema.AppendLine();
        }
        if (!foundTables.SetEquals(TableSet)) throw new ResourceConflictException("The database is missing one or more tables required for backup and restore. Apply the latest migrations first.");
        return Sha256(Encoding.UTF8.GetBytes(schema.ToString()));
    }

    private async Task EnterAsync(CancellationToken cancellationToken)
    {
        if (!await operationGate.WaitAsync(0, cancellationToken))
            throw new ResourceConflictException("Another database backup or restore operation is already running.");
    }

    private static async Task<byte[]> ReadEntryAsync(ZipArchiveEntry entry, long maximumBytes, CancellationToken cancellationToken)
    {
        if (maximumBytes > int.MaxValue) throw new InvalidDataException("A backup entry is too large.");
        await using var stream = entry.Open();
        using var output = new MemoryStream((int)maximumBytes);
        await stream.CopyToAsync(output, cancellationToken);
        if (output.Length != entry.Length || output.Length > maximumBytes) throw new InvalidDataException("A backup entry has an invalid size.");
        return output.ToArray();
    }

    private static DatabaseBackupSummaryDto ReadSummary(NpgsqlDataReader reader) => new(
        reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetFieldValue<DateTimeOffset>(3),
        reader.GetString(4), reader.GetString(5), reader.GetInt32(6), reader.GetInt64(7), reader.GetInt64(8), reader.GetString(9));

    private static string Sha256(byte[] value) => Convert.ToHexString(SHA256.HashData(value)).ToLowerInvariant();

    private sealed record BackupManifest(string Format, int Version, DateTimeOffset CreatedAt, string SchemaFingerprint, long TotalRows, IReadOnlyList<BackupTableManifest> Tables);
    private sealed record BackupTableManifest(string Name, string EntryName, long RowCount, long SizeBytes, string Sha256);
    private sealed record ValidatedArchive(BackupManifest Manifest, IReadOnlyDictionary<string, byte[]> TableContents, DatabaseBackupPreviewDto Preview);
}
