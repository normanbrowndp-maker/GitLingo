-- Apply once to a Supabase project after checking that these object names are unused.
-- The migration intentionally does not use IF NOT EXISTS: an existing object needs review.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint profiles_display_name_length check (
    display_name = pg_catalog.btrim(display_name)
    and pg_catalog.char_length(display_name) between 1 and 40
  )
);

alter table public.profiles enable row level security;

create table public.user_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  schema_version integer not null default 1,
  revision bigint not null default 1,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint user_progress_schema_version_positive check (schema_version > 0),
  constraint user_progress_revision_positive check (revision > 0),
  constraint user_progress_state_matches_version check (
    case
      when pg_catalog.jsonb_typeof(state) is distinct from 'object' then false
      when state -> 'v' is null then false
      when pg_catalog.jsonb_typeof(state -> 'v') is distinct from 'number' then false
      when state ->> 'v' !~ '^[1-9][0-9]*$' then false
      else (state ->> 'v')::numeric = schema_version
    end
  )
);

alter table public.user_progress enable row level security;

create function public.touch_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    new.created_at := pg_catalog.clock_timestamp();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$function$;

create function public.touch_progress_metadata()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    new.created_at := pg_catalog.clock_timestamp();
    new.revision := 1;
  else
    new.created_at := old.created_at;
    new.revision := old.revision + 1;
  end if;
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$function$;

create trigger profiles_set_updated_at
before insert or update on public.profiles
for each row execute function public.touch_profile_updated_at();

create trigger user_progress_set_server_metadata
before insert or update on public.user_progress
for each row execute function public.touch_progress_metadata();

revoke all privileges on function public.touch_profile_updated_at() from public, anon, authenticated;
revoke all privileges on function public.touch_progress_metadata() from public, anon, authenticated;

revoke all privileges on table public.profiles from public, anon, authenticated;
revoke all privileges on table public.user_progress from public, anon, authenticated;
revoke all privileges (id, display_name, created_at, updated_at)
  on table public.profiles from public, anon, authenticated;
revoke all privileges (user_id, state, schema_version, revision, created_at, updated_at)
  on table public.user_progress from public, anon, authenticated;

grant select, delete on table public.profiles to authenticated;
grant insert (id, display_name) on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

grant select, delete on table public.user_progress to authenticated;
grant insert (user_id, state, schema_version) on table public.user_progress to authenticated;
grant update (state, schema_version) on table public.user_progress to authenticated;

create policy profiles_select_own
on public.profiles for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id);

create policy profiles_insert_own
on public.profiles for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = id);

create policy profiles_update_own
on public.profiles for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id)
with check ((select auth.uid()) is not null and (select auth.uid()) = id);

create policy profiles_delete_own
on public.profiles for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id);

create policy user_progress_select_own
on public.user_progress for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy user_progress_insert_own
on public.user_progress for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy user_progress_update_own
on public.user_progress for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy user_progress_delete_own
on public.user_progress for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
