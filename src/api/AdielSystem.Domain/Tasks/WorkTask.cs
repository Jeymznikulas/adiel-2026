using AdielSystem.Domain.Common;

namespace AdielSystem.Domain.Tasks;

public sealed class WorkTask : Entity
{
    private WorkTask() { }

    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public WorkTaskStatus Status { get; private set; }
    public WorkTaskPriority Priority { get; private set; }
    public Guid? AssignedToId { get; private set; }
    public string AssignedToName { get; private set; } = string.Empty;
    public Guid? AssignedById { get; private set; }
    public string AssignedByName { get; private set; } = string.Empty;
    public DateOnly? DueDate { get; private set; }
    public TimeOnly? DueTime { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? ArchivedAt { get; private set; }
    public long Version { get; private set; }
    public IReadOnlyList<Subtask> Subtasks { get; private set; } = [];

    public static WorkTask Create(Guid id, string title, string description, WorkTaskPriority priority, Guid? assignedToId, string assignedToName, Guid assignedById, string assignedByName, DateOnly? dueDate, TimeOnly? dueTime, DateTimeOffset occurredAt)
    {
        if (dueDate is not null && dueDate < DateOnly.FromDateTime(occurredAt.UtcDateTime))
            throw new ArgumentException("A new task due date cannot be in the past.", nameof(dueDate));

        var task = new WorkTask
        {
            Id = id == Guid.Empty ? Guid.NewGuid() : id,
            Status = WorkTaskStatus.ToDo,
            AssignedById = assignedById == Guid.Empty ? throw new ArgumentException("An assigning owner is required.", nameof(assignedById)) : assignedById,
            AssignedByName = Required(assignedByName, nameof(assignedByName), 200),
            CreatedAt = occurredAt,
            UpdatedAt = occurredAt,
            Version = 1,
        };
        task.UpdateDetails(title, description, priority, assignedToId, assignedToName, dueDate, dueTime);
        return task;
    }

    public static WorkTask Rehydrate(Guid id, string title, string description, WorkTaskStatus status, WorkTaskPriority priority, Guid? assignedToId, string assignedToName, Guid? assignedById, string assignedByName, DateOnly? dueDate, TimeOnly? dueTime, DateTimeOffset? completedAt, DateTimeOffset createdAt, DateTimeOffset updatedAt, DateTimeOffset? archivedAt, long version, IEnumerable<Subtask> subtasks)
    {
        if (id == Guid.Empty || version <= 0) throw new ArgumentException("Persisted task identity and version are required.");
        var task = new WorkTask
        {
            Id = id,
            Status = status,
            AssignedById = assignedById,
            AssignedByName = Required(assignedByName, nameof(assignedByName), 200),
            CompletedAt = completedAt,
            CreatedAt = createdAt,
            UpdatedAt = updatedAt,
            ArchivedAt = archivedAt,
            Version = version,
            Subtasks = subtasks.OrderBy(subtask => subtask.Position).ToArray(),
        };
        task.SetDetails(title, description, priority, assignedToId, assignedToName, dueDate, dueTime);
        if ((status == WorkTaskStatus.Completed) != (completedAt is not null)) throw new ArgumentException("Task completion state is inconsistent.");
        return task;
    }

    public void UpdateDetails(string title, string description, WorkTaskPriority priority, Guid? assignedToId, string assignedToName, DateOnly? dueDate, TimeOnly? dueTime)
    {
        EnsureEditable();
        SetDetails(title, description, priority, assignedToId, assignedToName, dueDate, dueTime);
    }

    public void ChangeStatus(WorkTaskStatus target, DateTimeOffset occurredAt)
    {
        EnsureEditable();
        if (target == Status) return;
        var valid = (Status, target) switch
        {
            (WorkTaskStatus.ToDo, WorkTaskStatus.InProgress) => true,
            (WorkTaskStatus.InProgress, WorkTaskStatus.ToDo or WorkTaskStatus.Completed) => true,
            (WorkTaskStatus.Completed, WorkTaskStatus.InProgress) => true,
            _ => false,
        };
        if (!valid) throw new InvalidOperationException($"Task status cannot change from {Display(Status)} to {Display(target)}.");
        if (target == WorkTaskStatus.Completed && Subtasks.Any(subtask => !subtask.IsCompleted))
            throw new InvalidOperationException("Complete every subtask before completing the task.");
        Status = target;
        CompletedAt = target == WorkTaskStatus.Completed ? occurredAt : null;
    }

    public void Archive(DateTimeOffset occurredAt)
    {
        if (ArchivedAt is not null) throw new InvalidOperationException("The task is already archived.");
        ArchivedAt = occurredAt;
    }

    public void Restore()
    {
        if (ArchivedAt is null) throw new InvalidOperationException("The task is not archived.");
        ArchivedAt = null;
    }

    public void EnsureSubtasksCanChange()
    {
        EnsureEditable();
        if (Status == WorkTaskStatus.Completed) throw new InvalidOperationException("Reopen the task before changing its subtasks.");
    }

    private void EnsureEditable()
    {
        if (ArchivedAt is not null) throw new InvalidOperationException("Restore the task before changing it.");
    }

    private void SetDetails(string title, string description, WorkTaskPriority priority, Guid? assignedToId, string assignedToName, DateOnly? dueDate, TimeOnly? dueTime)
    {
        if (dueTime is not null && dueDate is null) throw new ArgumentException("A task due time requires a due date.", nameof(dueTime));
        Title = Required(title, nameof(title), 200);
        Description = Optional(description, nameof(description), 4000);
        Priority = priority;
        AssignedToId = assignedToId;
        AssignedToName = Required(assignedToName, nameof(assignedToName), 200);
        DueDate = dueDate;
        DueTime = dueTime;
    }

    private static string Required(string? value, string parameterName, int maximumLength)
    {
        var normalized = value?.Trim() ?? string.Empty;
        if (normalized.Length is 0 || normalized.Length > maximumLength) throw new ArgumentException($"The value must be between 1 and {maximumLength} characters.", parameterName);
        return normalized;
    }

    private static string Optional(string? value, string parameterName, int maximumLength)
    {
        var normalized = value?.Trim() ?? string.Empty;
        if (normalized.Length > maximumLength) throw new ArgumentException($"The value cannot exceed {maximumLength} characters.", parameterName);
        return normalized;
    }

    public static string Display(WorkTaskStatus status) => status switch { WorkTaskStatus.ToDo => "To do", WorkTaskStatus.InProgress => "In progress", _ => "Completed" };
    public static string Display(WorkTaskPriority priority) => priority.ToString();
}

public enum WorkTaskStatus { ToDo, InProgress, Completed }
public enum WorkTaskPriority { Low, Medium, High }
