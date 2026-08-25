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

namespace AdielSystem.IntegrationTests;

internal sealed class OwnerApiFactory : WebApplicationFactory<Program>
{
    private readonly CommittableTransaction databaseTransaction = new(new TransactionOptions { IsolationLevel = IsolationLevel.ReadCommitted, Timeout = TimeSpan.FromMinutes(2) });

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<IStartupFilter>(new RollbackTransactionStartupFilter(databaseTransaction));
            services.AddAuthentication(options => { options.DefaultAuthenticateScheme = OwnerTestAuthenticationHandler.SchemeName; options.DefaultChallengeScheme = OwnerTestAuthenticationHandler.SchemeName; })
                .AddScheme<AuthenticationSchemeOptions, OwnerTestAuthenticationHandler>(OwnerTestAuthenticationHandler.SchemeName, _ => { });
        });
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) databaseTransaction.Dispose();
        base.Dispose(disposing);
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
