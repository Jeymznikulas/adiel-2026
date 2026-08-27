using AdielSystem.Application.Security;

namespace AdielSystem.Application.Settings;

public interface ISettingsRepository
{
    Task<CompanySettings> GetCompanyAsync(CancellationToken cancellationToken);
    Task<CompanySettings> UpdateCompanyAsync(CompanySettings settings, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken);
    Task<DocumentDefaults> GetDocumentDefaultsAsync(CancellationToken cancellationToken);
    Task<DocumentDefaults> UpdateDocumentDefaultsAsync(DocumentDefaults settings, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken);
    Task<IReadOnlyList<DocumentNumberingRule>> GetDocumentNumberingRulesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<DocumentNumberingRule>> UpdateDocumentNumberingRulesAsync(IReadOnlyList<DocumentNumberingRule> rules, CurrentUser actor, CancellationToken cancellationToken);
    Task<string> PreviewDocumentNumberAsync(string documentType, DateOnly documentDate, CancellationToken cancellationToken);
    Task<string> ReserveDocumentNumberAsync(string documentType, DateOnly documentDate, CurrentUser actor, CancellationToken cancellationToken);
    Task<IReadOnlyList<BusinessOption>> ListOptionsAsync(string type, CancellationToken cancellationToken);
    Task<BusinessOption> CreateOptionAsync(string type, string name, string? email, CurrentUser actor, CancellationToken cancellationToken);
    Task<BusinessOption> RenameOptionAsync(Guid id, string name, string? email, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken);
    Task<BusinessOption> SetOptionActiveAsync(Guid id, bool isActive, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken);
    Task<IReadOnlyList<BusinessOption>> ReorderOptionsAsync(string type, IReadOnlyList<ReorderBusinessOption> items, CurrentUser actor, CancellationToken cancellationToken);
    Task DeleteOptionAsync(Guid id, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken);
}

public sealed record CompanySettings(string CompanyName, string Address, string MainOfficeNumber, string ClientRelationsNumber, string AccountsNumber, string NewAccountsNumber, string Email, string Tin, DateTimeOffset UpdatedAt, long Version);
public sealed record DocumentDefaults(string QuotationTerms, string PurchaseOrderTerms, string StatementPaymentInstructions, string PdfFooter, bool LateChargeEnabled, int LateChargeGraceDays, string LateChargeType, decimal LateChargeValue, DateTimeOffset UpdatedAt, long Version);
public sealed record DocumentNumberingRule(string DocumentType, string Prefix, int StartingNumber, int Digits, bool IncludeYear, bool ResetYearly, DateTimeOffset UpdatedAt, long Version);
public sealed record BusinessOption(Guid Id, string Type, string Name, bool IsActive, int SortOrder, long UsageCount, DateTimeOffset UpdatedAt, long Version, string? Email);
public sealed record ReorderBusinessOption(Guid Id, long Version);
