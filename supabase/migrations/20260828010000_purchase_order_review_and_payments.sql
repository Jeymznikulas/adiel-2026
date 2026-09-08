-- Purchase-order review states and append-only supplier payment ledger.
do $purchase_order_review_and_payments$
begin
alter table public.purchase_orders
  drop constraint if exists purchase_orders_document_status_check;

alter table public.purchase_orders
  add constraint purchase_orders_document_status_check
  check (document_status in ('Draft', 'Sent', 'Approved', 'For Revision', 'Cancelled'));

alter table public.purchase_orders
  drop constraint if exists purchase_orders_status_check;

alter table public.purchase_orders
  add constraint purchase_orders_status_check
  check (status in ('Delivered', 'For Payment', 'Waiting for Delivery', 'Cancelled', 'Approved', 'For Revision', 'Sent', 'Not yet sent'));

create table public.purchase_order_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete restrict,
  payment_date date not null,
  amount numeric(18, 2) not null check (amount > 0),
  balance_after numeric(18, 2) not null check (balance_after >= 0),
  method text not null check (char_length(btrim(method)) between 1 and 100),
  reference_number text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

create index purchase_order_payments_order_date_idx
on public.purchase_order_payments (purchase_order_id, payment_date desc, created_at desc);

create trigger protect_purchase_order_payments
before update or delete on public.purchase_order_payments
for each row execute function public.reject_immutable_record_change();

alter table public.purchase_order_payments enable row level security;

comment on table public.purchase_order_payments is
  'Append-only supplier payment ledger. Status and remaining balance are calculated by the backend.';
end
$purchase_order_review_and_payments$;
