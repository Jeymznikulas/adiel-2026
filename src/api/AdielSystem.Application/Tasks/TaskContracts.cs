namespace AdielSystem.Application.Tasks;

public sealed record SaveTaskRequest(string Title, string Description, string Priority, Guid? AssignedToId, string AssignedTo, DateOnly? DueDate, TimeOnly? DueTime, long? Version = null);
public sealed record CreateTaskRequest(string Title, string Description, string Status, string Priority, Guid? AssignedToId, string AssignedTo, DateOnly? DueDate, TimeOnly? DueTime);
public sealed record ChangeTaskStatusRequest(string Status, long Version);
public sealed record ChangeTaskArchiveRequest(long Version);
public sealed record CreateSubtaskRequest(string Title, long TaskVersion);
public sealed record UpdateSubtaskRequest(string Title, long Version, long TaskVersion);
public sealed record ChangeSubtaskCompletionRequest(bool Completed, long Version, long TaskVersion);
public sealed record RemoveSubtaskRequest(long Version, long TaskVersion);
public sealed record SubtaskDto(Guid Id, string Title, bool Completed, DateTimeOffset? CompletedAt, int Position, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, long Version);
public sealed record TaskDto(Guid Id, string Title, string Description, string Status, string Priority, Guid? AssignedToId, string AssignedTo, string AssignedBy, DateOnly? DueDate, TimeOnly? DueTime, DateTimeOffset? CompletedAt, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DateTimeOffset? ArchivedAt, long Version, IReadOnlyList<SubtaskDto> Subtasks);
public sealed record TaskPageDto(IReadOnlyList<TaskDto> Items, long Total);
