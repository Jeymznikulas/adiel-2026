using AdielSystem.Api.Security;
using AdielSystem.Application.Settings;

namespace AdielSystem.Api.Endpoints;

public static class SettingsEndpoints
{
    public static RouteGroupBuilder MapSettingsEndpoints(this RouteGroupBuilder group)
    {
        var settings = group.MapGroup("/settings").WithTags("Settings").RequireRateLimiting(SecurityConstants.OwnerRateLimitPolicy);
        settings.MapGet("/company", async (SettingsService service, CancellationToken token) => Results.Ok(await service.GetCompanyAsync(token)))
            .WithName("GetCompanySettings").Produces<CompanySettingsDto>();
        settings.MapPut("/company", async (UpdateCompanySettingsRequest request, SettingsService service, CancellationToken token) => Results.Ok(await service.UpdateCompanyAsync(request, token)))
            .WithName("UpdateCompanySettings").Produces<CompanySettingsDto>().ProducesProblem(400).ProducesProblem(409);
        settings.MapGet("/documents", async (SettingsService service, CancellationToken token) => Results.Ok(await service.GetDocumentDefaultsAsync(token)))
            .WithName("GetDocumentDefaults").Produces<DocumentDefaultsDto>();
        settings.MapPut("/documents", async (UpdateDocumentDefaultsRequest request, SettingsService service, CancellationToken token) => Results.Ok(await service.UpdateDocumentDefaultsAsync(request, token)))
            .WithName("UpdateDocumentDefaults").Produces<DocumentDefaultsDto>().ProducesProblem(400).ProducesProblem(409);
        settings.MapGet("/numbering", async (SettingsService service, CancellationToken token) => Results.Ok(await service.GetDocumentNumberingRulesAsync(token)))
            .WithName("GetDocumentNumberingRules").Produces<IReadOnlyList<DocumentNumberingRuleDto>>();
        settings.MapPut("/numbering", async (UpdateDocumentNumberingRulesRequest request, SettingsService service, CancellationToken token) => Results.Ok(await service.UpdateDocumentNumberingRulesAsync(request, token)))
            .WithName("UpdateDocumentNumberingRules").Produces<IReadOnlyList<DocumentNumberingRuleDto>>().ProducesProblem(400).ProducesProblem(409);
        settings.MapGet("/numbering/{documentType}/preview", async (string documentType, DateOnly? documentDate, SettingsService service, CancellationToken token) => Results.Ok(await service.PreviewDocumentNumberAsync(documentType, documentDate, token)))
            .WithName("PreviewDocumentNumber").Produces<DocumentNumberPreviewDto>().ProducesProblem(400);
        settings.MapPost("/numbering/{documentType}/reserve", async (string documentType, ReserveDocumentNumberRequest request, SettingsService service, CancellationToken token) => Results.Ok(await service.ReserveDocumentNumberAsync(documentType, request, token)))
            .WithName("ReserveDocumentNumber").Produces<DocumentNumberPreviewDto>().ProducesProblem(400);
        settings.MapGet("/options", async (string type, SettingsService service, CancellationToken token) => Results.Ok(await service.ListOptionsAsync(type, token)))
            .WithName("ListBusinessOptions").Produces<IReadOnlyList<BusinessOptionDto>>().ProducesProblem(400);
        settings.MapPost("/options", async (CreateBusinessOptionRequest request, SettingsService service, CancellationToken token) => Results.Created(string.Empty, await service.CreateOptionAsync(request, token)))
            .WithName("CreateBusinessOption").Produces<BusinessOptionDto>(201).ProducesProblem(400).ProducesProblem(409);
        settings.MapPut("/options/order", async (ReorderBusinessOptionsRequest request, SettingsService service, CancellationToken token) => Results.Ok(await service.ReorderOptionsAsync(request, token)))
            .WithName("ReorderBusinessOptions").Produces<IReadOnlyList<BusinessOptionDto>>().ProducesProblem(400).ProducesProblem(409);
        settings.MapPut("/options/{id:guid}", async (Guid id, RenameBusinessOptionRequest request, SettingsService service, CancellationToken token) => Results.Ok(await service.RenameOptionAsync(id, request, token)))
            .WithName("RenameBusinessOption").Produces<BusinessOptionDto>().ProducesProblem(400).ProducesProblem(404).ProducesProblem(409);
        settings.MapPost("/options/{id:guid}/active", async (Guid id, SetBusinessOptionActiveRequest request, SettingsService service, CancellationToken token) => Results.Ok(await service.SetOptionActiveAsync(id, request, token)))
            .WithName("SetBusinessOptionActive").Produces<BusinessOptionDto>().ProducesProblem(400).ProducesProblem(404).ProducesProblem(409);
        settings.MapDelete("/options/{id:guid}", async (Guid id, long version, SettingsService service, CancellationToken token) => { await service.DeleteOptionAsync(id, version, token); return Results.NoContent(); })
            .WithName("DeleteBusinessOption").Produces(204).ProducesProblem(404).ProducesProblem(409);
        return group;
    }
}
