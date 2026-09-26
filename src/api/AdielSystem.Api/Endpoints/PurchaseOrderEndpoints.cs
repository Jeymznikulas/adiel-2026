using AdielSystem.Api.Security;
using AdielSystem.Application.PurchaseOrders;

namespace AdielSystem.Api.Endpoints;

public static class PurchaseOrderEndpoints
{
    public static RouteGroupBuilder MapPurchaseOrderEndpoints(this RouteGroupBuilder group)
    {
        var orders = group.MapGroup("/purchase-orders").WithTags("Purchase Orders").RequireRateLimiting(SecurityConstants.OwnerRateLimitPolicy);
        orders.MapGet("/", async (string? search, Guid? supplierId, string? status, bool? archivedOnly, int? page, int? pageSize, PurchaseOrderService service, CancellationToken token) => Results.Ok(await service.ListAsync(search, supplierId, status, archivedOnly ?? false, page ?? 1, pageSize ?? 100, token))).WithName("ListPurchaseOrders");
        orders.MapGet("/{id:guid}", async (Guid id, PurchaseOrderService service, CancellationToken token) => Results.Ok(await service.GetAsync(id, token))).WithName("GetPurchaseOrder");
        orders.MapPost("/", async (SavePurchaseOrderRequest request, PurchaseOrderService service, CancellationToken token) => { var value = await service.CreateAsync(request, token); return Results.CreatedAtRoute("GetPurchaseOrder", new { id = value.Id }, value); }).WithName("CreatePurchaseOrder");
        orders.MapPut("/{id:guid}", async (Guid id, SavePurchaseOrderRequest request, PurchaseOrderService service, CancellationToken token) => Results.Ok(await service.UpdateAsync(id, request, token))).WithName("UpdatePurchaseOrder");
        orders.MapPost("/{id:guid}/status", async (Guid id, ChangePurchaseOrderStatusRequest request, PurchaseOrderService service, CancellationToken token) => Results.Ok(await service.ChangeStatusAsync(id, request, token))).WithName("ChangePurchaseOrderStatus");
        orders.MapPost("/{id:guid}/payments", async (Guid id, RecordPurchaseOrderPaymentRequest request, PurchaseOrderService service, CancellationToken token) => Results.Ok(await service.RecordPaymentAsync(id, request, token))).WithName("RecordPurchaseOrderPayment");
        orders.MapPost("/{id:guid}/archive", async (Guid id, ChangePurchaseOrderArchiveRequest request, PurchaseOrderService service, CancellationToken token) => Results.Ok(await service.ArchiveAsync(id, request, token))).WithName("ArchivePurchaseOrder");
        orders.MapPost("/{id:guid}/restore", async (Guid id, ChangePurchaseOrderArchiveRequest request, PurchaseOrderService service, CancellationToken token) => Results.Ok(await service.RestoreAsync(id, request, token))).WithName("RestorePurchaseOrder");
        return group;
    }
}
