using AdielSystem.Api.Security;
using Microsoft.Extensions.Configuration;

namespace AdielSystem.IntegrationTests;

public sealed class ProductionConfigurationTests
{
    [Fact]
    public void Explicit_https_hosts_least_privilege_login_and_external_storage_secret_pass_review()
    {
        var configuration = Configuration(new Dictionary<string, string?>
        {
            ["AllowedHosts"] = "api.example.com",
            ["Cors:AllowedOrigins:0"] = "https://app.example.com",
            ["ConnectionStrings:DefaultConnection"] = "Host=db.example.com;Database=postgres;Username=adiel_api_login.project;Password=from-secret-store;SSL Mode=VerifyFull;Root Certificate=System",
            ["AccessControl:OwnerUserId"] = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            ["Supabase:Url"] = "https://project.supabase.co",
            ["Supabase:Storage:ServiceRoleKey"] = "external-test-value",
            ["Supabase:Storage:EnsureBucketOnStartup"] = "false",
        });

        ProductionSecurityConfiguration.ValidateProduction(configuration, new ReverseProxyOptions
        {
            Enabled = true,
            KnownProxies = ["10.0.0.10"],
        });
    }

    [Theory]
    [InlineData("*", "https://app.example.com", "adiel_api_login.project")]
    [InlineData("api.example.com", "http://app.example.com", "adiel_api_login.project")]
    [InlineData("api.example.com", "https://app.example.com", "postgres.project")]
    public void Permissive_or_insecure_production_configuration_is_rejected(string hosts, string origin, string username)
    {
        var configuration = Configuration(new Dictionary<string, string?>
        {
            ["AllowedHosts"] = hosts,
            ["Cors:AllowedOrigins:0"] = origin,
            ["ConnectionStrings:DefaultConnection"] = $"Host=db.example.com;Database=postgres;Username={username};Password=from-secret-store;SSL Mode=VerifyFull;Root Certificate=System",
            ["AccessControl:OwnerUserId"] = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            ["Supabase:Url"] = "https://project.supabase.co",
            ["Supabase:Storage:ServiceRoleKey"] = "external-test-value",
            ["Supabase:Storage:EnsureBucketOnStartup"] = "false",
        });

        Assert.Throws<InvalidOperationException>(() => ProductionSecurityConfiguration.ValidateProduction(configuration, new ReverseProxyOptions()));
    }

    private static IConfiguration Configuration(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();
}
