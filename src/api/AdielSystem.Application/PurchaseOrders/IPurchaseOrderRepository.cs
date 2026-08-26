using AdielSystem.Application.Security;

namespace AdielSystem.Application.PurchaseOrders;

public interface IPurchaseOrderRepository
{
    Task<PurchaseOrderPageDto> ListAsync(string search, string? status, bool archivedOnly, int page, int pageSize, CancellationToken token);
    Task<PurchaseOrderDto?> GetAsync(Guid id, CancellationToken token);
    Task<PurchaseOrderDto> CreateAsync(SavePurchaseOrderRequest request, string number, CurrentUser actor, CancellationToken token);
    Task<PurchaseOrderDto> UpdateAsync(Guid id, SavePurchaseOrderRequest request, CurrentUser actor, CancellationToken token);
    Task<PurchaseOrderDto> ChangeStatusAsync(Guid id, ChangePurchaseOrderStatusRequest request, CurrentUser actor, CancellationToken token);
    Task<PurchaseOrderDto> SetArchivedAsync(Guid id, ChangePurchaseOrderArchiveRequest request, bool archived, CurrentUser actor, CancellationToken token);
}
