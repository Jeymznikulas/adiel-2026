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
    'item_category',
    'task_assignee'
  ));

commit;
