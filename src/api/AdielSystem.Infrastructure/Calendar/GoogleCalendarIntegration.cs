using System.Security.Cryptography;
using AdielSystem.Application.Calendar;
using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using Npgsql;

namespace AdielSystem.Infrastructure.Calendar;

internal sealed class GoogleCalendarIntegration(
    NpgsqlDataSource dataSource,
    GoogleCalendarHttpClient google,
    IOptions<GoogleCalendarOptions> options) : IGoogleCalendarIntegration
{
    private readonly GoogleCalendarOptions settings = options.Value;

    public async Task<GoogleCalendarStatusDto> GetStatusAsync(Guid ownerUserId, CancellationToken cancellationToken)
    {
        if (!settings.Enabled) return new(false, false, null, null);
        await using var command = dataSource.CreateCommand("select google_account_email,connected_at from public.google_calendar_connections where owner_user_id=@owner and revoked_at is null");
        command.Parameters.AddWithValue("owner", ownerUserId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken)
            ? new(true, true, reader.GetString(0), reader.GetFieldValue<DateTimeOffset>(1))
            : new(true, false, null, null);
    }

    public async Task<string> BeginConnectionAsync(CurrentUser actor, CancellationToken cancellationToken)
    {
        if (!settings.Enabled) throw new RequestValidationException("Google Calendar integration is not configured by the administrator.");
        var state = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var stateHash = HashState(state);
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await using (var cleanup = connection.CreateCommand())
        {
            cleanup.Transaction = transaction;
            cleanup.CommandText = "delete from public.google_calendar_oauth_states where expires_at<=now() or owner_user_id=@owner";
            cleanup.Parameters.AddWithValue("owner", actor.Id);
            await cleanup.ExecuteNonQueryAsync(cancellationToken);
        }
        await using (var insert = connection.CreateCommand())
        {
            insert.Transaction = transaction;
            insert.CommandText = "insert into public.google_calendar_oauth_states (state_hash,owner_user_id,expires_at) values (@hash,@owner,now()+interval '10 minutes')";
            insert.Parameters.AddWithValue("hash", stateHash);
            insert.Parameters.AddWithValue("owner", actor.Id);
            await insert.ExecuteNonQueryAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);
        return google.CreateAuthorizationUrl(state);
    }

    public async Task<GoogleCalendarCallbackResult> CompleteConnectionAsync(string code, string state, CancellationToken cancellationToken)
    {
        var ownerUserId = await ConsumeStateAsync(state, cancellationToken);
        var tokens = await google.ExchangeCodeAsync(code, cancellationToken);
        if (string.IsNullOrWhiteSpace(tokens.RefreshToken)) throw new RequestValidationException("Google did not return offline Calendar access. Disconnect the app from your Google Account and try again.");
        var user = await google.GetUserInfoAsync(tokens.AccessToken, cancellationToken);
        if (!user.EmailVerified) throw new RequestValidationException("Connect a verified Google account.");

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await using (var upsert = connection.CreateCommand())
        {
            upsert.Transaction = transaction;
            upsert.CommandText = """
                insert into public.google_calendar_connections
                    (owner_user_id,google_subject,google_account_email,encrypted_refresh_token,calendar_id,connected_at,updated_at,revoked_at)
                values (@owner,@subject,@email,@token,@calendar,now(),now(),null)
                on conflict (owner_user_id) do update
                set google_subject=excluded.google_subject,
                    google_account_email=excluded.google_account_email,
                    encrypted_refresh_token=excluded.encrypted_refresh_token,
                    calendar_id=excluded.calendar_id,
                    connected_at=now(),updated_at=now(),revoked_at=null,
                    version=public.google_calendar_connections.version+1
                """;
            upsert.Parameters.AddWithValue("owner", ownerUserId);
            upsert.Parameters.AddWithValue("subject", user.Subject);
            upsert.Parameters.AddWithValue("email", user.Email.Trim().ToLowerInvariant());
            upsert.Parameters.AddWithValue("token", google.ProtectRefreshToken(tokens.RefreshToken));
            upsert.Parameters.AddWithValue("calendar", NormalizedCalendarId());
            await upsert.ExecuteNonQueryAsync(cancellationToken);
        }
        await using (var enqueue = connection.CreateCommand())
        {
            enqueue.Transaction = transaction;
            enqueue.CommandText = "insert into public.calendar_sync_jobs (task_id,requested_task_version) select id,version from public.tasks where deleted_at is null";
            await enqueue.ExecuteNonQueryAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);

        var redirect = settings.FrontendRedirectUri ?? settings.FrontendBaseUri ?? throw new InvalidOperationException("GoogleCalendar:FrontendRedirectUri is required.");
        return new(AppendQuery(redirect, "calendar", "connected"));
    }

    public async Task DisconnectAsync(Guid ownerUserId, CancellationToken cancellationToken)
    {
        string? encryptedToken;
        await using (var read = dataSource.CreateCommand("select encrypted_refresh_token from public.google_calendar_connections where owner_user_id=@owner and revoked_at is null"))
        {
            read.Parameters.AddWithValue("owner", ownerUserId);
            encryptedToken = await read.ExecuteScalarAsync(cancellationToken) as string;
        }
        if (encryptedToken is not null)
        {
            try { await google.RevokeAsync(encryptedToken, cancellationToken); }
            catch (GoogleApiException) { /* Local disconnect still succeeds if Google is unavailable. */ }
        }
        await using var command = dataSource.CreateCommand("update public.google_calendar_connections set revoked_at=now(),updated_at=now(),version=version+1 where owner_user_id=@owner and revoked_at is null");
        command.Parameters.AddWithValue("owner", ownerUserId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task EnqueueTaskAsync(Guid taskId, CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand("insert into public.calendar_sync_jobs (task_id,requested_task_version) select id,version from public.tasks where id=@id and deleted_at is null");
        command.Parameters.AddWithValue("id", taskId);
        if (await command.ExecuteNonQueryAsync(cancellationToken) == 0) throw new ResourceNotFoundException($"Task '{taskId}' was not found.");
    }

    private async Task<Guid> ConsumeStateAsync(string state, CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand("delete from public.google_calendar_oauth_states where state_hash=@hash and expires_at>now() returning owner_user_id");
        command.Parameters.AddWithValue("hash", HashState(state));
        return await command.ExecuteScalarAsync(cancellationToken) is Guid ownerUserId
            ? ownerUserId
            : throw new RequestValidationException("The Google authorization request expired or has already been used.");
    }

    private string NormalizedCalendarId() => string.IsNullOrWhiteSpace(settings.CalendarId) ? "primary" : settings.CalendarId.Trim();
    private static string HashState(string state) => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(state))).ToLowerInvariant();
    private static string AppendQuery(Uri uri, string name, string value) => uri.AbsoluteUri + (string.IsNullOrEmpty(uri.Query) ? "?" : "&") + Uri.EscapeDataString(name) + "=" + Uri.EscapeDataString(value);
}
