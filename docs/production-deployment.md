# Production deployment and recovery

Phase 14 does not assume a deployment provider. Before approval, replace every example host, origin, proxy IP and project reference with the actual target values and keep secret values in the provider's managed secret store.

## Required production configuration

Copy the values from `src/api/AdielSystem.Api/appsettings.Production.example.json` into provider configuration. Do not deploy the example file as-is.

Required external secrets use .NET's double-underscore mapping:

```text
ConnectionStrings__DefaultConnection
AccessControl__OwnerUserId
Supabase__Storage__ServiceRoleKey
GoogleCalendar__ClientSecret (only when enabled)
```

The API refuses to start outside Development when `AllowedHosts` is wildcarded, CORS has no explicit HTTPS origin, the database login is `postgres`, the database password is a placeholder, or the Storage credential is absent. Set `ReverseProxy:Enabled=true` only behind a proxy, list its exact IP address in `KnownProxies`, and preserve one forwarding hop unless the documented topology has two. Forwarded headers from every other address are ignored. Terminate TLS at the trusted proxy or Kestrel, redirect HTTP to HTTPS, and verify the response contains HSTS after forwarding is applied.

OpenAPI JSON is available at `/openapi/v1.json` only to the configured owner. Request bodies are capped at 6 MiB, requests time out after 30 seconds, request headers after 15 seconds, and owner APIs permit 120 requests per 60 seconds with no queue. Adjust these only from observed production traffic; the 6 MiB cap must remain above the validated 5 MiB image limit.

`/health/live` checks only the process. `/health/ready` checks PostgreSQL and performs a read-only verification that the configured Storage bucket exists and is private. A failed dependency returns unhealthy without response bodies, credentials or exception details.

## Least-privilege database login

Apply `20260830000000_production_api_role.sql`. It creates the `NOLOGIN`, non-superuser, non-`BYPASSRLS` role `adiel_api_runtime`, grants only the tables/functions used by the API, and adds role-specific RLS policies. It does not create a credential.

From an authorized database-administration session, generate a unique password in the secret manager and create the deployment login without recording the password in shell history or logs:

```sql
create role adiel_api_login
  login nosuperuser nocreatedb nocreaterole inherit nobypassrls
  password '<value supplied directly from the secret manager>'
  in role adiel_api_runtime;
```

For the Supabase session pooler, use `Username=adiel_api_login.<project-ref>`. Store the entire connection string as `ConnectionStrings__DefaultConnection`, use `SSL Mode=VerifyFull`, and validate the provider's CA chain. After switching, verify API CRUD, numbering functions and `/health/ready`; then revoke the old application access to the `postgres` credential.

## RLS and Advisor verification

Run the committed authenticated integration suite, including `Every_exposed_table_has_rls_and_the_runtime_role_cannot_bypass_it`. In Supabase Dashboard, run Security Advisor and Performance Advisor after all migrations are applied. Export or capture the dated results, resolve every error/high-severity finding, and record accepted lower-severity findings with an owner and due date. Dashboard Advisor access cannot be inferred from CLI database access.

## Backup schedule

Configure two independent jobs in the production scheduler:

1. Nightly database export to encrypted, versioned storage outside the repository: `scripts/backup-database.ps1 -BackupRoot <encrypted-destination>`. Retain 14 daily, 8 weekly and 12 monthly recovery points. Alert on a non-zero exit, a missing file, an empty data export or checksum failure.
2. Immediately afterward, back up private objects: set `ADIEL_SUPABASE_URL` and `ADIEL_STORAGE_SERVICE_KEY` from the job's secret store, then run `scripts/backup-storage.ps1 -BackupRoot <encrypted-destination>`. Retain it under the same policy and recovery-point label as the database export.

Database exports do not contain Storage objects. Storage manifests contain paths, sizes and SHA-256 checksums but never signed URLs or credentials. Restrict backup read access separately from production write access and test alert delivery quarterly.

## Isolated restore drill

An actual restore is destructive and must target a disposable Supabase project that is positively identified by project reference and has no production traffic.

1. Obtain written approval naming the isolated target project and recovery point. Record source/target project references, operators and start time.
2. Verify the target is disposable; never use `db reset --linked` on production.
3. Apply committed migrations to the target, then restore the selected `data.sql` with an authorized PostgreSQL client. Restore Auth users through the supported Supabase Auth migration process rather than editing `auth.users` ad hoc.
4. Create a private target bucket with the production MIME and size limits. Upload every object at its exact manifest path.
5. Compare database row counts, object count/bytes/checksums and orphan/missing image references.
6. Configure an isolated API with the target secrets and least-privilege login. Run readiness, the authenticated API suite, browser E2E and the complete Client-to-Payment workflow.
7. Record recovery-point age (RPO), elapsed restore time (RTO), discrepancies and remediation. Delete the disposable target only under the separate approval that authorized cleanup.

No restore-drill checkbox may be marked complete without the dated evidence above.

## Final commands

```powershell
dotnet build AdielSystem.slnx -c Release --no-restore
dotnet test AdielSystem.slnx -c Release --no-build --no-restore
npm run typecheck --prefix src/web
npm run build --prefix src/web
npm run e2e --prefix src/web
powershell -File scripts/phase14-scans.ps1
npm audit --prefix src/web --omit=dev
git diff --check
```

For authenticated browser coverage, supply `ADIEL_E2E_USERNAME` and `ADIEL_E2E_PASSWORD` from the test secret store. Never place them in `.env` files or Playwright reports.
