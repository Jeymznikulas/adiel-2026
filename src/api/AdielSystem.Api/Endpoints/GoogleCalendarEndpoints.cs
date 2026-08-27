using AdielSystem.Api.Security;
using AdielSystem.Application.Calendar;
using AdielSystem.Infrastructure.Calendar;
using Microsoft.Extensions.Options;

namespace AdielSystem.Api.Endpoints;

public static class GoogleCalendarEndpoints
{
    public static RouteGroupBuilder MapGoogleCalendarEndpoints(this RouteGroupBuilder group)
    {
        var calendar = group.MapGroup("/integrations/google-calendar").WithTags("Google Calendar").RequireRateLimiting(SecurityConstants.OwnerRateLimitPolicy);
        calendar.MapGet("/status", async (GoogleCalendarService service, CancellationToken token) => Results.Ok(await service.GetStatusAsync(token)))
            .WithName("GetGoogleCalendarStatus").Produces<GoogleCalendarStatusDto>();
        calendar.MapPost("/connect", async (GoogleCalendarService service, CancellationToken token) => Results.Ok(await service.BeginConnectionAsync(token)))
            .WithName("BeginGoogleCalendarConnection").Produces<GoogleCalendarConnectDto>().ProducesProblem(400);
        calendar.MapDelete("/connection", async (GoogleCalendarService service, CancellationToken token) => { await service.DisconnectAsync(token); return Results.NoContent(); })
            .WithName("DisconnectGoogleCalendar").Produces(204);
        calendar.MapPost("/tasks/{taskId:guid}/retry", async (Guid taskId, GoogleCalendarService service, CancellationToken token) => { await service.RetryTaskAsync(taskId, token); return Results.Accepted(); })
            .WithName("RetryGoogleCalendarTaskSync").Produces(202).ProducesProblem(404);
        return group;
    }

    public static RouteGroupBuilder MapGoogleCalendarCallbackEndpoint(this RouteGroupBuilder group)
    {
        group.MapGet("/integrations/google-calendar/callback", async (string? code, string? state, string? error, GoogleCalendarService service, IOptions<GoogleCalendarOptions> options, CancellationToken token) =>
        {
            if (!string.IsNullOrWhiteSpace(error))
            {
                var redirect = options.Value.FrontendRedirectUri ?? options.Value.FrontendBaseUri;
                return redirect is null ? Results.BadRequest() : Results.Redirect(AppendQuery(redirect, "calendar", "denied"));
            }
            var result = await service.CompleteConnectionAsync(code, state, token);
            return Results.Redirect(result.RedirectUrl);
        }).WithName("CompleteGoogleCalendarConnection").AllowAnonymous();
        return group;
    }

    private static string AppendQuery(Uri uri, string name, string value) => uri.AbsoluteUri + (string.IsNullOrEmpty(uri.Query) ? "?" : "&") + Uri.EscapeDataString(name) + "=" + Uri.EscapeDataString(value);
}
