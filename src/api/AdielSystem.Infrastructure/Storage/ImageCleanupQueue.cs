using System.Threading.Channels;
using AdielSystem.Application.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AdielSystem.Infrastructure.Storage;

internal sealed class ImageCleanupQueue : BackgroundService, IImageCleanupQueue
{
    private readonly Channel<string> queue = Channel.CreateUnbounded<string>();
    private readonly IServiceProvider services;
    private readonly ILogger<ImageCleanupQueue> logger;
    public ImageCleanupQueue(IServiceProvider services, ILogger<ImageCleanupQueue> logger) { this.services = services; this.logger = logger; }
    public void Enqueue(string objectPath) { if (!string.IsNullOrWhiteSpace(objectPath)) queue.Writer.TryWrite(objectPath); }
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var path in queue.Reader.ReadAllAsync(stoppingToken))
        {
            for (var attempt = 1; attempt <= 3; attempt++)
            {
                try { using var scope = services.CreateScope(); await scope.ServiceProvider.GetRequiredService<IBusinessImageStorage>().DeleteAsync(path, stoppingToken); break; }
                catch (Exception ex) when (attempt < 3) { logger.LogWarning(ex, "Storage cleanup retry {Attempt} failed for an internally generated object path.", attempt); }
                catch (Exception ex) { logger.LogError(ex, "Storage cleanup failed after retries for an internally generated object path."); }
            }
        }
    }
}
