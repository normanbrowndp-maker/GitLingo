-- Миграция сборки отзывов: таблица site_reviews.
-- Применить один раз в Supabase SQL Editor. Существующие таблицы и политики не изменяет.

create table public.site_reviews (
  user_id uuid primary key references auth.users (id) on delete cascade,
  rating integer not null,
  comment text not null default '',
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint site_reviews_rating_range check (rating between 1 and 5),
  constraint site_reviews_comment_length check (pg_catalog.char_length(comment) <= 1000)
);

alter table public.site_reviews enable row level security;

-- Серверные даты: пользователь не может задать или изменить created_at/updated_at.
create function public.touch_site_review_metadata()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    new.created_at := pg_catalog.clock_timestamp();
  else
    new.created_at := old.created_at;
    new.user_id := old.user_id;
  end if;
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$function$;

create trigger site_reviews_set_server_metadata
before insert or update on public.site_reviews
for each row execute function public.touch_site_review_metadata();

revoke all privileges on function public.touch_site_review_metadata() from public, anon, authenticated;
revoke all privileges on table public.site_reviews from public, anon, authenticated;
revoke all privileges (user_id, rating, comment, created_at, updated_at)
  on table public.site_reviews from public, anon, authenticated;

-- Вошедший пользователь: только собственная строка. Анонимный доступ запрещён.
grant select, delete on table public.site_reviews to authenticated;
grant insert (user_id, rating, comment) on table public.site_reviews to authenticated;
grant update (rating, comment) on table public.site_reviews to authenticated;

create policy site_reviews_select_own
on public.site_reviews for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy site_reviews_insert_own
on public.site_reviews for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy site_reviews_update_own
on public.site_reviews for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy site_reviews_delete_own
on public.site_reviews for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
