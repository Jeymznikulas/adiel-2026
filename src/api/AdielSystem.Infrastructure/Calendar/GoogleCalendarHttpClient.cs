using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace AdielSystem.Infrastructure.Calendar;

internal sealed class GoogleCalendarHttpClient(HttpClient httpClient, IDataProtectionProvider dataProtectionProvider, IOptions<GoogleCalendarOptions> options)
{
    private const string EventsScope = "https://www.googleapis.com/auth/calendar.events";
    private readonly GoogleCalendarOptions settings = options.Value;
    private readonly IDataProtector tokenProtector = dataProtectionProvider.CreateProtector("AdielSystem.GoogleCalendar.RefreshToken.v1");

    public string CreateAuthorizationUrl(string state)
    {
        EnsureConfigured();
        var query = QueryString.Create(new KeyValuePair<string, string?>[] {
            new("client_id", settings.ClientId),
            new("redirect_uri", settings.RedirectUri!.AbsoluteUri),
            new("response_type", "code"),
            new("scope", $"openid email {EventsScope}"),
            new("access_type", "offline"),
            new("prompt", "consent"),
            new("include_granted_scopes", "true"),
            new("state", state),
        });
        return "https://accounts.google.com/o/oauth2/v2/auth" + query;
    }

    public async Task<GoogleAuthorizationTokens> ExchangeCodeAsync(string code, CancellationToken cancellationToken)
    {
        EnsureConfigured();
        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = settings.ClientId,
            ["client_secret"] = settings.ClientSecret,
            ["code"] = code,
            ["grant_type"] = "authorization_code",
            ["redirect_uri"] = settings.RedirectUri!.AbsoluteUri,
        });
        using var response = await httpClient.PostAsync("https://oauth2.googleapis.com/token", content, cancellationToken);
        return await ReadTokenResponseAsync(response, cancellationToken);
    }

    public async Task<string> RefreshAccessTokenAsync(string encryptedRefreshToken, CancellationToken cancellationToken)
    {
        EnsureConfigured();
        var refreshToken = tokenProtector.Unprotect(encryptedRefreshToken);
        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = settings.ClientId,
            ["client_secret"] = settings.ClientSecret,
            ["refresh_token"] = refreshToken,
            ["grant_type"] = "refresh_token",
        });
        using var response = await httpClient.PostAsync("https://oauth2.googleapis.com/token", content, cancellationToken);
        var tokens = await ReadTokenResponseAsync(response, cancellationToken);
        return tokens.AccessToken;
    }

    public string ProtectRefreshToken(string refreshToken) => tokenProtector.Protect(refreshToken);
    public string UnprotectRefreshToken(string encryptedRefreshToken) => tokenProtector.Unprotect(encryptedRefreshToken);

    public async Task<GoogleUserInfo> GetUserInfoAsync(string accessToken, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "https://openidconnect.googleapis.com/v1/userinfo");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode) throw await GoogleApiException.FromResponseAsync(response, cancellationToken);
        return await response.Content.ReadFromJsonAsync<GoogleUserInfo>(cancellationToken: cancellationToken)
            ?? throw new InvalidOperationException("Google returned an empty user profile.");
    }

    public async Task RevokeAsync(string encryptedRefreshToken, CancellationToken cancellationToken)
    {
        var token = UnprotectRefreshToken(encryptedRefreshToken);
        using var content = new FormUrlEncodedContent(new Dictionary<string, string> { ["token"] = token });
        using var response = await httpClient.PostAsync("https://oauth2.googleapis.com/revoke", content, cancellationToken);
        if (!response.IsSuccessStatusCode && response.StatusCode != HttpStatusCode.BadRequest)
            throw await GoogleApiException.FromResponseAsync(response, cancellationToken);
    }

    public async Task UpsertEventAsync(string accessToken, string calendarId, string eventId, object payload, bool eventKnown, CancellationToken cancellationToken)
    {
        if (eventKnown)
        {
            var update = await SendEventAsync(HttpMethod.Put, accessToken, calendarId, eventId, payload, cancellationToken);
            if (update != HttpStatusCode.NotFound) return;
        }

        var insert = await SendEventAsync(HttpMethod.Post, accessToken, calendarId, null, payload, cancellationToken);
        if (insert == HttpStatusCode.Conflict)
        {
            var update = await SendEventAsync(HttpMethod.Put, accessToken, calendarId, eventId, payload, cancellationToken);
            if (update == HttpStatusCode.NotFound) throw new GoogleApiException(update, "Google Calendar could not find the event after reporting an ID conflict.");
        }
    }

    public async Task DeleteEventAsync(string accessToken, string calendarId, string eventId, CancellationToken cancellationToken)
    {
        var url = EventUrl(calendarId, eventId);
        using var request = new HttpRequestMessage(HttpMethod.Delete, url + "?sendUpdates=all");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode && response.StatusCode is not HttpStatusCode.NotFound and not HttpStatusCode.Gone)
            throw await GoogleApiException.FromResponseAsync(response, cancellationToken);
    }

    private async Task<HttpStatusCode> SendEventAsync(HttpMethod method, string accessToken, string calendarId, string? eventId, object payload, CancellationToken cancellationToken)
    {
        var url = eventId is null ? $"https://www.googleapis.com/calendar/v3/calendars/{Uri.EscapeDataString(calendarId)}/events" : EventUrl(calendarId, eventId);
        using var request = new HttpRequestMessage(method, url + "?sendUpdates=all") { Content = JsonContent.Create(payload) };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode && response.StatusCode is not HttpStatusCode.NotFound and not HttpStatusCode.Conflict)
            throw await GoogleApiException.FromResponseAsync(response, cancellationToken);
        return response.StatusCode;
    }

    private static string EventUrl(string calendarId, string eventId) =>
        $"https://www.googleapis.com/calendar/v3/calendars/{Uri.EscapeDataString(calendarId)}/events/{Uri.EscapeDataString(eventId)}";

    private static async Task<GoogleAuthorizationTokens> ReadTokenResponseAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            if (body.Contains("invalid_grant", StringComparison.OrdinalIgnoreCase)) throw new GoogleAuthorizationException("Google Calendar authorization has expired or was revoked.");
            throw new GoogleApiException(response.StatusCode, body);
        }
        return JsonSerializer.Deserialize<GoogleAuthorizationTokens>(body) ?? throw new InvalidOperationException("Google returned an empty token response.");
    }

    private void EnsureConfigured()
    {
        if (!settings.Enabled || string.IsNullOrWhiteSpace(settings.ClientId) || string.IsNullOrWhiteSpace(settings.ClientSecret) || settings.RedirectUri is null)
            throw new InvalidOperationException("Google Calendar integration is not configured.");
    }
}

internal sealed record GoogleAuthorizationTokens(
    [property: JsonPropertyName("access_token")] string AccessToken,
    [property: JsonPropertyName("refresh_token")] string? RefreshToken,
    [property: JsonPropertyName("expires_in")] int ExpiresIn,
    [property: JsonPropertyName("scope")] string? Scope,
    [property: JsonPropertyName("token_type")] string? TokenType);

internal sealed record GoogleUserInfo(
    [property: JsonPropertyName("sub")] string Subject,
    [property: JsonPropertyName("email")] string Email,
    [property: JsonPropertyName("email_verified")] bool EmailVerified);

internal class GoogleApiException(HttpStatusCode statusCode, string message) : Exception(message)
{
    public HttpStatusCode StatusCode { get; } = statusCode;
    public static async Task<GoogleApiException> FromResponseAsync(HttpResponseMessage response, CancellationToken cancellationToken) =>
        new(response.StatusCode, await response.Content.ReadAsStringAsync(cancellationToken));
}

internal sealed class GoogleAuthorizationException(string message) : Exception(message);
