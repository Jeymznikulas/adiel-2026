using System.Net.Http.Headers;
using System.Text.Json;
using AdielSystem.Infrastructure.Configuration;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace AdielSystem.Infrastructure.Storage;

internal sealed class StorageHealthCheck(
    IHttpClientFactory clients,
    IOptions<SupabaseOptions> supabase,
    IOptions<SupabaseStorageOptions> storage) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var options = storage.Value;
        if (string.IsNullOrWhiteSpace(options.ServiceRoleKey))
            return HealthCheckResult.Unhealthy("The external Storage credential is not configured.");

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get,
                new Uri(supabase.Value.Url, $"storage/v1/bucket/{Uri.EscapeDataString(options.Bucket)}"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ServiceRoleKey);
            request.Headers.TryAddWithoutValidation("apikey", options.ServiceRoleKey);
            using var response = await clients.CreateClient("StorageHealth").SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
                return HealthCheckResult.Unhealthy($"Storage bucket verification returned HTTP {(int)response.StatusCode}.");

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            if (!document.RootElement.TryGetProperty("public", out var isPublic) || isPublic.GetBoolean())
                return HealthCheckResult.Unhealthy("The configured business-image bucket is public or its privacy could not be verified.");

            return HealthCheckResult.Healthy("The private Storage bucket is reachable.");
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException or JsonException)
        {
            return HealthCheckResult.Unhealthy("The private Storage bucket is unavailable.");
        }
    }
}
