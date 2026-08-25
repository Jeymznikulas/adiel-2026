begin;

create temporary table leaked_integration_client_ids on commit drop as
select id
from public.clients
where name like 'Integration Client %';

alter table public.audit_records disable trigger protect_audit_records;

delete from public.audit_records audit
using leaked_integration_client_ids leaked
where audit.module = 'Clients'
  and audit.record_id = leaked.id;

delete from public.audit_records
where module = 'Settings'
  and entity like 'Integration option %';

alter table public.audit_records enable trigger protect_audit_records;

delete from public.clients client
using leaked_integration_client_ids leaked
where client.id = leaked.id;

update public.company_settings
set address = '',
    main_office_number = '',
    email = '',
    tin = ''
where id = true
  and address = 'Integration Test Address'
  and main_office_number = '+63 900 000 0000'
  and email = 'owner@example.com'
  and tin = '000-000-000';

commit;
