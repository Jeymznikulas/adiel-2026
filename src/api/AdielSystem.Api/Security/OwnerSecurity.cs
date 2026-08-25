using System.Security.Claims;
using System.Threading.RateLimiting;
using AdielSystem.Application.Security;
using AdielSystem.Infrastructure.Configuration;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace AdielSystem.Api.Security;

public static class SecurityConstants
{
    public const string OwnerOnlyPolicy = "OwnerOnly";
    public const string OwnerRateLimitPolicy = "OwnerRateLimit";
}

public sealed class OwnerAccessOptions
{
    public const string SectionName = "AccessControl";
    public Guid OwnerUserId { get; init; }
}

internal sealed class HttpCurrentUserAccessor(IHttpContextAccessor httpContextAccessor) : ICurrentUserAccessor
{
    public CurrentUser GetRequiredUser()
    {
        var principal = httpContextAccessor.HttpContext?.User ?? throw new InvalidOperationException("No HTTP user is available.");
        if (!Guid.TryParse(principal.FindFirstValue("sub"), out var userId)) throw new UnauthorizedAccessException("The access token has no valid subject.");
        var email = principal.FindFirstValue("email");
        return new CurrentUser(userId, string.IsNullOrWhiteSpace(email) ? userId.ToString() : email.Split('@', 2)[0]);
    }
}

public static class SecurityServiceCollectionExtensions
{
    public static IServiceCollection AddOwnerSecurity(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<OwnerAccessOptions>().Bind(configuration.GetSection(OwnerAccessOptions.SectionName))
            .Validate(options => options.OwnerUserId != Guid.Empty, "AccessControl:OwnerUserId must be the Supabase Auth user ID of the owner.").ValidateOnStart();
        var supabaseUrl = configuration.GetSection(SupabaseOptions.SectionName).GetValue<Uri>(nameof(SupabaseOptions.Url))
            ?? throw new InvalidOperationException("Supabase:Url is required.");
        var ownerUserId = configuration.GetSection(OwnerAccessOptions.SectionName).GetValue<Guid>(nameof(OwnerAccessOptions.OwnerUserId));
        var issuer = new Uri(supabaseUrl, "/auth/v1").AbsoluteUri.TrimEnd('/');

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
        {
            options.MapInboundClaims = false;
            options.MetadataAddress = $"{issuer}/.well-known/openid-configuration";
            options.RequireHttpsMetadata = supabaseUrl.Scheme == Uri.UriSchemeHttps;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true, ValidIssuer = issuer, ValidateAudience = true, ValidAudience = "authenticated",
                ValidateLifetime = true, ValidateIssuerSigningKey = true, ClockSkew = TimeSpan.FromSeconds(30), NameClaimType = "sub",
            };
        });
        services.AddAuthorization(options => options.AddPolicy(SecurityConstants.OwnerOnlyPolicy, policy =>
        {
            policy.RequireAuthenticatedUser();
            policy.RequireClaim("role", "authenticated");
            policy.RequireClaim("sub", ownerUserId.ToString());
        }));
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserAccessor, HttpCurrentUserAccessor>();
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(SecurityConstants.OwnerRateLimitPolicy, context => RateLimitPartition.GetFixedWindowLimiter(
                context.User.FindFirst("sub")?.Value ?? "anonymous",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
        });
        return services;
    }
}
