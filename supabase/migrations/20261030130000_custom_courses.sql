-- Миграция минимального конструктора курсов: таблица черновиков custom_courses,
-- отдельная таблица публикаций custom_course_publications, серверная валидация
-- структуры и графа переходов, атомарная публикация через SECURITY DEFINER RPC.
-- Применить один раз в Supabase SQL Editor. Существующие таблицы проекта не изменяет.

begin;

-- ============================================================
-- Черновики. Строку и черновой content видит только владелец (RLS ниже).
-- Колонки published_content/status/published_at меняются только серверной RPC:
-- клиентам выдан column-level UPDATE только на title/description/content.
-- ============================================================
create table public.custom_courses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (pg_catalog.char_length(title) between 1 and 120),
  description text not null default '' check (pg_catalog.char_length(description) <= 500),
  content jsonb not null,
  published_content jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  published_at timestamptz
);

create index custom_courses_owner_idx
  on public.custom_courses (owner_user_id, updated_at desc);

-- ============================================================
-- Публикации: только опубликованные снимки и публичные поля.
-- Записи создаются/обновляются только RPC gl_publish_custom_course;
-- прямые insert/update/delete клиентам запрещены (RLS без политик на запись).
-- ============================================================
create table public.custom_course_publications (
  course_id uuid primary key references public.custom_courses (id) on delete cascade,
  title text not null check (pg_catalog.char_length(title) between 1 and 120),
  description text not null default '' check (pg_catalog.char_length(description) <= 500),
  snapshot jsonb not null,
  published_at timestamptz not null default pg_catalog.clock_timestamp()
);

create index custom_course_publications_published_idx
  on public.custom_course_publications (published_at desc);

alter table public.custom_courses enable row level security;
alter table public.custom_course_publications enable row level security;

-- ============================================================
-- Валидация структуры курса. Возвращает NULL, если курс корректен,
-- иначе текст первой найденной ошибки.
-- Этапы: 1) шапка и полная сборка ID всех вопросов; 2) проверка ссылок
-- переходов; 3) DFS с тремя цветами по обеим веткам (циклы, включая
-- самопереходы) и достижимость завершения.
-- ============================================================
create function public.gl_check_custom_course(p_content jsonb)
returns text
language plpgsql
stable
as $function$
declare
  v_title text;
  v_description text;
  v_lessons jsonb;
  v_lesson jsonb;
  v_question jsonb;
  v_transition jsonb;
  v_correct_raw jsonb;
  v_question_ids text[] := '{}';
  v_order text[] := '{}';
  v_qid text;
  v_lesson_index integer;
  v_question_index integer;
  v_lesson_count integer;
  v_question_count integer;
  -- второй проход: ссылки и граф
  v_edges jsonb := '{}'::jsonb;
  v_target_correct text;
  v_target_wrong text;
  v_position integer;
  v_total integer;
  -- DFS
  v_color jsonb := '{}'::jsonb;
  v_stack jsonb := '[]'::jsonb;
  v_item jsonb;
  v_current text;
  v_child text;
  v_is_post boolean;
  v_finish_reached boolean := false;
begin
  if p_content is null or jsonb_typeof(p_content) is distinct from 'object' then
    return 'Курс должен быть JSON-объектом.';
  end if;

  if p_content ->> 'schema' is distinct from 'gitlingo.custom-course/1' then
    return 'Неизвестная схема курса.';
  end if;

  v_title := coalesce(p_content ->> 'title', '');
  if pg_catalog.char_length(v_title) < 1 or pg_catalog.char_length(v_title) > 120 then
    return 'Название курса должно быть от 1 до 120 символов.';
  end if;

  v_description := coalesce(p_content ->> 'description', '');
  if pg_catalog.char_length(v_description) > 500 then
    return 'Описание курса не должно превышать 500 символов.';
  end if;

  if p_content -> 'lessons' is null or jsonb_typeof(p_content -> 'lessons') is distinct from 'array' then
    return 'Уроки курса должны быть массивом.';
  end if;

  v_lessons := p_content -> 'lessons';
  v_lesson_count := jsonb_array_length(v_lessons);
  if v_lesson_count < 1 or v_lesson_count > 50 then
    return 'Курс должен содержать от 1 до 50 уроков.';
  end if;

  -- ---------- Проход 1: структура каждого урока/вопроса + сбор ID ----------
  for v_lesson_index in 0 .. v_lesson_count - 1 loop
    v_lesson := v_lessons -> v_lesson_index;
    if v_lesson is null or jsonb_typeof(v_lesson) is distinct from 'object' then
      return format('Урок %s должен быть объектом.', v_lesson_index + 1);
    end if;
    if pg_catalog.char_length(coalesce(v_lesson ->> 'id', '')) < 1
      or pg_catalog.char_length(coalesce(v_lesson ->> 'id', '')) > 60 then
      return format('Урок %s: некорректный идентификатор.', v_lesson_index + 1);
    end if;
    if pg_catalog.char_length(coalesce(v_lesson ->> 'title', '')) < 1
      or pg_catalog.char_length(coalesce(v_lesson ->> 'title', '')) > 120 then
      return format('Урок %s: название обязательно (1–120 символов).', v_lesson_index + 1);
    end if;
    if pg_catalog.char_length(coalesce(v_lesson ->> 'theory', '')) > 5000 then
      return format('Урок «%s»: теория не должна превышать 5000 символов.', v_lesson ->> 'title');
    end if;
    if v_lesson -> 'questions' is null or jsonb_typeof(v_lesson -> 'questions') is distinct from 'array' then
      return format('Урок «%s»: вопросы должны быть массивом.', v_lesson ->> 'title');
    end if;
    v_question_count := jsonb_array_length(v_lesson -> 'questions');
    if v_question_count < 1 or v_question_count > 50 then
      return format('Урок «%s»: нужен хотя бы один вопрос (до 50).', v_lesson ->> 'title');
    end if;

    for v_question_index in 0 .. v_question_count - 1 loop
      v_question := v_lesson -> 'questions' -> v_question_index;
      if v_question is null or jsonb_typeof(v_question) is distinct from 'object' then
        return format('Урок «%s», вопрос %s должен быть объектом.', v_lesson ->> 'title', v_question_index + 1);
      end if;

      v_qid := coalesce(v_question ->> 'id', '');
      if v_qid not similar to '[A-Za-z0-9_-]{1,60}' then
        return format('Урок «%s», вопрос %s: некорректный идентификатор.', v_lesson ->> 'title', v_question_index + 1);
      end if;
      if v_qid = any (v_question_ids) then
        return format('Идентификатор вопроса «%s» повторяется.', v_qid);
      end if;
      v_question_ids := array_append(v_question_ids, v_qid);
      v_order := array_append(v_order, v_qid);

      if pg_catalog.char_length(coalesce(v_question ->> 'prompt', '')) < 1
        or pg_catalog.char_length(coalesce(v_question ->> 'prompt', '')) > 500 then
        return format('Вопрос «%s»: условие обязательно (1–500 символов).', v_qid);
      end if;

      if v_question -> 'options' is null
        or jsonb_typeof(v_question -> 'options') is distinct from 'array'
        or jsonb_array_length(v_question -> 'options') is distinct from 4 then
        return format('Вопрос «%s»: нужно ровно 4 варианта ответа.', v_qid);
      end if;
      for v_lesson_index in 0 .. 3 loop
        if jsonb_typeof(v_question -> 'options' -> v_lesson_index) is distinct from 'string' then
          return format('Вопрос «%s»: вариант %s должен быть строкой.', v_qid, v_lesson_index + 1);
        end if;
        if pg_catalog.char_length(v_question -> 'options' ->> v_lesson_index) not between 1 and 200 then
          return format('Вопрос «%s»: вариант %s должен быть от 1 до 200 символов.', v_qid, v_lesson_index + 1);
        end if;
      end loop;

      -- correct: строго JSON-число (не null, не строка "0") с целым значением 0–3.
      v_correct_raw := v_question -> 'correct';
      if v_correct_raw is null or jsonb_typeof(v_correct_raw) is distinct from 'number' then
        return format('Вопрос «%s»: правильный ответ должен быть числом 0–3.', v_qid);
      end if;
      if (v_correct_raw #>> '{}') not in ('0', '1', '2', '3') then
        -- отсекает дробные (0.5), отрицательные и значения вне диапазона
        return format('Вопрос «%s»: правильный ответ должен быть целым числом 0–3.', v_qid);
      end if;

      if pg_catalog.char_length(coalesce(v_question ->> 'explanation', '')) > 1000 then
        return format('Вопрос «%s»: объяснение не должно превышать 1000 символов.', v_qid);
      end if;

      foreach v_transition in array array[v_question -> 'onCorrect', v_question -> 'onWrong'] loop
        if v_transition is null or jsonb_typeof(v_transition) is distinct from 'object' then
          return format('Вопрос «%s»: переходы должны быть объектами.', v_qid);
        end if;
        if coalesce(v_transition ->> 'type', '') not in ('next', 'question', 'finish') then
          return format('Вопрос «%s»: неизвестный тип перехода.', v_qid);
        end if;
        if v_transition ->> 'type' = 'question'
          and coalesce(v_transition ->> 'questionId', '') not similar to '[A-Za-z0-9_-]{1,60}' then
          return format('Вопрос «%s»: переход должен указывать на вопрос.', v_qid);
        end if;
      end loop;
    end loop;
  end loop;

  -- ---------- Проход 2: ссылки переходов (все ID уже собраны) ----------
  for v_lesson_index in 0 .. v_lesson_count - 1 loop
    v_question_count := jsonb_array_length(v_lessons -> v_lesson_index -> 'questions');
    for v_question_index in 0 .. v_question_count - 1 loop
      v_question := v_lessons -> v_lesson_index -> 'questions' -> v_question_index;
      v_qid := v_question ->> 'id';

      foreach v_transition in array array[v_question -> 'onCorrect', v_question -> 'onWrong'] loop
        if v_transition ->> 'type' = 'question'
          and not (coalesce(v_transition ->> 'questionId', '') = any (v_question_ids)) then
          return format('Вопрос «%s»: переход указывает на несуществующий вопрос.', v_qid);
        end if;
      end loop;
    end loop;
  end loop;

  -- Резолв "__next__" в фактические цели в порядке вопросов.
  v_total := array_length(v_order, 1);
  for v_position in 1 .. v_total loop
    v_qid := v_order[v_position];
    v_question := null;
    for v_lesson_index in 0 .. v_lesson_count - 1 loop
      v_question_count := jsonb_array_length(v_lessons -> v_lesson_index -> 'questions');
      for v_question_index in 0 .. v_question_count - 1 loop
        if (v_lessons -> v_lesson_index -> 'questions' -> v_question_index ->> 'id') = v_qid then
          v_question := v_lessons -> v_lesson_index -> 'questions' -> v_question_index;
        end if;
      end loop;
    end loop;

    v_target_correct := case v_question -> 'onCorrect' ->> 'type'
      when 'next' then case when v_position < v_total then v_order[v_position + 1] else '__finish__' end
      when 'finish' then '__finish__'
      else v_question -> 'onCorrect' ->> 'questionId' end;
    v_target_wrong := case v_question -> 'onWrong' ->> 'type'
      when 'next' then case when v_position < v_total then v_order[v_position + 1] else '__finish__' end
      when 'finish' then '__finish__'
      else v_question -> 'onWrong' ->> 'questionId' end;

    v_edges := jsonb_set(v_edges, array[v_qid], jsonb_build_array(v_target_correct, v_target_wrong));
  end loop;

  -- ---------- Проход 3: DFS с тремя цветами по обеим веткам ----------
  -- Цвета: gray = узел в текущем пути (стек рекурсии), black = обработан.
  -- Встреча gray-узла среди детей любого узла (включая самопереход) = цикл.
  v_stack := jsonb_build_array(jsonb_build_object('n', v_order[1]));
  while jsonb_array_length(v_stack) > 0 loop
    v_item := v_stack -> (jsonb_array_length(v_stack) - 1);
    v_stack := v_stack - (jsonb_array_length(v_stack) - 1);
    v_current := v_item ->> 'n';
    v_is_post := (v_item ->> 'post') = '1';

    if v_is_post then
      v_color := jsonb_set(v_color, array[v_current], '"black"'::jsonb, true);
    elsif coalesce(v_color ->> v_current, '') = 'gray' then
      -- повторный элемент в стеке: уже раскрыт
      null;
    elsif coalesce(v_color ->> v_current, '') = 'black' then
      null;
    else
      v_color := jsonb_set(v_color, array[v_current], '"gray"'::jsonb, true);
      -- маркер возврата, затем обе ветки
      v_stack := v_stack || jsonb_build_array(jsonb_build_object('n', v_current, 'post', '1'));
      foreach v_child in array array[v_edges -> v_current ->> 0, v_edges -> v_current ->> 1] loop
        if v_child = '__finish__' then
          v_finish_reached := true;
        elsif coalesce(v_color ->> v_child, '') = 'gray' then
          return 'В переходах найден цикл: прохождение может никогда не завершиться.';
        elsif coalesce(v_color ->> v_child, '') is null then
          v_stack := v_stack || jsonb_build_array(jsonb_build_object('n', v_child));
        end if;
      end loop;
    end if;
  end loop;

  if not v_finish_reached then
    return 'Завершение курса недостижимо из первого вопроса.';
  end if;

  return null;
exception
  when others then
    return 'Структура курса не прошла проверку: ' || coalesce(sqlerrm, 'неизвестная ошибка');
end;
$function$;

revoke all privileges on function public.gl_check_custom_course(jsonb)
  from public, anon, authenticated;
-- Вызывается только внутри других функций владельца; EXECUTE наружу не выдаётся.

-- ============================================================
-- Атомарная публикация: проверка владельца, валидация структуры,
-- запись снимка в custom_courses и строку публикаций, серверная дата.
-- ============================================================
create function public.gl_publish_custom_course(p_course_id uuid, p_content jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner uuid;
  v_error text;
  v_now timestamptz;
begin
  if (select auth.uid()) is null then
    return jsonb_build_object('ok', false, 'error', 'Требуется вход в аккаунт.');
  end if;

  select owner_user_id
    into v_owner
    from public.custom_courses
    where id = p_course_id;
  if v_owner is null then
    return jsonb_build_object('ok', false, 'error', 'Курс не найден.');
  end if;
  if v_owner is distinct from (select auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'Публиковать может только автор курса.');
  end if;

  v_error := public.gl_check_custom_course(p_content);
  if v_error is not null then
    return jsonb_build_object('ok', false, 'error', v_error);
  end if;

  v_now := pg_catalog.clock_timestamp();

  update public.custom_courses
    set published_content = p_content,
        status = 'published',
        published_at = v_now
    where id = p_course_id;

  insert into public.custom_course_publications (course_id, title, description, snapshot, published_at)
    values (p_course_id, coalesce(p_content ->> 'title', ''), coalesce(p_content ->> 'description', ''), p_content, v_now)
    on conflict (course_id) do update
      set title = excluded.title,
          description = excluded.description,
          snapshot = excluded.snapshot,
          published_at = excluded.published_at;

  return jsonb_build_object('ok', true);
exception
  when others then
    return jsonb_build_object('ok', false, 'error', coalesce(sqlerrm, 'Публикация не удалась.'));
end;
$function$;

revoke all privileges on function public.gl_publish_custom_course(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.gl_publish_custom_course(uuid, jsonb) to authenticated;

-- ============================================================
-- Служебный триггер черновиков: владелец и дата создания неизменны,
-- updated_at ставит сервер. Столбцы публикации защищены column-level GRANT.
-- ============================================================
create function public.gl_custom_courses_guard()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'UPDATE' then
    if new.owner_user_id is distinct from old.owner_user_id then
      raise exception 'Владельца курса изменять нельзя.';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'Дату создания изменять нельзя.';
    end if;
    new.updated_at := pg_catalog.clock_timestamp();
  end if;
  return new;
end;
$function$;

create trigger gl_custom_courses_before_write
before update on public.custom_courses
for each row execute function public.gl_custom_courses_guard();

revoke all privileges on function public.gl_custom_courses_guard()
  from public, anon, authenticated;

-- ============================================================
-- Права. Черновики: владелец; колонки публикации клиентам недоступны.
-- Публикации: только чтение для всех вошедших; запись — только RPC.
-- ============================================================
grant select, insert, delete on table public.custom_courses to authenticated;
grant update (title, description, content) on table public.custom_courses to authenticated;

grant select on table public.custom_course_publications to authenticated;
-- INSERT/UPDATE/DELETE на publications не выдаются никому из клиентов.

create policy custom_courses_select_own
on public.custom_courses for select to authenticated
using (owner_user_id = (select auth.uid()));

create policy custom_courses_insert_own
on public.custom_courses for insert to authenticated
with check (owner_user_id = (select auth.uid()));

create policy custom_courses_update_own
on public.custom_courses for update to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

create policy custom_courses_delete_own
on public.custom_courses for delete to authenticated
using (owner_user_id = (select auth.uid()));

create policy custom_course_publications_select_all
on public.custom_course_publications for select to authenticated
using (true);

commit;
