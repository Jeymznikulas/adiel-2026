using System.Net;
using System.Net.Http.Json;
using AdielSystem.Application.Tasks;
using Npgsql;

namespace AdielSystem.IntegrationTests;

public sealed class AuthenticatedTaskFlowTests
{
    [Fact]
    public async Task Owner_can_complete_task_subtask_archive_restore_concurrency_and_audit_flow()
    {
        await using var factory = new OwnerApiFactory();
        using var client = factory.CreateClient();
        var token = TestContext.Current.CancellationToken;
        var dueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7));
        var dueTime = new TimeOnly(9, 30);
        var updatedDueDate = dueDate.AddDays(2);
        var updatedDueTime = new TimeOnly(14, 0);
        var uniqueTitle = $"Integration Task {Guid.NewGuid():N}";

        var invalidPriority = await client.PostAsJsonAsync("/api/v1/tasks", new { title = uniqueTitle, description = "", status = "To do", priority = "Urgent", assignedTo = "Alex", dueDate }, token);
        Assert.Equal(HttpStatusCode.BadRequest, invalidPriority.StatusCode);
        var invalidDate = await client.PostAsJsonAsync("/api/v1/tasks", new { title = uniqueTitle, description = "", status = "To do", priority = "High", assignedTo = "Alex", dueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)) }, token);
        Assert.Equal(HttpStatusCode.BadRequest, invalidDate.StatusCode);

        var create = await client.PostAsJsonAsync("/api/v1/tasks", new { title = uniqueTitle, description = "Initial details", status = "To do", priority = "High", assignedTo = "Alex Morgan", dueDate, dueTime }, token);
        Assert.True(create.StatusCode == HttpStatusCode.Created, await create.Content.ReadAsStringAsync(token));
        var created = (await create.Content.ReadFromJsonAsync<TaskDto>(token))!;
        Assert.Equal("High", created.Priority);
        Assert.Equal(dueDate, created.DueDate);
        Assert.Equal(dueTime, created.DueTime);
        Assert.Equal("owner", created.AssignedBy);

        var listResponse = await client.GetAsync($"/api/v1/tasks?search={Uri.EscapeDataString(uniqueTitle)}", token);
        Assert.True(listResponse.IsSuccessStatusCode, await listResponse.Content.ReadAsStringAsync(token));
        var listed = await listResponse.Content.ReadFromJsonAsync<TaskPageDto>(token);
        Assert.Contains(listed!.Items, task => task.Id == created.Id);

        var addSubtask = await client.PostAsJsonAsync($"/api/v1/tasks/{created.Id}/subtasks", new { title = "Confirm inventory", taskVersion = created.Version }, token);
        addSubtask.EnsureSuccessStatusCode();
        var withSubtask = (await addSubtask.Content.ReadFromJsonAsync<TaskDto>(token))!;
        var subtask = Assert.Single(withSubtask.Subtasks);
        Assert.True(withSubtask.Version > created.Version);

        var renameSubtask = await client.PutAsJsonAsync($"/api/v1/tasks/{created.Id}/subtasks/{subtask.Id}", new { title = "Confirm warehouse inventory", version = subtask.Version, taskVersion = withSubtask.Version }, token);
        renameSubtask.EnsureSuccessStatusCode();
        withSubtask = (await renameSubtask.Content.ReadFromJsonAsync<TaskDto>(token))!;
        subtask = Assert.Single(withSubtask.Subtasks);
        Assert.Equal("Confirm warehouse inventory", subtask.Title);

        var addTemporary = await client.PostAsJsonAsync($"/api/v1/tasks/{created.Id}/subtasks", new { title = "Temporary step", taskVersion = withSubtask.Version }, token);
        addTemporary.EnsureSuccessStatusCode();
        var withTemporary = (await addTemporary.Content.ReadFromJsonAsync<TaskDto>(token))!;
        var temporary = withTemporary.Subtasks.Single(item => item.Title == "Temporary step");
        using var removeRequest = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/tasks/{created.Id}/subtasks/{temporary.Id}") { Content = JsonContent.Create(new { version = temporary.Version, taskVersion = withTemporary.Version }) };
        var removeTemporary = await client.SendAsync(removeRequest, token);
        removeTemporary.EnsureSuccessStatusCode();
        withSubtask = (await removeTemporary.Content.ReadFromJsonAsync<TaskDto>(token))!;
        subtask = Assert.Single(withSubtask.Subtasks);

        var invalidSkip = await client.PostAsJsonAsync($"/api/v1/tasks/{created.Id}/status", new { status = "Completed", version = withSubtask.Version }, token);
        Assert.Equal(HttpStatusCode.BadRequest, invalidSkip.StatusCode);

        var start = await client.PostAsJsonAsync($"/api/v1/tasks/{created.Id}/status", new { status = "In progress", version = withSubtask.Version }, token);
        start.EnsureSuccessStatusCode();
        var started = (await start.Content.ReadFromJsonAsync<TaskDto>(token))!;
        var incomplete = await client.PostAsJsonAsync($"/api/v1/tasks/{created.Id}/status", new { status = "Completed", version = started.Version }, token);
        Assert.Equal(HttpStatusCode.BadRequest, incomplete.StatusCode);

        var completeSubtask = await client.PostAsJsonAsync($"/api/v1/tasks/{created.Id}/subtasks/{subtask.Id}/completion", new { completed = true, version = subtask.Version, taskVersion = started.Version }, token);
        completeSubtask.EnsureSuccessStatusCode();
        var ready = (await completeSubtask.Content.ReadFromJsonAsync<TaskDto>(token))!;
        Assert.True(ready.Subtasks.Single().Completed);

        var complete = await client.PostAsJsonAsync($"/api/v1/tasks/{created.Id}/status", new { status = "Completed", version = ready.Version }, token);
        complete.EnsureSuccessStatusCode();
        var completed = (await complete.Content.ReadFromJsonAsync<TaskDto>(token))!;
        Assert.NotNull(completed.CompletedAt);

        var mutateCompletedSubtask = await client.PostAsJsonAsync($"/api/v1/tasks/{created.Id}/subtasks/{subtask.Id}/completion", new { completed = false, version = ready.Subtasks.Single().Version, taskVersion = completed.Version }, token);
        Assert.Equal(HttpStatusCode.BadRequest, mutateCompletedSubtask.StatusCode);

        var reopen = await client.PostAsJsonAsync($"/api/v1/tasks/{created.Id}/status", new { status = "In progress", version = completed.Version }, token);
        reopen.EnsureSuccessStatusCode();
        var reopened = (await reopen.Content.ReadFromJsonAsync<TaskDto>(token))!;

        var update = await client.PutAsJsonAsync($"/api/v1/tasks/{created.Id}", new { title = uniqueTitle + " Updated", description = "Updated details", priority = "Low", assignedTo = "Jamie Lee", dueDate = updatedDueDate, dueTime = updatedDueTime, version = reopened.Version }, token);
        update.EnsureSuccessStatusCode();
        var updated = (await update.Content.ReadFromJsonAsync<TaskDto>(token))!;
        Assert.Equal("Low", updated.Priority);
        Assert.Equal(updatedDueDate, updated.DueDate);
        Assert.Equal(updatedDueTime, updated.DueTime);

        var stale = await client.PutAsJsonAsync($"/api/v1/tasks/{created.Id}", new { title = uniqueTitle, description = "Stale", priority = "Medium", assignedTo = "Alex", dueDate, version = reopened.Version }, token);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);

        var otherCreate = await client.PostAsJsonAsync("/api/v1/tasks", new { title = uniqueTitle + " Other", description = "", status = "To do", priority = "Medium", assignedTo = "Alex", dueDate }, token);
        var other = (await otherCreate.Content.ReadFromJsonAsync<TaskDto>(token))!;
        var wrongParent = await client.PostAsJsonAsync($"/api/v1/tasks/{other.Id}/subtasks/{subtask.Id}/completion", new { completed = false, version = ready.Subtasks.Single().Version, taskVersion = other.Version }, token);
        Assert.Equal(HttpStatusCode.NotFound, wrongParent.StatusCode);

        var archive = await client.PostAsJsonAsync($"/api/v1/tasks/{updated.Id}/archive", new { version = updated.Version }, token);
        archive.EnsureSuccessStatusCode();
        var archived = (await archive.Content.ReadFromJsonAsync<TaskDto>(token))!;
        Assert.NotNull(archived.ArchivedAt);
        var activeList = await client.GetFromJsonAsync<TaskPageDto>($"/api/v1/tasks?search={Uri.EscapeDataString(uniqueTitle)}", token);
        Assert.DoesNotContain(activeList!.Items, task => task.Id == archived.Id);
        var archivedList = await client.GetFromJsonAsync<TaskPageDto>($"/api/v1/tasks?archivedOnly=true&search={Uri.EscapeDataString(uniqueTitle)}", token);
        Assert.Contains(archivedList!.Items, task => task.Id == archived.Id);

        var restore = await client.PostAsJsonAsync($"/api/v1/tasks/{archived.Id}/restore", new { version = archived.Version }, token);
        restore.EnsureSuccessStatusCode();
        var restored = (await restore.Content.ReadFromJsonAsync<TaskDto>(token))!;
        Assert.Null(restored.ArchivedAt);

        var auditActions = await factory.QueryInTestTransactionAsync(async connection =>
        {
            await using var command = new NpgsqlCommand("select action from public.audit_records where module='Tasks' and record_id=@id order by occurred_at,id", connection);
            command.Parameters.AddWithValue("id", created.Id);
            var actions = new List<string>();
            await using var reader = await command.ExecuteReaderAsync(token);
            while (await reader.ReadAsync(token)) actions.Add(reader.GetString(0));
            return actions;
        }, token);
        Assert.Contains("Created", auditActions);
        Assert.Contains("Updated", auditActions);
        Assert.Contains("Status changed", auditActions);
        Assert.Contains("Subtask added", auditActions);
        Assert.Contains("Subtask updated", auditActions);
        Assert.Contains("Subtask removed", auditActions);
        Assert.Contains("Archived", auditActions);
        Assert.Contains("Restored", auditActions);
    }
}
