namespace AdielSystem.Application.Insights;

public sealed record PeriodTotalsDto(decimal Today, decimal Week, decimal Month);
public sealed record DashboardRangeDto(DateOnly Start, DateOnly End);
public sealed record DashboardRangesDto(DashboardRangeDto Today, DashboardRangeDto Week, DashboardRangeDto Month);
public sealed record DashboardTrendDto(string Key, string Label, decimal Sales, decimal Expenses, decimal Profit);
public sealed record DashboardClientDto(Guid? Id, string Name, string Photo, decimal Sales, long Orders);
public sealed record DashboardTaskDto(Guid Id, string Title, string Priority, DateOnly? DueDate, string AssignedTo);
public sealed record DashboardActionDto(string Id, string Title, string Detail, string Urgency, string Tone, string ActionLabel, string Path, int Priority, string SortDate);
public sealed record ActivityEntryDto(Guid Id, Guid? RecordId, string Timestamp, string Module, string Action, string Entity, string Description, string Actor, string Tone, decimal? Amount, string? Status);
public sealed record DashboardDto(
    DashboardRangesDto Ranges, PeriodTotalsDto Sales, PeriodTotalsDto Expenses, decimal GrossProfit, decimal Margin, decimal ActualRevenue, decimal ProjectExpenses, decimal OperatingExpenses, decimal ProjectProfit, decimal CompanyNetProfit, decimal CollectionsReceived, decimal PaidExpenses, decimal CashPosition, decimal SalesChange, decimal ExpenseChange,
    long TotalClients, long ActiveClients, long NewClients, long RepeatClients, IReadOnlyList<DashboardClientDto> TopClients,
    long UrgentTaskCount, IReadOnlyList<DashboardTaskDto> UrgentTasks,
    decimal OutstandingBalance, decimal OverdueBalance, long OverdueStatementCount, long DueSoonStatementCount,
    long WaitingDeliveryCount, long ForPaymentCount, decimal ForPaymentTotal, long NotSentCount,
    IReadOnlyList<DashboardTrendDto> Trend, IReadOnlyList<DashboardActionDto> Actions, IReadOnlyList<ActivityEntryDto> RecentActivity);

public sealed record SalesTrackerQuery(DateOnly From, DateOnly To, string Search, string Billing, string Collection, string Sort, int Page, int PageSize);
public sealed record SalesStatementDto(Guid Id, string Number, decimal Balance, decimal TotalPayments);
public sealed record SalesRowDto(Guid Id, DateOnly QuotationDate, string QuotationNumber, string ClientName, string Subject, string ProjectLocation, string LeadTime, decimal SubtotalAmount, decimal TotalAmount, decimal EstimatedCost, decimal EstimatedProfit, long ItemCount, decimal ActualExpenses, string BillingStatus, string CollectionStatus, SalesStatementDto? Statement);
public sealed record SalesBucketDto(string Label, decimal Sales, decimal Profit, decimal ActualProfit);
public sealed record SalesSummaryDto(decimal EstimatedRevenue, decimal EstimatedCost, decimal ActualExpenses, decimal EstimatedProfit, decimal ActualProfit, decimal ProfitVariance, decimal ProfitMargin, decimal ApprovedSales, decimal BilledSales, decimal Collections, decimal Receivables);
public sealed record SalesTrackerPageDto(IReadOnlyList<SalesRowDto> Items, long Total, int Page, int PageSize, SalesSummaryDto Summary, IReadOnlyList<SalesBucketDto> Chart);

public sealed record SearchResultDto(string Id, string Type, string Title, string Detail, string Path);
public sealed record SearchPageDto(IReadOnlyList<SearchResultDto> Items);

public sealed record ArchiveRowDto(string Module, Guid Id, string Title, string Detail, DateTimeOffset ArchivedAt, long Version);
public sealed record ArchivePageDto(IReadOnlyList<ArchiveRowDto> Items, long Total, int Page, int PageSize);

public sealed record ActivityQuery(string Search, string? Module, string? Action, DateOnly? Date, string Sort, int Page, int PageSize);
public sealed record ActivitySummaryDto(long Total, long Today, decimal ExpenseValue, long Actors);
public sealed record ActivityPageDto(IReadOnlyList<ActivityEntryDto> Items, long Total, int Page, int PageSize, ActivitySummaryDto Summary);
