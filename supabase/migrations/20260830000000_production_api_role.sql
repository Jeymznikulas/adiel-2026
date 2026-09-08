begin;

-- The login credential is created outside migrations so its password never enters
-- source control. The deployment login must be granted this NOLOGIN role.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'adiel_api_runtime') then
    create role adiel_api_runtime nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end
$$;

alter role adiel_api_runtime nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
grant usage on schema public to adiel_api_runtime;

grant select, insert, update, delete on table
  public.company_settings,
  public.document_defaults,
  public.document_numbering_rules,
  public.document_sequences,
  public.business_options,
  public.clients,
  public.client_contacts,
  public.suppliers,
  public.supplier_contacts,
  public.supplier_categories,
  public.supplier_performance_notes,
  public.items,
  public.item_variants,
  public.item_variant_specifications,
  public.quotations,
  public.quotation_lines,
  public.quotation_charges,
  public.purchase_orders,
  public.purchase_order_lines,
  public.purchase_order_charges,
  public.expenses,
  public.statements_of_account,
  public.statement_quotations,
  public.statement_items,
  public.statement_quotation_charges,
  public.payment_schedules,
  public.statement_late_charges,
  public.tasks,
  public.subtasks,
  public.google_calendar_connections,
  public.google_calendar_oauth_states,
  public.task_calendar_events,
  public.calendar_sync_jobs
to adiel_api_runtime;

grant select, insert on table
  public.audit_records,
  public.item_price_adjustments,
  public.statement_payments,
  public.purchase_order_payments
to adiel_api_runtime;

grant select on table public.profiles to adiel_api_runtime;
grant usage, select on all sequences in schema public to adiel_api_runtime;

revoke execute on function public.preview_document_number(text, date) from public;
revoke execute on function public.next_document_number(text, date) from public;
revoke execute on function public.handle_new_auth_user() from public;
revoke execute on function public.set_updated_at() from public;
revoke execute on function public.touch_business_record() from public;
revoke execute on function public.reject_immutable_record_change() from public;
grant execute on function public.preview_document_number(text, date) to adiel_api_runtime;
grant execute on function public.next_document_number(text, date) to adiel_api_runtime;

do $policy$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'company_settings', 'document_defaults', 'document_numbering_rules', 'document_sequences',
    'business_options', 'clients', 'client_contacts', 'suppliers', 'supplier_contacts',
    'supplier_categories', 'supplier_performance_notes', 'items', 'item_variants',
    'item_variant_specifications', 'item_price_adjustments', 'quotations', 'quotation_lines',
    'quotation_charges', 'purchase_orders', 'purchase_order_lines', 'purchase_order_charges',
    'purchase_order_payments', 'expenses', 'statements_of_account', 'statement_quotations',
    'statement_items', 'statement_quotation_charges', 'payment_schedules', 'statement_late_charges',
    'statement_payments', 'tasks', 'subtasks', 'audit_records', 'google_calendar_connections',
    'google_calendar_oauth_states', 'task_calendar_events', 'calendar_sync_jobs'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'API runtime access', table_name);
    execute format(
      'create policy %I on public.%I for all to adiel_api_runtime using (true) with check (true)',
      'API runtime access', table_name);
  end loop;
end
$policy$;

commit;
