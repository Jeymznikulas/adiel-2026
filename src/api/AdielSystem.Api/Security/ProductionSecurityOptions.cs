using System.Net;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Server.Kestrel.Core;

namespace AdielSystem.Api.Security;

public sealed class RequestProtectionOptions
{
    public const string SectionName = "RequestProtection";
    public long MaxRequestBodyBytes { get; init; } = 6 * 1024 * 1024;
    public long DatabaseBackupMaxRequestBodyBytes { get; init; } = 64 * 1024 * 1024;
    public int RequestTimeoutSeconds { get; init; } = 30;
    public int KeepAliveTimeoutSeconds { get; init; } = 120;
    public int RequestHeadersTimeoutSeconds { get; init; } = 15;
}

public sealed class ReverseProxyOptions
{
    public const string SectionName = "ReverseProxy";
    public bool Enabled { get; init; }
    public int ForwardLimit { get; init; } = 1;
    public string[] KnownProxies { get; init; } = [];
}

internal static class ProductionSecurityConfiguration
{
    public static void Configure(WebApplicationBuilder builder)
    {
        var requests = builder.Configuration.GetSection(RequestProtectionOptions.SectionName).Get<RequestProtectionOptions>() ?? new();
        if (requests.MaxRequestBodyBytes is < 1024 or > 64 * 1024 * 1024)
            throw new InvalidOperationException("RequestProtection:MaxRequestBodyBytes must be between 1 KB and 64 MB.");
        if (requests.DatabaseBackupMaxRequestBodyBytes < requests.MaxRequestBodyBytes || requests.DatabaseBackupMaxRequestBodyBytes > 64 * 1024 * 1024)
            throw new InvalidOperationException("RequestProtection:DatabaseBackupMaxRequestBodyBytes must be at least the normal request limit and no more than 64 MB.");
        if (requests.RequestTimeoutSeconds is < 1 or > 600 || requests.KeepAliveTimeoutSeconds is < 1 or > 600 || requests.RequestHeadersTimeoutSeconds is < 1 or > 120)
            throw new InvalidOperationException("RequestProtection timeout values are outside the supported production range.");

        builder.Services.AddSingleton(requests);
        builder.WebHost.ConfigureKestrel(options =>
        {
            options.Limits.MaxRequestBodySize = requests.DatabaseBackupMaxRequestBodyBytes;
            options.Limits.KeepAliveTimeout = TimeSpan.FromSeconds(requests.KeepAliveTimeoutSeconds);
            options.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(requests.RequestHeadersTimeoutSeconds);
            options.Limits.MaxRequestHeadersTotalSize = 32 * 1024;
        });
        var effectiveRequestTimeoutSeconds = builder.Environment.IsDevelopment()
            ? Math.Max(requests.RequestTimeoutSeconds, 120)
            : requests.RequestTimeoutSeconds;
        builder.Services.AddRequestTimeouts(options => options.DefaultPolicy = new()
        {
            Timeout = TimeSpan.FromSeconds(effectiveRequestTimeoutSeconds),
            TimeoutStatusCode = StatusCodes.Status503ServiceUnavailable,
        });

        var proxy = builder.Configuration.GetSection(ReverseProxyOptions.SectionName).Get<ReverseProxyOptions>() ?? new();
        if (proxy.Enabled && (proxy.ForwardLimit is < 1 or > 2 || proxy.KnownProxies.Length == 0))
            throw new InvalidOperationException("An enabled reverse proxy requires one or two forwarding hops and at least one trusted proxy IP address.");
        builder.Services.AddSingleton(proxy);
        builder.Services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
            options.ForwardLimit = proxy.ForwardLimit;
            options.RequireHeaderSymmetry = true;
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();
            foreach (var value in proxy.KnownProxies)
            {
                if (!IPAddress.TryParse(value, out var address)) throw new InvalidOperationException($"ReverseProxy:KnownProxies contains an invalid IP address: {value}");
                options.KnownProxies.Add(address);
            }
        });

        builder.Services.AddHsts(options =>
        {
            options.MaxAge = TimeSpan.FromDays(builder.Configuration.GetValue("Https:HstsMaxAgeDays", 365));
            options.IncludeSubDomains = builder.Configuration.GetValue("Https:IncludeSubDomains", true);
            options.Preload = builder.Configuration.GetValue("Https:Preload", true);
        });

        if (!builder.Environment.IsDevelopment()) ValidateProduction(builder.Configuration, proxy);
    }

    public static void Use(WebApplication app)
    {
        var proxy = app.Services.GetRequiredService<ReverseProxyOptions>();
        if (proxy.Enabled) app.UseForwardedHeaders();

        var requests = app.Services.GetRequiredService<RequestProtectionOptions>();
        app.Use(async (context, next) =>
        {
            var isDatabaseBackupRequest = context.Request.Path.StartsWithSegments("/api/v1/settings/backups", StringComparison.OrdinalIgnoreCase);
            var requestLimit = isDatabaseBackupRequest ? requests.DatabaseBackupMaxRequestBodyBytes : requests.MaxRequestBodyBytes;
            if (context.Request.ContentLength > requestLimit)
            {
                context.Response.StatusCode = StatusCodes.Status413PayloadTooLarge;
                return;
            }
            var feature = context.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
            if (feature is { IsReadOnly: false }) feature.MaxRequestBodySize = requestLimit;
            await next(context);
        });
        app.UseRequestTimeouts();
    }

    internal static void ValidateProduction(IConfiguration configuration, ReverseProxyOptions proxy)
    {
        var allowedHosts = configuration["AllowedHosts"]?.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) ?? [];
        if (allowedHosts.Length == 0 || allowedHosts.Any(host => host is "*" or "+"))
            throw new InvalidOperationException("Production AllowedHosts must contain only the deployed API host names.");

        var origins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        if (origins.Length == 0 || origins.Any(origin => !Uri.TryCreate(origin, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps || uri.PathAndQuery != "/"))
            throw new InvalidOperationException("Production CORS origins must be explicit HTTPS origins without paths.");

        var connectionString = configuration.GetConnectionString("DefaultConnection") ?? string.Empty;
        var connection = new Npgsql.NpgsqlConnectionStringBuilder(connectionString);
        if (string.IsNullOrWhiteSpace(connection.Password) || connection.Password.Contains("configure", StringComparison.OrdinalIgnoreCase) || connection.Password.Contains("your-", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("The production database password must come from external secret storage.");
        if (string.IsNullOrWhiteSpace(connection.Username) || connection.Username.Equals("postgres", StringComparison.OrdinalIgnoreCase) || connection.Username.StartsWith("postgres.", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Production must use a least-privilege database login instead of postgres.");
        if (connection.SslMode != Npgsql.SslMode.VerifyFull)
            throw new InvalidOperationException("Production database TLS must use SSL Mode=VerifyFull.");
        if (!Guid.TryParse(configuration["AccessControl:OwnerUserId"], out var ownerId) || ownerId == Guid.Empty || ownerId == Guid.Parse("11111111-1111-1111-1111-111111111111"))
            throw new InvalidOperationException("The production owner user ID must come from external configuration.");
        if (!Uri.TryCreate(configuration["Supabase:Url"], UriKind.Absolute, out var supabaseUrl) || supabaseUrl.Scheme != Uri.UriSchemeHttps)
            throw new InvalidOperationException("The production Supabase URL must use HTTPS.");
        if (string.IsNullOrWhiteSpace(configuration["Supabase:Storage:ServiceRoleKey"]))
            throw new InvalidOperationException("The production Storage backend key must come from external secret storage.");
        if (configuration.GetValue("Supabase:Storage:EnsureBucketOnStartup", true))
            throw new InvalidOperationException("Production must provision the private Storage bucket ahead of deployment and disable startup mutation.");
        if (proxy.Enabled && proxy.KnownProxies.Length == 0)
            throw new InvalidOperationException("Production reverse-proxy forwarding must name trusted proxy IP addresses.");
    }
}
