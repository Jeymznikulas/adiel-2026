alter table public.tasks
  add column due_time time without time zone,
  add constraint tasks_due_time_requires_due_date_check
  check (due_time is null or due_date is not null);
