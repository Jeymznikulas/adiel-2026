using AdielSystem.Application.Common;

namespace AdielSystem.Application.Insights;

public sealed class InsightsService(IInsightsRepository repository)
{
    private static readonly string[] SalesSortValues = ["newest", "oldest", "amount", "client"];
    private static readonly string[] ActivitySortValues = ["newest", "oldest", "module", "user"];

    public Task<DashboardDto> GetDashboardAsync(int trendMonths, DateOnly? from, DateOnly? to, CancellationToken token)
    {
        if (trendMonths is not (6 or 12)) throw new RequestValidationException("Trend months must be 6 or 12.");
        if (from is not null && to is not null && from > to) throw new RequestValidationException("The dashboard start date must not be after the end date.");
        if (from is null != to is null) throw new RequestValidationException("Choose both dashboard start and end dates.");
        return repository.GetDashboardAsync(trendMonths, DateOnly.FromDateTime(DateTime.UtcNow), from, to, token);
    }

    public Task<SalesTrackerPageDto> GetSalesAsync(DateOnly from, DateOnly to, string? search, string? billing, string? collection, string? sort, int page, int pageSize, CancellationToken token)
    {
        if (from > to) throw new RequestValidationException("The sales start date must not be after the end date.");
        ValidatePage(page, pageSize);
        var normalizedBilling = NormalizeSalesFilter(billing, ["All billing", "Unbilled", "Draft SOA", "Billed"], "billing");
        var normalizedCollection = NormalizeSalesFilter(collection, ["All collections", "Unbilled", "Awaiting issue", "Unpaid", "Partially Paid", "Paid", "Overdue"], "collection");
        var normalizedSort = NormalizeSort(sort, SalesSortValues, "Sales");
        return repository.GetSalesAsync(new(from, to, search?.Trim() ?? string.Empty, normalizedBilling, normalizedCollection, normalizedSort, page, pageSize), token);
    }

    public Task<SearchPageDto> SearchAsync(string? query, int limit, CancellationToken token)
    {
        var normalized = query?.Trim() ?? string.Empty;
        if (normalized.Length is < 2 or > 200) throw new RequestValidationException("Search text must be between 2 and 200 characters.");
        if (limit is < 1 or > 25) throw new RequestValidationException("Search limit must be between 1 and 25.");
        return repository.SearchAsync(normalized, limit, token);
    }

    public Task<ArchivePageDto> ListArchiveAsync(string? search, string? module, int page, int pageSize, CancellationToken token)
    {
        ValidatePage(page, pageSize);
        var normalizedModule = string.IsNullOrWhiteSpace(module) ? null : module.Trim();
        if (normalizedModule is not null && !ArchiveModules.Contains(normalizedModule, StringComparer.Ordinal)) throw new RequestValidationException("Archive module is invalid.");
        return repository.ListArchiveAsync(search?.Trim() ?? string.Empty, normalizedModule, page, pageSize, token);
    }

    public Task<ActivityPageDto> ListActivityAsync(string? search, string? module, string? action, DateOnly? date, Guid? recordId, string? sort, int page, int pageSize, CancellationToken token)
    {
        ValidatePage(page, pageSize);
        var normalizedModule = string.IsNullOrWhiteSpace(module) || module == "All modules" ? null : module.Trim();
        if (normalizedModule is not null && !ArchiveModules.Contains(normalizedModule, StringComparer.Ordinal)) throw new RequestValidationException("Activity module is invalid.");
        var normalizedAction = string.IsNullOrWhiteSpace(action) || action == "All actions" ? null : action.Trim();
        if (normalizedAction is not null && !ActivityActions.Contains(normalizedAction, StringComparer.Ordinal)) throw new RequestValidationException("Activity action is invalid.");
        return repository.ListActivityAsync(new(search?.Trim() ?? string.Empty, normalizedModule, normalizedAction, date, recordId, NormalizeSort(sort, ActivitySortValues, "Activity"), page, pageSize), token);
    }

    private static readonly string[] ArchiveModules = ["Tasks", "Items", "Expenses", "Suppliers", "Clients", "Quotations", "Purchase Orders", "Statements of Account"];
    private static readonly string[] ActivityActions = ["Created", "Updated", "Deleted", "Archived", "Restored", "Soft deleted", "Voided", "Status changed", "Payment recorded", "Payment reversed", "Subtask added", "Subtask updated", "Subtask removed", "Added to Expenses", "Removed from Expenses"];
    private static void ValidatePage(int page, int pageSize) { if (page <= 0) throw new RequestValidationException("Page must be greater than zero."); if (pageSize is < 1 or > 100) throw new RequestValidationException("Page size must be between 1 and 100."); }
    private static string NormalizeSort(string? value, string[] accepted, string subject) { var normalized = string.IsNullOrWhiteSpace(value) ? accepted[0] : value.Trim().ToLowerInvariant(); if (!accepted.Contains(normalized)) throw new RequestValidationException($"{subject} sort is invalid."); return normalized; }
    private static string NormalizeSalesFilter(string? value, string[] accepted, string subject) { var normalized = string.IsNullOrWhiteSpace(value) ? accepted[0] : value.Trim(); if (!accepted.Contains(normalized, StringComparer.Ordinal)) throw new RequestValidationException($"Sales {subject} filter is invalid."); return normalized; }
}
