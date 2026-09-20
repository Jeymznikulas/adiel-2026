using AdielSystem.Application.Security;

namespace AdielSystem.Application.Backups;

public sealed record DatabaseBackupTableDto(string Name, long RowCount, long SizeBytes, string Sha256);

public sealed record DatabaseBackupPreviewDto(
    string FileName,
    DateTimeOffset CreatedAt,
    string SchemaFingerprint,
    int TableCount,
    long RowCount,
    long SizeBytes,
    IReadOnlyList<DatabaseBackupTableDto> Tables);

public sealed record DatabaseBackupSummaryDto(
    Guid Id,
    string Kind,
    string FileName,
    DateTimeOffset CreatedAt,
    string CreatedByName,
    string SchemaFingerprint,
    int TableCount,
    long RowCount,
    long SizeBytes,
    string Sha256);

public sealed record DatabaseBackupFile(DatabaseBackupSummaryDto Summary, byte[] Content);

public sealed record DatabaseRestoreResultDto(
    DateTimeOffset RestoredAt,
    string SourceFileName,
    long RowCount,
    DatabaseBackupSummaryDto SafetyBackup);

public interface IDatabaseBackupManager
{
    Task<DatabaseBackupFile> CreateAsync(string kind, CurrentUser actor, CancellationToken cancellationToken);
    Task<IReadOnlyList<DatabaseBackupSummaryDto>> ListAsync(CancellationToken cancellationToken);
    Task<DatabaseBackupFile?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<DatabaseBackupPreviewDto> ValidateAsync(byte[] archive, string fileName, CancellationToken cancellationToken);
    Task<DatabaseRestoreResultDto> RestoreAsync(byte[] archive, string fileName, CurrentUser actor, CancellationToken cancellationToken);
}
