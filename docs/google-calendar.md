# Google Calendar task invitations

The integration uses one Google account as the event organizer. Task assignee emails are independent of the Adiel login email. When a task is created or changed, the API queues an event update and Google emails every selected assignee an invitation.

## Apply the database migration

Apply `supabase/migrations/20260827000000_google_calendar_integration.sql` and `supabase/migrations/20260829000000_task_due_time.sql` after the earlier migrations. Existing task assignees remain valid, but they must be edited in **Settings > Options > Task assignees** to add a Calendar email before they can receive invitations.

## Create Google credentials

1. Create or select a project in Google Cloud Console.
2. Enable the Google Calendar API.
3. Configure the OAuth consent screen.
4. Create an OAuth client with application type **Web application**.
5. Add the exact authorized redirect URI used by the API, for example `https://localhost:7001/api/v1/integrations/google-calendar/callback`.

The integration requests `openid`, `email`, and `https://www.googleapis.com/auth/calendar.events`. Offline access is required because the background worker updates events after the browser request has finished.

Google references:

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/workspace/calendar/api/auth
- https://developers.google.com/workspace/calendar/api/guides/create-events

## Configure the API

Keep the client secret outside committed configuration. For local development:

```powershell
dotnet user-secrets set "GoogleCalendar:Enabled" "true" --project src/api/AdielSystem.Api
dotnet user-secrets set "GoogleCalendar:ClientId" "YOUR-CLIENT-ID" --project src/api/AdielSystem.Api
dotnet user-secrets set "GoogleCalendar:ClientSecret" "YOUR-CLIENT-SECRET" --project src/api/AdielSystem.Api
dotnet user-secrets set "GoogleCalendar:RedirectUri" "https://localhost:7001/api/v1/integrations/google-calendar/callback" --project src/api/AdielSystem.Api
dotnet user-secrets set "GoogleCalendar:FrontendRedirectUri" "http://localhost:5173/settings?section=calendar" --project src/api/AdielSystem.Api
dotnet user-secrets set "GoogleCalendar:FrontendBaseUri" "http://localhost:5173/" --project src/api/AdielSystem.Api
dotnet user-secrets set "GoogleCalendar:TimeZone" "Asia/Singapore" --project src/api/AdielSystem.Api
dotnet user-secrets set "GoogleCalendar:EventDurationMinutes" "60" --project src/api/AdielSystem.Api
```

Production must use the deployed HTTPS API and web URLs. Persist ASP.NET Core Data Protection keys in durable protected storage; those keys protect the stored Google refresh token. Losing the keys makes the existing Calendar connection unreadable and requires reconnecting.

## Connect and use

1. Open **Settings > Calendar** and select **Connect Google Calendar**.
2. Sign in to the Google account that should organize task events.
3. Add or edit task assignees with their real Calendar invitation emails.
4. Create a task and select one or more assignees.

The task due date becomes a non-blocking all-day event when no due time is selected. A task with a due time becomes a timed event in the configured Calendar timezone and uses the configured event duration. Updates reuse the same deterministic event ID, reassignment updates the attendees, completion marks the event completed, and archiving removes the event. Failed Google requests retry in the background without rolling back the task save.

Google may require an attendee to accept the invitation before it appears on their calendar, depending on that person's invitation settings.
