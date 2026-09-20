begin;

do $role$
begin
  if not exists (select 1 from pg_roles where rolname = 'adiel_api_runtime') then
    create role adiel_api_runtime nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end
$role$;

create table public.system_backups (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('Manual', 'Pre-restore')),
  file_name text not null check (char_length(btrim(file_name)) between 1 and 240),
  created_at timestamptz not null default now(),
  created_by uuid not null,
  created_by_name text not null,
  schema_fingerprint text not null check (char_length(schema_fingerprint) = 64),
  table_count integer not null check (table_count > 0),
  row_count bigint not null check (row_count >= 0),
  size_bytes bigint not null check (size_bytes > 0),
  archive_sha256 text not null check (char_length(archive_sha256) = 64),
  archive_data bytea not null
);

create index system_backups_created_at_idx
on public.system_backups (created_at desc);

create table public.system_restore_history (
  id uuid primary key default gen_random_uuid(),
  source_file_name text not null,
  source_created_at timestamptz not null,
  restored_at timestamptz not null default now(),
  restored_by uuid not null,
  restored_by_name text not null,
  safety_backup_id uuid not null references public.system_backups (id) on delete restrict,
  schema_fingerprint text not null check (char_length(schema_fingerprint) = 64),
  table_count integer not null check (table_count > 0),
  row_count bigint not null check (row_count >= 0)
);

create index system_restore_history_restored_at_idx
on public.system_restore_history (restored_at desc);

alter table public.system_backups enable row level security;
alter table public.system_restore_history enable row level security;

grant select, insert on table public.system_backups, public.system_restore_history
to adiel_api_runtime;

create policy "API runtime access"
on public.system_backups
for all to adiel_api_runtime
using (true)
with check (true);

create policy "API runtime access"
on public.system_restore_history
for all to adiel_api_runtime
using (true)
with check (true);

create or replace function public.prepare_database_restore()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $restore$
begin
  truncate table
    public.calendar_sync_jobs,
    public.task_calendar_events,
    public.google_calendar_oauth_states,
    public.google_calendar_connections,
    public.audit_records,
    public.subtasks,
    public.tasks,
    public.statement_payments,
    public.statement_late_charges,
    public.payment_schedules,
    public.statement_quotation_charges,
    public.statement_items,
    public.statement_quotations,
    public.statements_of_account,
    public.expenses,
    public.purchase_order_payments,
    public.purchase_order_charges,
    public.purchase_order_lines,
    public.purchase_orders,
    public.quotation_charges,
    public.quotation_lines,
    public.quotations,
    public.item_price_adjustments,
    public.item_variant_specifications,
    public.item_variants,
    public.items,
    public.supplier_performance_notes,
    public.supplier_categories,
    public.supplier_contacts,
    public.suppliers,
    public.client_contacts,
    public.clients,
    public.business_options,
    public.document_sequences,
    public.document_numbering_rules,
    public.document_defaults,
    public.company_settings
  restart identity cascade;
end
$restore$;

create or replace function public.restore_database_table(target_table text, payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog
as $restore$
declare
  insert_columns text;
  inserted_rows bigint;
begin
  if target_table is null or target_table <> all (array[
    'company_settings', 'document_defaults', 'document_numbering_rules', 'document_sequences',
    'business_options', 'clients', 'client_contacts', 'suppliers', 'supplier_contacts',
    'supplier_categories', 'supplier_performance_notes', 'items', 'item_variants',
    'item_variant_specifications', 'item_price_adjustments', 'quotations', 'quotation_lines',
    'quotation_charges', 'purchase_orders', 'purchase_order_lines', 'purchase_order_charges',
    'purchase_order_payments', 'expenses', 'statements_of_account', 'statement_quotations',
    'statement_items', 'statement_quotation_charges', 'payment_schedules', 'statement_late_charges',
    'statement_payments', 'tasks', 'subtasks', 'audit_records'
  ]) then
    raise exception 'Table is not allowed for database restore.' using errcode = '22023';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'array' then
    raise exception 'Restore payload must be a JSON array.' using errcode = '22023';
  end if;

  select string_agg(format('%I', attribute.attname), ', ' order by attribute.attnum)
  into insert_columns
  from pg_attribute attribute
  where attribute.attrelid = format('public.%I', target_table)::regclass
    and attribute.attnum > 0
    and not attribute.attisdropped
    and attribute.attgenerated = ''
    and attribute.attidentity <> 'a';

  if insert_columns is null then
    raise exception 'No restorable columns were found.' using errcode = '55000';
  end if;

  execute format(
    'insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1)',
    target_table,
    insert_columns,
    insert_columns,
    target_table
  ) using payload;

  get diagnostics inserted_rows = row_count;
  return inserted_rows;
end
$restore$;

revoke all on function public.prepare_database_restore() from public;
revoke all on function public.restore_database_table(text, jsonb) from public;
grant execute on function public.prepare_database_restore() to adiel_api_runtime;
grant execute on function public.restore_database_table(text, jsonb) to adiel_api_runtime;

comment on table public.system_backups is
  'Owner-created and automatic pre-restore database archives. Archive contents exclude Auth, Storage objects, and integration credentials.';
comment on table public.system_restore_history is
  'Immutable history of successful owner-initiated business-data restores.';

commit;
