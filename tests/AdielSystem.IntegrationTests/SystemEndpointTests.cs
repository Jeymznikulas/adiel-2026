using Microsoft.AspNetCore.Mvc.Testing;

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
    }

    [Fact]
    public async Task Get_clients_without_owner_token_returns_unauthorized()
    {
        var response = await _client.GetAsync(
            "/api/v1/clients",
            TestContext.Current.CancellationToken);

        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, response.StatusCode);
    }
}

