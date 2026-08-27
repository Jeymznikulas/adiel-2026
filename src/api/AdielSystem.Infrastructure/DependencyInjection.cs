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
using AdielSystem.Application.PurchaseOrders;
using AdielSystem.Infrastructure.PurchaseOrders;
using AdielSystem.Application.Expenses;
using AdielSystem.Infrastructure.Expenses;
using AdielSystem.Application.Statements;
using AdielSystem.Infrastructure.Statements;
using AdielSystem.Application.Tasks;
using AdielSystem.Infrastructure.Tasks;
using AdielSystem.Application.Insights;
using AdielSystem.Infrastructure.Insights;
using AdielSystem.Application.Storage;
using AdielSystem.Infrastructure.Storage;
using AdielSystem.Application.Calendar;
using AdielSystem.Infrastructure.Calendar;
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
        services.AddOptions<SupabaseStorageOptions>().Bind(configuration.GetSection(SupabaseStorageOptions.SectionName));
        services.AddOptions<GoogleCalendarOptions>()
            .Bind(configuration.GetSection(GoogleCalendarOptions.SectionName))
            .Validate(options => !options.Enabled ||
                (!string.IsNullOrWhiteSpace(options.ClientId) && !string.IsNullOrWhiteSpace(options.ClientSecret) &&
                 options.RedirectUri is { IsAbsoluteUri: true } && options.FrontendRedirectUri is { IsAbsoluteUri: true } &&
                 options.FrontendBaseUri is { IsAbsoluteUri: true }),
                "Enabled Google Calendar integration requires ClientId, ClientSecret, RedirectUri, FrontendRedirectUri, and FrontendBaseUri.")
            .ValidateOnStart();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required.");

        services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));
        services.AddScoped<IClientRepository, ClientRepository>();
        services.AddScoped<ISettingsRepository, SettingsRepository>();
        services.AddScoped<ISupplierRepository, SupplierRepository>();
        services.AddScoped<IItemRepository, ItemRepository>();
        services.AddScoped<IQuotationRepository, QuotationRepository>();
        services.AddScoped<IPurchaseOrderRepository, PurchaseOrderRepository>();
        services.AddScoped<IExpenseRepository, ExpenseRepository>();
        services.AddScoped<IStatementRepository, StatementRepository>();
        services.AddScoped<ITaskRepository, TaskRepository>();
        services.AddScoped<IInsightsRepository, InsightsRepository>();
        services.AddScoped<IImageReferenceRepository, ImageReferenceRepository>();
        services.AddHttpClient<IBusinessImageStorage, SupabaseBusinessImageStorage>();
        services.AddDataProtection();
        services.AddHttpClient<GoogleCalendarHttpClient>();
        services.AddScoped<IGoogleCalendarIntegration, GoogleCalendarIntegration>();
        services.AddScoped<CalendarSyncProcessor>();
        services.AddHostedService<CalendarSyncWorker>();
        services.AddSingleton<ImageCleanupQueue>();
        services.AddSingleton<IImageCleanupQueue>(provider => provider.GetRequiredService<ImageCleanupQueue>());
        services.AddHostedService(provider => provider.GetRequiredService<ImageCleanupQueue>());
        services.AddHostedService<StorageBucketInitializer>();
        services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");

        return services;
    }
}
