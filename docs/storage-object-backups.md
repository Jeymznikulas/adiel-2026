# Supabase Storage object backups

Database backups do not include objects stored in Supabase Storage. Back up the private `business-images` bucket separately from PostgreSQL and keep both backups under the same retention policy.

## Configuration

The API reads `Supabase:Storage:ServiceRoleKey` from external configuration. For local development, configure it with .NET Secret Manager:

```powershell
dotnet user-secrets set "Supabase:Storage:ServiceRoleKey" "<service-role-key>" --project src/api/AdielSystem.Api/AdielSystem.Api.csproj
```

Use the deployment platform's managed secret store in production. Never place the key in an appsettings file, frontend environment variable, log, backup manifest, or source-control system.

## Backup procedure

1. Use a trusted server-side job authenticated with the service role to enumerate every object in `business-images`.
2. Download objects with their exact object paths into encrypted backup storage. Preserve the owner/module/entity prefixes.
3. Record a manifest containing object path, byte length, content type, checksum, and backup timestamp. Do not include signed URLs or credentials.
4. Compare the manifest with the `photo_url` paths in `clients`, `suppliers`, `items`, and `item_variants` and investigate missing or unreferenced objects.
5. Test restoration into an isolated private bucket and confirm that the API can generate short-lived signed URLs after database and object restoration.

Run object backups after database backups or use a coordinated maintenance window so references and objects represent the same recovery point. Apply retention and deletion rules to both copies.
