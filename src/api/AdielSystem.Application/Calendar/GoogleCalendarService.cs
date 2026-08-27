using AdielSystem.Application.Common;
using AdielSystem.Application.Security;

namespace AdielSystem.Application.Calendar;

public sealed class GoogleCalendarService(IGoogleCalendarIntegration integration, ICurrentUserAccessor currentUserAccessor)
{
    public Task<GoogleCalendarStatusDto> GetStatusAsync(CancellationToken cancellationToken) =>
        integration.GetStatusAsync(currentUserAccessor.GetRequiredUser().Id, cancellationToken);

    public async Task<GoogleCalendarConnectDto> BeginConnectionAsync(CancellationToken cancellationToken) =>
        new(await integration.BeginConnectionAsync(currentUserAccessor.GetRequiredUser(), cancellationToken));

    public Task<GoogleCalendarCallbackResult> CompleteConnectionAsync(string? code, string? state, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state))
            throw new RequestValidationException("Google did not return a valid authorization response.");
        return integration.CompleteConnectionAsync(code, state, cancellationToken);
    }

    public Task DisconnectAsync(CancellationToken cancellationToken) =>
        integration.DisconnectAsync(currentUserAccessor.GetRequiredUser().Id, cancellationToken);

    public Task RetryTaskAsync(Guid taskId, CancellationToken cancellationToken) =>
        integration.EnqueueTaskAsync(taskId, cancellationToken);
}
