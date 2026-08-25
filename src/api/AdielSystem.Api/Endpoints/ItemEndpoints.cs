using AdielSystem.Api.Security;
using AdielSystem.Application.Items;

namespace AdielSystem.Api.Endpoints;

public static class ItemEndpoints
{
    public static RouteGroupBuilder MapItemEndpoints(this RouteGroupBuilder group)
    {
        var items = group.MapGroup("/items").WithTags("Items").RequireRateLimiting(SecurityConstants.OwnerRateLimitPolicy);
        items.MapGet("/", async (string? search, Guid? supplierId, string? category, string? status, bool? includeArchived, bool? archivedOnly, int? page, int? pageSize, string? sort, ItemService service, CancellationToken token) => Results.Ok(await service.ListAsync(search, supplierId, category, status, includeArchived ?? false, archivedOnly ?? false, page ?? 1, pageSize ?? 100, sort, token))).WithName("ListItems").Produces<ItemPageDto>().ProducesProblem(400);
        items.MapGet("/{id:guid}", async (Guid id, ItemService service, CancellationToken token) => Results.Ok(await service.GetAsync(id, token))).WithName("GetItem").Produces<ItemDto>().ProducesProblem(404);
        items.MapPost("/", async (SaveItemRequest request, ItemService service, CancellationToken token) => { var result = await service.CreateAsync(request, token); return Results.CreatedAtRoute("GetItem", new { id = result.Id }, result); }).WithName("CreateItem").Produces<ItemDto>(201).ProducesProblem(400).ProducesProblem(409);
        items.MapPut("/{id:guid}", async (Guid id, SaveItemRequest request, ItemService service, CancellationToken token) => Results.Ok(await service.UpdateAsync(id, request, token))).WithName("UpdateItem").Produces<ItemDto>().ProducesProblem(400).ProducesProblem(404).ProducesProblem(409);
        items.MapPost("/{id:guid}/archive", async (Guid id, ChangeItemArchiveRequest request, ItemService service, CancellationToken token) => Results.Ok(await service.ArchiveAsync(id, request.Version, token))).WithName("ArchiveItem");
        items.MapPost("/{id:guid}/restore", async (Guid id, ChangeItemArchiveRequest request, ItemService service, CancellationToken token) => Results.Ok(await service.RestoreAsync(id, request.Version, token))).WithName("RestoreItem");
        items.MapPost("/{id:guid}/variants", async (Guid id, SaveItemVariantRequest request, ItemService service, CancellationToken token) => Results.Ok(await service.CreateVariantAsync(id, request, token))).WithName("CreateItemVariant");
        items.MapPut("/{id:guid}/variants/{variantId:guid}", async (Guid id, Guid variantId, SaveItemVariantRequest request, ItemService service, CancellationToken token) => Results.Ok(await service.UpdateVariantAsync(id, variantId, request, token))).WithName("UpdateItemVariant");
        items.MapDelete("/{id:guid}/variants/{variantId:guid}", async (Guid id, Guid variantId, long version, ItemService service, CancellationToken token) => Results.Ok(await service.DeleteVariantAsync(id, variantId, version, token))).WithName("DeleteItemVariant");
        items.MapPost("/{id:guid}/price-adjustments", async (Guid id, AddPriceAdjustmentRequest request, ItemService service, CancellationToken token) => Results.Ok(await service.AddPriceAdjustmentAsync(id, request, token))).WithName("AddItemPriceAdjustment");
        return group;
    }
}
