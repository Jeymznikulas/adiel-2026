namespace AdielSystem.Domain.Tasks;

public sealed class Subtask
{
    private Subtask() { }

    public Guid Id { get; private set; }
    public Guid TaskId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public bool IsCompleted { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public int Position { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public long Version { get; private set; }

    public static Subtask Create(Guid id, Guid taskId, string title, int position, DateTimeOffset occurredAt)
    {
        if (taskId == Guid.Empty) throw new ArgumentException("A parent task is required.", nameof(taskId));
        if (position <= 0) throw new ArgumentOutOfRangeException(nameof(position), "Subtask position must be greater than zero.");
        return new Subtask { Id = id == Guid.Empty ? Guid.NewGuid() : id, TaskId = taskId, Title = NormalizeTitle(title), Position = position, CreatedAt = occurredAt, UpdatedAt = occurredAt, Version = 1 };
    }

    public static Subtask Rehydrate(Guid id, Guid taskId, string title, bool isCompleted, DateTimeOffset? completedAt, int position, DateTimeOffset createdAt, DateTimeOffset updatedAt, long version)
    {
        if ((isCompleted) != (completedAt is not null)) throw new ArgumentException("Subtask completion state is inconsistent.");
        if (version <= 0) throw new ArgumentOutOfRangeException(nameof(version));
        return new Subtask { Id = id, TaskId = taskId, Title = NormalizeTitle(title), IsCompleted = isCompleted, CompletedAt = completedAt, Position = position, CreatedAt = createdAt, UpdatedAt = updatedAt, Version = version };
    }

    public void Rename(string title) => Title = NormalizeTitle(title);

    public void SetCompletion(bool completed, DateTimeOffset occurredAt)
    {
        IsCompleted = completed;
        CompletedAt = completed ? occurredAt : null;
    }

    private static string NormalizeTitle(string? value)
    {
        var normalized = value?.Trim() ?? string.Empty;
        if (normalized.Length is 0 || normalized.Length > 200) throw new ArgumentException("Subtask titles must be between 1 and 200 characters.", nameof(value));
        return normalized;
    }
}
