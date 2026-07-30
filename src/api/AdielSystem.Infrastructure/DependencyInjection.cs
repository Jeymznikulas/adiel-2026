using AdielSystem.Infrastructure.Configuration;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Npgsql;

namespace AdielSystem.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services
            .AddOptions<SupabaseOptions>()
            .Bind(configuration.GetSection(SupabaseOptions.SectionName))
            .Validate(options => options.Url.IsAbsoluteUri, "Supabase:Url must be an absolute URL.")
            .Validate(options => !string.IsNullOrWhiteSpace(options.ServiceRoleKey), "Supabase:ServiceRoleKey is required.")
            .ValidateOnStart();

        services.AddHttpClient("Supabase", (serviceProvider, client) =>
        {
            var options = serviceProvider.GetRequiredService<IOptions<SupabaseOptions>>().Value;
            client.BaseAddress = options.Url;
            client.DefaultRequestHeaders.Add("apikey", options.ServiceRoleKey);
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {options.ServiceRoleKey}");
        });

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required.");

        services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));
        services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");

        return services;
    }
}
