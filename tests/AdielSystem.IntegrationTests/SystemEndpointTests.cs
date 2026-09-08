using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;
using System.Net.Http.Json;

namespace AdielSystem.IntegrationTests;

public sealed class SystemEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public SystemEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Get_system_returns_success()
    {
        var response = await _client.GetAsync(
            "/api/v1/system",
            TestContext.Current.CancellationToken);

        response.EnsureSuccessStatusCode();
        Assert.Equal("nosniff", Assert.Single(response.Headers.GetValues("X-Content-Type-Options")));
        Assert.Equal("DENY", Assert.Single(response.Headers.GetValues("X-Frame-Options")));
    }

    [Fact]
    public async Task OpenApi_requires_the_owner_and_describes_version_one()
    {
        var anonymous = await _client.GetAsync("/openapi/v1.json", TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);

        await using var factory = new OwnerApiFactory();
        using var owner = factory.CreateClient();
        var document = await owner.GetAsync("/openapi/v1.json", TestContext.Current.CancellationToken);
        document.EnsureSuccessStatusCode();
        Assert.Contains("/api/v1/clients", await document.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Oversized_requests_are_rejected_before_authentication_or_model_binding()
    {
        using var content = new ByteArrayContent(new byte[6 * 1024 * 1024 + 1]);
        var response = await _client.PostAsync("/api/v1/clients", content, TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
    }

    [Fact]
    public async Task Owner_rate_limit_rejects_excess_requests_without_queueing()
    {
        await using var factory = new OwnerApiFactory();
        using var client = factory.CreateClient();

        for (var request = 0; request < 120; request++)
            (await client.GetAsync("/api/v1/clients?pageSize=1", TestContext.Current.CancellationToken)).EnsureSuccessStatusCode();
        var rejected = await client.GetAsync("/api/v1/clients?pageSize=1", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
        Assert.True(rejected.Headers.Contains("Retry-After"));
    }

    [Fact]
    public async Task Get_clients_without_owner_token_returns_unauthorized()
    {
        var response = await _client.GetAsync(
            "/api/v1/clients",
            TestContext.Current.CancellationToken);

        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Get_statements_without_owner_token_returns_unauthorized()
    {
        var response = await _client.GetAsync(
            "/api/v1/statements",
            TestContext.Current.CancellationToken);

        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Get_statements_with_non_owner_token_returns_forbidden()
    {
        await using var factory = new NonOwnerApiFactory();
        using var client = factory.CreateClient();
        var response = await client.GetAsync("/api/v1/statements", TestContext.Current.CancellationToken);
        Assert.Equal(System.Net.HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Tasks_require_authentication_and_the_configured_owner()
    {
        var anonymous = await _client.GetAsync("/api/v1/tasks", TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);

        await using var factory = new NonOwnerApiFactory();
        using var client = factory.CreateClient();
        var nonOwner = await client.GetAsync("/api/v1/tasks", TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Forbidden, nonOwner.StatusCode);
    }

    [Fact]
    public async Task Payment_endpoint_requires_the_owner()
    {
        var body = new { paymentDate = "2026-08-01", amount = 1m, method = "Cash", idempotencyKey = "authorization-test", version = 1L };
        var anonymous = await _client.PostAsJsonAsync($"/api/v1/statements/{Guid.NewGuid()}/payments", body, TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        await using var factory = new NonOwnerApiFactory(); using var client = factory.CreateClient();
        var nonOwner = await client.PostAsJsonAsync($"/api/v1/statements/{Guid.NewGuid()}/payments", body, TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Forbidden, nonOwner.StatusCode);
    }

    [Fact]
    public async Task Image_endpoints_require_authentication_and_the_configured_owner()
    {
        var anonymous = await _client.GetAsync($"/api/v1/clients/{Guid.NewGuid()}/image", TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        await using var factory = new NonOwnerApiFactory(); using var client = factory.CreateClient();
        var nonOwner = await client.GetAsync($"/api/v1/clients/{Guid.NewGuid()}/image", TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Forbidden, nonOwner.StatusCode);
    }
}

