-- Read-only catalog checks. Run after the migration in the dedicated test project.
-- Run as an administrative test operator; this verifies configuration, not user JWT behavior.

do $check$
declare
  expected_policy_count integer;
  actual_policy_count integer;
begin
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.profiles'::regclass) then
    raise exception 'RLS is not enabled on public.profiles';
  end if;
  if not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.user_progress'::regclass) then
    raise exception 'RLS is not enabled on public.user_progress';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_id_fkey' and confdeltype = 'c'
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.user_progress'::regclass and conname = 'user_progress_user_id_fkey' and confdeltype = 'c'
  ) then
    raise exception 'Expected auth.users cascading foreign keys are missing';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.user_progress'::regclass and conname = 'user_progress_state_matches_version'
      and contype = 'c'
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_display_name_length'
      and contype = 'c'
  ) then
    raise exception 'State object/version or display-name constraint is missing';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_set_updated_at'
      and not tgisinternal and tgenabled <> 'D'
  ) or not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.user_progress'::regclass and tgname = 'user_progress_set_server_metadata'
      and not tgisinternal and tgenabled <> 'D'
  ) then
    raise exception 'Server timestamp/revision triggers are missing or disabled';
  end if;

  select count(*) into expected_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename in ('profiles', 'user_progress')
    and policyname in (
      'profiles_select_own', 'profiles_insert_own', 'profiles_update_own', 'profiles_delete_own',
      'user_progress_select_own', 'user_progress_insert_own', 'user_progress_update_own', 'user_progress_delete_own'
    )
    and 'authenticated' = any(roles)
    and cardinality(roles) = 1
    and not ('anon' = any(roles))
    and (
      (cmd = 'SELECT' and qual like '%auth.uid()%')
      or (cmd = 'INSERT' and with_check like '%auth.uid()%')
      or (cmd = 'UPDATE' and qual like '%auth.uid()%' and with_check like '%auth.uid()%')
      or (cmd = 'DELETE' and qual like '%auth.uid()%')
    );
  if expected_policy_count <> 8 then
    raise exception 'Expected all 8 owner-scoped authenticated policies; found %', expected_policy_count;
  end if;
  select count(*) into actual_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'public' and tablename in ('profiles', 'user_progress');
  if actual_policy_count <> 8 then
    raise exception 'Unexpected extra/missing policies on account tables: %', actual_policy_count;
  end if;

  if has_table_privilege('anon', 'public.profiles', 'select')
    or has_table_privilege('anon', 'public.profiles', 'insert')
    or has_table_privilege('anon', 'public.profiles', 'update')
    or has_table_privilege('anon', 'public.profiles', 'delete')
    or has_table_privilege('anon', 'public.profiles', 'truncate')
    or has_table_privilege('anon', 'public.user_progress', 'select')
    or has_table_privilege('anon', 'public.user_progress', 'insert')
    or has_table_privilege('anon', 'public.user_progress', 'update')
    or has_table_privilege('anon', 'public.user_progress', 'delete')
    or has_table_privilege('anon', 'public.user_progress', 'truncate') then
    raise exception 'anon has a table privilege on account data';
  end if;
  if has_table_privilege('authenticated', 'public.profiles', 'truncate')
    or has_table_privilege('authenticated', 'public.user_progress', 'truncate') then
    raise exception 'authenticated unexpectedly has TRUNCATE';
  end if;
  if not has_schema_privilege('authenticated', 'public', 'usage')
    or not has_table_privilege('authenticated', 'public.profiles', 'select')
    or not has_table_privilege('authenticated', 'public.profiles', 'delete')
    or not has_table_privilege('authenticated', 'public.user_progress', 'select')
    or not has_table_privilege('authenticated', 'public.user_progress', 'delete')
    or not has_column_privilege('authenticated', 'public.profiles', 'id', 'insert')
    or not has_column_privilege('authenticated', 'public.profiles', 'display_name', 'insert')
    or not has_column_privilege('authenticated', 'public.profiles', 'display_name', 'update')
    or not has_column_privilege('authenticated', 'public.user_progress', 'user_id', 'insert')
    or not has_column_privilege('authenticated', 'public.user_progress', 'state', 'update')
    or not has_column_privilege('authenticated', 'public.user_progress', 'schema_version', 'update') then
    raise exception 'Expected authenticated table/column grants are missing';
  end if;
  if has_column_privilege('authenticated', 'public.profiles', 'id', 'update')
    or has_column_privilege('authenticated', 'public.profiles', 'updated_at', 'update')
    or has_column_privilege('authenticated', 'public.profiles', 'created_at', 'insert')
    or has_column_privilege('authenticated', 'public.profiles', 'updated_at', 'insert')
    or has_column_privilege('authenticated', 'public.user_progress', 'user_id', 'update')
    or has_column_privilege('authenticated', 'public.user_progress', 'revision', 'insert')
    or has_column_privilege('authenticated', 'public.user_progress', 'revision', 'update')
    or has_column_privilege('authenticated', 'public.user_progress', 'updated_at', 'insert')
    or has_column_privilege('authenticated', 'public.user_progress', 'updated_at', 'update')
    or has_column_privilege('authenticated', 'public.user_progress', 'created_at', 'insert')
    or has_column_privilege('authenticated', 'public.user_progress', 'created_at', 'update') then
    raise exception 'A client can alter an owner or server-managed column';
  end if;
  if has_function_privilege('anon', 'public.touch_profile_updated_at()', 'execute')
    or has_function_privilege('authenticated', 'public.touch_profile_updated_at()', 'execute')
    or has_function_privilege('anon', 'public.touch_progress_metadata()', 'execute')
    or has_function_privilege('authenticated', 'public.touch_progress_metadata()', 'execute') then
    raise exception 'A client can execute a trigger function directly';
  end if;
  if (select prosecdef from pg_catalog.pg_proc where oid = 'public.touch_profile_updated_at()'::regprocedure)
    or (select prosecdef from pg_catalog.pg_proc where oid = 'public.touch_progress_metadata()'::regprocedure) then
    raise exception 'A trigger function unexpectedly uses SECURITY DEFINER';
  end if;
  if exists (
    select 1
    from pg_catalog.pg_class view_rel
    join pg_catalog.pg_namespace n on n.oid = view_rel.relnamespace
    join pg_catalog.pg_rewrite rw on rw.ev_class = view_rel.oid
    join pg_catalog.pg_depend dep on dep.classid = 'pg_catalog.pg_rewrite'::regclass and dep.objid = rw.oid
    where n.nspname = 'public'
      and view_rel.relkind in ('v', 'm')
      and dep.refobjid in ('public.profiles'::regclass, 'public.user_progress'::regclass)
  ) then
    raise exception 'An unexpected view exposes account table data';
  end if;
end;
$check$;

select 'RLS policies, table/column grants, trigger function permissions, and view dependencies passed' as result;
