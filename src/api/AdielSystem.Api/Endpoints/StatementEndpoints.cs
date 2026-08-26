using AdielSystem.Api.Security;
using AdielSystem.Application.Statements;

namespace AdielSystem.Api.Endpoints;

public static class StatementEndpoints
{
    public static RouteGroupBuilder MapStatementEndpoints(this RouteGroupBuilder group)
    {
        var statements = group.MapGroup("/statements").WithTags("Statements of Account").RequireRateLimiting(SecurityConstants.OwnerRateLimitPolicy);
        statements.MapGet("/", async (string? search, string? status, bool? archivedOnly, int? page, int? pageSize, StatementService service, CancellationToken token) => Results.Ok(await service.ListAsync(search, status, archivedOnly ?? false, page ?? 1, pageSize ?? 100, token))).WithName("ListStatements");
        statements.MapGet("/{id:guid}", async (Guid id, StatementService service, CancellationToken token) => Results.Ok(await service.GetAsync(id, token))).WithName("GetStatement");
        statements.MapPost("/", async (SaveStatementRequest request, StatementService service, CancellationToken token) => { var result = await service.CreateAsync(request, token); return Results.CreatedAtRoute("GetStatement", new { id = result.Id }, result); }).WithName("CreateStatement");
        statements.MapPut("/{id:guid}", async (Guid id, SaveStatementRequest request, StatementService service, CancellationToken token) => Results.Ok(await service.UpdateAsync(id, request, token))).WithName("UpdateStatement");
        statements.MapPost("/{id:guid}/status", async (Guid id, ChangeStatementStatusRequest request, StatementService service, CancellationToken token) => Results.Ok(await service.ChangeStatusAsync(id, request, token))).WithName("ChangeStatementStatus");
        statements.MapPost("/{id:guid}/archive", async (Guid id, ChangeStatementArchiveRequest request, StatementService service, CancellationToken token) => Results.Ok(await service.ArchiveAsync(id, request, token))).WithName("ArchiveStatement");
        statements.MapPost("/{id:guid}/restore", async (Guid id, ChangeStatementArchiveRequest request, StatementService service, CancellationToken token) => Results.Ok(await service.RestoreAsync(id, request, token))).WithName("RestoreStatement");
        statements.MapPost("/{id:guid}/schedules/{scheduleId:guid}/late-charge", async (Guid id, Guid scheduleId, ApplyLateChargeRequest request, StatementService service, CancellationToken token) => Results.Ok(await service.ApplyLateChargeAsync(id, scheduleId, request, token))).WithName("ApplyStatementLateCharge");
        statements.MapPost("/{id:guid}/schedules/{scheduleId:guid}/late-charge/waive", async (Guid id, Guid scheduleId, WaiveLateChargeRequest request, StatementService service, CancellationToken token) => Results.Ok(await service.WaiveLateChargeAsync(id, scheduleId, request, token))).WithName("WaiveStatementLateCharge");
        statements.MapPost("/{id:guid}/payments", async (Guid id, RecordStatementPaymentRequest request, StatementService service, CancellationToken token) => Results.Ok(await service.RecordPaymentAsync(id, request, token))).WithName("RecordStatementPayment");
        statements.MapPost("/{id:guid}/payments/{paymentId:guid}/reverse", async (Guid id, Guid paymentId, ReverseStatementPaymentRequest request, StatementService service, CancellationToken token) => Results.Ok(await service.ReversePaymentAsync(id, paymentId, request, token))).WithName("ReverseStatementPayment");
        return group;
    }
}
