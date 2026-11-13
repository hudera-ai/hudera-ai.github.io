-- HUDERA AI platform · hiring evaluation + registration details for the admin "Hiring" page (#/hiring/<id>)
-- Rubric: CV 20% + test 50% + interview 30%, each scored 0–100 by the team. The total is computed, never stored,
-- so changing the weights later only means editing the two functions below (and HW in admin/index.html).
-- Needs the careers migration (app.job_applications, 0014) before it; reads the online test from 0027 only through admin_exams.
-- Adds nullable columns only and two new admin functions; nothing existing is changed. Safe to run more than once.
-- Gates are on the server: reading needs hiring.view, saving needs hiring.manage (same as admin_hiring / admin_hiring_update).

-- ================================================================ columns
alter table app.job_applications
  add column if not exists eval_cv             smallint check (eval_cv between 0 and 100),
  add column if not exists eval_test           smallint check (eval_test between 0 and 100),
  add column if not exists eval_interview      smallint check (eval_interview between 0 and 100),
  add column if not exists eval_recommendation text check (eval_recommendation in ('strong_yes', 'yes', 'maybe', 'no')),
  add column if not exists evaluated_by        uuid references app.profiles (id) on delete set null,
  add column if not exists evaluated_at        timestamptz,
  add column if not exists eval_log            jsonb not null default '[]'::jsonb;   -- every save: {t, by, by_name, cv, test, interview, total, rec}

-- ================================================================ read: scores + how/when each applicant registered
-- Keyed by application id so the dashboard can merge it with admin_hiring without changing that function.
create or replace function public.admin_hiring_extra() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_perm('hiring.view');
  return jsonb_build_object(
    'can_edit', app.has_perm('hiring.manage'),
    'weights', jsonb_build_object('cv', 20, 'test', 50, 'interview', 30),
    'items', coalesce((select jsonb_object_agg(j.id::text, jsonb_build_object(
        'user_id', j.user_id,
        'cv', j.eval_cv, 'test', j.eval_test, 'interview', j.eval_interview,
        'total', case when j.eval_cv is null or j.eval_test is null or j.eval_interview is null then null
                      else round(j.eval_cv * 0.20 + j.eval_test * 0.50 + j.eval_interview * 0.30, 1) end,
        'recommendation', j.eval_recommendation, 'evaluated_at', j.evaluated_at, 'evaluated_by_name', coalesce(e.full_name, e.email),
        'log', j.eval_log,
        -- the applicant's site account (they must sign in with Google to apply)
        'account', case when p.id is null then null else jsonb_build_object('created_at', p.created_at, 'provider', p.auth_provider,
                     'login_count', p.login_count, 'last_seen_at', p.last_seen_at, 'locale', p.locale) end,
        -- the browsing session they applied from (only exists if they allowed analytics)
        'visit', (select jsonb_build_object('started_at', s.started_at, 'source', s.source, 'utm_source', s.utm_source, 'utm_medium', s.utm_medium,
                    'utm_campaign', s.utm_campaign, 'referrer', s.referrer_domain, 'landing', s.landing_path, 'device', s.device_type, 'browser', s.browser, 'os', s.os)
                  from app.sessions s where j.user_id is not null and s.user_id = j.user_id and s.started_at <= j.created_at + interval '1 minute'
                  order by s.started_at desc limit 1),
        -- the first time that browser ever reached the site
        'first_touch', (select jsonb_build_object('first_seen_at', vi.first_seen_at, 'referrer', vi.first_referrer_domain, 'utm_source', vi.first_utm_source)
                        from app.visitors vi where j.user_id is not null and vi.user_id = j.user_id order by vi.first_seen_at limit 1)))
      from app.job_applications j
      left join app.profiles p on p.id = j.user_id
      left join app.profiles e on e.id = j.evaluated_by), '{}'::jsonb));
end $$;

-- ================================================================ write: save the three scores and the recommendation
-- Pass null for a score that isn't known yet (e.g. no interview so far). Each save is kept in eval_log and the audit log.
create or replace function public.admin_hiring_eval(p_id uuid, p_cv integer default null, p_test integer default null,
                                                    p_interview integer default null, p_recommendation text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_rec text := nullif(trim(coalesce(p_recommendation, '')), ''); v_total numeric; v_ref text; v_by text;
begin
  perform app.require_perm('hiring.manage');
  if (p_cv is not null and p_cv not between 0 and 100) or (p_test is not null and p_test not between 0 and 100)
     or (p_interview is not null and p_interview not between 0 and 100)
     or (v_rec is not null and v_rec not in ('strong_yes', 'yes', 'maybe', 'no')) then perform app.err('invalid_input'); end if;
  v_total := case when p_cv is null or p_test is null or p_interview is null then null else round(p_cv * 0.20 + p_test * 0.50 + p_interview * 0.30, 1) end;
  select coalesce(full_name, email) into v_by from app.profiles where id = auth.uid();
  update app.job_applications
     set eval_cv = p_cv, eval_test = p_test, eval_interview = p_interview, eval_recommendation = v_rec,
         evaluated_by = auth.uid(), evaluated_at = now(),
         eval_log = (case when jsonb_array_length(eval_log) >= 100 then eval_log - 0 else eval_log end)
                    || jsonb_build_array(jsonb_build_object('t', now(), 'by', auth.uid(), 'by_name', v_by, 'cv', p_cv, 'test', p_test,
                                                            'interview', p_interview, 'total', v_total, 'rec', v_rec))
   where id = p_id
   returning ref into v_ref;
  if not found then perform app.err('not_found'); end if;
  perform app.audit('hiring.evaluated', 'job_application', p_id::text,
    jsonb_build_object('ref', v_ref, 'cv', p_cv, 'test', p_test, 'interview', p_interview, 'total', v_total, 'recommendation', v_rec));
  return jsonb_build_object('ok', true, 'total', v_total);
end $$;

-- ================================================================ grants: signed-in users only, then gated by role inside
revoke all on function public.admin_hiring_extra(), public.admin_hiring_eval(uuid, integer, integer, integer, text) from public, anon;
grant execute on function public.admin_hiring_extra(), public.admin_hiring_eval(uuid, integer, integer, integer, text) to authenticated;
