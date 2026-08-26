namespace AdielSystem.Application.Insights;

public interface IInsightsRepository
{
    Task<DashboardDto> GetDashboardAsync(int trendMonths, DateOnly today, CancellationToken cancellationToken);
    Task<SalesTrackerPageDto> GetSalesAsync(SalesTrackerQuery query, CancellationToken cancellationToken);
    Task<SearchPageDto> SearchAsync(string query, int limit, CancellationToken cancellationToken);
    Task<ArchivePageDto> ListArchiveAsync(string search, string? module, int page, int pageSize, CancellationToken cancellationToken);
    Task<ActivityPageDto> ListActivityAsync(ActivityQuery query, CancellationToken cancellationToken);
}
