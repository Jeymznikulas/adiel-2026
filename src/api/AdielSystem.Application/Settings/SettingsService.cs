using System.Net.Mail;
using AdielSystem.Application.Common;
using AdielSystem.Application.Security;

namespace AdielSystem.Application.Settings;

public sealed class SettingsService(ISettingsRepository repository, ICurrentUserAccessor currentUserAccessor)
{
    private static readonly HashSet<string> OptionTypes = ["expense_category", "payment_method", "client_industry", "supplier_category", "item_category", "task_assignee"];
    private static readonly HashSet<string> DocumentTypes = ["quotation", "purchase_order", "statement_of_account"];

    public async Task<CompanySettingsDto> GetCompanyAsync(CancellationToken cancellationToken) => ToDto(await repository.GetCompanyAsync(cancellationToken));

    public async Task<CompanySettingsDto> UpdateCompanyAsync(UpdateCompanySettingsRequest request, CancellationToken cancellationToken)
    {
        if (request.Version <= 0) throw new RequestValidationException("The current company-settings version is required.");
        var companyName = Required(request.CompanyName, "Company name", 200);
        var address = Required(request.Address, "Business address", 500);
        var mainOffice = Required(request.MainOfficeNumber, "Main office number", 60);
        var email = Required(request.Email, "Company email", 254);
        try { _ = new MailAddress(email); } catch (FormatException) { throw new RequestValidationException("Enter a valid company email address."); }
        var settings = new CompanySettings(companyName, address, mainOffice, Optional(request.ClientRelationsNumber, 60), Optional(request.AccountsNumber, 60), Optional(request.NewAccountsNumber, 60), email, Required(request.Tin, "TIN", 60), DateTimeOffset.MinValue, request.Version);
        return ToDto(await repository.UpdateCompanyAsync(settings, request.Version, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    public async Task<DocumentDefaultsDto> GetDocumentDefaultsAsync(CancellationToken cancellationToken) => ToDto(await repository.GetDocumentDefaultsAsync(cancellationToken));

    public async Task<DocumentDefaultsDto> UpdateDocumentDefaultsAsync(UpdateDocumentDefaultsRequest request, CancellationToken cancellationToken)
    {
        if (request.Version <= 0) throw new RequestValidationException("The current document-defaults version is required.");
        if (request.LateChargeGraceDays is < 0 or > 90) throw new RequestValidationException("Late-charge grace days must be between 0 and 90.");
        if (request.LateChargeType is not ("Percentage" or "Fixed amount")) throw new RequestValidationException("Late-charge type must be Percentage or Fixed amount.");
        if (request.LateChargeValue < 0 || request.LateChargeEnabled && request.LateChargeValue <= 0) throw new RequestValidationException("Enabled late charges require a value greater than zero.");
        if (request.LateChargeType == "Percentage" && request.LateChargeValue > 100) throw new RequestValidationException("Percentage late charges cannot exceed 100%.");
        var settings = new DocumentDefaults(Limited(request.QuotationTerms, 10_000), Limited(request.PurchaseOrderTerms, 10_000), Limited(request.StatementPaymentInstructions, 5_000), Limited(request.PdfFooter, 1_000), request.LateChargeEnabled, request.LateChargeGraceDays, request.LateChargeType, request.LateChargeValue, DateTimeOffset.MinValue, request.Version);
        return ToDto(await repository.UpdateDocumentDefaultsAsync(settings, request.Version, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    public async Task<IReadOnlyList<DocumentNumberingRuleDto>> GetDocumentNumberingRulesAsync(CancellationToken cancellationToken) =>
        (await repository.GetDocumentNumberingRulesAsync(cancellationToken)).Select(ToDto).ToArray();

    public async Task<IReadOnlyList<DocumentNumberingRuleDto>> UpdateDocumentNumberingRulesAsync(UpdateDocumentNumberingRulesRequest request, CancellationToken cancellationToken)
    {
        if (request.Rules is null || request.Rules.Count != DocumentTypes.Count || request.Rules.Select(rule => rule.DocumentType?.Trim().ToLowerInvariant()).Distinct().Count() != DocumentTypes.Count)
            throw new RequestValidationException("Provide each document-numbering rule once.");
        var rules = request.Rules.Select(NormalizeNumberingRule).ToArray();
        if (rules.Select(rule => rule.Prefix).Distinct(StringComparer.OrdinalIgnoreCase).Count() != rules.Length)
            throw new RequestValidationException("Use a different prefix for each document type.");
        return (await repository.UpdateDocumentNumberingRulesAsync(rules, currentUserAccessor.GetRequiredUser(), cancellationToken)).Select(ToDto).ToArray();
    }

    public async Task<DocumentNumberPreviewDto> PreviewDocumentNumberAsync(string documentType, DateOnly? documentDate, CancellationToken cancellationToken)
    {
        var type = ValidDocumentType(documentType);
        var date = ValidDocumentDate(documentDate);
        return new DocumentNumberPreviewDto(type, date, await repository.PreviewDocumentNumberAsync(type, date, cancellationToken));
    }

    public async Task<DocumentNumberPreviewDto> ReserveDocumentNumberAsync(string documentType, ReserveDocumentNumberRequest request, CancellationToken cancellationToken)
    {
        var type = ValidDocumentType(documentType);
        var date = ValidDocumentDate(request.DocumentDate);
        return new DocumentNumberPreviewDto(type, date, await repository.ReserveDocumentNumberAsync(type, date, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    public async Task<IReadOnlyList<BusinessOptionDto>> ListOptionsAsync(string type, CancellationToken cancellationToken) =>
        (await repository.ListOptionsAsync(ValidType(type), cancellationToken)).Select(ToDto).ToArray();

    public async Task<BusinessOptionDto> CreateOptionAsync(CreateBusinessOptionRequest request, CancellationToken cancellationToken) =>
        ToDto(await repository.CreateOptionAsync(ValidType(request.Type), OptionName(request.Name), currentUserAccessor.GetRequiredUser(), cancellationToken));

    public async Task<BusinessOptionDto> RenameOptionAsync(Guid id, RenameBusinessOptionRequest request, CancellationToken cancellationToken)
    {
        RequireVersion(request.Version);
        return ToDto(await repository.RenameOptionAsync(id, OptionName(request.Name), request.Version, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    public async Task<BusinessOptionDto> SetOptionActiveAsync(Guid id, SetBusinessOptionActiveRequest request, CancellationToken cancellationToken)
    {
        RequireVersion(request.Version);
        return ToDto(await repository.SetOptionActiveAsync(id, request.IsActive, request.Version, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    public async Task<IReadOnlyList<BusinessOptionDto>> ReorderOptionsAsync(ReorderBusinessOptionsRequest request, CancellationToken cancellationToken)
    {
        var type = ValidType(request.Type);
        if (request.Items is null || request.Items.Count == 0 || request.Items.Any(item => item.Version <= 0) || request.Items.Select(item => item.Id).Distinct().Count() != request.Items.Count)
            throw new RequestValidationException("Provide every option once with its current version.");
        return (await repository.ReorderOptionsAsync(type, request.Items.Select(item => new ReorderBusinessOption(item.Id, item.Version)).ToArray(), currentUserAccessor.GetRequiredUser(), cancellationToken)).Select(ToDto).ToArray();
    }

    public async Task DeleteOptionAsync(Guid id, long version, CancellationToken cancellationToken)
    {
        RequireVersion(version);
        await repository.DeleteOptionAsync(id, version, currentUserAccessor.GetRequiredUser(), cancellationToken);
    }

    private static string ValidType(string? value)
    {
        var normalized = value?.Trim().ToLowerInvariant() ?? string.Empty;
        return OptionTypes.Contains(normalized) ? normalized : throw new RequestValidationException("Unsupported business-option type.");
    }
    private static string ValidDocumentType(string? value)
    {
        var normalized = value?.Trim().ToLowerInvariant() ?? string.Empty;
        return DocumentTypes.Contains(normalized) ? normalized : throw new RequestValidationException("Unsupported document type.");
    }
    private static DocumentNumberingRule NormalizeNumberingRule(UpdateDocumentNumberingRuleRequest request)
    {
        RequireNumberingVersion(request.Version);
        var prefix = Required(request.Prefix, "Document prefix", 12).ToUpperInvariant();
        if (!prefix.All(character => char.IsAsciiLetterOrDigit(character) || character is '_' or '-')) throw new RequestValidationException("Document prefixes may use only letters, numbers, hyphens, and underscores.");
        if (request.StartingNumber is < 1 or > 99_999_999) throw new RequestValidationException("Starting number must be between 1 and 99999999.");
        if (request.Digits is < 2 or > 8) throw new RequestValidationException("Number width must be between 2 and 8 digits.");
        if (request.ResetYearly && !request.IncludeYear) throw new RequestValidationException("Yearly resets require the year in the document number.");
        return new DocumentNumberingRule(ValidDocumentType(request.DocumentType), prefix, request.StartingNumber, request.Digits, request.IncludeYear, request.ResetYearly, DateTimeOffset.MinValue, request.Version);
    }
    private static DateOnly ValidDocumentDate(DateOnly? value)
    {
        var date = value ?? DateOnly.FromDateTime(DateTime.UtcNow);
        if (date.Year is < 2000 or > 9999) throw new RequestValidationException("Document date must be between the years 2000 and 9999.");
        return date;
    }
    private static string OptionName(string? value) => Required(value, "Option name", 60);
    private static string Required(string? value, string label, int maximum) { var result = value?.Trim() ?? string.Empty; if (result.Length is 0 || result.Length > maximum) throw new RequestValidationException($"{label} must be between 1 and {maximum} characters."); return result; }
    private static string Optional(string? value, int maximum) { var result = value?.Trim() ?? string.Empty; if (result.Length > maximum) throw new RequestValidationException($"This value cannot exceed {maximum} characters."); return result; }
    private static string Limited(string? value, int maximum) { var result = value?.Trim() ?? string.Empty; if (result.Length > maximum) throw new RequestValidationException($"This document default cannot exceed {maximum} characters."); return result; }
    private static void RequireVersion(long version) { if (version <= 0) throw new RequestValidationException("The current option version is required."); }
    private static void RequireNumberingVersion(long version) { if (version <= 0) throw new RequestValidationException("The current document-numbering version is required."); }
    private static CompanySettingsDto ToDto(CompanySettings value) => new(value.CompanyName, value.Address, value.MainOfficeNumber, value.ClientRelationsNumber, value.AccountsNumber, value.NewAccountsNumber, value.Email, value.Tin, value.UpdatedAt, value.Version);
    private static DocumentDefaultsDto ToDto(DocumentDefaults value) => new(value.QuotationTerms, value.PurchaseOrderTerms, value.StatementPaymentInstructions, value.PdfFooter, value.LateChargeEnabled, value.LateChargeGraceDays, value.LateChargeType, value.LateChargeValue, value.UpdatedAt, value.Version);
    private static DocumentNumberingRuleDto ToDto(DocumentNumberingRule value) => new(value.DocumentType, value.Prefix, value.StartingNumber, value.Digits, value.IncludeYear, value.ResetYearly, value.UpdatedAt, value.Version);
    private static BusinessOptionDto ToDto(BusinessOption value) => new(value.Id, value.Type, value.Name, value.IsActive, value.SortOrder, value.UsageCount, value.UpdatedAt, value.Version);
}
