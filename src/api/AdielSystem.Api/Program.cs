using AdielSystem.Api;
using AdielSystem.Api.Endpoints;
using AdielSystem.Api.Security;
using AdielSystem.Application.Clients;
using AdielSystem.Application.Settings;
using AdielSystem.Application.Suppliers;
using AdielSystem.Application.Items;
using AdielSystem.Application.Quotations;
using AdielSystem.Application.PurchaseOrders;
using AdielSystem.Application.Expenses;
using AdielSystem.Application.Statements;
using AdielSystem.Application.Tasks;
using AdielSystem.Application.Insights;
using AdielSystem.Application.Storage;
using AdielSystem.Application.Calendar;
using AdielSystem.Infrastructure;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

ProductionSecurityConfiguration.Configure(builder);

builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(options =>
{
    options.SingleLine = true;
    options.TimestampFormat = "HH:mm:ss ";
});
builder.Logging.AddDebug();

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddOpenApi();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddOwnerSecurity(builder.Configuration);
builder.Services.AddScoped<ClientService>();
builder.Services.AddScoped<SettingsService>();
builder.Services.AddScoped<SupplierService>();
builder.Services.AddScoped<ItemService>();
builder.Services.AddScoped<QuotationService>();
builder.Services.AddScoped<PurchaseOrderService>();
builder.Services.AddScoped<ExpenseService>();
builder.Services.AddScoped<StatementService>();
builder.Services.AddScoped<TaskService>();
builder.Services.AddScoped<InsightsService>();
builder.Services.AddScoped<BusinessImageService>();
builder.Services.AddScoped<GoogleCalendarService>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("WebClient", policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod();
    });
});

var app = builder.Build();

ProductionSecurityConfiguration.Use(app);
app.UseExceptionHandler();
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["Cache-Control"] = "no-store";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    await next(context);
});
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.UseCors("WebClient");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready");

var api = app.MapGroup("/api/v1");
api.MapSystemEndpoints();
api.MapGoogleCalendarCallbackEndpoint();
api.MapGroup(string.Empty).RequireAuthorization(SecurityConstants.OwnerOnlyPolicy).MapClientEndpoints();
api.MapGroup(string.Empty).RequireAuthorization(SecurityConstants.OwnerOnlyPolicy).MapSettingsEndpoints();
api.MapGroup(string.Empty).RequireAuthorization(SecurityConstants.OwnerOnlyPolicy).MapSupplierEndpoints();
api.MapGroup(string.Empty).RequireAuthorization(SecurityConstants.OwnerOnlyPolicy).MapItemEndpoints();
api.MapGroup(string.Empty).RequireAuthorization(SecurityConstants.OwnerOnlyPolicy).MapQuotationEndpoints();
api.MapGroup(string.Empty).RequireAuthorization(SecurityConstants.OwnerOnlyPolicy).MapPurchaseOrderEndpoints();
api.MapGroup(string.Empty).RequireAuthorization(SecurityConstants.OwnerOnlyPolicy).MapExpenseEndpoints();
api.MapGroup(string.Empty).RequireAuthorization(SecurityConstants.OwnerOnlyPolicy).MapStatementEndpoints();
api.MapGroup(string.Empty).RequireAuthorization(SecurityConstants.OwnerOnlyPolicy).MapTaskEndpoints();
api.MapGroup(string.Empty).RequireAuthorization(SecurityConstants.OwnerOnlyPolicy).MapInsightEndpoints();
api.MapGroup(string.Empty).RequireAuthorization(SecurityConstants.OwnerOnlyPolicy).MapImageEndpoints();
api.MapGroup(string.Empty).RequireAuthorization(SecurityConstants.OwnerOnlyPolicy).MapGoogleCalendarEndpoints();

if (builder.Configuration.GetValue("OpenApi:Enabled", true))
    app.MapOpenApi().RequireAuthorization(SecurityConstants.OwnerOnlyPolicy);

app.Run();

public partial class Program;
