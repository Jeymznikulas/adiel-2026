using AdielSystem.Application.Security;

namespace AdielSystem.Application.Calendar;

public sealed record GoogleCalendarStatusDto(bool Configured, bool Connected, string? GoogleAccountEmail, DateTimeOffset? ConnectedAt);
public sealed record GoogleCalendarConnectDto(string AuthorizationUrl);
public sealed record GoogleCalendarCallbackResult(string RedirectUrl);

public interface IGoogleCalendarIntegration
{
    Task<GoogleCalendarStatusDto> GetStatusAsync(Guid ownerUserId, CancellationToken cancellationToken);
    Task<string> BeginConnectionAsync(CurrentUser actor, CancellationToken cancellationToken);
    Task<GoogleCalendarCallbackResult> CompleteConnectionAsync(string code, string state, CancellationToken cancellationToken);
    Task DisconnectAsync(Guid ownerUserId, CancellationToken cancellationToken);
    Task EnqueueTaskAsync(Guid taskId, CancellationToken cancellationToken);
}

