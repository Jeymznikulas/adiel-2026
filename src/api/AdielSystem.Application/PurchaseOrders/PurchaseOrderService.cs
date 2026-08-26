using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using AdielSystem.Application.Settings;

namespace AdielSystem.Application.PurchaseOrders;

public sealed class PurchaseOrderService(IPurchaseOrderRepository repository, SettingsService settings, ICurrentUserAccessor currentUser)
{
    public Task<PurchaseOrderPageDto> ListAsync(string? search, string? status, bool archivedOnly, int page, int pageSize, CancellationToken token) => page <= 0 || pageSize is < 1 or > 100 ? throw new RequestValidationException("Page must be greater than zero and page size must be between 1 and 100.") : repository.ListAsync(search?.Trim() ?? string.Empty, string.IsNullOrWhiteSpace(status) ? null : status.Trim(), archivedOnly, page, pageSize, token);
    public async Task<PurchaseOrderDto> GetAsync(Guid id, CancellationToken token) => await repository.GetAsync(id, token) ?? throw new ResourceNotFoundException($"Purchase order '{id}' was not found.");
    public async Task<PurchaseOrderDto> CreateAsync(SavePurchaseOrderRequest request, CancellationToken token) { Validate(request); var number = (await settings.ReserveDocumentNumberAsync("purchase_order", new(request.OrderDate), token)).Number; return await repository.CreateAsync(request, number, currentUser.GetRequiredUser(), token); }
    public Task<PurchaseOrderDto> UpdateAsync(Guid id, SavePurchaseOrderRequest request, CancellationToken token) { if (request.Version is null or <= 0) throw new RequestValidationException("The current purchase order version is required."); Validate(request); return repository.UpdateAsync(id, request, currentUser.GetRequiredUser(), token); }
    public Task<PurchaseOrderDto> ChangeStatusAsync(Guid id, ChangePurchaseOrderStatusRequest request, CancellationToken token) => request.Version <= 0 ? throw new RequestValidationException("The current purchase order version is required.") : repository.ChangeStatusAsync(id, request, currentUser.GetRequiredUser(), token);
    public Task<PurchaseOrderDto> ArchiveAsync(Guid id, ChangePurchaseOrderArchiveRequest request, CancellationToken token) => repository.SetArchivedAsync(id, request, true, currentUser.GetRequiredUser(), token);
    public Task<PurchaseOrderDto> RestoreAsync(Guid id, ChangePurchaseOrderArchiveRequest request, CancellationToken token) => repository.SetArchivedAsync(id, request, false, currentUser.GetRequiredUser(), token);
    private static void Validate(SavePurchaseOrderRequest r)
    {
        if (r.OrderDate == default || r.Lines is null || r.Charges is null || r.Lines.Any(x => string.IsNullOrWhiteSpace(x.ItemName) || string.IsNullOrWhiteSpace(x.UnitOfMeasure) || x.Quantity <= 0 || x.UnitCost < 0) || r.Charges.Any(x => string.IsNullOrWhiteSpace(x.Label) || x.Amount < 0)) throw new RequestValidationException("Purchase order lines and charges are invalid.");
        if (string.Equals(r.Intent, "send", StringComparison.OrdinalIgnoreCase) && (r.SupplierId is null || r.ClientId is null || string.IsNullOrWhiteSpace(r.ContactPerson) || string.IsNullOrWhiteSpace(r.DeliveryLocation) || r.Lines.Count == 0)) throw new RequestValidationException("Complete the supplier, client, contact, delivery location, and lines before sending the purchase order.");
    }
}
