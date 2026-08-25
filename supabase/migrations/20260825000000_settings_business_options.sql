begin;

alter table public.business_options
  drop constraint business_options_option_type_check;

alter table public.business_options
  add constraint business_options_option_type_check
  check (option_type in (
    'expense_category',
    'payment_method',
    'client_industry',
    'supplier_category',
    'item_category'
  ));

insert into public.business_options (option_type, name, sort_order)
select 'supplier_category', name, sort_order
from (values
  ('Electrical', 1),
  ('Metals', 2),
  ('Hardware', 3),
  ('Construction', 4),
  ('Safety', 5),
  ('Plumbing', 6),
  ('Tools', 7),
  ('Office supplies', 8),
  ('Other', 9)
) as defaults(name, sort_order)
on conflict do nothing;

alter table public.audit_records
  drop constraint audit_records_module_check;

alter table public.audit_records
  add constraint audit_records_module_check
  check (module in (
    'Settings',
    'Tasks',
    'Items',
    'Expenses',
    'Suppliers',
    'Clients',
    'Quotations',
    'Purchase Orders',
    'Statements of Account'
  ));

commit;
