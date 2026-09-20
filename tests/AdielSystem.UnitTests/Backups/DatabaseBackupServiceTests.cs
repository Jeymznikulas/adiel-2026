using AdielSystem.Application.Backups;
using AdielSystem.Application.Common;
using AdielSystem.Application.Security;

namespace AdielSystem.UnitTests.Backups;

public sealed class DatabaseBackupServiceTests
{
    [Fact]
    public async Task Restore_requires_the_exact_confirmation_phrase()
    {
        var manager = new FakeBackupManager();
        var service = new DatabaseBackupService(manager, new FakeCurrentUser());

        await Assert.ThrowsAsync<RequestValidationException>(() => service.RestoreAsync([1], "backup.zip", "restore", TestContext.Current.CancellationToken));
        Assert.False(manager.RestoreCalled);
    }

    [Fact]
    public async Task Restore_rejects_files_that_are_not_system_zip_archives()
    {
        var manager = new FakeBackupManager();
        var service = new DatabaseBackupService(manager, new FakeCurrentUser());

        await Assert.ThrowsAsync<RequestValidationException>(() => service.RestoreAsync([1], "backup.sql", "RESTORE", TestContext.Current.CancellationToken));
        Assert.False(manager.RestoreCalled);
    }

    [Fact]
    public async Task Valid_restore_passes_the_owner_and_safe_file_name_to_the_manager()
    {
        var manager = new FakeBackupManager();
        var service = new DatabaseBackupService(manager, new FakeCurrentUser());

        await service.RestoreAsync([1], "C:\\fake-path\\backup.zip", "RESTORE", TestContext.Current.CancellationToken);

        Assert.True(manager.RestoreCalled);
        Assert.Equal("backup.zip", manager.RestoreFileName);
        Assert.Equal(Guid.Parse("11111111-1111-1111-1111-111111111111"), manager.RestoreActor?.Id);
    }

    private sealed class FakeCurrentUser : ICurrentUserAccessor
    {
        public CurrentUser GetRequiredUser() => new(Guid.Parse("11111111-1111-1111-1111-111111111111"), "owner");
    }

    private sealed class FakeBackupManager : IDatabaseBackupManager
    {
        public bool RestoreCalled { get; private set; }
        public string? RestoreFileName { get; private set; }
        public CurrentUser? RestoreActor { get; private set; }

        public Task<DatabaseBackupFile> CreateAsync(string kind, CurrentUser actor, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<IReadOnlyList<DatabaseBackupSummaryDto>> ListAsync(CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<DatabaseBackupFile?> GetAsync(Guid id, CancellationToken cancellationToken) => throw new NotImplementedException();
        public Task<DatabaseBackupPreviewDto> ValidateAsync(byte[] archive, string fileName, CancellationToken cancellationToken) => throw new NotImplementedException();

        public Task<DatabaseRestoreResultDto> RestoreAsync(byte[] archive, string fileName, CurrentUser actor, CancellationToken cancellationToken)
        {
            RestoreCalled = true;
            RestoreFileName = fileName;
            RestoreActor = actor;
            var summary = new DatabaseBackupSummaryDto(Guid.NewGuid(), "Pre-restore", "safety.zip", DateTimeOffset.UtcNow, actor.Username, new string('0', 64), 1, 0, 1, new string('0', 64));
            return Task.FromResult(new DatabaseRestoreResultDto(DateTimeOffset.UtcNow, fileName, 0, summary));
        }
    }
}
