namespace AdielSystem.Application.Quotations;

public sealed record SaveQuotationLineRequest(Guid? ItemId, Guid? VariantId, string? Photo, string ItemName, string? VariantLabel, string? ProductCode, string UnitOfMeasure, decimal Quantity, decimal UnitPrice, decimal UnitCost);
public sealed record SaveQuotationChargeRequest(string Label, decimal Amount);
public sealed record SaveQuotationRequest(DateOnly QuotationDate, Guid? ClientId, string ClientName, Guid? ContactId, string ContactPerson, string? Subject, string? ProjectLocation, string? LeadTime, string? Notes, string? Terms, bool VatEnabled, IReadOnlyList<SaveQuotationLineRequest> Lines, IReadOnlyList<SaveQuotationChargeRequest> Charges, string? Intent = "draft", long? Version = null);
public sealed record ChangeQuotationStatusRequest(string Status, string? Reason, long Version, bool ArchiveAfterVoiding = false);
public sealed record ChangeQuotationArchiveRequest(long Version);
public sealed record QuotationLineDto(Guid Id, Guid? ItemId, Guid? VariantId, string Photo, string ItemName, string VariantLabel, string ProductCode, string UnitOfMeasure, decimal Quantity, decimal UnitPrice, decimal UnitCost, decimal LineAmount);
public sealed record QuotationChargeDto(Guid Id, string Label, decimal Amount, int Position);
public sealed record QuotationDto(Guid Id, string QuotationNumber, DateOnly QuotationDate, Guid? ClientId, string ClientName, Guid? ContactId, string ContactPerson, string Subject, string ProjectLocation, string LeadTime, string Notes, string Terms, decimal SubtotalAmount, bool VatEnabled, decimal VatRate, decimal VatAmount, decimal TotalAmount, decimal EstimatedProfit, string Status, string? RejectionReason, string? VoidReason, IReadOnlyList<QuotationLineDto> Lines, IReadOnlyList<QuotationChargeDto> Charges, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DateTimeOffset? ArchivedAt, long Version);
public sealed record QuotationPageDto(IReadOnlyList<QuotationDto> Items, int Page, int PageSize, long Total);
