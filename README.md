# Adiel System

Adiel System is a React/TypeScript frontend with a layered ASP.NET Core REST API, Supabase PostgreSQL, Supabase Auth, and private Supabase Storage.

## Repository structure

```text
.
|-- src/
|   |-- web/                         React, TypeScript, Vite, Tailwind CSS
|   `-- api/
|       |-- AdielSystem.Api/         HTTP endpoints and composition root
|       |-- AdielSystem.Application/ use cases and application contracts
|       |-- AdielSystem.Domain/      business rules and domain models
|       `-- AdielSystem.Infrastructure/ external services and persistence
|-- tests/
|   |-- AdielSystem.UnitTests/
|   `-- AdielSystem.IntegrationTests/
|-- supabase/
|   |-- migrations/                  versioned PostgreSQL migrations
|   |-- config.toml                  local Supabase configuration
|   `-- seed.sql                     optional local-only seed data
`-- docs/                            operational and architecture documentation
```

## Prerequisites

- .NET SDK `10.0.302` (see `global.json`)
- Node.js 24 or newer and npm 11
- A Supabase project
- Supabase CLI, invoked below through `npx supabase`
- Docker Desktop only if you want the optional local Supabase stack

Install the application dependencies from the repository root:

```powershell
dotnet restore AdielSystem.slnx
npm install --prefix src/web
```

## Recommended setup order

For a new or replacement Supabase project, use this order:

1. Link the Supabase CLI and apply the committed database migrations.
2. Create the owner account in Supabase Auth.
3. Configure backend secrets outside the repository.
4. Configure the non-secret backend and frontend settings.
5. Start and verify the application.

Keeping migrations in source control and secrets in an external secret store is the recommended approach. Database schema migration, business-data transfer, Auth-user transfer, and Storage-object transfer are separate operations; a schema migration does not copy the other three.

## 1. Apply the database migrations

Authenticate the CLI, link it to the intended project, inspect the migration state, and apply only pending migrations:

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

Use the project reference from the Supabase dashboard URL or project settings. `db push` records applied versions in `supabase_migrations.schema_migrations`, so committed migrations are not reapplied on later deployments.

Review the dry run before pushing to a shared or production database. Do not use `supabase db reset --linked` against a hosted project: reset is destructive.

### Optional local Supabase database

With Docker Desktop running, start the local stack and rebuild its database from the committed migrations and `supabase/seed.sql`:

```powershell
npx supabase start
npx supabase db reset
```

Use `db reset` only for the disposable local Supabase environment.

### Adding future database changes

Create a new forward-only migration instead of editing a migration that may already have been applied:

```powershell
npx supabase migration new describe_the_change
```

Edit the generated SQL file under `supabase/migrations`, test it locally, then repeat the `migration list`, `db push --dry-run`, and `db push` sequence for the hosted project. Commit the migration with the application code that depends on it.

## 2. Create the owner account

After the migrations have completed, create the application owner in Supabase Dashboard under **Authentication > Users**:

1. Create an email user such as `admin@users.adiel.local` and auto-confirm it.
2. Use `admin` as the username on the application sign-in page; the frontend converts it to the configured synthetic email domain.
3. Copy the Auth user's UUID. It becomes `AccessControl:OwnerUserId` below.

The migrated database trigger creates the related application profile. See [Authentication setup](docs/authentication.md) for the complete username-authentication behavior.

Google Calendar task invitations are configured separately from login identity. See [Google Calendar setup](docs/google-calendar.md).

## 3. Configure backend secrets

For local development, use .NET User Secrets. Copy the exact Session pooler connection values shown by **Supabase Dashboard > Connect**, including the host, username, and database password:

```powershell
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=<session-pooler-host>;Port=5432;Database=postgres;Username=postgres.<project-ref>;Password=<database-password>;SSL Mode=Require;Trust Server Certificate=true" --project src/api/AdielSystem.Api
dotnet user-secrets set "AccessControl:OwnerUserId" "<owner-auth-user-uuid>" --project src/api/AdielSystem.Api
dotnet user-secrets set "Supabase:Storage:ServiceRoleKey" "<sb_secret_backend-key>" --project src/api/AdielSystem.Api
```

`Supabase:Storage:ServiceRoleKey` is the application's compatibility setting name. Store a current Supabase secret key (`sb_secret_...`) in it. Never place that key in a frontend environment file, commit it, print it, or include it in logs.

For staging or production, use the deployment platform's secret manager with .NET's double-underscore environment-variable mapping:

```text
ConnectionStrings__DefaultConnection
AccessControl__OwnerUserId
Supabase__Storage__ServiceRoleKey
```

Do not commit `appsettings.Development.json`, `.env.local`, database passwords, access tokens, or backend secret keys. Avoid running `dotnet user-secrets list` in shared terminals or logs because it prints secret values.

## 4. Configure non-secret settings

Create the local backend settings file:

```powershell
Copy-Item src/api/AdielSystem.Api/appsettings.Development.example.json src/api/AdielSystem.Api/appsettings.Development.json
```

Set the project URL and confirm the frontend development origin. The private `business-images` bucket is shared by the supported modules; the backend creates safe owner/module object paths inside it.

```json
{
  "Cors": {
    "AllowedOrigins": [
      "http://localhost:5173"
    ]
  },
  "Supabase": {
    "Url": "https://<project-ref>.supabase.co",
    "Storage": {
      "Bucket": "business-images",
      "EnsureBucketOnStartup": true
    }
  }
}
```

On startup, the API confirms or creates the private bucket when `EnsureBucketOnStartup` is enabled and the configured backend key has permission. Stored database values are object paths; the API issues short-lived signed viewing URLs.

Create the frontend environment file:

```powershell
Copy-Item src/web/.env.example src/web/.env.local
```

Fill it with public browser configuration only:

```dotenv
VITE_API_BASE_URL=http://localhost:5080/api/v1
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<sb_publishable_browser-key>
VITE_SUPABASE_USERNAME_DOMAIN=users.adiel.local
```

The publishable key is intended for browser use. Authorization still depends on Supabase Auth, backend owner checks, and database security. Never use the backend secret key as `VITE_SUPABASE_PUBLISHABLE_KEY`.

## 5. Run the application

Start the API and frontend in separate terminals:

```powershell
dotnet run --project src/api/AdielSystem.Api
```

```powershell
npm run dev --prefix src/web
```

The frontend defaults to `http://localhost:5173`, and the API launch profile uses `http://localhost:5080`. API liveness is available at `/health/live`, database readiness at `/health/ready`, and versioned endpoints start at `/api/v1`.

## Moving to a different Supabase project

Treat a project move as four explicit workstreams:

1. **Schema:** link the CLI to the new project and run the committed migrations with `db push`.
2. **Business data:** export/import the required application rows separately, preserving IDs and foreign-key order. Do not use `seed.sql` as a production data-transfer mechanism.
3. **Auth:** recreate or migrate Supabase Auth users through a supported Auth migration process. Update `AccessControl:OwnerUserId` to the owner UUID in the destination project.
4. **Storage:** create or confirm the private `business-images` bucket, copy its objects, and preserve their object paths so existing image references remain valid. Follow [Storage object backups](docs/storage-object-backups.md).

Then replace the destination-specific connection string, project URL, backend secret key, frontend publishable key, and owner UUID. Restart the API and frontend so configuration is reloaded. Do not assume `supabase db push` transfers Auth users, business data, or Storage objects.

## Verification

Run the full project checks after setup or migration:

```powershell
dotnet build AdielSystem.slnx -c Release --no-restore
dotnet test AdielSystem.slnx -c Release --no-build --no-restore
npm run typecheck --prefix src/web
npm run build --prefix src/web
git diff --check
```

Also verify that:

- `/health/ready` reports a successful database connection.
- The configured owner can sign in and another user cannot access owner data.
- An image upload appears under the expected private bucket path and renders through a signed URL.
- No secret value or `.env.local`/development settings file is staged for commit.

Vite may report a chunk-size advisory during a successful build; treat it separately from compilation or type-check failures.

## Secret rotation checklist

When a database password, backend secret key, or frontend publishable key is rotated:

1. Create the replacement credential in Supabase.
2. Update the appropriate local user secret or deployment secret manager. Update `.env.local` only for a public publishable key.
3. Restart the affected process and verify authentication, readiness, and image upload/viewing.
4. Revoke the old credential only after the replacement is verified.
5. If a secret was ever committed or shared, remove the exposure, rotate immediately, and review repository and deployment logs.

## Dependency policy

React, Tailwind CSS, and Vite are versioned npm dependencies rather than CDN-loaded build tools. This provides reproducible builds, type checking, tree shaking, and a strict Content Security Policy. CDN delivery remains suitable for deployed static assets, fonts, and images.
