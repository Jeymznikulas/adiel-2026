-- Delivery and payment are independent PO lifecycle tracks. Payment can begin
-- before delivery, and partial payment is represented explicitly.
alter table public.purchase_orders
  drop constraint if exists purchase_orders_payment_status_check;

alter table public.purchase_orders
  add constraint purchase_orders_payment_status_check
  check (payment_status in ('Not Due', 'To Pay', 'Partially Paid', 'Overdue', 'Paid'));
