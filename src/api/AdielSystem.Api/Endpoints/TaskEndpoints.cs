using AdielSystem.Api.Security;
using AdielSystem.Application.Tasks;
using Microsoft.AspNetCore.Mvc;

namespace AdielSystem.Api.Endpoints;

public static class TaskEndpoints
{
    public static RouteGroupBuilder MapTaskEndpoints(this RouteGroupBuilder group)
    {
        var tasks = group.MapGroup("/tasks").WithTags("Tasks").RequireRateLimiting(SecurityConstants.OwnerRateLimitPolicy);
        tasks.MapGet("/", async (string? search, string? status, string? priority, bool? includeArchived, bool? archivedOnly, TaskService service, CancellationToken token) =>
                Results.Ok(await service.ListAsync(search, status, priority, includeArchived ?? false, archivedOnly ?? false, token)))
            .WithName("ListTasks").Produces<TaskPageDto>().ProducesProblem(400);
        tasks.MapGet("/{id:guid}", async (Guid id, TaskService service, CancellationToken token) => Results.Ok(await service.GetAsync(id, token)))
            .WithName("GetTask").Produces<TaskDto>().ProducesProblem(404);
        tasks.MapPost("/", async (CreateTaskRequest request, TaskService service, CancellationToken token) =>
        {
            var result = await service.CreateAsync(request, token);
            return Results.CreatedAtRoute("GetTask", new { id = result.Id }, result);
        }).WithName("CreateTask").Produces<TaskDto>(201).ProducesProblem(400).ProducesProblem(409);
        tasks.MapPut("/{id:guid}", async (Guid id, SaveTaskRequest request, TaskService service, CancellationToken token) => Results.Ok(await service.UpdateAsync(id, request, token)))
            .WithName("UpdateTask").Produces<TaskDto>().ProducesProblem(400).ProducesProblem(404).ProducesProblem(409);
        tasks.MapPost("/{id:guid}/status", async (Guid id, ChangeTaskStatusRequest request, TaskService service, CancellationToken token) => Results.Ok(await service.ChangeStatusAsync(id, request, token)))
            .WithName("ChangeTaskStatus").Produces<TaskDto>().ProducesProblem(400).ProducesProblem(404).ProducesProblem(409);
        tasks.MapPost("/{id:guid}/archive", async (Guid id, ChangeTaskArchiveRequest request, TaskService service, CancellationToken token) => Results.Ok(await service.ArchiveAsync(id, request.Version, token)))
            .WithName("ArchiveTask").Produces<TaskDto>().ProducesProblem(400).ProducesProblem(404).ProducesProblem(409);
        tasks.MapPost("/{id:guid}/restore", async (Guid id, ChangeTaskArchiveRequest request, TaskService service, CancellationToken token) => Results.Ok(await service.RestoreAsync(id, request.Version, token)))
            .WithName("RestoreTask").Produces<TaskDto>().ProducesProblem(400).ProducesProblem(404).ProducesProblem(409);
        tasks.MapPost("/{taskId:guid}/subtasks", async (Guid taskId, CreateSubtaskRequest request, TaskService service, CancellationToken token) => Results.Ok(await service.AddSubtaskAsync(taskId, request, token)))
            .WithName("AddSubtask").Produces<TaskDto>().ProducesProblem(400).ProducesProblem(404).ProducesProblem(409);
        tasks.MapPut("/{taskId:guid}/subtasks/{subtaskId:guid}", async (Guid taskId, Guid subtaskId, UpdateSubtaskRequest request, TaskService service, CancellationToken token) => Results.Ok(await service.UpdateSubtaskAsync(taskId, subtaskId, request, token)))
            .WithName("UpdateSubtask").Produces<TaskDto>().ProducesProblem(400).ProducesProblem(404).ProducesProblem(409);
        tasks.MapPost("/{taskId:guid}/subtasks/{subtaskId:guid}/completion", async (Guid taskId, Guid subtaskId, ChangeSubtaskCompletionRequest request, TaskService service, CancellationToken token) => Results.Ok(await service.SetSubtaskCompletionAsync(taskId, subtaskId, request, token)))
            .WithName("ChangeSubtaskCompletion").Produces<TaskDto>().ProducesProblem(400).ProducesProblem(404).ProducesProblem(409);
        tasks.MapDelete("/{taskId:guid}/subtasks/{subtaskId:guid}", async (Guid taskId, Guid subtaskId, [FromBody] RemoveSubtaskRequest request, TaskService service, CancellationToken token) => Results.Ok(await service.RemoveSubtaskAsync(taskId, subtaskId, request, token)))
            .WithName("RemoveSubtask").Produces<TaskDto>().ProducesProblem(400).ProducesProblem(404).ProducesProblem(409);
        return group;
    }
}
