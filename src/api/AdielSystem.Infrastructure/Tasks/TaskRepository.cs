using System.Transactions;
using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using AdielSystem.Application.Tasks;
using AdielSystem.Domain.Tasks;
using Npgsql;
using NpgsqlTypes;

namespace AdielSystem.Infrastructure.Tasks;

internal sealed class TaskRepository(NpgsqlDataSource dataSource) : ITaskRepository
{
    public async Task<TaskSearchResult> SearchAsync(TaskSearchCriteria criteria, CancellationToken token)
    {
        await using var connection = await dataSource.OpenConnectionAsync(token);
        var ids = new List<Guid>();
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = $"""
                select id from public.tasks
                where deleted_at is null
                  and {(criteria.ArchivedOnly ? "archived_at is not null" : criteria.IncludeArchived ? "true" : "archived_at is null")}
                  and (@status='' or status=@status)
                  and (@priority='' or priority=@priority)
                  and (@search='' or title ilike @search escape '\' or description ilike @search escape '\' or assigned_to_name ilike @search escape '\' or assigned_by_name ilike @search escape '\'
                       or exists (select 1 from public.subtasks s where s.task_id=tasks.id and s.title ilike @search escape '\'))
                order by case priority when 'High' then 1 when 'Medium' then 2 else 3 end, due_date nulls last, created_at desc
                """;
            AddSearchParameters(command, criteria);
            await using var reader = await command.ExecuteReaderAsync(token);
            while (await reader.ReadAsync(token)) ids.Add(reader.GetGuid(0));
        }
        var items = new List<WorkTask>();
        foreach (var id in ids)
        {
            var task = await ReadAsync(connection, null, id, false, token);
            if (task is not null) items.Add(task);
        }
        return new(items, items.Count);
    }

    public async Task<WorkTask?> GetAsync(Guid id, CancellationToken token)
    {
        await using var connection = await dataSource.OpenConnectionAsync(token);
        return await ReadAsync(connection, null, id, false, token);
    }

    public async Task<bool> ProfileExistsAsync(Guid id, CancellationToken token)
    {
        await using var command = dataSource.CreateCommand("select exists(select 1 from public.profiles where id=@id)");
        command.Parameters.AddWithValue("id", id);
        return (bool)(await command.ExecuteScalarAsync(token) ?? false);
    }

    public Task<WorkTask> CreateAsync(WorkTask task, CurrentUser actor, CancellationToken token) => ExecuteAsync(async (connection, transaction) =>
    {
        await using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = "insert into public.tasks (id,title,description,status,priority,assigned_to,assigned_to_name,assigned_by,assigned_by_name,due_date,due_time,completed_at) values (@id,@title,@description,@status,@priority,@assigned_to,@assigned_to_name,@assigned_by,@assigned_by_name,@due_date,@due_time,@completed_at)";
            AddTaskParameters(command, task);
            await command.ExecuteNonQueryAsync(token);
        }
        await InsertAuditAsync(connection, transaction, task.Id, "Created", task.Title, $"Task created and assigned to {task.AssignedToName}.", actor, task.Status, "success", token);
        await EnqueueCalendarSyncAsync(connection, transaction, task.Id, 1, token);
        return await ReadRequiredAsync(connection, transaction, task.Id, false, token);
    }, token);

    public Task<WorkTask> UpdateAsync(WorkTask task, long expectedVersion, CurrentUser actor, CancellationToken token) => ExecuteAsync(async (connection, transaction) =>
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "update public.tasks set title=@title,description=@description,priority=@priority,assigned_to=@assigned_to,assigned_to_name=@assigned_to_name,due_date=@due_date,due_time=@due_time where id=@id and archived_at is null and deleted_at is null and version=@version returning id";
        AddTaskParameters(command, task);
        command.Parameters.AddWithValue("version", expectedVersion);
        if (await command.ExecuteScalarAsync(token) is null) throw Stale();
        await InsertAuditAsync(connection, transaction, task.Id, "Updated", task.Title, "Task details, priority, assignee, or due date were updated.", actor, task.Status, "info", token);
        var saved = await ReadRequiredAsync(connection, transaction, task.Id, false, token);
        await EnqueueCalendarSyncAsync(connection, transaction, task.Id, saved.Version, token);
        return saved;
    }, token);

    public Task<WorkTask> ChangeStatusAsync(Guid id, WorkTaskStatus target, long expectedVersion, CurrentUser actor, CancellationToken token) => ExecuteAsync(async (connection, transaction) =>
    {
        var task = await ReadRequiredAsync(connection, transaction, id, true, token);
        if (task.Version != expectedVersion) throw Stale();
        var previous = task.Status;
        task.ChangeStatus(target, DateTimeOffset.UtcNow);
        if (previous == target) return task;
        await using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = "update public.tasks set status=@status,completed_at=@completed_at where id=@id and version=@version and archived_at is null and deleted_at is null returning id";
            command.Parameters.AddWithValue("id", id);
            command.Parameters.AddWithValue("version", expectedVersion);
            command.Parameters.AddWithValue("status", WorkTask.Display(target));
            command.Parameters.Add("completed_at", NpgsqlDbType.TimestampTz).Value = (object?)task.CompletedAt ?? DBNull.Value;
            if (await command.ExecuteScalarAsync(token) is null) throw Stale();
        }
        await InsertAuditAsync(connection, transaction, id, "Status changed", task.Title, $"Task status changed from {WorkTask.Display(previous)} to {WorkTask.Display(target)}.", actor, target, target == WorkTaskStatus.Completed ? "success" : "info", token);
        var saved = await ReadRequiredAsync(connection, transaction, id, false, token);
        await EnqueueCalendarSyncAsync(connection, transaction, id, saved.Version, token);
        return saved;
    }, token);

    public Task<WorkTask> SetArchivedAsync(Guid id, long expectedVersion, bool archived, CurrentUser actor, CancellationToken token) => ExecuteAsync(async (connection, transaction) =>
    {
        var task = await ReadRequiredAsync(connection, transaction, id, true, token);
        if (task.Version != expectedVersion) throw Stale();
        if (archived) task.Archive(DateTimeOffset.UtcNow); else task.Restore();
        await using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = archived
                ? "update public.tasks set archived_at=now(),archived_by=@actor where id=@id and archived_at is null and deleted_at is null and version=@version returning id"
                : "update public.tasks set archived_at=null,archived_by=null where id=@id and archived_at is not null and deleted_at is null and version=@version returning id";
            command.Parameters.AddWithValue("actor", actor.Id);
            command.Parameters.AddWithValue("id", id);
            command.Parameters.AddWithValue("version", expectedVersion);
            if (await command.ExecuteScalarAsync(token) is null) throw Stale();
        }
        await InsertAuditAsync(connection, transaction, id, archived ? "Archived" : "Restored", task.Title, archived ? "Task and its subtasks were archived." : "Task and its subtasks were restored.", actor, task.Status, "info", token);
        var saved = await ReadRequiredAsync(connection, transaction, id, false, token);
        await EnqueueCalendarSyncAsync(connection, transaction, id, saved.Version, token);
        return saved;
    }, token);

    public Task<WorkTask> AddSubtaskAsync(Guid taskId, string title, long taskVersion, CurrentUser actor, CancellationToken token) => ExecuteAsync(async (connection, transaction) =>
    {
        var task = await LockMutableParentAsync(connection, transaction, taskId, taskVersion, token);
        var position = task.Subtasks.Count == 0 ? 1 : task.Subtasks.Max(subtask => subtask.Position) + 1;
        var subtask = Subtask.Create(Guid.NewGuid(), taskId, title, position, DateTimeOffset.UtcNow);
        await using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = "insert into public.subtasks (id,task_id,title,position) values (@id,@task_id,@title,@position)";
            command.Parameters.AddWithValue("id", subtask.Id);
            command.Parameters.AddWithValue("task_id", taskId);
            command.Parameters.AddWithValue("title", subtask.Title);
            command.Parameters.AddWithValue("position", subtask.Position);
            await command.ExecuteNonQueryAsync(token);
        }
        await TouchParentAsync(connection, transaction, taskId, taskVersion, token);
        await InsertAuditAsync(connection, transaction, taskId, "Subtask added", task.Title, $"Subtask added: {subtask.Title}.", actor, task.Status, "info", token);
        return await ReadRequiredAsync(connection, transaction, taskId, false, token);
    }, token);

    public Task<WorkTask> UpdateSubtaskAsync(Guid taskId, Guid subtaskId, string title, long subtaskVersion, long taskVersion, CurrentUser actor, CancellationToken token) => ExecuteAsync(async (connection, transaction) =>
    {
        var task = await LockMutableParentAsync(connection, transaction, taskId, taskVersion, token);
        var subtask = RequireSubtask(task, subtaskId);
        subtask.Rename(title);
        await using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = "update public.subtasks set title=@title where id=@id and task_id=@task_id and version=@version returning id";
            command.Parameters.AddWithValue("title", subtask.Title);
            command.Parameters.AddWithValue("id", subtaskId);
            command.Parameters.AddWithValue("task_id", taskId);
            command.Parameters.AddWithValue("version", subtaskVersion);
            if (await command.ExecuteScalarAsync(token) is null) throw StaleSubtask();
        }
        await TouchParentAsync(connection, transaction, taskId, taskVersion, token);
        await InsertAuditAsync(connection, transaction, taskId, "Subtask updated", task.Title, $"Subtask renamed to: {subtask.Title}.", actor, task.Status, "info", token);
        return await ReadRequiredAsync(connection, transaction, taskId, false, token);
    }, token);

    public Task<WorkTask> SetSubtaskCompletionAsync(Guid taskId, Guid subtaskId, bool completed, long subtaskVersion, long taskVersion, CurrentUser actor, CancellationToken token) => ExecuteAsync(async (connection, transaction) =>
    {
        var task = await LockMutableParentAsync(connection, transaction, taskId, taskVersion, token);
        var subtask = RequireSubtask(task, subtaskId);
        subtask.SetCompletion(completed, DateTimeOffset.UtcNow);
        await using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = "update public.subtasks set is_completed=@completed,completed_at=@completed_at where id=@id and task_id=@task_id and version=@version returning id";
            command.Parameters.AddWithValue("completed", completed);
            command.Parameters.Add("completed_at", NpgsqlDbType.TimestampTz).Value = (object?)subtask.CompletedAt ?? DBNull.Value;
            command.Parameters.AddWithValue("id", subtaskId);
            command.Parameters.AddWithValue("task_id", taskId);
            command.Parameters.AddWithValue("version", subtaskVersion);
            if (await command.ExecuteScalarAsync(token) is null) throw StaleSubtask();
        }
        await TouchParentAsync(connection, transaction, taskId, taskVersion, token);
        await InsertAuditAsync(connection, transaction, taskId, "Subtask updated", task.Title, $"Subtask {(completed ? "completed" : "reopened")}: {subtask.Title}.", actor, task.Status, completed ? "success" : "info", token);
        return await ReadRequiredAsync(connection, transaction, taskId, false, token);
    }, token);

    public Task<WorkTask> RemoveSubtaskAsync(Guid taskId, Guid subtaskId, long subtaskVersion, long taskVersion, CurrentUser actor, CancellationToken token) => ExecuteAsync(async (connection, transaction) =>
    {
        var task = await LockMutableParentAsync(connection, transaction, taskId, taskVersion, token);
        var subtask = RequireSubtask(task, subtaskId);
        await using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText = "delete from public.subtasks where id=@id and task_id=@task_id and version=@version returning id";
            command.Parameters.AddWithValue("id", subtaskId);
            command.Parameters.AddWithValue("task_id", taskId);
            command.Parameters.AddWithValue("version", subtaskVersion);
            if (await command.ExecuteScalarAsync(token) is null) throw StaleSubtask();
        }
        await TouchParentAsync(connection, transaction, taskId, taskVersion, token);
        await InsertAuditAsync(connection, transaction, taskId, "Subtask removed", task.Title, $"Subtask removed: {subtask.Title}.", actor, task.Status, "warning", token);
        return await ReadRequiredAsync(connection, transaction, taskId, false, token);
    }, token);

    private async Task<WorkTask> LockMutableParentAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid taskId, long version, CancellationToken token)
    {
        var task = await ReadRequiredAsync(connection, transaction, taskId, true, token);
        if (task.Version != version) throw Stale();
        task.EnsureSubtasksCanChange();
        return task;
    }

    private static Subtask RequireSubtask(WorkTask task, Guid subtaskId) => task.Subtasks.FirstOrDefault(subtask => subtask.Id == subtaskId)
        ?? throw new ResourceNotFoundException($"Subtask '{subtaskId}' was not found under task '{task.Id}'.");

    private static async Task TouchParentAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid taskId, long version, CancellationToken token)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "update public.tasks set updated_at=updated_at where id=@id and version=@version and archived_at is null and deleted_at is null returning id";
        command.Parameters.AddWithValue("id", taskId);
        command.Parameters.AddWithValue("version", version);
        if (await command.ExecuteScalarAsync(token) is null) throw Stale();
    }

    private static async Task<WorkTask?> ReadAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid id, bool forUpdate, CancellationToken token)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "select id,title,description,status,priority,assigned_to,assigned_to_name,assigned_by,assigned_by_name,due_date,due_time,completed_at,created_at,updated_at,archived_at,version from public.tasks where id=@id and deleted_at is null" + (forUpdate ? " for update" : string.Empty);
        command.Parameters.AddWithValue("id", id);
        TaskRecord record;
        await using (var reader = await command.ExecuteReaderAsync(token))
        {
            if (!await reader.ReadAsync(token)) return null;
            record = new(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4), reader.IsDBNull(5) ? null : reader.GetGuid(5), reader.GetString(6), reader.IsDBNull(7) ? null : reader.GetGuid(7), reader.GetString(8), reader.IsDBNull(9) ? null : reader.GetFieldValue<DateOnly>(9), reader.IsDBNull(10) ? null : reader.GetFieldValue<TimeOnly>(10), reader.IsDBNull(11) ? null : reader.GetFieldValue<DateTimeOffset>(11), reader.GetFieldValue<DateTimeOffset>(12), reader.GetFieldValue<DateTimeOffset>(13), reader.IsDBNull(14) ? null : reader.GetFieldValue<DateTimeOffset>(14), reader.GetInt64(15));
        }
        var subtasks = await ReadSubtasksAsync(connection, transaction, id, token);
        return WorkTask.Rehydrate(record.Id, record.Title, record.Description, ParseStatus(record.Status), ParsePriority(record.Priority), record.AssignedToId, record.AssignedToName, record.AssignedById, record.AssignedByName, record.DueDate, record.DueTime, record.CompletedAt, record.CreatedAt, record.UpdatedAt, record.ArchivedAt, record.Version, subtasks);
    }

    private static async Task<IReadOnlyList<Subtask>> ReadSubtasksAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid taskId, CancellationToken token)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "select id,task_id,title,is_completed,completed_at,position,created_at,updated_at,version from public.subtasks where task_id=@task_id order by position,id";
        command.Parameters.AddWithValue("task_id", taskId);
        var items = new List<Subtask>();
        await using var reader = await command.ExecuteReaderAsync(token);
        while (await reader.ReadAsync(token)) items.Add(Subtask.Rehydrate(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetBoolean(3), reader.IsDBNull(4) ? null : reader.GetFieldValue<DateTimeOffset>(4), reader.GetInt32(5), reader.GetFieldValue<DateTimeOffset>(6), reader.GetFieldValue<DateTimeOffset>(7), reader.GetInt64(8)));
        return items;
    }

    private static async Task<WorkTask> ReadRequiredAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid id, bool forUpdate, CancellationToken token) => await ReadAsync(connection, transaction, id, forUpdate, token) ?? throw new ResourceNotFoundException($"Task '{id}' was not found.");

    private async Task<T> ExecuteAsync<T>(Func<NpgsqlConnection, NpgsqlTransaction?, Task<T>> operation, CancellationToken token)
    {
        await using var connection = await dataSource.OpenConnectionAsync(token);
        await using var transaction = Transaction.Current is null ? await connection.BeginTransactionAsync(token) : null;
        var result = await operation(connection, transaction);
        if (transaction is not null) await transaction.CommitAsync(token);
        return result;
    }

    private static void AddTaskParameters(NpgsqlCommand command, WorkTask task)
    {
        command.Parameters.AddWithValue("id", task.Id);
        command.Parameters.AddWithValue("title", task.Title);
        command.Parameters.AddWithValue("description", task.Description);
        command.Parameters.AddWithValue("status", WorkTask.Display(task.Status));
        command.Parameters.AddWithValue("priority", WorkTask.Display(task.Priority));
        command.Parameters.Add("assigned_to", NpgsqlDbType.Uuid).Value = (object?)task.AssignedToId ?? DBNull.Value;
        command.Parameters.AddWithValue("assigned_to_name", task.AssignedToName);
        command.Parameters.Add("assigned_by", NpgsqlDbType.Uuid).Value = (object?)task.AssignedById ?? DBNull.Value;
        command.Parameters.AddWithValue("assigned_by_name", task.AssignedByName);
        command.Parameters.Add("due_date", NpgsqlDbType.Date).Value = (object?)task.DueDate ?? DBNull.Value;
        command.Parameters.Add("due_time", NpgsqlDbType.Time).Value = (object?)task.DueTime ?? DBNull.Value;
        command.Parameters.Add("completed_at", NpgsqlDbType.TimestampTz).Value = (object?)task.CompletedAt ?? DBNull.Value;
    }

    private static void AddSearchParameters(NpgsqlCommand command, TaskSearchCriteria criteria)
    {
        command.Parameters.AddWithValue("status", criteria.Status ?? string.Empty);
        command.Parameters.AddWithValue("priority", criteria.Priority ?? string.Empty);
        command.Parameters.AddWithValue("search", string.IsNullOrWhiteSpace(criteria.Search) ? string.Empty : "%" + EscapeLike(criteria.Search) + "%");
    }

    private static async Task InsertAuditAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid id, string action, string entity, string description, CurrentUser actor, WorkTaskStatus status, string tone, CancellationToken token)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "insert into public.audit_records (record_id,module,action,entity,description,actor_id,actor_name,tone,status) values (@record_id,'Tasks',@action,@entity,@description,@actor_id,@actor_name,@tone,@status)";
        command.Parameters.AddWithValue("record_id", id);
        command.Parameters.AddWithValue("action", action);
        command.Parameters.AddWithValue("entity", entity);
        command.Parameters.AddWithValue("description", description);
        command.Parameters.AddWithValue("actor_id", actor.Id);
        command.Parameters.AddWithValue("actor_name", actor.Username);
        command.Parameters.AddWithValue("tone", tone);
        command.Parameters.AddWithValue("status", WorkTask.Display(status));
        await command.ExecuteNonQueryAsync(token);
    }

    private static async Task EnqueueCalendarSyncAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid taskId, long taskVersion, CancellationToken token)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "insert into public.calendar_sync_jobs (task_id, requested_task_version) values (@task_id, @task_version)";
        command.Parameters.AddWithValue("task_id", taskId);
        command.Parameters.AddWithValue("task_version", taskVersion);
        await command.ExecuteNonQueryAsync(token);
    }

    private static string EscapeLike(string value) => value.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("%", "\\%", StringComparison.Ordinal).Replace("_", "\\_", StringComparison.Ordinal);
    private static WorkTaskStatus ParseStatus(string value) => value switch { "To do" => WorkTaskStatus.ToDo, "In progress" => WorkTaskStatus.InProgress, "Completed" => WorkTaskStatus.Completed, _ => throw new InvalidOperationException("Stored task status is invalid.") };
    private static WorkTaskPriority ParsePriority(string value) => value switch { "Low" => WorkTaskPriority.Low, "Medium" => WorkTaskPriority.Medium, "High" => WorkTaskPriority.High, _ => throw new InvalidOperationException("Stored task priority is invalid.") };
    private static ConcurrencyConflictException Stale() => new("This task changed after you opened it. Reload and try again.");
    private static ConcurrencyConflictException StaleSubtask() => new("This subtask changed after you opened it. Reload and try again.");
    private sealed record TaskRecord(Guid Id, string Title, string Description, string Status, string Priority, Guid? AssignedToId, string AssignedToName, Guid? AssignedById, string AssignedByName, DateOnly? DueDate, TimeOnly? DueTime, DateTimeOffset? CompletedAt, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DateTimeOffset? ArchivedAt, long Version);
}
