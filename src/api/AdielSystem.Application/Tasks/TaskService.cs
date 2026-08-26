using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using AdielSystem.Domain.Tasks;

namespace AdielSystem.Application.Tasks;

public sealed class TaskService(ITaskRepository repository, ICurrentUserAccessor currentUserAccessor)
{
    public async Task<TaskPageDto> ListAsync(string? search, string? status, string? priority, bool includeArchived, bool archivedOnly, CancellationToken token)
    {
        if (includeArchived && archivedOnly) throw new RequestValidationException("Choose either all tasks or archived tasks, not both.");
        var normalizedStatus = string.IsNullOrWhiteSpace(status) ? null : WorkTask.Display(ParseStatus(status));
        var normalizedPriority = string.IsNullOrWhiteSpace(priority) ? null : WorkTask.Display(ParsePriority(priority));
        var result = await repository.SearchAsync(new(search?.Trim() ?? string.Empty, normalizedStatus, normalizedPriority, includeArchived, archivedOnly), token);
        return new(result.Items.Select(ToDto).ToArray(), result.Total);
    }

    public async Task<TaskDto> GetAsync(Guid id, CancellationToken token) => ToDto(await GetRequiredAsync(id, token));

    public async Task<TaskDto> CreateAsync(CreateTaskRequest request, CancellationToken token)
    {
        var actor = currentUserAccessor.GetRequiredUser();
        await ValidateAssigneeAsync(request.AssignedToId, token);
        try
        {
            var task = WorkTask.Create(Guid.NewGuid(), request.Title, request.Description, ParsePriority(request.Priority), request.AssignedToId, request.AssignedTo, actor.Id, actor.Username, request.DueDate, DateTimeOffset.UtcNow);
            var status = ParseStatus(request.Status);
            if (status != WorkTaskStatus.ToDo) task.ChangeStatus(status, DateTimeOffset.UtcNow);
            return ToDto(await repository.CreateAsync(task, actor, token));
        }
        catch (Exception exception) when (exception is ArgumentException or InvalidOperationException) { throw new RequestValidationException(exception.Message); }
    }

    public async Task<TaskDto> UpdateAsync(Guid id, SaveTaskRequest request, CancellationToken token)
    {
        RequireVersion(request.Version);
        await ValidateAssigneeAsync(request.AssignedToId, token);
        var task = await GetRequiredAsync(id, token);
        try { task.UpdateDetails(request.Title, request.Description, ParsePriority(request.Priority), request.AssignedToId, request.AssignedTo, request.DueDate); }
        catch (Exception exception) when (exception is ArgumentException or InvalidOperationException) { throw new RequestValidationException(exception.Message); }
        return ToDto(await repository.UpdateAsync(task, request.Version!.Value, currentUserAccessor.GetRequiredUser(), token));
    }

    public async Task<TaskDto> ChangeStatusAsync(Guid id, ChangeTaskStatusRequest request, CancellationToken token)
    {
        RequireVersion(request.Version);
        try { return ToDto(await repository.ChangeStatusAsync(id, ParseStatus(request.Status), request.Version, currentUserAccessor.GetRequiredUser(), token)); }
        catch (InvalidOperationException exception) { throw new RequestValidationException(exception.Message); }
    }

    public Task<TaskDto> ArchiveAsync(Guid id, long version, CancellationToken token) => SetArchivedAsync(id, version, true, token);
    public Task<TaskDto> RestoreAsync(Guid id, long version, CancellationToken token) => SetArchivedAsync(id, version, false, token);

    public async Task<TaskDto> AddSubtaskAsync(Guid taskId, CreateSubtaskRequest request, CancellationToken token)
    {
        RequireVersion(request.TaskVersion);
        try { return ToDto(await repository.AddSubtaskAsync(taskId, request.Title, request.TaskVersion, currentUserAccessor.GetRequiredUser(), token)); }
        catch (Exception exception) when (exception is ArgumentException or InvalidOperationException) { throw new RequestValidationException(exception.Message); }
    }

    public async Task<TaskDto> UpdateSubtaskAsync(Guid taskId, Guid subtaskId, UpdateSubtaskRequest request, CancellationToken token)
    {
        RequireVersion(request.Version); RequireVersion(request.TaskVersion);
        try { return ToDto(await repository.UpdateSubtaskAsync(taskId, subtaskId, request.Title, request.Version, request.TaskVersion, currentUserAccessor.GetRequiredUser(), token)); }
        catch (Exception exception) when (exception is ArgumentException or InvalidOperationException) { throw new RequestValidationException(exception.Message); }
    }

    public async Task<TaskDto> SetSubtaskCompletionAsync(Guid taskId, Guid subtaskId, ChangeSubtaskCompletionRequest request, CancellationToken token)
    {
        RequireVersion(request.Version); RequireVersion(request.TaskVersion);
        try { return ToDto(await repository.SetSubtaskCompletionAsync(taskId, subtaskId, request.Completed, request.Version, request.TaskVersion, currentUserAccessor.GetRequiredUser(), token)); }
        catch (InvalidOperationException exception) { throw new RequestValidationException(exception.Message); }
    }

    public async Task<TaskDto> RemoveSubtaskAsync(Guid taskId, Guid subtaskId, RemoveSubtaskRequest request, CancellationToken token)
    {
        RequireVersion(request.Version); RequireVersion(request.TaskVersion);
        try { return ToDto(await repository.RemoveSubtaskAsync(taskId, subtaskId, request.Version, request.TaskVersion, currentUserAccessor.GetRequiredUser(), token)); }
        catch (InvalidOperationException exception) { throw new RequestValidationException(exception.Message); }
    }

    private async Task<TaskDto> SetArchivedAsync(Guid id, long version, bool archived, CancellationToken token)
    {
        RequireVersion(version);
        try { return ToDto(await repository.SetArchivedAsync(id, version, archived, currentUserAccessor.GetRequiredUser(), token)); }
        catch (InvalidOperationException exception) { throw new RequestValidationException(exception.Message); }
    }

    private async Task ValidateAssigneeAsync(Guid? assignedToId, CancellationToken token)
    {
        if (assignedToId is not null && !await repository.ProfileExistsAsync(assignedToId.Value, token)) throw new RequestValidationException("The selected assignee does not exist.");
    }

    private async Task<WorkTask> GetRequiredAsync(Guid id, CancellationToken token) => await repository.GetAsync(id, token) ?? throw new ResourceNotFoundException($"Task '{id}' was not found.");
    private static void RequireVersion(long? version) { if (version is null or <= 0) throw new RequestValidationException("The current task version is required."); }
    private static WorkTaskStatus ParseStatus(string? value) => value?.Trim() switch { "To do" => WorkTaskStatus.ToDo, "In progress" => WorkTaskStatus.InProgress, "Completed" => WorkTaskStatus.Completed, _ => throw new RequestValidationException("Task status must be To do, In progress, or Completed.") };
    private static WorkTaskPriority ParsePriority(string? value) => value?.Trim() switch { "Low" => WorkTaskPriority.Low, "Medium" => WorkTaskPriority.Medium, "High" => WorkTaskPriority.High, _ => throw new RequestValidationException("Task priority must be Low, Medium, or High.") };
    private static TaskDto ToDto(WorkTask task) => new(task.Id, task.Title, task.Description, WorkTask.Display(task.Status), WorkTask.Display(task.Priority), task.AssignedToId, task.AssignedToName, task.AssignedByName, task.DueDate, task.CompletedAt, task.CreatedAt, task.UpdatedAt, task.ArchivedAt, task.Version, task.Subtasks.Select(subtask => new SubtaskDto(subtask.Id, subtask.Title, subtask.IsCompleted, subtask.CompletedAt, subtask.Position, subtask.CreatedAt, subtask.UpdatedAt, subtask.Version)).ToArray());
}
