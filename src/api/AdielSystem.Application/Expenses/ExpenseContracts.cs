namespace AdielSystem.Application.Expenses;

public sealed record SaveExpenseRequest(DateOnly ExpenseDate, string Payee, string Category, string? Description, decimal Amount, string PaymentMethod, string? Purchaser, string Status, string? InvoiceUrl, string? Notes, Guid? QuotationId, string? QuotationNumber, string? ProjectName, Guid? PurchaseOrderId, long? Version = null);
public sealed record ChangeExpenseStatusRequest(string Status, string? Reason, long Version, bool ArchiveAfterVoiding = false);
public sealed record ChangeExpenseArchiveRequest(long Version);
public sealed record ExpenseDto(Guid Id, DateOnly ExpenseDate, string Payee, string Category, string Description, decimal Amount, string PaymentMethod, string Purchaser, string Status, string InvoiceUrl, string Notes, Guid? QuotationId, string QuotationNumber, string ProjectName, Guid? PurchaseOrderId, string? VoidReason, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DateTimeOffset? ArchivedAt, long Version);
public sealed record ExpensePageDto(IReadOnlyList<ExpenseDto> Items, int Page, int PageSize, long Total);
