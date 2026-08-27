namespace AdielSystem.Infrastructure.Calendar;

public sealed class GoogleCalendarOptions
{
    public const string SectionName = "GoogleCalendar";
    public bool Enabled { get; init; }
    public string ClientId { get; init; } = string.Empty;
    public string ClientSecret { get; init; } = string.Empty;
    public Uri? RedirectUri { get; init; }
    public Uri? FrontendRedirectUri { get; init; }
    public Uri? FrontendBaseUri { get; init; }
    public string CalendarId { get; init; } = "primary";
}

