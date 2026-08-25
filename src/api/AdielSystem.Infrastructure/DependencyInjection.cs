using AdielSystem.Application.Clients;
using AdielSystem.Infrastructure.Clients;
using AdielSystem.Infrastructure.Configuration;
using AdielSystem.Application.Settings;
using AdielSystem.Infrastructure.Settings;
using AdielSystem.Application.Suppliers;
using AdielSystem.Infrastructure.Suppliers;
using AdielSystem.Application.Items;
using AdielSystem.Infrastructure.Items;
using AdielSystem.Application.Quotations;
using AdielSystem.Infrastructure.Quotations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
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
            .ValidateOnStart();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required.");

        services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));
        services.AddScoped<IClientRepository, ClientRepository>();
        services.AddScoped<ISettingsRepository, SettingsRepository>();
        services.AddScoped<ISupplierRepository, SupplierRepository>();
        services.AddScoped<IItemRepository, ItemRepository>();
        services.AddScoped<IQuotationRepository, QuotationRepository>();
        services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");

        return services;
    }
}
