alter table public.quotations
  drop column if exists discount_label,
  add column if not exists discount_type text not null default 'Percentage' check (discount_type in ('Percentage', 'Fixed amount')),
  add column if not exists discount_value numeric(18, 2) not null default 0 check (discount_value >= 0),
  add column if not exists discount_amount numeric(18, 2) not null default 0 check (discount_amount >= 0),
  drop constraint if exists quotations_discount_subtotal_check,
  add constraint quotations_discount_subtotal_check check (discount_amount <= subtotal_amount),
  drop constraint if exists quotations_discount_percentage_check,
  add constraint quotations_discount_percentage_check check (discount_type <> 'Percentage' or discount_value <= 100);

alter table public.statement_quotations
  drop column if exists discount_label,
  add column if not exists discount_type text not null default 'Percentage' check (discount_type in ('Percentage', 'Fixed amount')),
  add column if not exists discount_value numeric(18, 2) not null default 0 check (discount_value >= 0),
  add column if not exists discount_amount numeric(18, 2) not null default 0 check (discount_amount >= 0),
  drop constraint if exists statement_quotations_discount_subtotal_check,
  add constraint statement_quotations_discount_subtotal_check check (discount_amount <= subtotal_amount),
  drop constraint if exists statement_quotations_discount_percentage_check,
  add constraint statement_quotations_discount_percentage_check check (discount_type <> 'Percentage' or discount_value <= 100);
