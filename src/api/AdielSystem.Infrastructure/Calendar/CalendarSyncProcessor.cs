using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;

namespace AdielSystem.Infrastructure.Calendar;

internal sealed class CalendarSyncProcessor(
    NpgsqlDataSource dataSource,
    GoogleCalendarHttpClient google,
    IOptions<GoogleCalendarOptions> options,
    ILogger<CalendarSyncProcessor> logger)
{
    private readonly GoogleCalendarOptions settings = options.Value;
    private readonly string workerId = $"{Environment.MachineName}-{Guid.NewGuid():N}";

    public async Task<bool> ProcessNextAsync(CancellationToken cancellationToken)
    {
        var job = await ClaimAsync(cancellationToken);
        if (job is null) return false;
        try
        {
            await SynchronizeAsync(job, cancellationToken);
            await CompleteAsync(job.Id, null, cancellationToken);
        }
        catch (GoogleAuthorizationException exception)
        {
            await MarkConnectionRevokedAsync(cancellationToken);
            await CompleteAsync(job.Id, exception.Message, cancellationToken);
            logger.LogWarning(exception, "Google Calendar authorization was revoked while syncing task {TaskId}", job.TaskId);
        }
        catch (Exception exception) when (exception is GoogleApiException or HttpRequestException or NpgsqlException)
        {
            await RetryOrFailAsync(job, exception.Message, cancellationToken);
            logger.LogWarning(exception, "Google Calendar sync failed for task {TaskId} on attempt {Attempt}", job.TaskId, job.Attempts);
        }
        return true;
    }

    private async Task SynchronizeAsync(CalendarSyncJob job, CancellationToken cancellationToken)
    {
        var connection = await ReadConnectionAsync(cancellationToken);
        if (connection is null) return;
        var task = await ReadTaskAsync(job.TaskId, cancellationToken);
        if (task is null) return;

        var accessToken = await google.RefreshAccessTokenAsync(connection.EncryptedRefreshToken, cancellationToken);
        var shouldDelete = task.ArchivedAt is not null || task.DueDate is null || task.AttendeeEmails.Length == 0;
        if (shouldDelete)
        {
            if (task.GoogleEventId is not null)
            {
                await google.DeleteEventAsync(accessToken, task.GoogleCalendarId ?? connection.CalendarId, task.GoogleEventId, cancellationToken);
                await DeleteMappingAsync(task.Id, cancellationToken);
            }
            return;
        }

        var eventId = task.GoogleEventId ?? CalendarEventId(task.Id);
        var dueDate = task.DueDate ?? throw new InvalidOperationException("A calendar event requires a task due date.");
        GoogleCalendarEventTime start;
        GoogleCalendarEventTime end;
        if (task.DueTime is null)
        {
            start = new(dueDate.ToString("yyyy-MM-dd"), null, null);
            end = new(dueDate.AddDays(1).ToString("yyyy-MM-dd"), null, null);
        }
        else
        {
            var startsAt = dueDate.ToDateTime(task.DueTime.Value);
            var endsAt = startsAt.AddMinutes(settings.EventDurationMinutes);
            start = new(null, startsAt.ToString("yyyy-MM-dd'T'HH:mm:ss"), settings.TimeZone);
            end = new(null, endsAt.ToString("yyyy-MM-dd'T'HH:mm:ss"), settings.TimeZone);
        }
        var taskUrl = settings.FrontendBaseUri is null ? null : new Uri(settings.FrontendBaseUri, $"tasks?task={task.Id}").AbsoluteUri;
        var description = $"{task.Description}\n\nPriority: {task.Priority}\nStatus: {task.Status}\nAssigned to: {task.AssignedToName}".Trim();
        if (taskUrl is not null) description += $"\n\nOpen task: {taskUrl}";
        var payload = new GoogleCalendarEvent(
            eventId,
            task.Status == "Completed" ? $"✓ [Adiel] {task.Title}" : $"[Adiel] {task.Title}",
            description,
            start,
            end,
            task.AttendeeEmails.Select(email => new GoogleCalendarAttendee(email)).ToArray(),
            "transparent",
            false,
            false,
            new(new Dictionary<string, string> { ["adielTaskId"] = task.Id.ToString(), ["adielTaskVersion"] = task.Version.ToString() }),
            new(task.Status != "Completed"));

        await google.UpsertEventAsync(accessToken, connection.CalendarId, eventId, payload, task.GoogleEventId is not null, cancellationToken);
        await SaveMappingAsync(task, connection.CalendarId, eventId, cancellationToken);
    }

    private async Task<CalendarSyncJob?> ClaimAsync(CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand("""
            with candidate as (
              select id from public.calendar_sync_jobs
              where completed_at is null and available_at<=now() and (locked_until is null or locked_until<now())
              order by id
              for update skip locked
              limit 1
            )
            update public.calendar_sync_jobs job
            set locked_until=now()+interval '2 minutes',locked_by=@worker,attempts=attempts+1
            from candidate
            where job.id=candidate.id
            returning job.id,job.task_id,job.attempts
            """);
        command.Parameters.AddWithValue("worker", workerId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? new(reader.GetInt64(0), reader.GetGuid(1), reader.GetInt32(2)) : null;
    }

    private async Task<CalendarConnection?> ReadConnectionAsync(CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand("select encrypted_refresh_token,calendar_id from public.google_calendar_connections where revoked_at is null order by connected_at desc limit 1");
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? new(reader.GetString(0), reader.GetString(1)) : null;
    }

    private async Task<CalendarTaskSnapshot?> ReadTaskAsync(Guid taskId, CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand("""
            select task.id,task.title,task.description,task.status,task.priority,task.assigned_to_name,
                   task.due_date,task.due_time,task.archived_at,task.version,
                   coalesce(array(
                     select distinct lower(option.contact_email)
                     from public.business_options option
                     where option.option_type='task_assignee' and option.contact_email is not null
                       and exists (
                         select 1 from unnest(string_to_array(task.assigned_to_name, ',')) assignee
                         where lower(btrim(assignee))=lower(option.name)
                       )
                     order by lower(option.contact_email)
                   ),array[]::text[]) attendee_emails,
                   event.google_event_id,event.google_calendar_id
            from public.tasks task
            left join public.task_calendar_events event on event.task_id=task.id
            where task.id=@id and task.deleted_at is null
            """);
        command.Parameters.AddWithValue("id", taskId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken)) return null;
        return new(
            reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4), reader.GetString(5),
            reader.IsDBNull(6) ? null : reader.GetFieldValue<DateOnly>(6), reader.IsDBNull(7) ? null : reader.GetFieldValue<TimeOnly>(7),
            reader.IsDBNull(8) ? null : reader.GetFieldValue<DateTimeOffset>(8), reader.GetInt64(9),
            reader.GetFieldValue<string[]>(10), reader.IsDBNull(11) ? null : reader.GetString(11), reader.IsDBNull(12) ? null : reader.GetString(12));
    }

    private async Task SaveMappingAsync(CalendarTaskSnapshot task, string calendarId, string eventId, CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand("""
            insert into public.task_calendar_events
                (task_id,google_event_id,google_calendar_id,attendee_emails,last_synced_task_version,sync_status,last_error,updated_at)
            values (@task,@event,@calendar,@emails,@version,'synced',null,now())
            on conflict (task_id) do update
            set google_event_id=excluded.google_event_id,google_calendar_id=excluded.google_calendar_id,
                attendee_emails=excluded.attendee_emails,last_synced_task_version=excluded.last_synced_task_version,
                sync_status='synced',last_error=null,updated_at=now()
            """);
        command.Parameters.AddWithValue("task", task.Id);
        command.Parameters.AddWithValue("event", eventId);
        command.Parameters.AddWithValue("calendar", calendarId);
        command.Parameters.AddWithValue("emails", task.AttendeeEmails);
        command.Parameters.AddWithValue("version", task.Version);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task DeleteMappingAsync(Guid taskId, CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand("delete from public.task_calendar_events where task_id=@task");
        command.Parameters.AddWithValue("task", taskId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task CompleteAsync(long jobId, string? error, CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand("update public.calendar_sync_jobs set completed_at=now(),locked_until=null,locked_by=null,last_error=@error where id=@id and locked_by=@worker");
        command.Parameters.AddWithValue("id", jobId);
        command.Parameters.AddWithValue("worker", workerId);
        command.Parameters.AddWithValue("error", (object?)Truncate(error) ?? DBNull.Value);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task RetryOrFailAsync(CalendarSyncJob job, string error, CancellationToken cancellationToken)
    {
        var failed = job.Attempts >= 8;
        var delay = Math.Min(300, (int)Math.Pow(2, Math.Min(job.Attempts, 8)));
        await using var command = dataSource.CreateCommand("""
            update public.calendar_sync_jobs
            set completed_at=case when @failed then now() else null end,
                available_at=case when @failed then available_at else now()+make_interval(secs=>@delay) end,
                locked_until=null,locked_by=null,last_error=@error
            where id=@id and locked_by=@worker
            """);
        command.Parameters.AddWithValue("failed", failed);
        command.Parameters.AddWithValue("delay", delay);
        command.Parameters.AddWithValue("error", Truncate(error)!);
        command.Parameters.AddWithValue("id", job.Id);
        command.Parameters.AddWithValue("worker", workerId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task MarkConnectionRevokedAsync(CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand("update public.google_calendar_connections set revoked_at=now(),updated_at=now(),version=version+1 where revoked_at is null");
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static string CalendarEventId(Guid taskId) => "adiel" + taskId.ToString("N");
    private static string? Truncate(string? value) => value is null ? null : value[..Math.Min(value.Length, 2000)];

    private sealed record CalendarSyncJob(long Id, Guid TaskId, int Attempts);
    private sealed record CalendarConnection(string EncryptedRefreshToken, string CalendarId);
    private sealed record CalendarTaskSnapshot(Guid Id, string Title, string Description, string Status, string Priority, string AssignedToName, DateOnly? DueDate, TimeOnly? DueTime, DateTimeOffset? ArchivedAt, long Version, string[] AttendeeEmails, string? GoogleEventId, string? GoogleCalendarId);
}

internal sealed class CalendarSyncWorker(IServiceScopeFactory scopeFactory, IOptions<GoogleCalendarOptions> options, ILogger<CalendarSyncWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled) return;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var processor = scope.ServiceProvider.GetRequiredService<CalendarSyncProcessor>();
                if (!await processor.ProcessNextAsync(stoppingToken)) await Task.Delay(TimeSpan.FromSeconds(4), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (Exception exception)
            {
                logger.LogError(exception, "Google Calendar background synchronization stopped for this polling interval");
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }
    }
}

internal sealed record GoogleCalendarEvent(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("summary")] string Summary,
    [property: JsonPropertyName("description")] string Description,
    [property: JsonPropertyName("start")] GoogleCalendarEventTime Start,
    [property: JsonPropertyName("end")] GoogleCalendarEventTime End,
    [property: JsonPropertyName("attendees")] IReadOnlyList<GoogleCalendarAttendee> Attendees,
    [property: JsonPropertyName("transparency")] string Transparency,
    [property: JsonPropertyName("guestsCanModify")] bool GuestsCanModify,
    [property: JsonPropertyName("guestsCanInviteOthers")] bool GuestsCanInviteOthers,
    [property: JsonPropertyName("extendedProperties")] GoogleCalendarExtendedProperties ExtendedProperties,
    [property: JsonPropertyName("reminders")] GoogleCalendarReminders Reminders);

internal sealed record GoogleCalendarEventTime(
    [property: JsonPropertyName("date"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Date,
    [property: JsonPropertyName("dateTime"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? DateTime,
    [property: JsonPropertyName("timeZone"), JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? TimeZone);
internal sealed record GoogleCalendarAttendee([property: JsonPropertyName("email")] string Email);
internal sealed record GoogleCalendarExtendedProperties([property: JsonPropertyName("private")] IReadOnlyDictionary<string, string> Private);
internal sealed record GoogleCalendarReminders([property: JsonPropertyName("useDefault")] bool UseDefault);
