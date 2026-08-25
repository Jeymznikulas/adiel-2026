begin;

create unique index document_numbering_rules_prefix_unique
on public.document_numbering_rules (prefix);

create or replace function public.preview_document_number(
  requested_document_type text,
  document_date date default current_date
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  numbering_rule public.document_numbering_rules%rowtype;
  counter_year integer;
  next_number bigint;
begin
  select *
  into strict numbering_rule
  from public.document_numbering_rules
  where document_type = requested_document_type;

  counter_year := case
    when numbering_rule.reset_yearly then extract(year from document_date)::integer
    else 0
  end;

  select greatest(document_sequences.last_number + 1, numbering_rule.starting_number)
  into next_number
  from public.document_sequences
  where document_type = numbering_rule.document_type
    and prefix = numbering_rule.prefix
    and sequence_year = counter_year;

  next_number := coalesce(next_number, numbering_rule.starting_number);

  return concat_ws(
    '-',
    numbering_rule.prefix,
    case when numbering_rule.include_year then extract(year from document_date)::integer::text end,
    lpad(next_number::text, numbering_rule.digits, '0')
  );
end;
$$;

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
  where document_type = requested_document_type
  for share;

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

commit;
