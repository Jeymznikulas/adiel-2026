-- Core ADIEL business workflow.
--
-- Business records are intentionally protected by RLS without browser policies.
-- They are read and written through the ASP.NET Core API, whose database/service
-- role bypasses RLS. Supabase Auth continues to own users and passwords.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.touch_business_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

create or replace function public.reject_immutable_record_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% records are append-only', tg_table_name
    using errcode = '55000';
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Company and configurable business options
-- ---------------------------------------------------------------------------

create table public.company_settings (
  id boolean primary key default true check (id),
  company_name text not null default 'ADIEL CONSTRUCTION SUPPLIES',
  address text not null default '',
  main_office_number text not null default '',
  client_relations_number text not null default '',
  accounts_number text not null default '',
  new_accounts_number text not null default '',
  email text not null default '',
  tin text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

create table public.document_defaults (
  id boolean primary key default true check (id),
  quotation_terms text not null default '',
  purchase_order_terms text not null default '',
  statement_payment_instructions text not null default '',
  pdf_footer text not null default '',
  late_charge_enabled boolean not null default false,
  late_charge_grace_days integer not null default 3 check (late_charge_grace_days between 0 and 90),
  late_charge_type text not null default 'Percentage'
    check (late_charge_type in ('Percentage', 'Fixed amount')),
  late_charge_value numeric(18, 4) not null default 0 check (late_charge_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

create table public.document_numbering_rules (
  document_type text primary key
    check (document_type in ('quotation', 'purchase_order', 'statement_of_account')),
  prefix text not null check (prefix ~ '^[A-Z0-9_-]{1,12}$'),
  starting_number integer not null default 1 check (starting_number between 1 and 99999999),
  digits integer not null default 3 check (digits between 2 and 8),
  include_year boolean not null default true,
  reset_yearly boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  check (not reset_yearly or include_year)
);

create table public.document_sequences (
  document_type text not null references public.document_numbering_rules (document_type) on delete cascade,
  prefix text not null,
  sequence_year integer not null default 0 check (sequence_year = 0 or sequence_year between 2000 and 9999),
  last_number bigint not null check (last_number > 0),
  updated_at timestamptz not null default now(),
  primary key (document_type, prefix, sequence_year)
);

create table public.business_options (
  id uuid primary key default gen_random_uuid(),
  option_type text not null
    check (option_type in ('expense_category', 'payment_method', 'client_industry', 'item_category')),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

create unique index business_options_type_name_unique
on public.business_options (option_type, lower(name));

insert into public.company_settings (id) values (true);

insert into public.document_defaults (
  id,
  quotation_terms,
  purchase_order_terms,
  statement_payment_instructions,
  pdf_footer
)
values (
  true,
  E'Prices and availability are valid only for the scope shown in this quotation.\nChanges to quantities, specifications, or delivery location may require a revised quotation.',
  E'All supplied items must match the specifications and quantities stated in this purchase order.\nPrices are inclusive of all agreed charges unless separately itemized in this document.\nThe supplier must reference the PO number on all delivery receipts and invoices.\nDelivery schedules or substitutions require prior written approval from ADIEL Construction Supplies.',
  'Please include the SOA number as the payment reference and send proof of payment to the accounts contact shown above.',
  'Generated electronically by the ADIEL Operations System.'
);

insert into public.document_numbering_rules
  (document_type, prefix, starting_number, digits, include_year, reset_yearly)
values
  ('quotation', 'QT', 1, 3, true, true),
  ('purchase_order', 'PO', 1, 3, true, true),
  ('statement_of_account', 'SOA', 1, 3, true, true);

create or replace function public.next_document_number(
  requested_document_type text,
  document_date date default current_date
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  numbering_rule public.document_numbering_rules%rowtype;
  counter_year integer;
  allocated_number bigint;
begin
  select *
  into strict numbering_rule
  from public.document_numbering_rules
  where document_type = requested_document_type;

  counter_year := case
    when numbering_rule.reset_yearly then extract(year from document_date)::integer
    else 0
  end;

  insert into public.document_sequences (
    document_type,
    prefix,
    sequence_year,
    last_number,
    updated_at
  )
  values (
    numbering_rule.document_type,
    numbering_rule.prefix,
    counter_year,
    numbering_rule.starting_number,
    now()
  )
  on conflict (document_type, prefix, sequence_year)
  do update
  set last_number = greatest(public.document_sequences.last_number + 1, excluded.last_number),
      updated_at = now()
  returning last_number into allocated_number;

  return concat_ws(
    '-',
    numbering_rule.prefix,
    case when numbering_rule.include_year then extract(year from document_date)::integer::text end,
    lpad(allocated_number::text, numbering_rule.digits, '0')
  );
end;
$$;

insert into public.business_options (option_type, name, sort_order)
select option_type, name, sort_order
from (values
  ('expense_category', 'Materials', 1),
  ('expense_category', 'Transportation', 2),
  ('expense_category', 'Office supplies', 3),
  ('expense_category', 'Utilities', 4),
  ('expense_category', 'Meals', 5),
  ('expense_category', 'Equipment', 6),
  ('expense_category', 'Professional fees', 7),
  ('expense_category', 'Other', 8),
  ('payment_method', 'Cash', 1),
  ('payment_method', 'GCash', 2),
  ('payment_method', 'Bank transfer', 3),
  ('payment_method', 'Credit card', 4),
  ('payment_method', 'Cheque', 5),
  ('payment_method', 'Other', 6),
  ('client_industry', 'Construction', 1),
  ('client_industry', 'Retail', 2),
  ('client_industry', 'Real estate', 3),
  ('client_industry', 'Manufacturing', 4),
  ('client_industry', 'Hospitality', 5),
  ('client_industry', 'Government', 6),
  ('client_industry', 'Education', 7),
  ('client_industry', 'Healthcare', 8),
  ('client_industry', 'Professional services', 9),
  ('client_industry', 'Other', 10),
  ('item_category', 'Electrical', 1),
  ('item_category', 'Hardware', 2),
  ('item_category', 'Construction materials', 3),
  ('item_category', 'Safety equipment', 4),
  ('item_category', 'Plumbing', 5),
  ('item_category', 'Tools', 6),
  ('item_category', 'Office supplies', 7),
  ('item_category', 'Other', 8)
) as defaults(option_type, name, sort_order);

-- ---------------------------------------------------------------------------
-- Clients and suppliers
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  photo_url text,
  address text not null default '',
  industry text not null default 'Other',
  client_since date not null default current_date,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  version bigint not null default 1 check (version > 0),
  check (deleted_at is null or archived_at is not null)
);

create unique index clients_active_name_unique
on public.clients (lower(name))
where deleted_at is null;

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  email text not null default '',
  phone text not null default '',
  is_primary boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

create unique index client_contacts_one_primary
on public.client_contacts (client_id)
where is_primary;

create index client_contacts_client_id_idx on public.client_contacts (client_id);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  logo_url text,
  supplier_type text not null default 'Other'
    check (supplier_type in ('Contractor', 'Distributor', 'Manufacturer', 'Service provider', 'Other')),
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  tin text not null default '',
  company_email text not null default '',
  company_phone text not null default '',
  address text not null default '',
  catalog_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  version bigint not null default 1 check (version > 0),
  check (deleted_at is null or archived_at is not null)
);

create unique index suppliers_active_name_unique
on public.suppliers (lower(name))
where deleted_at is null;

create table public.supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  email text not null default '',
  phone text not null default '',
  is_primary boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0)
);

create unique index supplier_contacts_one_primary
on public.supplier_contacts (supplier_id)
where is_primary;

create index supplier_contacts_supplier_id_idx on public.supplier_contacts (supplier_id);

create table public.supplier_categories (
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  category text not null check (char_length(btrim(category)) between 1 and 100),
  sort_order integer not null default 0 check (sort_order >= 0),
  primary key (supplier_id, category)
);

create table public.supplier_performance_notes (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  note text not null check (char_length(btrim(note)) > 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

create index supplier_performance_notes_supplier_id_idx
on public.supplier_performance_notes (supplier_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Item catalogue and price history
-- ---------------------------------------------------------------------------

create table public.items (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  photo_url text,
  category text not null default 'Other',
  subcategory text not null default '',
  brand text not null default '',
  unit_of_measure text not null default 'Piece',
  unit_weight numeric(18, 3) not null default 0 check (unit_weight >= 0),
  product_code text,
  barcode text,
  description text not null default '',
  status text not null default 'Active' check (status in ('Active', 'Inactive', 'Discontinued')),
  raw_cost numeric(18, 2) not null default 0 check (raw_cost >= 0),
  selling_price numeric(18, 2) not null default 0 check (selling_price >= 0),
  last_price_update date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  version bigint not null default 1 check (version > 0),
  check (deleted_at is null or archived_at is not null)
);

create unique index items_product_code_unique
on public.items (lower(product_code))
where product_code is not null and btrim(product_code) <> '' and deleted_at is null;

create index items_supplier_id_idx on public.items (supplier_id);
create index items_status_idx on public.items (status) where deleted_at is null;

create table public.item_variants (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  value text not null check (char_length(btrim(value)) between 1 and 200),
  photo_url text,
  product_code text,
  barcode text,
  unit_of_measure text not null default 'Piece',
  unit_weight numeric(18, 3) not null default 0 check (unit_weight >= 0),
  status text not null default 'Active' check (status in ('Active', 'Inactive', 'Discontinued')),
  raw_cost numeric(18, 2) not null default 0 check (raw_cost >= 0),
  selling_price numeric(18, 2) not null default 0 check (selling_price >= 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  unique (item_id, name, value)
);

create unique index item_variants_product_code_unique
on public.item_variants (lower(product_code))
where product_code is not null and btrim(product_code) <> '';

create index item_variants_item_id_idx on public.item_variants (item_id);

create table public.item_variant_specifications (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.item_variants (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  value text not null check (char_length(btrim(value)) between 1 and 500),
  sort_order integer not null default 0 check (sort_order >= 0),
  unique (variant_id, name)
);

create index item_variant_specifications_variant_id_idx
on public.item_variant_specifications (variant_id);

create table public.item_price_adjustments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  variant_id uuid references public.item_variants (id) on delete cascade,
  effective_date date not null,
  previous_raw_cost numeric(18, 2) not null check (previous_raw_cost >= 0),
  previous_selling_price numeric(18, 2) not null check (previous_selling_price >= 0),
  raw_cost numeric(18, 2) not null check (raw_cost >= 0),
  selling_price numeric(18, 2) not null check (selling_price >= 0),
  reason text not null check (char_length(btrim(reason)) > 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

create index item_price_adjustments_item_date_idx
on public.item_price_adjustments (item_id, effective_date desc, created_at desc);

-- ---------------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------------

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text not null check (char_length(btrim(quotation_number)) between 1 and 50),
  quotation_date date not null default current_date,
  client_id uuid references public.clients (id) on delete set null,
  client_name text not null,
  contact_id uuid references public.client_contacts (id) on delete set null,
  contact_person text not null default '',
  subject text not null default '',
  project_location text not null default '',
  lead_time text not null default '',
  notes text not null default '',
  terms text not null default '',
  currency_code char(3) not null default 'PHP',
  subtotal_amount numeric(18, 2) not null default 0 check (subtotal_amount >= 0),
  vat_enabled boolean not null default false,
  vat_rate numeric(7, 4) not null default 0.12 check (vat_rate between 0 and 1),
  vat_amount numeric(18, 2) not null default 0 check (vat_amount >= 0),
  total_amount numeric(18, 2) not null default 0 check (total_amount >= 0),
  estimated_profit numeric(18, 2) not null default 0,
  status text not null default 'Draft'
    check (status in ('Draft', 'For Approval', 'Approved', 'Rejected', 'Voided')),
  submitted_at timestamptz,
  submitted_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  rejected_at timestamptz,
  rejected_by uuid references public.profiles (id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  void_reason text,
  version bigint not null default 1 check (version > 0),
  check (deleted_at is null or archived_at is not null),
  check (status <> 'Rejected' or nullif(btrim(rejection_reason), '') is not null),
  check (status <> 'Voided' or nullif(btrim(void_reason), '') is not null)
);

create unique index quotations_number_unique on public.quotations (lower(quotation_number));
create index quotations_client_date_idx on public.quotations (client_id, quotation_date desc);
create index quotations_status_idx on public.quotations (status) where deleted_at is null;

create table public.quotation_lines (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  item_id uuid references public.items (id) on delete set null,
  variant_id uuid references public.item_variants (id) on delete set null,
  position integer not null check (position > 0),
  photo_url text,
  item_name text not null,
  variant_label text not null default '',
  product_code text not null default '',
  unit_of_measure text not null,
  quantity numeric(18, 3) not null check (quantity > 0),
  unit_price numeric(18, 2) not null check (unit_price >= 0),
  unit_cost numeric(18, 2) not null check (unit_cost >= 0),
  line_amount numeric(18, 2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now(),
  unique (quotation_id, position)
);

create index quotation_lines_quotation_id_idx on public.quotation_lines (quotation_id);
create index quotation_lines_item_id_idx on public.quotation_lines (item_id);

create table public.quotation_charges (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 100),
  amount numeric(18, 2) not null check (amount >= 0),
  position integer not null default 1 check (position > 0),
  unique (quotation_id, position)
);

create index quotation_charges_quotation_id_idx on public.quotation_charges (quotation_id);

-- ---------------------------------------------------------------------------
-- Purchase orders and expenses
-- ---------------------------------------------------------------------------

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null check (char_length(btrim(po_number)) between 1 and 50),
  order_date date not null default current_date,
  client_id uuid references public.clients (id) on delete set null,
  client_name text not null default '',
  supplier_id uuid references public.suppliers (id) on delete set null,
  supplier_name text not null,
  contact_person text not null default '',
  subject text not null default '',
  quotation_id uuid references public.quotations (id) on delete set null,
  quotation_number text not null default '',
  payment_method text not null default '',
  payment_term text not null default '',
  delivery_location text not null default '',
  delivery_mode text not null default '',
  notes text not null default '',
  terms text not null default '',
  currency_code char(3) not null default 'PHP',
  subtotal_amount numeric(18, 2) not null default 0 check (subtotal_amount >= 0),
  vat_enabled boolean not null default false,
  vat_rate numeric(7, 4) not null default 0.12 check (vat_rate between 0 and 1),
  vat_amount numeric(18, 2) not null default 0 check (vat_amount >= 0),
  total_amount numeric(18, 2) not null default 0 check (total_amount >= 0),
  status text not null default 'Not yet sent'
    check (status in ('Delivered', 'For Payment', 'Waiting for Delivery', 'Cancelled', 'Sent', 'Not yet sent')),
  document_status text not null default 'Draft'
    check (document_status in ('Draft', 'Sent', 'Cancelled')),
  delivery_status text not null default 'Pending'
    check (delivery_status in ('Pending', 'Partially Delivered', 'Delivered')),
  payment_status text not null default 'Not Due'
    check (payment_status in ('Not Due', 'To Pay', 'Overdue', 'Paid')),
  sent_at timestamptz,
  sent_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  void_reason text,
  version bigint not null default 1 check (version > 0),
  check (deleted_at is null or archived_at is not null),
  check (document_status <> 'Cancelled' or nullif(btrim(void_reason), '') is not null)
);

create unique index purchase_orders_number_unique on public.purchase_orders (lower(po_number));
create index purchase_orders_supplier_date_idx on public.purchase_orders (supplier_id, order_date desc);
create index purchase_orders_client_id_idx on public.purchase_orders (client_id);
create index purchase_orders_quotation_id_idx on public.purchase_orders (quotation_id);
create index purchase_orders_status_idx on public.purchase_orders (document_status, delivery_status, payment_status)
where deleted_at is null;

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  item_id uuid references public.items (id) on delete set null,
  variant_id uuid references public.item_variants (id) on delete set null,
  position integer not null check (position > 0),
  photo_url text,
  item_name text not null,
  variant_label text not null default '',
  product_code text not null default '',
  unit_of_measure text not null,
  quantity numeric(18, 3) not null check (quantity > 0),
  unit_cost numeric(18, 2) not null check (unit_cost >= 0),
  line_amount numeric(18, 2) generated always as (round(quantity * unit_cost, 2)) stored,
  created_at timestamptz not null default now(),
  unique (purchase_order_id, position)
);

create index purchase_order_lines_order_id_idx on public.purchase_order_lines (purchase_order_id);
create index purchase_order_lines_item_id_idx on public.purchase_order_lines (item_id);

create table public.purchase_order_charges (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 100),
  amount numeric(18, 2) not null check (amount >= 0),
  position integer not null default 1 check (position > 0),
  unique (purchase_order_id, position)
);

create index purchase_order_charges_order_id_idx
on public.purchase_order_charges (purchase_order_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  payee text not null check (char_length(btrim(payee)) between 1 and 200),
  category text not null,
  description text not null default '',
  amount numeric(18, 2) not null check (amount > 0),
  currency_code char(3) not null default 'PHP',
  payment_method text not null,
  purchaser text not null default '',
  status text not null default 'To pay'
    check (status in ('Paid', 'Verifying', 'To pay', 'Overdue', 'Cancelled')),
  invoice_url text,
  notes text not null default '',
  quotation_id uuid references public.quotations (id) on delete set null,
  quotation_number text not null default '',
  project_name text not null default '',
  purchase_order_id uuid references public.purchase_orders (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  void_reason text,
  version bigint not null default 1 check (version > 0),
  check (deleted_at is null or archived_at is not null),
  check (status <> 'Cancelled' or nullif(btrim(void_reason), '') is not null)
);

create unique index expenses_purchase_order_unique
on public.expenses (purchase_order_id)
where purchase_order_id is not null and deleted_at is null;

create index expenses_date_idx on public.expenses (expense_date desc) where deleted_at is null;
create index expenses_quotation_id_idx on public.expenses (quotation_id);
create index expenses_status_idx on public.expenses (status) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Statements of account, collections, late charges, and payments
-- ---------------------------------------------------------------------------

create table public.statements_of_account (
  id uuid primary key default gen_random_uuid(),
  soa_number text not null check (char_length(btrim(soa_number)) between 1 and 50),
  statement_date date not null default current_date,
  coverage_from date not null,
  coverage_to date not null,
  due_date date not null,
  client_id uuid references public.clients (id) on delete set null,
  client_name text not null,
  contact_person text not null default '',
  currency_code char(3) not null default 'PHP',
  opening_balance numeric(18, 2) not null default 0 check (opening_balance >= 0),
  total_charges numeric(18, 2) not null default 0 check (total_charges >= 0),
  total_payments numeric(18, 2) not null default 0 check (total_payments >= 0),
  balance numeric(18, 2) not null default 0 check (balance >= 0),
  payment_arrangement text not null default 'Full payment'
    check (payment_arrangement in ('Full payment', 'Installment', 'Custom schedule')),
  payment_frequency text not null default 'Custom'
    check (payment_frequency in ('Weekly', 'Every 2 weeks', 'Monthly', 'Quarterly', 'Custom')),
  late_charge_enabled boolean not null default false,
  late_charge_grace_days integer not null default 3 check (late_charge_grace_days between 0 and 90),
  late_charge_type text not null default 'Percentage'
    check (late_charge_type in ('Percentage', 'Fixed amount')),
  late_charge_value numeric(18, 4) not null default 0 check (late_charge_value >= 0),
  status text not null default 'Draft'
    check (status in ('Draft', 'Issued', 'Partially Settled', 'Settled', 'Overdue', 'Cancelled')),
  notes text not null default '',
  terms text not null default '',
  issued_at timestamptz,
  issued_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  void_reason text,
  version bigint not null default 1 check (version > 0),
  check (coverage_from <= coverage_to),
  check (deleted_at is null or archived_at is not null),
  check (status <> 'Cancelled' or nullif(btrim(void_reason), '') is not null)
);

create unique index statements_of_account_number_unique
on public.statements_of_account (lower(soa_number));

create index statements_of_account_client_date_idx
on public.statements_of_account (client_id, statement_date desc);

create index statements_of_account_status_due_idx
on public.statements_of_account (status, due_date)
where deleted_at is null;

create table public.statement_quotations (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.statements_of_account (id) on delete cascade,
  quotation_id uuid references public.quotations (id) on delete set null,
  position integer not null check (position > 0),
  quotation_number text not null,
  quotation_date date not null,
  subject text not null default '',
  project_location text not null default '',
  subtotal_amount numeric(18, 2) not null default 0 check (subtotal_amount >= 0),
  vat_enabled boolean not null default false,
  vat_amount numeric(18, 2) not null default 0 check (vat_amount >= 0),
  total_amount numeric(18, 2) not null default 0 check (total_amount >= 0),
  unique (statement_id, position),
  unique (statement_id, quotation_id)
);

create index statement_quotations_statement_id_idx on public.statement_quotations (statement_id);
create index statement_quotations_quotation_id_idx on public.statement_quotations (quotation_id);

create table public.statement_items (
  id uuid primary key default gen_random_uuid(),
  statement_quotation_id uuid not null references public.statement_quotations (id) on delete cascade,
  item_id uuid references public.items (id) on delete set null,
  variant_id uuid references public.item_variants (id) on delete set null,
  position integer not null check (position > 0),
  photo_url text,
  item_name text not null,
  variant_label text not null default '',
  product_code text not null default '',
  unit_of_measure text not null,
  quantity numeric(18, 3) not null check (quantity > 0),
  unit_price numeric(18, 2) not null check (unit_price >= 0),
  amount numeric(18, 2) not null check (amount >= 0),
  unique (statement_quotation_id, position)
);

create index statement_items_quotation_id_idx
on public.statement_items (statement_quotation_id);

create table public.statement_quotation_charges (
  id uuid primary key default gen_random_uuid(),
  statement_quotation_id uuid not null references public.statement_quotations (id) on delete cascade,
  label text not null,
  amount numeric(18, 2) not null check (amount >= 0),
  position integer not null check (position > 0),
  unique (statement_quotation_id, position)
);

create index statement_quotation_charges_quotation_id_idx
on public.statement_quotation_charges (statement_quotation_id);

create table public.payment_schedules (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.statements_of_account (id) on delete cascade,
  position integer not null check (position > 0),
  label text not null check (char_length(btrim(label)) between 1 and 100),
  due_date date not null,
  amount numeric(18, 2) not null check (amount > 0),
  late_charge_enabled boolean,
  late_charge_grace_days integer check (late_charge_grace_days between 0 and 90),
  late_charge_type text check (late_charge_type in ('Percentage', 'Fixed amount')),
  late_charge_value numeric(18, 4) check (late_charge_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  unique (statement_id, position)
);

create index payment_schedules_statement_due_idx
on public.payment_schedules (statement_id, due_date);

create table public.statement_late_charges (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.statements_of_account (id) on delete cascade,
  payment_schedule_id uuid not null references public.payment_schedules (id) on delete restrict,
  applied_date date not null,
  charge_type text not null check (charge_type in ('Percentage', 'Fixed amount')),
  rate_value numeric(18, 4) not null check (rate_value >= 0),
  calculated_amount numeric(18, 2) not null check (calculated_amount >= 0),
  amount numeric(18, 2) not null check (amount >= 0),
  status text not null default 'Applied' check (status in ('Applied', 'Waived')),
  reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  version bigint not null default 1 check (version > 0),
  unique (statement_id, payment_schedule_id)
);

create index statement_late_charges_statement_id_idx
on public.statement_late_charges (statement_id, status);

create table public.statement_payments (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.statements_of_account (id) on delete restrict,
  entry_type text not null default 'Payment' check (entry_type in ('Payment', 'Reversal')),
  reverses_payment_id uuid unique references public.statement_payments (id) on delete restrict,
  payment_date date not null,
  amount numeric(18, 2) not null check (amount > 0),
  principal_amount numeric(18, 2) not null default 0 check (principal_amount >= 0),
  late_charge_amount numeric(18, 2) not null default 0 check (late_charge_amount >= 0),
  method text not null,
  reference_number text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  check (amount = principal_amount + late_charge_amount),
  check (
    (entry_type = 'Payment' and reverses_payment_id is null)
    or (entry_type = 'Reversal' and reverses_payment_id is not null)
  )
);

create index statement_payments_statement_date_idx
on public.statement_payments (statement_id, payment_date desc, created_at desc);

create trigger protect_statement_payments
before update or delete on public.statement_payments
for each row execute function public.reject_immutable_record_change();

-- ---------------------------------------------------------------------------
-- Tasks and immutable audit records
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '',
  status text not null default 'To do' check (status in ('To do', 'In progress', 'Completed')),
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  assigned_to uuid references public.profiles (id) on delete set null,
  assigned_to_name text not null default '',
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_by_name text not null default '',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  version bigint not null default 1 check (version > 0),
  check (deleted_at is null or archived_at is not null)
);

create index tasks_assignee_status_idx on public.tasks (assigned_to, status) where deleted_at is null;
create index tasks_due_date_idx on public.tasks (due_date) where deleted_at is null and status <> 'Completed';

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  is_completed boolean not null default false,
  completed_at timestamptz,
  position integer not null default 1 check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1 check (version > 0),
  unique (task_id, position)
);

create index subtasks_task_id_idx on public.subtasks (task_id);

create table public.audit_records (
  id uuid primary key default gen_random_uuid(),
  record_id uuid,
  module text not null
    check (module in ('Tasks', 'Items', 'Expenses', 'Suppliers', 'Clients', 'Quotations', 'Purchase Orders', 'Statements of Account')),
  action text not null
    check (action in ('Created', 'Updated', 'Deleted', 'Archived', 'Restored', 'Soft deleted', 'Voided', 'Status changed', 'Payment recorded', 'Payment reversed', 'Subtask added', 'Subtask updated', 'Subtask removed', 'Added to Expenses', 'Removed from Expenses')),
  entity text not null,
  description text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text not null,
  tone text not null default 'info' check (tone in ('success', 'info', 'warning', 'danger')),
  amount numeric(18, 2),
  status text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now()
);

create index audit_records_record_idx on public.audit_records (module, record_id, occurred_at desc);
create index audit_records_occurred_at_idx on public.audit_records (occurred_at desc);

create trigger protect_audit_records
before update or delete on public.audit_records
for each row execute function public.reject_immutable_record_change();

-- ---------------------------------------------------------------------------
-- Optimistic-concurrency and updated-at triggers
-- ---------------------------------------------------------------------------

create trigger touch_company_settings before update on public.company_settings
for each row execute function public.touch_business_record();
create trigger touch_document_defaults before update on public.document_defaults
for each row execute function public.touch_business_record();
create trigger touch_document_numbering_rules before update on public.document_numbering_rules
for each row execute function public.touch_business_record();
create trigger touch_business_options before update on public.business_options
for each row execute function public.touch_business_record();
create trigger touch_clients before update on public.clients
for each row execute function public.touch_business_record();
create trigger touch_client_contacts before update on public.client_contacts
for each row execute function public.touch_business_record();
create trigger touch_suppliers before update on public.suppliers
for each row execute function public.touch_business_record();
create trigger touch_supplier_contacts before update on public.supplier_contacts
for each row execute function public.touch_business_record();
create trigger touch_items before update on public.items
for each row execute function public.touch_business_record();
create trigger touch_item_variants before update on public.item_variants
for each row execute function public.touch_business_record();
create trigger touch_quotations before update on public.quotations
for each row execute function public.touch_business_record();
create trigger touch_purchase_orders before update on public.purchase_orders
for each row execute function public.touch_business_record();
create trigger touch_expenses before update on public.expenses
for each row execute function public.touch_business_record();
create trigger touch_statements_of_account before update on public.statements_of_account
for each row execute function public.touch_business_record();
create trigger touch_payment_schedules before update on public.payment_schedules
for each row execute function public.touch_business_record();
create trigger touch_statement_late_charges before update on public.statement_late_charges
for each row execute function public.touch_business_record();
create trigger touch_tasks before update on public.tasks
for each row execute function public.touch_business_record();
create trigger touch_subtasks before update on public.subtasks
for each row execute function public.touch_business_record();

-- ---------------------------------------------------------------------------
-- RLS: business data is backend-only. No authenticated/anon policies are added.
-- ---------------------------------------------------------------------------

alter table public.company_settings enable row level security;
alter table public.document_defaults enable row level security;
alter table public.document_numbering_rules enable row level security;
alter table public.document_sequences enable row level security;
alter table public.business_options enable row level security;
alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_contacts enable row level security;
alter table public.supplier_categories enable row level security;
alter table public.supplier_performance_notes enable row level security;
alter table public.items enable row level security;
alter table public.item_variants enable row level security;
alter table public.item_variant_specifications enable row level security;
alter table public.item_price_adjustments enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_lines enable row level security;
alter table public.quotation_charges enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.purchase_order_charges enable row level security;
alter table public.expenses enable row level security;
alter table public.statements_of_account enable row level security;
alter table public.statement_quotations enable row level security;
alter table public.statement_items enable row level security;
alter table public.statement_quotation_charges enable row level security;
alter table public.payment_schedules enable row level security;
alter table public.statement_late_charges enable row level security;
alter table public.statement_payments enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.audit_records enable row level security;

comment on table public.quotation_lines is
  'Historical quotation line snapshots. The API must reject changes after approval or voiding.';
comment on table public.statement_quotations is
  'Immutable-at-issue quotation snapshots used by statements of account.';
comment on table public.statement_payments is
  'Append-only payment ledger. Corrections are new Reversal rows, never updates or deletes.';
comment on table public.audit_records is
  'Append-only audit trail for business workflow changes.';
