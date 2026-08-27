using AdielSystem.Application.Insights;
using Npgsql;
using NpgsqlTypes;

namespace AdielSystem.Infrastructure.Insights;

internal sealed class InsightsRepository(NpgsqlDataSource dataSource) : IInsightsRepository
{
    public async Task<DashboardDto> GetDashboardAsync(int trendMonths, DateOnly today, DateOnly? from, DateOnly? to, CancellationToken token)
    {
        var weekStart = today.AddDays(-((int)today.DayOfWeek + 6) % 7);
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var previousMonthStart = monthStart.AddMonths(-1);
        var previousComparableEnd = previousMonthStart.AddDays(Math.Min(today.Day, DateTime.DaysInMonth(previousMonthStart.Year, previousMonthStart.Month)) - 1);
        var dueSoon = today.AddDays(7);
        var taskAttention = today.AddDays(3);
        await using var connection = await dataSource.OpenConnectionAsync(token);
        var metrics = await ReadDashboardMetricsAsync(connection, today, weekStart, monthStart, previousMonthStart, previousComparableEnd, token);
        var clients = await ReadClientMetricsAsync(connection, monthStart, token);
        var tasks = await ReadUrgentTasksAsync(connection, taskAttention, token);
        var statements = await ReadStatementMetricsAsync(connection, today, dueSoon, token);
        var orders = await ReadPurchaseOrderMetricsAsync(connection, token);
        var trend = await ReadTrendAsync(connection, trendMonths, from, to, token);
        var actions = await ReadActionsAsync(connection, today, dueSoon, taskAttention, token);
        var activity = await ReadRecentActivityAsync(connection, token);
        var ranges = new DashboardRangesDto(new(today, today), new(weekStart, today), new(monthStart, today));
        return new(ranges, metrics.Sales, metrics.Expenses, metrics.GrossProfit, metrics.Margin, metrics.ActualRevenue, metrics.ProjectExpenses, metrics.OperatingExpenses, metrics.ProjectProfit, metrics.CompanyNetProfit, metrics.Collections, metrics.PaidExpenses, metrics.CashPosition, ChangePercent(metrics.Sales.Month, metrics.PreviousSales), ChangePercent(metrics.Expenses.Month, metrics.PreviousExpenses), clients.Total, clients.Active, clients.New, clients.Repeat, clients.Top, tasks.Count, tasks.Items, statements.Outstanding, statements.Overdue, statements.OverdueCount, statements.DueSoonCount, orders.WaitingDelivery, orders.ForPayment, orders.ForPaymentTotal, orders.NotSent, trend, actions, activity);
    }

    public async Task<SalesTrackerPageDto> GetSalesAsync(SalesTrackerQuery query, CancellationToken token)
    {
        await using var connection = await dataSource.OpenConnectionAsync(token);
        var summary = await ReadSalesSummaryAsync(connection, query, token);
        var total = await ScalarLongAsync(connection, SalesCte(query) + " select count(*) from filtered where MatchesFilters", command => AddSalesParameters(command, query), token);
        var items = new List<SalesRowDto>();
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = SalesCte(query) + $"""
                select id, quotation_date, quotation_number, client_name, subject, project_location, lead_time, subtotal_amount, total_amount, estimated_cost, estimated_profit, item_count, actual_expenses, billing_status, collection_status, statement_id, soa_number, balance, total_payments
                from filtered where MatchesFilters order by {SalesOrder(query.Sort)} limit @limit offset @offset
                """;
            AddSalesParameters(command, query);
            command.Parameters.AddWithValue("limit", query.PageSize);
            command.Parameters.AddWithValue("offset", (query.Page - 1) * query.PageSize);
            await using var reader = await command.ExecuteReaderAsync(token);
            while (await reader.ReadAsync(token))
            {
                var statement = reader.IsDBNull(15) ? null : new SalesStatementDto(reader.GetGuid(15), reader.GetString(16), reader.GetDecimal(17), reader.GetDecimal(18));
                items.Add(new(reader.GetGuid(0), reader.GetFieldValue<DateOnly>(1), reader.GetString(2), reader.GetString(3), reader.GetString(4), reader.GetString(5), reader.GetString(6), reader.GetDecimal(7), reader.GetDecimal(8), reader.GetDecimal(9), reader.GetDecimal(10), reader.GetInt64(11), reader.GetDecimal(12), reader.GetString(13), reader.GetString(14), statement));
            }
        }
        var chart = await ReadSalesChartAsync(connection, query, token);
        return new(items, total, query.Page, query.PageSize, summary, chart);
    }

    public async Task<SearchPageDto> SearchAsync(string query, int limit, CancellationToken token)
    {
        await using var command = dataSource.CreateCommand("""
            with matches as (
              select 'Client' type, id, name title, concat_ws(' · ', industry, address) detail, '/clients/' || id path, 1 rank from public.clients where archived_at is null and deleted_at is null and (name ilike @search escape '\' or industry ilike @search escape '\' or address ilike @search escape '\')
              union all select 'Item', id, name, concat_ws(' · ', product_code, category, brand), '/items/' || id, 2 from public.items where archived_at is null and deleted_at is null and (name ilike @search escape '\' or product_code ilike @search escape '\' or barcode ilike @search escape '\' or category ilike @search escape '\')
              union all select 'Supplier', id, name, concat_ws(' · ', supplier_type, company_email), '/suppliers/' || id, 3 from public.suppliers where archived_at is null and deleted_at is null and (name ilike @search escape '\' or company_email ilike @search escape '\')
              union all select 'Quotation', id, quotation_number, concat_ws(' · ', client_name, subject, status), '/quotations/' || id, 4 from public.quotations where archived_at is null and deleted_at is null and (quotation_number ilike @search escape '\' or client_name ilike @search escape '\' or subject ilike @search escape '\')
              union all select 'Purchase order', id, po_number, concat_ws(' · ', supplier_name, client_name, status), '/purchase-orders?order=' || id, 5 from public.purchase_orders where archived_at is null and deleted_at is null and (po_number ilike @search escape '\' or supplier_name ilike @search escape '\' or client_name ilike @search escape '\' or subject ilike @search escape '\')
              union all select 'Task', id, title, concat_ws(' · ', assigned_to_name, status, priority), '/tasks?task=' || id, 6 from public.tasks where archived_at is null and deleted_at is null and (title ilike @search escape '\' or description ilike @search escape '\' or assigned_to_name ilike @search escape '\')
            ) select id, type, title, coalesce(detail,''), path from matches order by rank, title limit @limit
            """);
        command.Parameters.AddWithValue("search", "%" + EscapeLike(query) + "%");
        command.Parameters.AddWithValue("limit", limit);
        var results = new List<SearchResultDto>();
        await using var reader = await command.ExecuteReaderAsync(token);
        while (await reader.ReadAsync(token)) results.Add(new($"{reader.GetString(1).ToLowerInvariant().Replace(' ', '-')}-{reader.GetGuid(0)}", reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4)));
        return new(results);
    }

    public async Task<ArchivePageDto> ListArchiveAsync(string search, string? module, int page, int pageSize, CancellationToken token)
    {
        await using var connection = await dataSource.OpenConnectionAsync(token);
        var sql = ArchiveCte() + " select count(*) from archived where (@module='' or module=@module) and (@search='' or title ilike @search escape '\\' or detail ilike @search escape '\\')";
        var total = await ScalarLongAsync(connection, sql, command => AddArchiveParameters(command, search, module), token);
        var items = new List<ArchiveRowDto>();
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = ArchiveCte() + " select module,id,title,detail,archived_at,version from archived where (@module='' or module=@module) and (@search='' or title ilike @search escape '\\' or detail ilike @search escape '\\') order by archived_at desc,module,title limit @limit offset @offset";
            AddArchiveParameters(command, search, module); command.Parameters.AddWithValue("limit", pageSize); command.Parameters.AddWithValue("offset", (page - 1) * pageSize);
            await using var reader = await command.ExecuteReaderAsync(token);
            while (await reader.ReadAsync(token)) items.Add(new(reader.GetString(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3), reader.GetFieldValue<DateTimeOffset>(4), reader.GetInt64(5)));
        }
        return new(items, total, page, pageSize);
    }

    public async Task<ActivityPageDto> ListActivityAsync(ActivityQuery query, CancellationToken token)
    {
        await using var connection = await dataSource.OpenConnectionAsync(token);
        const string where = "where (@module='' or module=@module) and (@action='' or action=@action) and (@date is null or occurred_at::date=@date) and (@record_id is null or record_id=@record_id) and (@search='' or entity ilike @search escape '\\' or description ilike @search escape '\\' or actor_name ilike @search escape '\\')";
        var total = await ScalarLongAsync(connection, "select count(*) from public.audit_records " + where, command => AddActivityParameters(command, query), token);
        var summary = await ReadActivitySummaryAsync(connection, where, query, token);
        var items = new List<ActivityEntryDto>();
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = "select id,record_id,occurred_at,module,action,entity,description,actor_name,tone,amount,status from public.audit_records " + where + " order by " + ActivityOrder(query.Sort) + " limit @limit offset @offset";
            AddActivityParameters(command, query); command.Parameters.AddWithValue("limit", query.PageSize); command.Parameters.AddWithValue("offset", (query.Page - 1) * query.PageSize);
            await using var reader = await command.ExecuteReaderAsync(token);
            while (await reader.ReadAsync(token)) items.Add(ReadActivity(reader));
        }
        return new(items, total, query.Page, query.PageSize, summary);
    }

    private static async Task<DashboardMetrics> ReadDashboardMetricsAsync(NpgsqlConnection connection, DateOnly today, DateOnly weekStart, DateOnly monthStart, DateOnly previousStart, DateOnly previousEnd, CancellationToken token)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            select
              coalesce(sum(q.total_amount) filter (where q.quotation_date=@today),0), coalesce(sum(q.total_amount) filter (where q.quotation_date between @week_start and @today),0), coalesce(sum(q.total_amount) filter (where q.quotation_date between @month_start and @today),0),
              coalesce(sum(q.estimated_profit) filter (where q.quotation_date between @month_start and @today),0), coalesce(sum(q.subtotal_amount) filter (where q.quotation_date between @month_start and @today),0), coalesce(sum(q.total_amount) filter (where q.quotation_date between @previous_start and @previous_end),0)
            from public.quotations q where q.status='Approved' and q.archived_at is null and q.deleted_at is null;
            select
              coalesce(sum(e.amount) filter (where e.expense_date=@today),0), coalesce(sum(e.amount) filter (where e.expense_date between @week_start and @today),0), coalesce(sum(e.amount) filter (where e.expense_date between @month_start and @today),0),
              coalesce(sum(e.amount) filter (where e.expense_date between @previous_start and @previous_end),0), coalesce(sum(e.amount) filter (where e.expense_date between @month_start and @today and e.quotation_id is not null),0), coalesce(sum(e.amount) filter (where e.expense_date between @month_start and @today and e.quotation_id is null),0), coalesce(sum(e.amount) filter (where e.expense_date between @month_start and @today and e.status='Paid'),0)
            from public.expenses e where e.status<>'Cancelled' and e.archived_at is null and e.deleted_at is null;
            select coalesce(sum(case when p.entry_type='Payment' then p.amount else -p.amount end),0) from public.statement_payments p join public.statements_of_account s on s.id=p.statement_id where s.status<>'Cancelled' and s.archived_at is null and s.deleted_at is null and p.payment_date between @month_start and @today;
            """;
        command.Parameters.AddWithValue("today", today); command.Parameters.AddWithValue("week_start", weekStart); command.Parameters.AddWithValue("month_start", monthStart); command.Parameters.AddWithValue("previous_start", previousStart); command.Parameters.AddWithValue("previous_end", previousEnd);
        await using var reader = await command.ExecuteReaderAsync(token);
        await reader.ReadAsync(token); var sales = new PeriodTotalsDto(reader.GetDecimal(0), reader.GetDecimal(1), reader.GetDecimal(2)); var gross = reader.GetDecimal(3); var revenue = reader.GetDecimal(4); var priorSales = reader.GetDecimal(5);
        await reader.NextResultAsync(token); await reader.ReadAsync(token); var expenses = new PeriodTotalsDto(reader.GetDecimal(0), reader.GetDecimal(1), reader.GetDecimal(2)); var priorExpenses = reader.GetDecimal(3); var project = reader.GetDecimal(4); var operating = reader.GetDecimal(5); var paid = reader.GetDecimal(6);
        await reader.NextResultAsync(token); await reader.ReadAsync(token); var collections = reader.GetDecimal(0);
        var projectProfit = revenue - project; var companyNet = projectProfit - operating;
        return new(sales, expenses, gross, sales.Month == 0 ? 0 : gross / sales.Month * 100, revenue, project, operating, projectProfit, companyNet, collections, paid, collections - paid, priorSales, priorExpenses);
    }

    private static async Task<ClientMetrics> ReadClientMetricsAsync(NpgsqlConnection connection, DateOnly monthStart, CancellationToken token)
    {
        await using var command = connection.CreateCommand(); command.CommandText = """
            select count(*), count(*) filter(where status='Active'), count(*) filter(where client_since>=@month_start) from public.clients where archived_at is null and deleted_at is null;
            select q.client_id,q.client_name,coalesce(max(c.photo_url),''),sum(q.total_amount),count(*) from public.quotations q left join public.clients c on c.id=q.client_id where q.status='Approved' and q.archived_at is null and q.deleted_at is null group by q.client_id,q.client_name having count(*)>1 order by count(*) desc,sum(q.total_amount) desc limit 5;
            """; command.Parameters.AddWithValue("month_start", monthStart);
        await using var reader = await command.ExecuteReaderAsync(token); await reader.ReadAsync(token); var total=reader.GetInt64(0); var active=reader.GetInt64(1); var newer=reader.GetInt64(2); await reader.NextResultAsync(token); var top=new List<DashboardClientDto>(); var repeat=0L; while(await reader.ReadAsync(token)){repeat++; top.Add(new(reader.IsDBNull(0)?null:reader.GetGuid(0),reader.GetString(1),reader.GetString(2),reader.GetDecimal(3),reader.GetInt64(4)));} return new(total,active,newer,repeat,top);
    }

    private static async Task<UrgentTasks> ReadUrgentTasksAsync(NpgsqlConnection connection, DateOnly attentionEnd, CancellationToken token)
    {
        await using var command = connection.CreateCommand(); command.CommandText="select count(*),coalesce(json_agg(json_build_array(id,title,priority,due_date,assigned_to_name) order by due_date nulls last) filter(where row_number<=5),'[]'::json) from (select id,title,priority,due_date,assigned_to_name,row_number() over(order by (due_date<current_date) desc,case priority when 'High' then 1 else 2 end,due_date nulls last) row_number from public.tasks where archived_at is null and deleted_at is null and status<>'Completed' and (priority='High' or due_date<=@attention_end)) t"; command.Parameters.AddWithValue("attention_end",attentionEnd); await using var reader=await command.ExecuteReaderAsync(token); await reader.ReadAsync(token); var count=reader.GetInt64(0); var items=new List<DashboardTaskDto>(); if(!reader.IsDBNull(1)){var doc=System.Text.Json.JsonDocument.Parse(reader.GetString(1)); foreach(var value in doc.RootElement.EnumerateArray()){items.Add(new(value[0].GetGuid(),value[1].GetString()!,value[2].GetString()!,value[3].ValueKind==System.Text.Json.JsonValueKind.Null?null:DateOnly.Parse(value[3].GetString()!),value[4].GetString()!));}} return new(count,items);
    }

    private static async Task<StatementMetrics> ReadStatementMetricsAsync(NpgsqlConnection connection, DateOnly today, DateOnly dueSoon, CancellationToken token)
    {
        await using var command=connection.CreateCommand(); command.CommandText="select coalesce(sum(balance),0),coalesce(sum(balance) filter(where status='Overdue' or due_date<@today),0),count(*) filter(where status='Overdue' or due_date<@today),count(*) filter(where due_date between @today and @due_soon) from public.statements_of_account where archived_at is null and deleted_at is null and status not in ('Draft','Cancelled') and balance>0"; command.Parameters.AddWithValue("today",today);command.Parameters.AddWithValue("due_soon",dueSoon);await using var reader=await command.ExecuteReaderAsync(token);await reader.ReadAsync(token);return new(reader.GetDecimal(0),reader.GetDecimal(1),reader.GetInt64(2),reader.GetInt64(3));
    }

    private static async Task<PurchaseOrderMetrics> ReadPurchaseOrderMetricsAsync(NpgsqlConnection connection, CancellationToken token)
    { await using var command=connection.CreateCommand();command.CommandText="select count(*) filter(where status in ('Waiting for Delivery','Sent')),count(*) filter(where status='For Payment'),coalesce(sum(total_amount) filter(where status='For Payment'),0),count(*) filter(where status='Not yet sent') from public.purchase_orders where archived_at is null and deleted_at is null and status not in ('Cancelled','Delivered')";await using var reader=await command.ExecuteReaderAsync(token);await reader.ReadAsync(token);return new(reader.GetInt64(0),reader.GetInt64(1),reader.GetDecimal(2),reader.GetInt64(3)); }

    private static async Task<IReadOnlyList<DashboardTrendDto>> ReadTrendAsync(NpgsqlConnection connection,int trendMonths,DateOnly? from,DateOnly? to,CancellationToken token)
    { await using var command=connection.CreateCommand(); command.CommandText="""with bounds as(select coalesce(@from,(date_trunc('month',current_date)-(@months-1)*interval '1 month')::date) from_date,coalesce(@to,current_date) to_date),months as(select generate_series(date_trunc('month',from_date),date_trunc('month',to_date),interval '1 month')::date month_start from bounds) select to_char(m.month_start,'YYYY-MM'),to_char(m.month_start,'Mon'),coalesce((select sum(q.total_amount) from public.quotations q,bounds b where q.status='Approved' and q.archived_at is null and q.deleted_at is null and q.quotation_date>=m.month_start and q.quotation_date<(m.month_start+interval '1 month')::date and q.quotation_date between b.from_date and b.to_date),0),coalesce((select sum(e.amount) from public.expenses e,bounds b where e.status<>'Cancelled' and e.archived_at is null and e.deleted_at is null and e.expense_date>=m.month_start and e.expense_date<(m.month_start+interval '1 month')::date and e.expense_date between b.from_date and b.to_date),0),coalesce((select sum(q.subtotal_amount) from public.quotations q,bounds b where q.status='Approved' and q.archived_at is null and q.deleted_at is null and q.quotation_date>=m.month_start and q.quotation_date<(m.month_start+interval '1 month')::date and q.quotation_date between b.from_date and b.to_date),0)-coalesce((select sum(e.amount) from public.expenses e,bounds b where e.status<>'Cancelled' and e.archived_at is null and e.deleted_at is null and e.expense_date>=m.month_start and e.expense_date<(m.month_start+interval '1 month')::date and e.expense_date between b.from_date and b.to_date),0) from months m order by m.month_start""";command.Parameters.AddWithValue("months",trendMonths);command.Parameters.AddWithValue("from",NpgsqlDbType.Date,(object?)from??DBNull.Value);command.Parameters.AddWithValue("to",NpgsqlDbType.Date,(object?)to??DBNull.Value);var rows=new List<DashboardTrendDto>();await using var reader=await command.ExecuteReaderAsync(token);while(await reader.ReadAsync(token))rows.Add(new(reader.GetString(0),reader.GetString(1),reader.GetDecimal(2),reader.GetDecimal(3),reader.GetDecimal(4)));return rows; }

    private static async Task<IReadOnlyList<DashboardActionDto>> ReadActionsAsync(NpgsqlConnection connection,DateOnly today,DateOnly dueSoon,DateOnly taskAttention,CancellationToken token)
    { await using var command=connection.CreateCommand(); command.CommandText="""select id,title,detail,urgency,tone,action_label,path,priority,sort_date from( select s.id::text id,s.soa_number||' · '||s.client_name title,concat(s.balance::text,' outstanding') detail,case when s.status='Overdue' or s.due_date<@today then 'Overdue' when s.due_date=@today then 'Today' else 'Upcoming' end urgency,case when s.status='Overdue' or s.due_date<@today then 'danger' when s.due_date=@today then 'today' else 'upcoming' end tone,case when s.status='Overdue' or s.due_date<=@today then 'Record payment' else 'View SOA' end action_label,'/statement-of-account/'||s.id path,case when s.status='Overdue' or s.due_date<@today then 0 when s.due_date=@today then 2 else 6 end priority,s.due_date::text sort_date from public.statements_of_account s where s.archived_at is null and s.deleted_at is null and s.status not in('Draft','Cancelled') and s.balance>0 and s.due_date<=@due_soon union all select t.id::text,t.title,concat(t.assigned_to_name,' · ',coalesce(t.due_date::text,t.priority)),case when t.due_date<@today then 'Overdue' when t.due_date=@today then 'Today' when t.due_date is null then 'Pending' else 'Upcoming' end,case when t.due_date<@today then 'danger' when t.due_date=@today then 'today' when t.due_date is null then 'pending' else 'upcoming' end,'Open task','/tasks?task='||t.id,case when t.due_date<@today then 1 when t.due_date=@today then 2 else 7 end,coalesce(t.due_date::text,'9999-12-31') from public.tasks t where t.archived_at is null and t.deleted_at is null and t.status<>'Completed' and(t.priority='High' or t.due_date<=@task_attention) union all select q.id::text,q.quotation_number||' · '||q.client_name,coalesce(q.subject,'Quotation waiting for approval'),'Pending','pending','Review','/quotations/'||q.id||'?review=1',3,q.quotation_date::text from public.quotations q where q.archived_at is null and q.deleted_at is null and q.status='For Approval' union all select p.id::text,p.po_number||' · '||p.supplier_name,concat(p.total_amount::text,' purchase order is ready to send'),'Pending','pending','View PO','/purchase-orders?order='||p.id,5,p.order_date::text from public.purchase_orders p where p.archived_at is null and p.deleted_at is null and p.status='Not yet sent') actions order by priority,sort_date,title limit 50""";command.Parameters.AddWithValue("today",today);command.Parameters.AddWithValue("due_soon",dueSoon);command.Parameters.AddWithValue("task_attention",taskAttention);var rows=new List<DashboardActionDto>();await using var reader=await command.ExecuteReaderAsync(token);while(await reader.ReadAsync(token))rows.Add(new(reader.GetString(0),reader.GetString(1),reader.GetString(2),reader.GetString(3),reader.GetString(4),reader.GetString(5),reader.GetString(6),reader.GetInt32(7),reader.GetString(8)));return rows; }

    private static async Task<IReadOnlyList<ActivityEntryDto>> ReadRecentActivityAsync(NpgsqlConnection connection,CancellationToken token){await using var command=connection.CreateCommand();command.CommandText="select id,record_id,occurred_at,module,action,entity,description,actor_name,tone,amount,status from public.audit_records order by occurred_at desc limit 6";var rows=new List<ActivityEntryDto>();await using var reader=await command.ExecuteReaderAsync(token);while(await reader.ReadAsync(token))rows.Add(ReadActivity(reader));return rows;}

    private static async Task<SalesSummaryDto> ReadSalesSummaryAsync(NpgsqlConnection connection,SalesTrackerQuery query,CancellationToken token){await using var command=connection.CreateCommand();command.CommandText=SalesCte(query)+""" select coalesce(sum(subtotal_amount),0),coalesce(sum(estimated_cost),0),coalesce(sum(actual_expenses),0),coalesce(sum(estimated_profit),0),coalesce(sum(total_amount),0),coalesce(sum(total_amount) filter(where billing_status='Billed'),0),coalesce((select sum(total_payments) from (select distinct statement_id,total_payments from filtered where MatchesFilters and statement_id is not null) statements),0),coalesce((select sum(balance) from (select distinct statement_id,balance from filtered where MatchesFilters and statement_id is not null) statements),0) from filtered where MatchesFilters""";AddSalesParameters(command,query);await using var reader=await command.ExecuteReaderAsync(token);await reader.ReadAsync(token);var revenue=reader.GetDecimal(0);var cost=reader.GetDecimal(1);var actual=reader.GetDecimal(2);var profit=reader.GetDecimal(3);var approved=reader.GetDecimal(4);var billed=reader.GetDecimal(5);var collections=reader.GetDecimal(6);var receivables=reader.GetDecimal(7);var actualProfit=revenue-actual;return new(revenue,cost,actual,profit,actualProfit,actualProfit-profit,approved==0?0:profit/approved*100,approved,billed,collections,receivables);}
    private static async Task<IReadOnlyList<SalesBucketDto>> ReadSalesChartAsync(NpgsqlConnection connection,SalesTrackerQuery query,CancellationToken token){var days=query.To.DayNumber-query.From.DayNumber+1;var bucket=days<=31?"day":"month";await using var command=connection.CreateCommand();command.CommandText=SalesCte(query)+" select date_trunc(@bucket,quotation_date::timestamp)::date,coalesce(sum(subtotal_amount),0),coalesce(sum(estimated_profit),0),coalesce(sum(subtotal_amount-actual_expenses),0) from filtered where MatchesFilters group by 1 order by 1";AddSalesParameters(command,query);command.Parameters.AddWithValue("bucket",bucket);var rows=new List<SalesBucketDto>();await using var reader=await command.ExecuteReaderAsync(token);while(await reader.ReadAsync(token)){var date=reader.GetFieldValue<DateOnly>(0);rows.Add(new(bucket=="day"?date.ToString("MMM d"):date.ToString("MMM yy"),reader.GetDecimal(1),reader.GetDecimal(2),reader.GetDecimal(3)));}return rows;}

    private static async Task<ActivitySummaryDto> ReadActivitySummaryAsync(NpgsqlConnection connection,string where,ActivityQuery query,CancellationToken token){await using var command=connection.CreateCommand();command.CommandText="select count(*),count(*) filter(where occurred_at::date=current_date),coalesce(sum(amount) filter(where module='Expenses' and action='Created'),0),count(distinct actor_name) from public.audit_records "+where;AddActivityParameters(command,query);await using var reader=await command.ExecuteReaderAsync(token);await reader.ReadAsync(token);return new(reader.GetInt64(0),reader.GetInt64(1),reader.GetDecimal(2),reader.GetInt64(3));}

    private static string SalesCte(SalesTrackerQuery query)=>"""with base as( select q.id,q.quotation_date,q.quotation_number,q.client_name,q.subject,q.project_location,q.lead_time,q.subtotal_amount,q.total_amount,q.estimated_profit,coalesce((select sum(l.quantity*l.unit_cost) from public.quotation_lines l where l.quotation_id=q.id),0) estimated_cost,coalesce((select count(*) from public.quotation_lines l where l.quotation_id=q.id),0)::bigint item_count,coalesce((select sum(e.amount) from public.expenses e where e.quotation_id=q.id and e.status<>'Cancelled' and e.archived_at is null and e.deleted_at is null),0) actual_expenses,s.id statement_id,s.soa_number,s.balance,s.total_payments,s.status statement_status,s.due_date from public.quotations q left join lateral(select s.id,s.soa_number,s.balance,s.total_payments,s.status,s.due_date from public.statement_quotations sq join public.statements_of_account s on s.id=sq.statement_id where sq.quotation_id=q.id and s.archived_at is null and s.deleted_at is null and s.status<>'Cancelled' order by s.statement_date desc limit 1)s on true where q.status='Approved' and q.archived_at is null and q.deleted_at is null and q.quotation_date between @from and @to and(@search='' or q.quotation_number ilike @search escape '\' or q.client_name ilike @search escape '\' or q.subject ilike @search escape '\' or q.project_location ilike @search escape '\')),classified as(select *,case when statement_id is null then 'Unbilled' when statement_status='Draft' then 'Draft SOA' else 'Billed' end billing_status,case when statement_id is null then 'Unbilled' when statement_status='Draft' then 'Awaiting issue' when balance<=0 then 'Paid' when total_payments>0 then 'Partially Paid' when due_date<current_date or statement_status='Overdue' then 'Overdue' else 'Unpaid' end collection_status from base),filtered as(select *,(@billing='All billing' or billing_status=@billing) and(@collection='All collections' or collection_status=@collection) MatchesFilters from classified)""";
    private static void AddSalesParameters(NpgsqlCommand command,SalesTrackerQuery query){command.Parameters.AddWithValue("from",query.From);command.Parameters.AddWithValue("to",query.To);command.Parameters.AddWithValue("search",string.IsNullOrWhiteSpace(query.Search)?string.Empty:"%"+EscapeLike(query.Search)+"%");command.Parameters.AddWithValue("billing",query.Billing);command.Parameters.AddWithValue("collection",query.Collection);}
    private static string SalesOrder(string sort)=>sort switch{"oldest"=>"quotation_date,quotation_number","amount"=>"total_amount desc,quotation_date desc","client"=>"client_name,quotation_date desc",_=>"quotation_date desc,quotation_number desc"};
    private static string ActivityOrder(string sort)=>sort switch{"oldest"=>"occurred_at,id","module"=>"module,occurred_at desc","user"=>"actor_name,occurred_at desc",_=>"occurred_at desc,id desc"};
    private static string ArchiveCte()=>"""with archived as(select 'Clients' module,id,name title,industry detail,archived_at,version from public.clients where archived_at is not null and deleted_at is null union all select 'Suppliers',id,name,supplier_type,archived_at,version from public.suppliers where archived_at is not null and deleted_at is null union all select 'Items',id,name,product_code,archived_at,version from public.items where archived_at is not null and deleted_at is null union all select 'Quotations',id,quotation_number,client_name,archived_at,version from public.quotations where archived_at is not null and deleted_at is null union all select 'Purchase Orders',id,po_number,supplier_name,archived_at,version from public.purchase_orders where archived_at is not null and deleted_at is null union all select 'Expenses',id,payee,description,archived_at,version from public.expenses where archived_at is not null and deleted_at is null union all select 'Statements of Account',id,soa_number,client_name,archived_at,version from public.statements_of_account where archived_at is not null and deleted_at is null union all select 'Tasks',id,title,assigned_to_name,archived_at,version from public.tasks where archived_at is not null and deleted_at is null)""";
    private static void AddArchiveParameters(NpgsqlCommand command,string search,string? module){command.Parameters.AddWithValue("module",module??string.Empty);command.Parameters.AddWithValue("search",string.IsNullOrWhiteSpace(search)?string.Empty:"%"+EscapeLike(search)+"%");}
    private static void AddActivityParameters(NpgsqlCommand command,ActivityQuery query){command.Parameters.AddWithValue("module",query.Module??string.Empty);command.Parameters.AddWithValue("action",query.Action??string.Empty);command.Parameters.AddWithValue("date",NpgsqlDbType.Date,(object?)query.Date??DBNull.Value);command.Parameters.AddWithValue("record_id",NpgsqlDbType.Uuid,(object?)query.RecordId??DBNull.Value);command.Parameters.AddWithValue("search",string.IsNullOrWhiteSpace(query.Search)?string.Empty:"%"+EscapeLike(query.Search)+"%");}
    private static ActivityEntryDto ReadActivity(NpgsqlDataReader reader)=>new(reader.GetGuid(0),reader.IsDBNull(1)?null:reader.GetGuid(1),reader.GetFieldValue<DateTimeOffset>(2).ToString("O"),reader.GetString(3),reader.GetString(4),reader.GetString(5),reader.GetString(6),reader.GetString(7),reader.GetString(8),reader.IsDBNull(9)?null:reader.GetDecimal(9),reader.IsDBNull(10)?null:reader.GetString(10));
    private static async Task<long> ScalarLongAsync(NpgsqlConnection connection,string sql,CancellationToken token){await using var command=connection.CreateCommand();command.CommandText=sql;return (long)(await command.ExecuteScalarAsync(token)??0L);}
    private static async Task<long> ScalarLongAsync(NpgsqlConnection connection,string sql,Action<NpgsqlCommand> parameters,CancellationToken token){await using var command=connection.CreateCommand();command.CommandText=sql;parameters(command);return (long)(await command.ExecuteScalarAsync(token)??0L);}
    private static decimal ChangePercent(decimal current,decimal previous)=>previous==0?(current==0?0:100):(current-previous)/previous*100;
    private static string EscapeLike(string value)=>value.Replace("\\","\\\\",StringComparison.Ordinal).Replace("%","\\%",StringComparison.Ordinal).Replace("_","\\_",StringComparison.Ordinal);
    private sealed record DashboardMetrics(PeriodTotalsDto Sales,PeriodTotalsDto Expenses,decimal GrossProfit,decimal Margin,decimal ActualRevenue,decimal ProjectExpenses,decimal OperatingExpenses,decimal ProjectProfit,decimal CompanyNetProfit,decimal Collections,decimal PaidExpenses,decimal CashPosition,decimal PreviousSales,decimal PreviousExpenses);
    private sealed record ClientMetrics(long Total,long Active,long New,long Repeat,IReadOnlyList<DashboardClientDto> Top);
    private sealed record UrgentTasks(long Count,IReadOnlyList<DashboardTaskDto> Items);
    private sealed record StatementMetrics(decimal Outstanding,decimal Overdue,long OverdueCount,long DueSoonCount);
    private sealed record PurchaseOrderMetrics(long WaitingDelivery,long ForPayment,decimal ForPaymentTotal,long NotSent);
}
