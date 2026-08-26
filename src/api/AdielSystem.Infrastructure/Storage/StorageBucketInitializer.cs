using AdielSystem.Application.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AdielSystem.Infrastructure.Storage;

internal sealed class StorageBucketInitializer(IServiceProvider services, IOptions<SupabaseStorageOptions> options, ILogger<StorageBucketInitializer> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.EnsureBucketOnStartup || string.IsNullOrWhiteSpace(options.Value.ServiceRoleKey)) { logger.LogWarning("Storage bucket verification skipped because the external Storage secret is not configured."); return; }
        try { using var scope = services.CreateScope(); await scope.ServiceProvider.GetRequiredService<IBusinessImageStorage>().EnsurePrivateBucketAsync(stoppingToken); logger.LogInformation("Private business image bucket verified."); }
        catch (Exception ex) { logger.LogError(ex, "Private business image bucket verification failed."); }
    }
}
