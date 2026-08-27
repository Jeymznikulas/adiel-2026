using AdielSystem.Api.Security;
using AdielSystem.Application.Insights;

namespace AdielSystem.Api.Endpoints;

public static class InsightEndpoints
{
    public static RouteGroupBuilder MapInsightEndpoints(this RouteGroupBuilder group)
    {
        var insights = group.WithTags("Insights").RequireRateLimiting(SecurityConstants.OwnerRateLimitPolicy);
        insights.MapGet("/dashboard", async (int? trendMonths, DateOnly? from, DateOnly? to, InsightsService service, CancellationToken token) => Results.Ok(await service.GetDashboardAsync(trendMonths ?? 6, from, to, token)))
            .WithName("GetDashboard").Produces<DashboardDto>().ProducesProblem(400);
        insights.MapGet("/sales-tracker", async (DateOnly from, DateOnly to, string? search, string? billing, string? collection, string? sort, int? page, int? pageSize, InsightsService service, CancellationToken token) => Results.Ok(await service.GetSalesAsync(from, to, search, billing, collection, sort, page ?? 1, pageSize ?? 30, token)))
            .WithName("GetSalesTracker").Produces<SalesTrackerPageDto>().ProducesProblem(400);
        insights.MapGet("/search", async (string? query, int? limit, InsightsService service, CancellationToken token) => Results.Ok(await service.SearchAsync(query, limit ?? 12, token)))
            .WithName("SearchBusinessRecords").Produces<SearchPageDto>().ProducesProblem(400);
        insights.MapGet("/archive", async (string? search, string? module, int? page, int? pageSize, InsightsService service, CancellationToken token) => Results.Ok(await service.ListArchiveAsync(search, module, page ?? 1, pageSize ?? 30, token)))
            .WithName("ListUnifiedArchive").Produces<ArchivePageDto>().ProducesProblem(400);
        insights.MapGet("/activity", async (string? search, string? module, string? action, DateOnly? date, Guid? recordId, string? sort, int? page, int? pageSize, InsightsService service, CancellationToken token) => Results.Ok(await service.ListActivityAsync(search, module, action, date, recordId, sort, page ?? 1, pageSize ?? 30, token)))
            .WithName("ListActivity").Produces<ActivityPageDto>().ProducesProblem(400);
        return group;
    }
}
