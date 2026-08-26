using AdielSystem.Application.Security;
using AdielSystem.Domain.Tasks;

namespace AdielSystem.Application.Tasks;

public interface ITaskRepository
{
    Task<TaskSearchResult> SearchAsync(TaskSearchCriteria criteria, CancellationToken cancellationToken);
    Task<WorkTask?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> ProfileExistsAsync(Guid id, CancellationToken cancellationToken);
    Task<WorkTask> CreateAsync(WorkTask task, CurrentUser actor, CancellationToken cancellationToken);
    Task<WorkTask> UpdateAsync(WorkTask task, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken);
    Task<WorkTask> ChangeStatusAsync(Guid id, WorkTaskStatus target, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken);
    Task<WorkTask> SetArchivedAsync(Guid id, long expectedVersion, bool archived, CurrentUser actor, CancellationToken cancellationToken);
    Task<WorkTask> AddSubtaskAsync(Guid taskId, string title, long taskVersion, CurrentUser actor, CancellationToken cancellationToken);
    Task<WorkTask> UpdateSubtaskAsync(Guid taskId, Guid subtaskId, string title, long subtaskVersion, long taskVersion, CurrentUser actor, CancellationToken cancellationToken);
    Task<WorkTask> SetSubtaskCompletionAsync(Guid taskId, Guid subtaskId, bool completed, long subtaskVersion, long taskVersion, CurrentUser actor, CancellationToken cancellationToken);
    Task<WorkTask> RemoveSubtaskAsync(Guid taskId, Guid subtaskId, long subtaskVersion, long taskVersion, CurrentUser actor, CancellationToken cancellationToken);
}

public sealed record TaskSearchCriteria(string Search, string? Status, string? Priority, bool IncludeArchived, bool ArchivedOnly);
public sealed record TaskSearchResult(IReadOnlyList<WorkTask> Items, long Total);
