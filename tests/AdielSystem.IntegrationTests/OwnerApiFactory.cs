using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Transactions;
using AdielSystem.Api.Security;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;

namespace AdielSystem.IntegrationTests;

internal sealed class OwnerApiFactory : WebApplicationFactory<Program>
{
    private readonly Action<IServiceCollection>? configureServices;
    private readonly CommittableTransaction databaseTransaction = new(new TransactionOptions { IsolationLevel = IsolationLevel.ReadCommitted, Timeout = TimeSpan.FromMinutes(2) });
    public OwnerApiFactory(Action<IServiceCollection>? configureServices = null) => this.configureServices = configureServices;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<IStartupFilter>(new RollbackTransactionStartupFilter(databaseTransaction));
            services.AddAuthentication(options => { options.DefaultAuthenticateScheme = OwnerTestAuthenticationHandler.SchemeName; options.DefaultChallengeScheme = OwnerTestAuthenticationHandler.SchemeName; })
                .AddScheme<AuthenticationSchemeOptions, OwnerTestAuthenticationHandler>(OwnerTestAuthenticationHandler.SchemeName, _ => { });
            configureServices?.Invoke(services);
        });
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) databaseTransaction.Dispose();
        base.Dispose(disposing);
    }

    public async Task<T> QueryInTestTransactionAsync<T>(Func<NpgsqlConnection, Task<T>> query, CancellationToken token)
    {
        using var scope = new TransactionScope(databaseTransaction, TimeSpan.FromMinutes(2), TransactionScopeAsyncFlowOption.Enabled);
        await using var connection = await Services.GetRequiredService<NpgsqlDataSource>().OpenConnectionAsync(token);
        var result = await query(connection);
        scope.Complete();
        return result;
    }
}

internal sealed class RollbackTransactionStartupFilter(CommittableTransaction databaseTransaction) : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => application =>
    {
        application.Use(async (_, nextMiddleware) =>
        {
            using var requestScope = new TransactionScope(databaseTransaction, TimeSpan.FromMinutes(2), TransactionScopeAsyncFlowOption.Enabled);
            await nextMiddleware();
            requestScope.Complete();
        });
        next(application);
    };
}

internal sealed class OwnerTestAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, IOptions<OwnerAccessOptions> ownerOptions, ILoggerFactory logger, UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "OwnerIntegrationTest";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var identity = new ClaimsIdentity([new Claim("sub", ownerOptions.Value.OwnerUserId.ToString()), new Claim("email", "owner@example.com"), new Claim("role", "authenticated")], SchemeName);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
    }
}

internal sealed class NonOwnerApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.ConfigureTestServices(services =>
    {
        services.AddAuthentication(options => { options.DefaultAuthenticateScheme = NonOwnerTestAuthenticationHandler.SchemeName; options.DefaultChallengeScheme = NonOwnerTestAuthenticationHandler.SchemeName; })
            .AddScheme<AuthenticationSchemeOptions, NonOwnerTestAuthenticationHandler>(NonOwnerTestAuthenticationHandler.SchemeName, _ => { });
    });
}

internal sealed class NonOwnerTestAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "NonOwnerIntegrationTest";
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var identity = new ClaimsIdentity([new Claim("sub", "22222222-2222-2222-2222-222222222222"), new Claim("email", "other@example.com"), new Claim("role", "authenticated")], SchemeName);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
    }
}
