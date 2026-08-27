begin;

alter table public.business_options
  add column if not exists contact_email text;

alter table public.business_options
  add constraint business_options_contact_email_check
  check (
    contact_email is null
    or (
      char_length(contact_email) between 3 and 254
      and contact_email = lower(btrim(contact_email))
      and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  );

create unique index if not exists business_options_task_assignee_email_unique
on public.business_options (lower(contact_email))
where option_type = 'task_assignee' and contact_email is not null;

create table public.google_calendar_connections (
  owner_user_id uuid primary key references public.profiles (id) on delete cascade,
  google_subject text not null,
  google_account_email text not null,
  encrypted_refresh_token text not null,
  calendar_id text not null default 'primary',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  version bigint not null default 1 check (version > 0)
);

create table public.google_calendar_oauth_states (
  state_hash text primary key,
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at)
);

create table public.task_calendar_events (
  task_id uuid primary key references public.tasks (id) on delete cascade,
  google_event_id text not null,
  google_calendar_id text not null,
  attendee_emails text[] not null default '{}',
  last_synced_task_version bigint not null check (last_synced_task_version > 0),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'failed')),
  last_error text,
  updated_at timestamptz not null default now()
);

create table public.calendar_sync_jobs (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  requested_task_version bigint not null check (requested_task_version > 0),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  locked_by text,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index calendar_sync_jobs_pending_idx
on public.calendar_sync_jobs (available_at, id)
where completed_at is null;

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_oauth_states enable row level security;
alter table public.task_calendar_events enable row level security;
alter table public.calendar_sync_jobs enable row level security;

commit;
