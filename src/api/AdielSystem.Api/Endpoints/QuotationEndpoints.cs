using AdielSystem.Api.Security;
using AdielSystem.Application.Quotations;

namespace AdielSystem.Api.Endpoints;

public static class QuotationEndpoints
{
    public static RouteGroupBuilder MapQuotationEndpoints(this RouteGroupBuilder group)
    {
        var quotations = group.MapGroup("/quotations").WithTags("Quotations").RequireRateLimiting(SecurityConstants.OwnerRateLimitPolicy);
        quotations.MapGet("/", async (string? search, string? status, bool? archivedOnly, int? page, int? pageSize, QuotationService service, CancellationToken token) => Results.Ok(await service.ListAsync(search, status, archivedOnly ?? false, page ?? 1, pageSize ?? 100, token))).WithName("ListQuotations");
        quotations.MapGet("/{id:guid}", async (Guid id, QuotationService service, CancellationToken token) => Results.Ok(await service.GetAsync(id, token))).WithName("GetQuotation");
        quotations.MapPost("/", async (SaveQuotationRequest request, QuotationService service, CancellationToken token) => { var result = await service.CreateAsync(request, token); return Results.CreatedAtRoute("GetQuotation", new { id = result.Id }, result); }).WithName("CreateQuotation");
        quotations.MapPut("/{id:guid}", async (Guid id, SaveQuotationRequest request, QuotationService service, CancellationToken token) => Results.Ok(await service.UpdateAsync(id, request, token))).WithName("UpdateQuotation");
        quotations.MapPost("/{id:guid}/status", async (Guid id, ChangeQuotationStatusRequest request, QuotationService service, CancellationToken token) => Results.Ok(await service.ChangeStatusAsync(id, request, token))).WithName("ChangeQuotationStatus");
        quotations.MapPost("/{id:guid}/archive", async (Guid id, ChangeQuotationArchiveRequest request, QuotationService service, CancellationToken token) => Results.Ok(await service.ArchiveAsync(id, request, token))).WithName("ArchiveQuotation");
        quotations.MapPost("/{id:guid}/restore", async (Guid id, ChangeQuotationArchiveRequest request, QuotationService service, CancellationToken token) => Results.Ok(await service.RestoreAsync(id, request, token))).WithName("RestoreQuotation");
        return group;
    }
}
