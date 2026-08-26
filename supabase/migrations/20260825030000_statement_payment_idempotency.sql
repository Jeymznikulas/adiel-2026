-- Phase 10: a durable, per-statement idempotency key prevents duplicate payment submissions.
alter table public.statement_payments
  add column if not exists idempotency_key text;

alter table public.statement_payments
  add constraint statement_payments_idempotency_key_length
  check (idempotency_key is null or char_length(btrim(idempotency_key)) between 1 and 100);

create unique index if not exists statement_payments_statement_idempotency_unique
  on public.statement_payments (statement_id, idempotency_key)
  where idempotency_key is not null;
