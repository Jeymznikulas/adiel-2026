-- Supabase Auth remains responsible for password storage and verification.
-- The application converts a username to: username@users.adiel.local.

alter table public.profiles
add column if not exists username text;

alter table public.profiles
add constraint profiles_username_format
check (username is null or username ~ '^[a-z0-9._-]{3,64}$');

create unique index if not exists profiles_username_unique
on public.profiles (lower(username))
where username is not null;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  derived_username text;
begin
  derived_username := lower(split_part(coalesce(new.email, ''), '@', 1));

  if derived_username !~ '^[a-z0-9._-]{3,64}$' then
    raise exception 'The authentication identifier does not contain a valid username.';
  end if;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    derived_username,
    coalesce(new.raw_user_meta_data ->> 'display_name', derived_username)
  )
  on conflict (id) do update
  set username = coalesce(public.profiles.username, excluded.username),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

