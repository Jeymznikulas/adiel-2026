# Database backup and restore

The owner-only **Settings > Backup** screen creates portable ZIP archives of the application's business data.

## Initial setup

Run the complete contents of:

`supabase/migrations/20260920010000_database_backup_restore.sql`

in the Supabase SQL Editor. Run it once against each Supabase project used by the application.

## Included

- Company and document settings
- Clients and contacts
- Suppliers, contacts, categories, and performance notes
- Items, variants, specifications, prices, and price history
- Quotations and purchase orders, including charges and payments
- Expenses
- Statements of account, schedules, charges, and payments
- Tasks, subtasks, and audit records

Generated database columns are recalculated during restore. Archive manifests contain a schema fingerprint, table row counts, and SHA-256 checksums.

## Excluded

- Supabase Auth users and passwords
- Supabase Storage objects (database URL fields are retained)
- Environment files and API credentials
- Google OAuth connections, tokens, transient states, event mappings, and sync jobs
- Database schema and application source code

Google Calendar must be reconnected after a restore.

## Restore safety

Only the configured owner can access the endpoints. An uploaded archive is fully validated before mutation. Restore requires the exact confirmation phrase `RESTORE`, creates and stores a pre-restore safety backup, and replaces the business tables inside one serializable PostgreSQL transaction. A failure rolls the transaction back without partially restored business data.

Only restore an archive into the same Supabase project and a compatible application/schema version. Test important restores against a separate test environment first.

The upload limit is 60 MB compressed and 256 MB expanded. The 50 most recent stored backup records are shown in the user interface.
