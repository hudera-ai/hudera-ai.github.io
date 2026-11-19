-- Academy: real watch tracking, session dates in the public catalog.
-- 1) app.ac_watch keeps which 5-second slices of each lesson video a student actually played.
--    Credit per call is capped by wall-clock time since the last call (up to 2.5x speed), so
--    seeking to the end or sending everything at once earns nothing extra.
-- 2) A lesson is marked done automatically at 90% watched; students can no longer mark it by hand.
-- 3) The public catalog's schedule carries opens_at (the academy has no live meetings).

create table if not exists app.ac_watch (
  enrollment_id uuid not null references app.ac_enrollments(id) on delete cascade,
  lesson_id     uuid not null references app.ac_lessons(id) on delete cascade,
  seen          int[] not null default '{}',
  duration_s    int not null default 0,
  pct           numeric(5,1) not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (enrollment_id, lesson_id)
);
alter table app.ac_watch enable row level security;

create or replace function public.academy_watch(p_enrollment uuid, p_lesson uuid, p_buckets int[], p_duration numeric)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  e app.ac_enrollments; s app.ac_sessions; w app.ac_watch;
  v_dur int; v_total int; v_new int[]; v_allow int; v_seen int[]; v_pct numeric; v_done boolean;
begin
  perform app.require_user();
  e := app.ac_my_enrollment(p_enrollment);
  select s2.* into s from app.ac_sessions s2 join app.ac_lessons l on l.session_id = s2.id where l.id = p_lesson;
  if s.id is null or not (app.ac_gate(e, s) ->> 'open')::boolean then perform app.err('session_locked'); end if;
  if p_duration is null or p_duration < 10 or p_duration > 14400 or coalesce(array_length(p_buckets, 1), 0) > 3000 then perform app.err('invalid_input'); end if;
  v_dur := ceil(p_duration)::int;
  v_total := greatest(1, ceil(v_dur / 5.0)::int);

  insert into app.ac_watch (enrollment_id, lesson_id, duration_s) values (e.id, p_lesson, v_dur)
  on conflict (enrollment_id, lesson_id) do nothing;
  select * into w from app.ac_watch where enrollment_id = e.id and lesson_id = p_lesson for update;

  -- new slices only, in order, capped by the time that really passed since the last save
  select coalesce(array_agg(b order by b), '{}') into v_new
  from (select distinct b from unnest(coalesce(p_buckets, '{}')) b where b >= 0 and b < v_total and not (b = any (w.seen))) x;
  v_allow := greatest(0, ceil(extract(epoch from (now() - w.updated_at)) * 2.5 / 5.0)::int) + 1;
  if array_length(v_new, 1) > v_allow then v_new := v_new[1:v_allow]; end if;

  select coalesce(array_agg(b order by b), '{}') into v_seen from (select distinct b from unnest(w.seen || v_new) b) y;
  v_pct := least(100, round(100.0 * coalesce(array_length(v_seen, 1), 0) / v_total, 1));
  update app.ac_watch set seen = v_seen, duration_s = v_dur, pct = v_pct, updated_at = now()
  where enrollment_id = e.id and lesson_id = p_lesson;

  if v_pct >= 90 then
    insert into app.ac_lesson_done (enrollment_id, lesson_id) values (e.id, p_lesson) on conflict do nothing;
  end if;
  v_done := exists (select 1 from app.ac_lesson_done where enrollment_id = e.id and lesson_id = p_lesson);
  return jsonb_build_object('pct', v_pct, 'done', v_done);
end $function$;

create or replace function public.academy_watch_status(p_enrollment uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare e app.ac_enrollments;
begin
  perform app.require_user();
  e := app.ac_my_enrollment(p_enrollment);
  return coalesce((select jsonb_object_agg(w.lesson_id::text, w.pct) from app.ac_watch w where w.enrollment_id = e.id), '{}'::jsonb);
end $function$;

-- students can no longer mark a video watched by hand: done needs 90% real watching (team members are exempt)
create or replace function public.academy_lesson_done(p_enrollment uuid, p_lesson uuid, p_done boolean default true)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare e app.ac_enrollments; s app.ac_sessions;
begin
  perform app.require_user();
  e := app.ac_my_enrollment(p_enrollment);
  select s2.* into s from app.ac_sessions s2 join app.ac_lessons l on l.session_id = s2.id where l.id = p_lesson;
  if s.id is null or not (app.ac_gate(e, s) ->> 'open')::boolean then perform app.err('session_locked'); end if;
  if p_done then
    if not public.ac_is_team() and coalesce((select pct from app.ac_watch where enrollment_id = e.id and lesson_id = p_lesson), 0) < 90 then
      perform app.err('not_watched');
    end if;
    insert into app.ac_lesson_done (enrollment_id, lesson_id) values (e.id, p_lesson) on conflict do nothing;
  else
    if not public.ac_is_team() then perform app.err('forbidden'); end if;
    delete from app.ac_lesson_done where enrollment_id = e.id and lesson_id = p_lesson;
  end if;
  return jsonb_build_object('ok', true);
end $function$;

-- admin: watch % per student per session (average of the session's lessons)
create or replace function public.admin_academy_watch(p_cohort uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  perform app.require_perm('academy.view');
  return coalesce((
    select jsonb_object_agg(x.enrollment_id::text, x.sessions) from (
      select en.id as enrollment_id,
             jsonb_object_agg(s.n::text, round(coalesce((select avg(coalesce(w.pct, 0)) from app.ac_lessons l
               left join app.ac_watch w on w.lesson_id = l.id and w.enrollment_id = en.id where l.session_id = s.id), 0), 0)) as sessions
      from app.ac_enrollments en
      join app.ac_cohorts k on k.id = en.cohort_id
      join app.ac_sessions s on s.course_id = k.course_id
      where en.cohort_id = p_cohort
      group by en.id) x), '{}'::jsonb);
end $function$;

-- public catalog: each session's opening date (there are no live meetings)
create or replace function app.ac_cohort_json(c app.ac_cohorts)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object('id', c.id, 'name', c.name, 'starts_on', c.starts_on, 'status', c.status, 'seats', c.seats,
    'taken', (select count(*) from app.ac_enrollments e where e.cohort_id = c.id and e.status in ('pending', 'active', 'completed')),
    'schedule', coalesce((select jsonb_agg(jsonb_build_object('n', s.n, 'opens_at', cs.opens_at, 'live_at', cs.live_at) order by s.n)
      from app.ac_cohort_sessions cs join app.ac_sessions s on s.id = cs.session_id where cs.cohort_id = c.id), '[]'::jsonb))
$function$;

revoke all on function public.academy_watch(uuid, uuid, int[], numeric) from public, anon;
revoke all on function public.academy_watch_status(uuid) from public, anon;
revoke all on function public.admin_academy_watch(uuid) from public, anon;
grant execute on function public.academy_watch(uuid, uuid, int[], numeric) to authenticated;
grant execute on function public.academy_watch_status(uuid) to authenticated;
grant execute on function public.admin_academy_watch(uuid) to authenticated;
