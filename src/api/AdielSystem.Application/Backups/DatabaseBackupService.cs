using AdielSystem.Application.Common;
using AdielSystem.Application.Security;

namespace AdielSystem.Application.Backups;

public sealed class DatabaseBackupService(IDatabaseBackupManager manager, ICurrentUserAccessor currentUserAccessor)
{
    public const long MaximumUploadBytes = 60L * 1024 * 1024;

    public Task<DatabaseBackupFile> CreateAsync(CancellationToken cancellationToken) =>
        manager.CreateAsync("Manual", currentUserAccessor.GetRequiredUser(), cancellationToken);

    public Task<IReadOnlyList<DatabaseBackupSummaryDto>> ListAsync(CancellationToken cancellationToken) =>
        manager.ListAsync(cancellationToken);

    public async Task<DatabaseBackupFile> GetAsync(Guid id, CancellationToken cancellationToken) =>
        await manager.GetAsync(id, cancellationToken) ?? throw new ResourceNotFoundException($"Database backup '{id}' was not found.");

    public Task<DatabaseBackupPreviewDto> ValidateAsync(byte[] archive, string fileName, CancellationToken cancellationToken)
    {
        ValidateUpload(archive, fileName);
        return manager.ValidateAsync(archive, SafeFileName(fileName), cancellationToken);
    }

    public Task<DatabaseRestoreResultDto> RestoreAsync(byte[] archive, string fileName, string? confirmation, CancellationToken cancellationToken)
    {
        ValidateUpload(archive, fileName);
        if (!string.Equals(confirmation?.Trim(), "RESTORE", StringComparison.Ordinal))
            throw new RequestValidationException("Type RESTORE exactly to confirm replacement of the current business data.");
        return manager.RestoreAsync(archive, SafeFileName(fileName), currentUserAccessor.GetRequiredUser(), cancellationToken);
    }

    private static void ValidateUpload(byte[] archive, string fileName)
    {
        if (archive.Length == 0) throw new RequestValidationException("Choose a database backup ZIP file.");
        if (archive.LongLength > MaximumUploadBytes) throw new RequestValidationException("The database backup exceeds the 60 MB upload limit.");
        if (!string.Equals(Path.GetExtension(fileName), ".zip", StringComparison.OrdinalIgnoreCase))
            throw new RequestValidationException("Database backups must be ZIP files created by this system.");
    }

    private static string SafeFileName(string fileName)
    {
        var safe = Path.GetFileName(fileName.Replace('\\', '/')).Trim();
        return string.IsNullOrWhiteSpace(safe) || safe.Length > 240
            ? throw new RequestValidationException("The backup file name is invalid.")
            : safe;
    }
}
