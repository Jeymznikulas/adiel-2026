using AdielSystem.Api.Security;
using AdielSystem.Application.Suppliers;

namespace AdielSystem.Api.Endpoints;

public static class SupplierEndpoints
{
    public static RouteGroupBuilder MapSupplierEndpoints(this RouteGroupBuilder group)
    {
        var suppliers = group.MapGroup("/suppliers").WithTags("Suppliers").RequireRateLimiting(SecurityConstants.OwnerRateLimitPolicy);
        suppliers.MapGet("/", async (string? search, string? type, bool? includeArchived, bool? archivedOnly, int? page, int? pageSize, string? sort, SupplierService service, CancellationToken token) =>
                Results.Ok(await service.ListAsync(search, type, includeArchived ?? false, archivedOnly ?? false, page ?? 1, pageSize ?? 100, sort, token)))
            .WithName("ListSuppliers").Produces<SupplierPageDto>().ProducesProblem(400);
        suppliers.MapGet("/{id:guid}", async (Guid id, SupplierService service, CancellationToken token) => Results.Ok(await service.GetAsync(id, token)))
            .WithName("GetSupplier").Produces<SupplierDto>().ProducesProblem(404);
        suppliers.MapPost("/", async (SaveSupplierRequest request, SupplierService service, CancellationToken token) =>
        {
            var result = await service.CreateAsync(request, token);
            return Results.CreatedAtRoute("GetSupplier", new { id = result.Id }, result);
        }).WithName("CreateSupplier").Produces<SupplierDto>(201).ProducesProblem(400).ProducesProblem(409);
        suppliers.MapPut("/{id:guid}", async (Guid id, SaveSupplierRequest request, SupplierService service, CancellationToken token) => Results.Ok(await service.UpdateAsync(id, request, token)))
            .WithName("UpdateSupplier").Produces<SupplierDto>().ProducesProblem(400).ProducesProblem(404).ProducesProblem(409);
        suppliers.MapPost("/{id:guid}/archive", async (Guid id, ChangeSupplierArchiveRequest request, SupplierService service, CancellationToken token) => Results.Ok(await service.ArchiveAsync(id, request.Version, token)))
            .WithName("ArchiveSupplier").Produces<SupplierDto>().ProducesProblem(400).ProducesProblem(404).ProducesProblem(409);
        suppliers.MapPost("/{id:guid}/restore", async (Guid id, ChangeSupplierArchiveRequest request, SupplierService service, CancellationToken token) => Results.Ok(await service.RestoreAsync(id, request.Version, token)))
            .WithName("RestoreSupplier").Produces<SupplierDto>().ProducesProblem(400).ProducesProblem(404).ProducesProblem(409);
        return group;
    }
}
