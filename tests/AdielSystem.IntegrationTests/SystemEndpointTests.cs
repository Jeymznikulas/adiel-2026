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
    public async Task Get_system_returns_success(CancellationToken cancellationToken)
    {
        var response = await _client.GetAsync("/api/v1/system", cancellationToken);

        response.EnsureSuccessStatusCode();
    }
}

