using System.Net;
using System.Net.Http.Json;
using AdielSystem.Application.Insights;
using AdielSystem.Application.Tasks;

namespace AdielSystem.IntegrationTests;

public sealed class AuthenticatedInsightsTests
{
    [Fact]
    public async Task Owner_can_query_dashboard_sales_search_archive_and_activity_with_filters()
    {
        await using var factory = new OwnerApiFactory();
        using var client = factory.CreateClient();
        var token = TestContext.Current.CancellationToken;
        var title = $"Insight task {Guid.NewGuid():N}";
        var dueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2));
        var create = await client.PostAsJsonAsync("/api/v1/tasks", new { title, description = "", status = "To do", priority = "High", assignedTo = "Owner", dueDate }, token);
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var task = (await create.Content.ReadFromJsonAsync<TaskDto>(token))!;

        var dashboard = await client.GetFromJsonAsync<DashboardDto>("/api/v1/dashboard?trendMonths=6", token);
        Assert.NotNull(dashboard);
        Assert.Equal(6, dashboard!.Trend.Count);

        var today = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd");
        var sales = await client.GetFromJsonAsync<SalesTrackerPageDto>($"/api/v1/sales-tracker?from={today}&to={today}&page=1&pageSize=1", token);
        Assert.NotNull(sales);
        Assert.InRange(sales!.Page, 1, int.MaxValue);
        Assert.NotNull(sales.Summary);

        var search = await client.GetFromJsonAsync<SearchPageDto>($"/api/v1/search?query={Uri.EscapeDataString(title)}&limit=10", token);
        Assert.Contains(search!.Items, row => row.Type == "Task" && row.Title == title && row.Path.EndsWith(task.Id.ToString(), StringComparison.Ordinal));

        var archive = await client.PostAsJsonAsync($"/api/v1/tasks/{task.Id}/archive", new { version = task.Version }, token);
        archive.EnsureSuccessStatusCode();
        var archived = (await archive.Content.ReadFromJsonAsync<TaskDto>(token))!;
        var archivePage = await client.GetFromJsonAsync<ArchivePageDto>($"/api/v1/archive?module=Tasks&search={Uri.EscapeDataString(title)}&page=1&pageSize=1", token);
        Assert.Contains(archivePage!.Items, row => row.Id == task.Id && row.Version == archived.Version);
        Assert.True(archivePage.Total >= 1);

        var activityResponse = await client.GetAsync($"/api/v1/activity?module=Tasks&search={Uri.EscapeDataString(title)}&page=1&pageSize=1", token);
        Assert.True(activityResponse.IsSuccessStatusCode, await activityResponse.Content.ReadAsStringAsync(token));
        var activity = await activityResponse.Content.ReadFromJsonAsync<ActivityPageDto>(token);
        Assert.NotNull(activity);
        Assert.NotEmpty(activity!.Items);
        Assert.True(activity.Total >= activity.Items.Count);
        var beyond = await client.GetFromJsonAsync<ActivityPageDto>($"/api/v1/activity?module=Tasks&search={Uri.EscapeDataString(title)}&page=999&pageSize=1", token);
        Assert.Empty(beyond!.Items);
    }

    [Fact]
    public async Task Insight_queries_reject_invalid_filters_and_require_owner()
    {
        await using var owner = new OwnerApiFactory();
        using var ownerClient = owner.CreateClient();
        var token = TestContext.Current.CancellationToken;
        Assert.Equal(HttpStatusCode.BadRequest, (await ownerClient.GetAsync("/api/v1/search?query=x", token)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await ownerClient.GetAsync("/api/v1/sales-tracker?from=2026-09-01&to=2026-08-01", token)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await ownerClient.GetAsync("/api/v1/archive?module=Unknown", token)).StatusCode);

        await using var nonOwner = new NonOwnerApiFactory();
        using var nonOwnerClient = nonOwner.CreateClient();
        Assert.Equal(HttpStatusCode.Forbidden, (await nonOwnerClient.GetAsync("/api/v1/dashboard", token)).StatusCode);
    }
}
