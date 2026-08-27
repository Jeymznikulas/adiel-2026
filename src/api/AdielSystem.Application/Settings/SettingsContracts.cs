namespace AdielSystem.Application.Settings;

public sealed record CompanySettingsDto(string CompanyName, string Address, string MainOfficeNumber, string ClientRelationsNumber, string AccountsNumber, string NewAccountsNumber, string Email, string Tin, DateTimeOffset UpdatedAt, long Version);
public sealed record UpdateCompanySettingsRequest(string CompanyName, string Address, string MainOfficeNumber, string ClientRelationsNumber, string AccountsNumber, string NewAccountsNumber, string Email, string Tin, long Version);

public sealed record DocumentDefaultsDto(string QuotationTerms, string PurchaseOrderTerms, string StatementPaymentInstructions, string PdfFooter, bool LateChargeEnabled, int LateChargeGraceDays, string LateChargeType, decimal LateChargeValue, DateTimeOffset UpdatedAt, long Version);
public sealed record UpdateDocumentDefaultsRequest(string QuotationTerms, string PurchaseOrderTerms, string StatementPaymentInstructions, string PdfFooter, bool LateChargeEnabled, int LateChargeGraceDays, string LateChargeType, decimal LateChargeValue, long Version);

public sealed record DocumentNumberingRuleDto(string DocumentType, string Prefix, int StartingNumber, int Digits, bool IncludeYear, bool ResetYearly, DateTimeOffset UpdatedAt, long Version);
public sealed record UpdateDocumentNumberingRuleRequest(string DocumentType, string Prefix, int StartingNumber, int Digits, bool IncludeYear, bool ResetYearly, long Version);
public sealed record UpdateDocumentNumberingRulesRequest(IReadOnlyList<UpdateDocumentNumberingRuleRequest> Rules);
public sealed record DocumentNumberPreviewDto(string DocumentType, DateOnly DocumentDate, string Number);
public sealed record ReserveDocumentNumberRequest(DateOnly? DocumentDate);

public sealed record BusinessOptionDto(Guid Id, string Type, string Name, bool IsActive, int SortOrder, long UsageCount, DateTimeOffset UpdatedAt, long Version, string? Email);
public sealed record CreateBusinessOptionRequest(string Type, string Name, string? Email = null);
public sealed record RenameBusinessOptionRequest(string Name, long Version, string? Email = null);
public sealed record SetBusinessOptionActiveRequest(bool IsActive, long Version);
public sealed record ReorderBusinessOptionItemRequest(Guid Id, long Version);
public sealed record ReorderBusinessOptionsRequest(string Type, IReadOnlyList<ReorderBusinessOptionItemRequest> Items);
