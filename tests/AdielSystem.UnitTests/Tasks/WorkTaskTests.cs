using AdielSystem.Domain.Tasks;

namespace AdielSystem.UnitTests.Tasks;

public sealed class WorkTaskTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 26, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid OwnerId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    [Fact]
    public void Task_details_are_normalized_and_due_schedule_is_retained()
    {
        var dueDate = new DateOnly(2026, 8, 30);
        var dueTime = new TimeOnly(14, 30);
        var task = WorkTask.Create(Guid.NewGuid(), "  Prepare quote  ", "  Confirm pricing  ", WorkTaskPriority.High, null, "  Alex Morgan  ", OwnerId, "owner", dueDate, dueTime, Now);

        Assert.Equal("Prepare quote", task.Title);
        Assert.Equal("Confirm pricing", task.Description);
        Assert.Equal(WorkTaskPriority.High, task.Priority);
        Assert.Equal(dueDate, task.DueDate);
        Assert.Equal(dueTime, task.DueTime);
    }

    [Fact]
    public void New_task_due_date_cannot_be_in_the_past()
    {
        Assert.Throws<ArgumentException>(() => WorkTask.Create(Guid.NewGuid(), "Task", "", WorkTaskPriority.Medium, null, "Alex", OwnerId, "owner", new DateOnly(2026, 8, 25), null, Now));
    }

    [Fact]
    public void Task_due_time_requires_a_due_date()
    {
        Assert.Throws<ArgumentException>(() => WorkTask.Create(Guid.NewGuid(), "Task", "", WorkTaskPriority.Medium, null, "Alex", OwnerId, "owner", null, new TimeOnly(9, 0), Now));
    }

    [Fact]
    public void Task_follows_forward_completion_and_reopen_transitions()
    {
        var task = CreateTask();
        task.ChangeStatus(WorkTaskStatus.InProgress, Now.AddMinutes(1));
        task.ChangeStatus(WorkTaskStatus.Completed, Now.AddMinutes(2));
        Assert.Equal(Now.AddMinutes(2), task.CompletedAt);

        task.ChangeStatus(WorkTaskStatus.InProgress, Now.AddMinutes(3));
        Assert.Null(task.CompletedAt);
    }

    [Fact]
    public void To_do_task_cannot_skip_directly_to_completed()
    {
        var exception = Assert.Throws<InvalidOperationException>(() => CreateTask().ChangeStatus(WorkTaskStatus.Completed, Now));
        Assert.Contains("cannot change", exception.Message);
    }

    [Fact]
    public void Task_cannot_complete_while_a_subtask_is_incomplete()
    {
        var subtask = Subtask.Create(Guid.NewGuid(), Guid.NewGuid(), "Confirm stock", 1, Now);
        var task = WorkTask.Rehydrate(subtask.TaskId, "Task", "", WorkTaskStatus.InProgress, WorkTaskPriority.Medium, null, "Alex", OwnerId, "owner", null, null, null, Now, Now, null, 1, [subtask]);

        var exception = Assert.Throws<InvalidOperationException>(() => task.ChangeStatus(WorkTaskStatus.Completed, Now.AddMinutes(1)));
        Assert.Contains("every subtask", exception.Message);
    }

    [Fact]
    public void Completed_or_archived_task_rejects_subtask_changes()
    {
        var completed = CreateTask();
        completed.ChangeStatus(WorkTaskStatus.InProgress, Now);
        completed.ChangeStatus(WorkTaskStatus.Completed, Now);
        Assert.Throws<InvalidOperationException>(completed.EnsureSubtasksCanChange);

        var archived = CreateTask();
        archived.Archive(Now);
        Assert.Throws<InvalidOperationException>(archived.EnsureSubtasksCanChange);
    }

    [Fact]
    public void Subtask_requires_a_parent_and_valid_position()
    {
        Assert.Throws<ArgumentException>(() => Subtask.Create(Guid.NewGuid(), Guid.Empty, "Child", 1, Now));
        Assert.Throws<ArgumentOutOfRangeException>(() => Subtask.Create(Guid.NewGuid(), Guid.NewGuid(), "Child", 0, Now));
    }

    private static WorkTask CreateTask() => WorkTask.Create(Guid.NewGuid(), "Task", "", WorkTaskPriority.Medium, null, "Alex", OwnerId, "owner", null, null, Now);
}
