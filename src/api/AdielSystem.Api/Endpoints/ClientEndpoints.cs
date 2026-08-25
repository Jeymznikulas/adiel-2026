using AdielSystem.Api.Security;
using AdielSystem.Application.Clients;

namespace AdielSystem.Api.Endpoints;

public static class ClientEndpoints
{
    public static RouteGroupBuilder MapClientEndpoints(this RouteGroupBuilder group)
    {
        var clients = group.MapGroup("/clients").WithTags("Clients").RequireRateLimiting(SecurityConstants.OwnerRateLimitPolicy);
        clients.MapGet("/", async (string? search, string? industry, bool? includeArchived, bool? archivedOnly, int? page, int? pageSize, string? sort, ClientService service, CancellationToken token) =>
                Results.Ok(await service.ListAsync(search, industry, includeArchived ?? false, archivedOnly ?? false, page ?? 1, pageSize ?? 12, sort, token)))
            .WithName("ListClients").Produces<ClientPageDto>().ProducesProblem(400);
        clients.MapGet("/industries", async (ClientService service, CancellationToken token) => Results.Ok(await service.ListIndustriesAsync(token)))
            .WithName("ListClientIndustries").Produces<IReadOnlyList<ClientIndustryDto>>();
        clients.MapPost("/industries", async (CreateClientIndustryRequest request, ClientService service, CancellationToken token) =>
                Results.Created(string.Empty, await service.CreateIndustryAsync(request, token)))
            .WithName("CreateClientIndustry").Produces<ClientIndustryDto>(201).ProducesProblem(400).ProducesProblem(409);
        clients.MapPut("/industries/{id:guid}", async (Guid id, RenameClientIndustryRequest request, ClientService service, CancellationToken token) =>
                Results.Ok(await service.RenameIndustryAsync(id, request, token)))
            .WithName("RenameClientIndustry").Produces<ClientIndustryDto>().ProducesProblem(400).ProducesProblem(409);
        clients.MapPost("/industries/{id:guid}/active", async (Guid id, SetClientIndustryActiveRequest request, ClientService service, CancellationToken token) =>
                Results.Ok(await service.SetIndustryActiveAsync(id, request, token)))
            .WithName("SetClientIndustryActive").Produces<ClientIndustryDto>().ProducesProblem(400).ProducesProblem(409);
        clients.MapPut("/industries/order", async (ReorderClientIndustriesRequest request, ClientService service, CancellationToken token) =>
                Results.Ok(await service.ReorderIndustriesAsync(request, token)))
            .WithName("ReorderClientIndustries").Produces<IReadOnlyList<ClientIndustryDto>>().ProducesProblem(400);
        clients.MapDelete("/industries/{id:guid}", async (Guid id, long version, ClientService service, CancellationToken token) =>
            {
                await service.DeleteIndustryAsync(id, version, token);
                return Results.NoContent();
            })
            .WithName("DeleteClientIndustry").Produces(204).ProducesProblem(400).ProducesProblem(409);
        clients.MapGet("/{id:guid}", async (Guid id, ClientService service, CancellationToken token) => Results.Ok(await service.GetAsync(id, token)))
            .WithName("GetClient").Produces<ClientDto>().ProducesProblem(404);
        clients.MapGet("/{id:guid}/timeline", async (Guid id, ClientService service, CancellationToken token) => Results.Ok(await service.GetTimelineAsync(id, token)))
            .WithName("GetClientTimeline").Produces<ClientTimelineDto>().ProducesProblem(404);
        clients.MapPost("/", async (SaveClientRequest request, ClientService service, CancellationToken token) =>
        {
            var result = await service.CreateAsync(request, token);
            return Results.CreatedAtRoute("GetClient", new { id = result.Id }, result);
        }).WithName("CreateClient").Produces<ClientDto>(201).ProducesProblem(400).ProducesProblem(409);
        clients.MapPut("/{id:guid}", async (Guid id, SaveClientRequest request, ClientService service, CancellationToken token) => Results.Ok(await service.UpdateAsync(id, request, token)))
            .WithName("UpdateClient").Produces<ClientDto>().ProducesProblem(400).ProducesProblem(404).ProducesProblem(409);
        clients.MapPost("/{id:guid}/archive", async (Guid id, ChangeClientArchiveRequest request, ClientService service, CancellationToken token) => Results.Ok(await service.ArchiveAsync(id, request.Version, token)))
            .WithName("ArchiveClient").Produces<ClientDto>().ProducesProblem(404).ProducesProblem(409);
        clients.MapPost("/{id:guid}/restore", async (Guid id, ChangeClientArchiveRequest request, ClientService service, CancellationToken token) => Results.Ok(await service.RestoreAsync(id, request.Version, token)))
            .WithName("RestoreClient").Produces<ClientDto>().ProducesProblem(404).ProducesProblem(409);
        return group;
    }
}
