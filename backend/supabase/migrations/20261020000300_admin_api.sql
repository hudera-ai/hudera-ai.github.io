-- HUDERA AI platform · 0003 · admin API
-- Every admin_* function verifies the caller's staff role on the server (app.require_perm).
-- Hiding buttons in the dashboard is only cosmetic; these checks are the real gate.

-- ================================================================ range helper
create or replace function app.range(p_from date, p_to date, p_tz text, out r_start timestamptz, out r_end timestamptz, out tz text)
language plpgsql stable set search_path = '' as $$
begin
  tz := coalesce(nullif(p_tz, ''), 'Asia/Riyadh');
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = tz) then perform app.err('invalid_timezone'); end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 731 then perform app.err('invalid_range'); end if;
  r_start := p_from::timestamp at time zone tz;
  r_end := (p_to + 1)::timestamp at time zone tz;
end $$;

create or replace function app.inactivity_days() returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((app.setting('inactivity_days') #>> '{}')::integer, 30) $$;

-- ================================================================ who am I (used by the dashboard to show/hide sections)
create or replace function public.admin_whoami() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_role app.staff_role := app.caller_role();
begin
  if auth.uid() is null then perform app.err('not_authenticated'); end if;
  if v_role is null then return jsonb_build_object('role', null, 'perms', '[]'::jsonb); end if;
  return jsonb_build_object('role', v_role, 'user_id', auth.uid(),
    'name', (select full_name from app.profiles where id = auth.uid()),
    'email', (select email from app.profiles where id = auth.uid()),
    'perms', (select jsonb_agg(p) from unnest(array['analytics.view', 'users.view', 'users.export', 'users.manage', 'leads.view', 'leads.manage',
              'email.send', 'features.view', 'settings.manage', 'roles.manage', 'audit.view']) p where app.has_perm(p)));
end $$;

-- ================================================================ overview
create or replace function public.admin_overview(p_from date, p_to date, p_tz text default 'Asia/Riyadh') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r record; v_today date; v_today_start timestamptz; v_month_start timestamptz; v jsonb; v_inact integer := app.inactivity_days();
begin
  perform app.require_perm('analytics.view');
  select * into r from app.range(p_from, p_to, p_tz);
  v_today := (now() at time zone r.tz)::date;
  v_today_start := v_today::timestamp at time zone r.tz;
  v_month_start := date_trunc('month', v_today)::timestamp at time zone r.tz;

  with
  days as (select d::date as day from generate_series(p_from, p_to, interval '1 day') d),
  s as (select * from app.sessions where started_at >= r.r_start and started_at < r.r_end),
  e as (select * from app.events where occurred_at >= r.r_start and occurred_at < r.r_end),
  pr as (select * from app.profiles where status <> 'deleted')
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'tz', r.tz),
    'cards', jsonb_build_object(
      'registered_users', (select count(*) from pr),
      'total_visitors', (select count(*) from app.visitors where device_type <> 'bot'),
      'visitors_in_range', (select count(distinct visitor_id) from s),
      'sessions_in_range', (select count(*) from s),
      'page_views_in_range', (select count(*) from e where name = 'page_view'),
      'returning_visitors_in_range', (select count(distinct visitor_id) from s where is_returning),
      'new_users_in_range', (select count(*) from pr where created_at >= r.r_start and created_at < r.r_end),
      'new_users_today', (select count(*) from pr where created_at >= v_today_start),
      'new_users_7d', (select count(*) from pr where created_at >= now() - interval '7 days'),
      'new_users_month', (select count(*) from pr where created_at >= v_month_start),
      'active_users_today', (select count(distinct ev.user_id) from app.events ev join app.profiles ap on ap.id = ev.user_id and ap.status = 'active' where ev.occurred_at >= v_today_start),
      'active_users_7d', (select count(distinct ev.user_id) from app.events ev join app.profiles ap on ap.id = ev.user_id and ap.status = 'active' where ev.occurred_at >= now() - interval '7 days'),
      'active_users_30d', (select count(distinct ev.user_id) from app.events ev join app.profiles ap on ap.id = ev.user_id and ap.status = 'active' where ev.occurred_at >= now() - interval '30 days'),
      'inactive_users', (select count(*) from pr where coalesce(last_seen_at, created_at) < now() - make_interval(days => v_inact)),
      'logged_in_sessions', (select count(*) from s where user_id is not null),
      'anonymous_sessions', (select count(*) from s where user_id is null),
      'contacts_total', (select count(*) from app.contact_requests),
      'contacts_in_range', (select count(*) from app.contact_requests where created_at >= r.r_start and created_at < r.r_end),
      'contacts_pending', (select count(*) from app.contact_requests where status in ('new', 'pending')),
      'contacts_open', (select count(*) from app.contact_requests where status not in ('resolved', 'closed')),
      'contacts_overdue', (select count(*) from app.contact_requests where follow_up_at < now() and status not in ('resolved', 'closed')),
      'registration_conversion', (select case when count(distinct s.visitor_id) = 0 then null
                                   else round(100.0 * count(distinct s.visitor_id) filter (where exists (select 1 from pr where pr.id = s.user_id and pr.created_at >= r.r_start and pr.created_at < r.r_end))
                                              / count(distinct s.visitor_id), 2) end from s),
      'inactivity_days', v_inact),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day, 'page_views', coalesce(ed.pv, 0), 'sessions', coalesce(sd.n, 0), 'visitors', coalesce(sd.v, 0),
        'registrations', coalesce(rd.n, 0), 'active_users', coalesce(ed.au, 0), 'contacts', coalesce(cd.n, 0), 'avg_session_sec', sd.avg_sec
      ) order by d.day), '[]'::jsonb)
      from days d
      left join (select (e.occurred_at at time zone r.tz)::date as day, count(*) filter (where e.name = 'page_view') pv,
                        count(distinct e.user_id) filter (where e.user_id is not null) au from e group by 1) ed on ed.day = d.day
      left join (select (s.started_at at time zone r.tz)::date as day, count(*) n, count(distinct s.visitor_id) v,
                        round(avg(extract(epoch from (s.last_seen_at - s.started_at)))) avg_sec from s group by 1) sd on sd.day = d.day
      left join (select (pr.created_at at time zone r.tz)::date as day, count(*) n from pr
                  where pr.created_at >= r.r_start and pr.created_at < r.r_end group by 1) rd on rd.day = d.day
      left join (select (c.created_at at time zone r.tz)::date as day, count(*) n from app.contact_requests c
                  where c.created_at >= r.r_start and c.created_at < r.r_end group by 1) cd on cd.day = d.day),
    'monthly_active', (select coalesce(jsonb_agg(jsonb_build_object('month', m.month, 'users', m.users, 'visitors', m.visitors) order by m.month), '[]'::jsonb) from (
        select to_char(date_trunc('month', ev.occurred_at at time zone r.tz), 'YYYY-MM') as month,
               count(distinct ev.user_id) as users, count(distinct ev.visitor_id) as visitors
          from app.events ev where ev.occurred_at >= (date_trunc('month', v_today) - interval '5 months')::timestamp at time zone r.tz
         group by 1) m),
    'top_pages', (select coalesce(jsonb_agg(x order by (x ->> 'views')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('path', coalesce(path, '/'), 'views', count(*), 'visitors', count(distinct visitor_id)) x
          from e where name = 'page_view' group by coalesce(path, '/') order by count(*) desc limit 12) t),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('source', source, 'sessions', n) order by n desc), '[]'::jsonb)
                  from (select source, count(*) n from s group by source) t),
    'referrers', (select coalesce(jsonb_agg(jsonb_build_object('domain', referrer_domain, 'sessions', n) order by n desc), '[]'::jsonb)
                  from (select referrer_domain, count(*) n from s where referrer_domain is not null group by 1 order by 2 desc limit 10) t),
    'campaigns', (select coalesce(jsonb_agg(jsonb_build_object('utm_source', utm_source, 'utm_campaign', utm_campaign, 'sessions', n) order by n desc), '[]'::jsonb)
                  from (select utm_source, utm_campaign, count(*) n from s where utm_source is not null group by 1, 2 order by 3 desc limit 10) t),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('device', device_type, 'sessions', n) order by n desc), '[]'::jsonb)
                  from (select coalesce(device_type, 'unknown') device_type, count(*) n from s group by 1) t),
    'browsers', (select coalesce(jsonb_agg(jsonb_build_object('browser', browser, 'sessions', n) order by n desc), '[]'::jsonb)
                  from (select coalesce(browser, 'Unknown') browser, count(*) n from s group by 1) t),
    'engagement', (select jsonb_build_object(
        'avg_session_sec', round(avg(extract(epoch from (last_seen_at - started_at)))),
        'pages_per_session', round(avg(page_views)::numeric, 2),
        'events_per_session', round(avg(event_count)::numeric, 2),
        'bounce_rate', case when count(*) = 0 then null else round(100.0 * count(*) filter (where page_views <= 1 and event_count <= 1) / count(*), 1) end) from s),
    'features', (select coalesce(jsonb_agg(jsonb_build_object('key', f.key, 'name', f.name, 'uses', f.uses, 'users', f.users, 'visitors', f.visitors) order by f.uses desc), '[]'::jsonb) from (
        select ft.key, ft.name, count(ev.id) uses, count(distinct ev.user_id) users, count(distinct ev.visitor_id) visitors
          from app.features ft left join e ev on ev.feature_key = ft.key
         where ft.active group by ft.key, ft.name) f),
    'contacts_by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from app.contact_requests group by status) t),
    'retention', (select coalesce(jsonb_agg(c order by c ->> 'week'), '[]'::jsonb) from (
        select jsonb_build_object('week', to_char(w.week, 'IYYY-"W"IW'), 'users', count(*),
          'w1', round(100.0 * count(*) filter (where exists (select 1 from app.events ev where ev.user_id = p.id and ev.occurred_at >= p.created_at + interval '7 days' and ev.occurred_at < p.created_at + interval '14 days')) / count(*)),
          'w2', round(100.0 * count(*) filter (where exists (select 1 from app.events ev where ev.user_id = p.id and ev.occurred_at >= p.created_at + interval '14 days' and ev.occurred_at < p.created_at + interval '21 days')) / count(*)),
          'w4', round(100.0 * count(*) filter (where exists (select 1 from app.events ev where ev.user_id = p.id and ev.occurred_at >= p.created_at + interval '28 days' and ev.occurred_at < p.created_at + interval '35 days')) / count(*)),
          'complete_weeks', floor(extract(epoch from ((now() at time zone r.tz) - (w.week + interval '7 days'))) / 604800)) c
          from pr p cross join lateral (select date_trunc('week', p.created_at at time zone r.tz) as week) w
         where p.created_at >= now() - interval '10 weeks' group by w.week) t)
  ) into v;
  return v;
end $$;

-- ================================================================ users
create or replace function app.user_rows(p_search text, p_from date, p_to date, p_activity text, p_status text, p_has_phone boolean, p_tz text)
returns setof app.profiles
language plpgsql stable security definer set search_path = '' as $$
declare v_q text := lower(app.clean_text(p_search, 100)); v_inact integer := app.inactivity_days(); v_tz text := coalesce(nullif(p_tz, ''), 'Asia/Riyadh');
begin
  return query
  select p.* from app.profiles p
   where (v_q is null or lower(coalesce(p.full_name, '')) like '%' || v_q || '%' or lower(p.email) like '%' || v_q || '%'
          or coalesce(p.phone, '') like '%' || regexp_replace(v_q, '[^0-9+]', '', 'g') || '%' and regexp_replace(v_q, '[^0-9]', '', 'g') <> '')
     and (p_from is null or p.created_at >= p_from::timestamp at time zone v_tz)
     and (p_to is null or p.created_at < (p_to + 1)::timestamp at time zone v_tz)
     and (p_status is null or p_status = 'all' and p.status <> 'deleted' or p.status::text = p_status)
     and (p_has_phone is null or (p.phone is not null) = p_has_phone)
     and (p_activity is null or p_activity = 'all'
          or p_activity = 'active' and coalesce(p.last_seen_at, p.created_at) >= now() - make_interval(days => v_inact)
          or p_activity = 'inactive' and coalesce(p.last_seen_at, p.created_at) < now() - make_interval(days => v_inact));
end $$;

create or replace function app.user_summary(p app.profiles) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'full_name', p.full_name, 'email', p.email, 'email_verified', p.email_verified, 'phone', p.phone,
    'avatar_url', p.avatar_url, 'status', p.status, 'created_at', p.created_at, 'last_login_at', p.last_login_at,
    'last_seen_at', p.last_seen_at, 'login_count', p.login_count, 'marketing_consent', p.marketing_consent,
    'activity', case when p.status <> 'active' then p.status::text
                     when coalesce(p.last_seen_at, p.created_at) >= now() - make_interval(days => app.inactivity_days()) then 'active' else 'inactive' end,
    'staff_role', (select role from app.staff_roles where user_id = p.id),
    'sessions', (select count(*) from app.sessions s where s.user_id = p.id),
    'important_actions', (select count(*) from app.events e join app.event_catalog c on c.name = e.name and c.is_important where e.user_id = p.id),
    'recent_features', (select coalesce(jsonb_agg(f.name order by f.last_used desc), '[]'::jsonb) from (
        select ft.name, max(e.occurred_at) last_used from app.events e join app.features ft on ft.key = e.feature_key
         where e.user_id = p.id group by ft.name order by 2 desc limit 3) f),
    'contact_status', (select c.status from app.contact_requests c where c.user_id = p.id order by c.created_at desc limit 1),
    'requests', (select count(*) from app.contact_requests c where c.user_id = p.id)) $$;

create or replace function public.admin_list_users(p_search text default null, p_from date default null, p_to date default null,
  p_activity text default 'all', p_status text default 'all', p_has_phone boolean default null, p_sort text default 'created_desc',
  p_limit integer default 25, p_offset integer default 0, p_tz text default 'Asia/Riyadh') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_total bigint; v_rows jsonb;
begin
  perform app.require_perm('users.view');
  p_limit := least(greatest(coalesce(p_limit, 25), 1), 100); p_offset := greatest(coalesce(p_offset, 0), 0);
  select count(*) into v_total from app.user_rows(p_search, p_from, p_to, p_activity, p_status, p_has_phone, p_tz);
  select coalesce(jsonb_agg(app.user_summary(u) order by
           case when p_sort = 'name' then lower(coalesce(u.full_name, u.email)) end,
           case when p_sort = 'last_seen' then coalesce(u.last_seen_at, u.created_at) end desc,
           case when p_sort = 'created_asc' then u.created_at end,
           u.created_at desc), '[]'::jsonb)
    into v_rows
    from (select * from app.user_rows(p_search, p_from, p_to, p_activity, p_status, p_has_phone, p_tz) x
           order by case when p_sort = 'name' then lower(coalesce(x.full_name, x.email)) end,
                    case when p_sort = 'last_seen' then coalesce(x.last_seen_at, x.created_at) end desc,
                    case when p_sort = 'created_asc' then x.created_at end,
                    x.created_at desc
           limit p_limit offset p_offset) u;
  return jsonb_build_object('total', v_total, 'limit', p_limit, 'offset', p_offset, 'rows', v_rows, 'inactivity_days', app.inactivity_days());
end $$;

create or replace function public.admin_export_users(p_search text default null, p_from date default null, p_to date default null,
  p_activity text default 'all', p_status text default 'all', p_has_phone boolean default null, p_tz text default 'Asia/Riyadh') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb; v_n integer;
begin
  perform app.require_perm('users.export');
  if not app.hit('export_users:' || auth.uid(), 20, interval '1 hour') then perform app.err('rate_limited'); end if;
  select coalesce(jsonb_agg(app.user_summary(u) order by u.created_at desc), '[]'::jsonb), count(*) into v, v_n
    from (select * from app.user_rows(p_search, p_from, p_to, p_activity, p_status, p_has_phone, p_tz) limit 10000) u;
  perform app.audit('users.exported', 'users', null, jsonb_build_object('rows', v_n, 'search', p_search, 'activity', p_activity, 'status', p_status, 'has_phone', p_has_phone, 'from', p_from, 'to', p_to));
  return v;
end $$;

create or replace function public.admin_get_user(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p app.profiles; v jsonb;
begin
  perform app.require_perm('users.view');
  select * into p from app.profiles where id = p_id;
  if p.id is null then perform app.err('not_found'); end if;
  select jsonb_build_object(
    'user', app.user_summary(p) || jsonb_build_object('google_linked', p.google_sub is not null, 'auth_provider', p.auth_provider,
            'locale', p.locale, 'privacy_accepted_at', p.privacy_accepted_at, 'phone_updated_at', p.phone_updated_at, 'deleted_at', p.deleted_at),
    'stats', jsonb_build_object(
        'events', (select count(*) from app.events where user_id = p.id),
        'page_views', (select count(*) from app.events where user_id = p.id and name = 'page_view'),
        'first_event_at', (select min(occurred_at) from app.events where user_id = p.id),
        'last_event_at', (select max(occurred_at) from app.events where user_id = p.id),
        'visitors', (select count(*) from app.visitors where user_id = p.id)),
    'sessions', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'started_at', s.started_at, 'last_seen_at', s.last_seen_at,
                   'landing_path', s.landing_path, 'source', s.source, 'referrer_domain', s.referrer_domain, 'device', s.device_type,
                   'browser', s.browser, 'page_views', s.page_views, 'events', s.event_count) order by s.started_at desc), '[]'::jsonb)
                 from (select * from app.sessions where user_id = p.id order by started_at desc limit 20) s),
    'pages', (select coalesce(jsonb_agg(jsonb_build_object('path', path, 'views', n, 'last_at', last_at) order by n desc), '[]'::jsonb)
              from (select coalesce(path, '/') path, count(*) n, max(occurred_at) last_at from app.events where user_id = p.id and name = 'page_view' group by 1 order by 2 desc limit 20) t),
    -- used: has events · not_used: tracking was live while this user was active and nothing was recorded · unknown: not enough data
    'features', (select coalesce(jsonb_agg(jsonb_build_object('key', f.key, 'name', f.name, 'category', f.category, 'eligibility', f.eligibility,
                   'uses', f.uses, 'last_used', f.last_used, 'tracking_since', f.tracking_since,
                   'state', case when f.uses > 0 then 'used'
                                 when f.last_seen is not null and f.last_seen > f.tracking_since then 'not_used'
                                 else 'unknown' end) order by f.uses desc, f.sort), '[]'::jsonb)
                 from (select ft.key, ft.name, ft.category, ft.eligibility, ft.tracking_since, ft.sort,
                              count(e.id) uses, max(e.occurred_at) last_used,
                              (select max(occurred_at) from app.events x where x.user_id = p.id and x.source = 'client') last_seen
                         from app.features ft left join app.events e on e.feature_key = ft.key and e.user_id = p.id
                        where ft.active group by ft.key) f),
    'requests', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'ref', c.ref, 'subject', c.subject, 'status', c.status, 'created_at', c.created_at,
                   'preferred_method', c.preferred_method, 'follow_up_at', c.follow_up_at) order by c.created_at desc), '[]'::jsonb)
                 from app.contact_requests c where c.user_id = p.id),
    'emails', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'template', m.template, 'subject', coalesce(m.subject, m.template), 'status', m.status,
                   'created_at', m.created_at, 'sent_at', m.sent_at, 'delivered_at', m.delivered_at, 'last_error', m.last_error) order by m.created_at desc), '[]'::jsonb)
               from (select * from app.email_messages where user_id = p.id order by created_at desc limit 50) m)
  ) into v;
  return v;
end $$;

create or replace function public.admin_user_timeline(p_id uuid, p_before timestamptz default null, p_limit integer default 60) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform app.require_perm('users.view');
  p_limit := least(greatest(coalesce(p_limit, 60), 1), 200);
  p_before := coalesce(p_before, now() + interval '1 minute');
  select coalesce(jsonb_agg(t.item order by t.at desc), '[]'::jsonb) into v from (
    select * from (
      select e.occurred_at at, jsonb_build_object('kind', 'event', 'at', e.occurred_at, 'name', e.name, 'path', e.path, 'feature', f.name,
             'success', e.success, 'props', e.props, 'source', e.source, 'session_id', e.session_id) item
        from app.events e left join app.features f on f.key = e.feature_key
       where e.user_id = p_id and e.occurred_at < p_before
      union all
      select c.created_at, jsonb_build_object('kind', 'contact', 'at', c.created_at, 'ref', c.ref, 'id', c.id, 'subject', c.subject, 'status', c.status)
        from app.contact_requests c where c.user_id = p_id and c.created_at < p_before
      union all
      select m.created_at, jsonb_build_object('kind', 'email', 'at', m.created_at, 'id', m.id, 'template', m.template, 'subject', coalesce(m.subject, m.template), 'status', m.status)
        from app.email_messages m where m.user_id = p_id and m.created_at < p_before
      union all
      select h.changed_at, jsonb_build_object('kind', 'status', 'at', h.changed_at, 'ref', c.ref, 'from', h.from_status, 'to', h.to_status)
        from app.contact_status_history h join app.contact_requests c on c.id = h.request_id
       where c.user_id = p_id and h.from_status is not null and h.changed_at < p_before
    ) u order by at desc limit p_limit) t;
  return jsonb_build_object('items', v, 'next_before', (select min((x ->> 'at')::timestamptz) from jsonb_array_elements(v) x),
                            'has_more', jsonb_array_length(v) = p_limit);
end $$;

create or replace function public.admin_set_user_status(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_old app.account_status;
begin
  perform app.require_perm('users.manage');
  if p_id = auth.uid() then perform app.err('cannot_change_self'); end if;
  if p_status not in ('active', 'suspended') then perform app.err('invalid_status'); end if;
  select status into v_old from app.profiles where id = p_id;
  if v_old is null then perform app.err('not_found'); end if;
  if v_old = 'deleted' then perform app.err('account_deleted'); end if;
  if exists (select 1 from app.staff_roles where user_id = p_id and role = 'owner') and app.caller_role() <> 'owner' then perform app.err('forbidden'); end if;
  update app.profiles set status = p_status::app.account_status, updated_at = now() where id = p_id;
  perform app.audit('user.status_changed', 'user', p_id::text, jsonb_build_object('from', v_old, 'to', p_status));
  return public.admin_get_user(p_id) -> 'user';
end $$;

-- ================================================================ contact requests / leads
create or replace function public.admin_list_contacts(p_search text default null, p_status text default null, p_assigned uuid default null,
  p_from date default null, p_to date default null, p_overdue boolean default false, p_limit integer default 25, p_offset integer default 0,
  p_tz text default 'Asia/Riyadh') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_q text := lower(app.clean_text(p_search, 100)); v_tz text := coalesce(nullif(p_tz, ''), 'Asia/Riyadh'); v_total bigint; v_rows jsonb;
begin
  perform app.require_perm('leads.view');
  p_limit := least(greatest(coalesce(p_limit, 25), 1), 100); p_offset := greatest(coalesce(p_offset, 0), 0);
  with f as (
    select c.* from app.contact_requests c
     where (v_q is null or lower(c.full_name) like '%' || v_q || '%' or lower(c.email) like '%' || v_q || '%' or lower(c.ref) like '%' || v_q || '%'
            or lower(c.subject) like '%' || v_q || '%' or coalesce(c.phone, '') like '%' || nullif(regexp_replace(v_q, '[^0-9]', '', 'g'), '') || '%')
       and (p_status is null or p_status = 'all' or p_status = 'open' and c.status not in ('resolved', 'closed') or c.status::text = p_status)
       and (p_assigned is null or c.assigned_to = p_assigned)
       and (p_from is null or c.created_at >= p_from::timestamp at time zone v_tz)
       and (p_to is null or c.created_at < (p_to + 1)::timestamp at time zone v_tz)
       and (not coalesce(p_overdue, false) or c.follow_up_at < now() and c.status not in ('resolved', 'closed')))
  select (select count(*) from f),
         (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'ref', c.ref, 'full_name', c.full_name, 'email', c.email, 'phone', c.phone,
             'company', c.company, 'reason', c.reason, 'subject', c.subject, 'preferred_method', c.preferred_method, 'status', c.status,
             'assigned_to', c.assigned_to, 'assignee_name', a.full_name, 'follow_up_at', c.follow_up_at, 'created_at', c.created_at,
             'user_id', c.user_id, 'attempts', (select count(*) from app.contact_attempts t where t.request_id = c.id)) order by c.created_at desc), '[]'::jsonb)
            from (select * from f order by created_at desc limit p_limit offset p_offset) c left join app.profiles a on a.id = c.assigned_to)
    into v_total, v_rows;
  return jsonb_build_object('total', v_total, 'limit', p_limit, 'offset', p_offset, 'rows', v_rows,
    'counts', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from app.contact_requests group by status) t));
end $$;

create or replace function public.admin_get_contact(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c app.contact_requests; v jsonb;
begin
  perform app.require_perm('leads.view');
  select * into c from app.contact_requests where id = p_id;
  if c.id is null then perform app.err('not_found'); end if;
  select jsonb_build_object(
    'request', to_jsonb(c) - 'client_token' || jsonb_build_object('assignee_name', (select full_name from app.profiles where id = c.assigned_to)),
    'user', (select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'email_verified', p.email_verified,
              'phone', p.phone, 'status', p.status, 'created_at', p.created_at, 'last_seen_at', p.last_seen_at, 'marketing_consent', p.marketing_consent)
             from app.profiles p where p.id = c.user_id),
    'notes', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'created_at', n.created_at, 'author', a.full_name) order by n.created_at), '[]'::jsonb)
              from app.contact_notes n left join app.profiles a on a.id = n.author_id where n.request_id = c.id),
    'attempts', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'channel', t.channel, 'outcome', t.outcome, 'notes', t.notes,
                   'attempted_at', t.attempted_at, 'by', a.full_name, 'email_id', t.email_id) order by t.attempted_at), '[]'::jsonb)
                 from app.contact_attempts t left join app.profiles a on a.id = t.by_user where t.request_id = c.id),
    'history', (select coalesce(jsonb_agg(jsonb_build_object('from', h.from_status, 'to', h.to_status, 'at', h.changed_at, 'by', a.full_name) order by h.changed_at), '[]'::jsonb)
                from app.contact_status_history h left join app.profiles a on a.id = h.changed_by where h.request_id = c.id),
    'emails', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'template', m.template, 'to_email', m.to_email, 'subject', coalesce(m.subject, m.template),
                 'status', m.status, 'created_at', m.created_at, 'sent_at', m.sent_at, 'delivered_at', m.delivered_at, 'last_error', m.last_error) order by m.created_at), '[]'::jsonb)
               from app.email_messages m where m.related_request_id = c.id),
    'other_requests', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'ref', o.ref, 'subject', o.subject, 'status', o.status, 'created_at', o.created_at) order by o.created_at desc), '[]'::jsonb)
                       from app.contact_requests o where o.user_id = c.user_id and o.id <> c.id)
  ) into v;
  return v;
end $$;

create or replace function public.admin_update_contact(p_id uuid, p_status text default null, p_assigned_to uuid default null, p_clear_assignee boolean default false,
  p_follow_up_at timestamptz default null, p_clear_follow_up boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c app.contact_requests; v_new app.contact_status;
begin
  perform app.require_perm('leads.manage');
  select * into c from app.contact_requests where id = p_id for update;
  if c.id is null then perform app.err('not_found'); end if;
  if p_status is not null then
    if p_status not in ('new', 'pending', 'contacted', 'in_progress', 'resolved', 'closed') then perform app.err('invalid_status'); end if;
    v_new := p_status::app.contact_status;
  end if;
  if p_assigned_to is not null and not exists (select 1 from app.staff_roles r join app.profiles p on p.id = r.user_id
                                               where r.user_id = p_assigned_to and p.status = 'active' and r.role in ('owner', 'admin', 'support')) then
    perform app.err('invalid_assignee');
  end if;
  update app.contact_requests set
    status = coalesce(v_new, status),
    assigned_to = case when p_clear_assignee then null else coalesce(p_assigned_to, assigned_to) end,
    follow_up_at = case when p_clear_follow_up then null else coalesce(p_follow_up_at, follow_up_at) end,
    first_response_at = case when first_response_at is null and v_new in ('contacted', 'in_progress', 'resolved') then now() else first_response_at end,
    closed_at = case when v_new in ('resolved', 'closed') then coalesce(closed_at, now()) when v_new is not null then null else closed_at end,
    updated_at = now()
  where id = p_id;
  if v_new is not null and v_new <> c.status then
    insert into app.contact_status_history (request_id, from_status, to_status, changed_by) values (p_id, c.status, v_new, auth.uid());
  end if;
  perform app.audit('contact.updated', 'contact_request', c.ref, jsonb_strip_nulls(jsonb_build_object(
    'status', case when v_new is distinct from c.status and v_new is not null then jsonb_build_array(c.status, v_new) end,
    'assigned_to', case when p_clear_assignee or p_assigned_to is not null then coalesce(p_assigned_to::text, 'none') end,
    'follow_up_at', case when p_clear_follow_up or p_follow_up_at is not null then coalesce(p_follow_up_at::text, 'none') end)));
  return public.admin_get_contact(p_id);
end $$;

create or replace function public.admin_add_contact_note(p_id uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_perm('leads.manage');
  if not exists (select 1 from app.contact_requests where id = p_id) then perform app.err('not_found'); end if;
  if app.clean_text(p_body, 4000) is null then perform app.err('invalid_note'); end if;
  insert into app.contact_notes (request_id, author_id, body) values (p_id, auth.uid(), app.clean_text(p_body, 4000));
  update app.contact_requests set updated_at = now() where id = p_id;
  return public.admin_get_contact(p_id);
end $$;

create or replace function public.admin_log_contact_attempt(p_id uuid, p_channel text, p_outcome text, p_notes text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c app.contact_requests;
begin
  perform app.require_perm('leads.manage');
  select * into c from app.contact_requests where id = p_id for update;
  if c.id is null then perform app.err('not_found'); end if;
  if p_channel not in ('email', 'phone', 'whatsapp', 'meeting', 'other') then perform app.err('invalid_channel'); end if;
  if p_outcome not in ('reached', 'no_answer', 'left_message', 'email_sent', 'wrong_number', 'scheduled', 'other') then perform app.err('invalid_outcome'); end if;
  insert into app.contact_attempts (request_id, channel, outcome, notes, by_user) values (p_id, p_channel, p_outcome, app.clean_text(p_notes, 2000), auth.uid());
  update app.contact_requests set first_response_at = coalesce(first_response_at, now()), updated_at = now(),
         status = case when status in ('new', 'pending') then 'contacted'::app.contact_status else status end
   where id = p_id;
  if c.status in ('new', 'pending') then
    insert into app.contact_status_history (request_id, from_status, to_status, changed_by) values (p_id, c.status, 'contacted', auth.uid());
  end if;
  perform app.audit('contact.attempt_logged', 'contact_request', c.ref, jsonb_build_object('channel', p_channel, 'outcome', p_outcome));
  return public.admin_get_contact(p_id);
end $$;

create or replace function public.admin_staff_options() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_perm('leads.view');
  return (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', coalesce(p.full_name, p.email), 'role', r.role) order by p.full_name), '[]'::jsonb)
            from app.staff_roles r join app.profiles p on p.id = r.user_id where p.status = 'active' and r.role in ('owner', 'admin', 'support'));
end $$;

-- ================================================================ features & event catalog
create or replace function public.admin_features(p_from date, p_to date, p_tz text default 'Asia/Riyadh') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r record; v jsonb;
begin
  perform app.require_perm('features.view');
  select * into r from app.range(p_from, p_to, p_tz);
  select coalesce(jsonb_agg(x order by (x ->> 'uses')::int desc, x ->> 'name'), '[]'::jsonb) into v from (
    select jsonb_build_object('key', f.key, 'name', f.name, 'description', f.description, 'category', f.category, 'eligibility', f.eligibility,
      'match_event', f.match_event, 'match_prop', f.match_prop, 'match_value', f.match_value, 'active', f.active, 'sort', f.sort,
      'tracking_since', f.tracking_since,
      'uses', (select count(*) from app.events e where e.feature_key = f.key and e.occurred_at >= r.r_start and e.occurred_at < r.r_end),
      'users', (select count(distinct e.user_id) from app.events e where e.feature_key = f.key and e.occurred_at >= r.r_start and e.occurred_at < r.r_end),
      'visitors', (select count(distinct e.visitor_id) from app.events e where e.feature_key = f.key and e.occurred_at >= r.r_start and e.occurred_at < r.r_end),
      'all_time_users', (select count(distinct e.user_id) from app.events e join app.profiles p on p.id = e.user_id
                          where e.feature_key = f.key and p.status = 'active' and p.last_seen_at > f.tracking_since),
      'last_used', (select max(e.occurred_at) from app.events e where e.feature_key = f.key),
      'eligible_users', (select count(*) from app.profiles p where p.status = 'active' and p.last_seen_at > f.tracking_since),
      'trend', (select coalesce(jsonb_agg(coalesce(c.n, 0) order by d.d), '[]'::jsonb)
                  from (select g::date d from generate_series(p_from, p_to, interval '1 day') g) d
                  left join (select (e.occurred_at at time zone r.tz)::date d, count(*) n from app.events e
                              where e.feature_key = f.key and e.occurred_at >= r.r_start and e.occurred_at < r.r_end group by 1) c on c.d = d.d)) x
      from app.features f) t;
  return v;
end $$;

create or replace function public.admin_feature_detail(p_key text, p_from date, p_to date, p_tz text default 'Asia/Riyadh') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r record; f app.features; v jsonb; v_can_pii boolean := app.has_perm('users.view');
begin
  perform app.require_perm('features.view');
  select * into r from app.range(p_from, p_to, p_tz);
  select * into f from app.features where key = p_key;
  if f.key is null then perform app.err('not_found'); end if;
  select jsonb_build_object(
    'feature', to_jsonb(f),
    'uses', (select count(*) from app.events e where e.feature_key = f.key and e.occurred_at >= r.r_start and e.occurred_at < r.r_end),
    'users', (select count(distinct e.user_id) from app.events e where e.feature_key = f.key and e.occurred_at >= r.r_start and e.occurred_at < r.r_end),
    'visitors', (select count(distinct e.visitor_id) from app.events e where e.feature_key = f.key and e.occurred_at >= r.r_start and e.occurred_at < r.r_end),
    'last_used', (select max(occurred_at) from app.events e where e.feature_key = f.key),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d.d, 'uses', coalesce(c.n, 0), 'users', coalesce(c.u, 0)) order by d.d), '[]'::jsonb)
              from (select g::date d from generate_series(p_from, p_to, interval '1 day') g) d
              left join (select (e.occurred_at at time zone r.tz)::date d, count(*) n, count(distinct e.user_id) u from app.events e
                          where e.feature_key = f.key and e.occurred_at >= r.r_start and e.occurred_at < r.r_end group by 1) c on c.d = d.d),
    'props', (select coalesce(jsonb_agg(jsonb_build_object('value', val, 'uses', n) order by n desc), '[]'::jsonb) from (
        select coalesce(e.props ->> coalesce(f.match_prop, (select c.allowed_props[1] from app.event_catalog c where c.name = f.match_event)), '—') val, count(*) n
          from app.events e where e.feature_key = f.key and e.occurred_at >= r.r_start and e.occurred_at < r.r_end group by 1 order by 2 desc limit 12) t),
    'users_who_used', case when v_can_pii then (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email,
                         'uses', t.n, 'last_used', t.last_used) order by t.n desc), '[]'::jsonb) from (
        select user_id, count(*) n, max(occurred_at) last_used from app.events where feature_key = f.key and user_id is not null
         group by user_id order by 2 desc limit 100) t join app.profiles p on p.id = t.user_id) end,
    'eligible_not_used', case when v_can_pii then (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email,
                         'last_seen_at', p.last_seen_at) order by p.last_seen_at desc), '[]'::jsonb) from (
        select * from app.profiles p where p.status = 'active' and p.last_seen_at > f.tracking_since
           and not exists (select 1 from app.events e where e.feature_key = f.key and e.user_id = p.id)
         order by p.last_seen_at desc limit 100) p) end,
    'eligible_not_used_count', (select count(*) from app.profiles p where p.status = 'active' and p.last_seen_at > f.tracking_since
           and not exists (select 1 from app.events e where e.feature_key = f.key and e.user_id = p.id)),
    'unknown_count', (select count(*) from app.profiles p where p.status = 'active' and (p.last_seen_at is null or p.last_seen_at <= f.tracking_since))
  ) into v;
  return v;
end $$;

create or replace function public.admin_event_catalog() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_perm('features.view');
  return (select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'description', c.description, 'category', c.category, 'allowed_props', c.allowed_props,
            'is_important', c.is_important, 'client_allowed', c.client_allowed,
            'last_30d', (select count(*) from app.events e where e.name = c.name and e.occurred_at > now() - interval '30 days')) order by c.category, c.name), '[]'::jsonb)
          from app.event_catalog c);
end $$;

create or replace function public.admin_upsert_event(p_name text, p_description text, p_category text, p_allowed_props text[], p_is_important boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_perm('settings.manage');
  if p_name !~ '^[a-z][a-z0-9_]{1,48}$' then perform app.err('invalid_event_name'); end if;
  if exists (select 1 from unnest(coalesce(p_allowed_props, '{}')) x where x !~ '^[a-z][a-z0-9_]{0,30}$') or cardinality(coalesce(p_allowed_props, '{}')) > 12 then
    perform app.err('invalid_props');
  end if;
  if exists (select 1 from app.event_catalog where name = p_name and not client_allowed) then perform app.err('server_event_locked'); end if;
  insert into app.event_catalog (name, description, category, allowed_props, is_important)
  values (p_name, coalesce(app.clean_text(p_description, 200), p_name), coalesce(app.clean_text(p_category, 40), 'interaction'), coalesce(p_allowed_props, '{}'), coalesce(p_is_important, false))
  on conflict (name) do update set description = excluded.description, category = excluded.category,
     allowed_props = excluded.allowed_props, is_important = excluded.is_important;
  perform app.audit('event.upserted', 'event', p_name, jsonb_build_object('allowed_props', p_allowed_props, 'is_important', p_is_important));
  return public.admin_event_catalog();
end $$;

create or replace function public.admin_upsert_feature(p_key text, p_name text, p_description text, p_category text, p_eligibility text,
  p_match_event text, p_match_prop text, p_match_value text, p_active boolean, p_sort integer default 100, p_backfill boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_existing app.features; v_since timestamptz; v_rows integer := 0;
begin
  perform app.require_perm('settings.manage');
  if p_key !~ '^[a-z][a-z0-9_]{1,48}$' then perform app.err('invalid_feature_key'); end if;
  if app.clean_text(p_name, 80) is null then perform app.err('invalid_feature_name'); end if;
  if p_eligibility not in ('everyone', 'registered') then perform app.err('invalid_eligibility'); end if;
  if not exists (select 1 from app.event_catalog where name = p_match_event) then perform app.err('unknown_event'); end if;
  if (nullif(p_match_prop, '') is null) <> (nullif(p_match_value, '') is null) then perform app.err('invalid_match'); end if;
  if nullif(p_match_prop, '') is not null and not exists (select 1 from app.event_catalog where name = p_match_event and nullif(p_match_prop, '') = any (allowed_props)) then
    perform app.err('prop_not_allowed');
  end if;
  select * into v_existing from app.features where key = p_key;
  insert into app.features (key, name, description, category, eligibility, match_event, match_prop, match_value, active, sort)
  values (p_key, app.clean_text(p_name, 80), app.clean_text(p_description, 300), coalesce(app.clean_text(p_category, 40), 'general'), p_eligibility,
          p_match_event, nullif(p_match_prop, ''), nullif(p_match_value, ''), coalesce(p_active, true), coalesce(p_sort, 100))
  on conflict (key) do update set name = excluded.name, description = excluded.description, category = excluded.category,
     eligibility = excluded.eligibility, match_event = excluded.match_event, match_prop = excluded.match_prop,
     match_value = excluded.match_value, active = excluded.active, sort = excluded.sort;
  if coalesce(p_backfill, true) then
    -- tag past events that match and are not yet attributed; tracking starts at the earliest such event
    update app.events e set feature_key = p_key
     where e.feature_key is null and e.name = p_match_event
       and (nullif(p_match_prop, '') is null or e.props ->> p_match_prop = p_match_value);
    get diagnostics v_rows = row_count;
    select min(occurred_at) into v_since from app.events where feature_key = p_key;
    if v_since is not null and v_existing.key is null then update app.features set tracking_since = v_since where key = p_key; end if;
  end if;
  perform app.audit(case when v_existing.key is null then 'feature.created' else 'feature.updated' end, 'feature', p_key,
                    jsonb_build_object('match_event', p_match_event, 'match_prop', p_match_prop, 'match_value', p_match_value, 'active', p_active, 'backfilled', v_rows));
  return jsonb_build_object('key', p_key, 'backfilled', v_rows);
end $$;

-- ================================================================ email (admin side; delivery is done by the email-worker Edge Function)
create or replace function public.admin_email_recipient(p_user uuid default null, p_request uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  perform app.require_perm('email.send');
  if p_user is not null then
    select jsonb_build_object('user_id', id, 'name', full_name, 'email', email, 'email_verified', email_verified, 'phone', phone,
                              'status', status, 'marketing_consent', marketing_consent, 'sendable', status <> 'deleted')
      into v from app.profiles where id = p_user;
  elsif p_request is not null then
    select jsonb_build_object('user_id', c.user_id, 'name', c.full_name, 'email', c.email, 'email_verified', coalesce(p.email_verified, false), 'phone', c.phone,
                              'status', coalesce(p.status::text, 'no_account'), 'marketing_consent', coalesce(p.marketing_consent, false),
                              'sendable', c.email not like '%@deleted.invalid', 'request_ref', c.ref)
      into v from app.contact_requests c left join app.profiles p on p.id = c.user_id where c.id = p_request;
  end if;
  if v is null then perform app.err('not_found'); end if;
  return v;
end $$;

create or replace function public.admin_send_email(p_subject text, p_body text, p_user uuid default null, p_request uuid default null,
  p_category text default 'follow_up', p_client_token text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_rec jsonb; v_id uuid; v_ref text;
begin
  perform app.require_perm('email.send');
  if not app.hit('admin_email:' || auth.uid(), 60, interval '1 hour') then perform app.err('rate_limited'); end if;
  if p_category not in ('follow_up', 'transactional', 'announcement') then perform app.err('invalid_category'); end if;
  if char_length(coalesce(app.clean_line(p_subject, 300), '')) not between 3 and 150 then perform app.err('invalid_subject'); end if;
  if char_length(coalesce(btrim(p_body), '')) not between 5 and 8000 then perform app.err('invalid_body'); end if;
  v_rec := public.admin_email_recipient(p_user, p_request);
  if not (v_rec ->> 'sendable')::boolean then perform app.err('recipient_unavailable'); end if;
  if p_category = 'announcement' and not coalesce((v_rec ->> 'marketing_consent')::boolean, false) then perform app.err('no_marketing_consent'); end if;
  v_id := app.enqueue_email(case when p_category = 'announcement' then 'announcement' else 'follow_up' end, v_rec ->> 'email',
            (v_rec ->> 'user_id')::uuid, jsonb_build_object('name', v_rec ->> 'name', 'ref', v_rec ->> 'request_ref'),
            p_category, p_request, app.clean_line(p_subject, 150), left(btrim(p_body), 8000),
            case when p_client_token is not null then 'admin:' || auth.uid() || ':' || left(p_client_token, 60) end);
  if v_id is null then
    select id into v_id from app.email_messages where p_client_token is not null and idempotency_key = 'admin:' || auth.uid() || ':' || left(p_client_token, 60);
    if v_id is null then perform app.err('invalid_recipient'); end if;
    return jsonb_build_object('id', v_id, 'duplicate', true, 'to', v_rec ->> 'email');
  end if;
  if p_request is not null then
    select ref into v_ref from app.contact_requests where id = p_request;
    insert into app.contact_attempts (request_id, channel, outcome, notes, email_id, by_user)
    values (p_request, 'email', 'email_sent', app.clean_text(p_subject, 150), v_id, auth.uid());
    update app.contact_requests set first_response_at = coalesce(first_response_at, now()), updated_at = now() where id = p_request;
  end if;
  perform app.audit('email.queued', 'email', v_id::text, jsonb_build_object('to_user', v_rec ->> 'user_id', 'request', v_ref, 'category', p_category));
  return jsonb_build_object('id', v_id, 'status', 'queued', 'to', v_rec ->> 'email', 'duplicate', false);
end $$;

create or replace function public.admin_list_emails(p_status text default null, p_user uuid default null, p_search text default null,
  p_limit integer default 25, p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_q text := lower(app.clean_text(p_search, 100));
begin
  perform app.require_perm('email.send');
  p_limit := least(greatest(coalesce(p_limit, 25), 1), 100); p_offset := greatest(coalesce(p_offset, 0), 0);
  return jsonb_build_object(
    'total', (select count(*) from app.email_messages m where (p_status is null or p_status = 'all' or m.status::text = p_status)
               and (p_user is null or m.user_id = p_user) and (v_q is null or m.to_email like '%' || v_q || '%' or lower(coalesce(m.subject, '')) like '%' || v_q || '%')),
    'counts', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from app.email_messages group by status) t),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'to_email', m.to_email, 'user_id', m.user_id, 'template', m.template,
               'category', m.category, 'subject', coalesce(m.subject, m.template), 'status', m.status, 'attempts', m.attempts,
               'last_error', m.last_error, 'created_at', m.created_at, 'sent_at', m.sent_at, 'delivered_at', m.delivered_at,
               'next_attempt_at', case when m.status = 'queued' then m.next_attempt_at end,
               'request_ref', (select ref from app.contact_requests c where c.id = m.related_request_id),
               'events', (select coalesce(jsonb_agg(jsonb_build_object('type', ev.type, 'at', ev.occurred_at, 'detail', ev.detail) order by ev.occurred_at), '[]'::jsonb)
                          from app.email_events ev where ev.email_id = m.id)) order by m.created_at desc), '[]'::jsonb)
             from (select * from app.email_messages m where (p_status is null or p_status = 'all' or m.status::text = p_status)
                     and (p_user is null or m.user_id = p_user) and (v_q is null or m.to_email like '%' || v_q || '%' or lower(coalesce(m.subject, '')) like '%' || v_q || '%')
                   order by m.created_at desc limit p_limit offset p_offset) m));
end $$;

create or replace function public.admin_retry_email(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_status app.email_status;
begin
  perform app.require_perm('email.send');
  select status into v_status from app.email_messages where id = p_id for update;
  if v_status is null then perform app.err('not_found'); end if;
  if v_status <> 'failed' then perform app.err('not_retryable'); end if;
  update app.email_messages set status = 'queued', next_attempt_at = now(), max_attempts = attempts + 3, last_error = null, updated_at = now() where id = p_id;
  perform app.audit('email.retried', 'email', p_id::text, '{}'::jsonb);
  return jsonb_build_object('id', p_id, 'status', 'queued');
end $$;

create or replace function public.admin_cancel_email(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_perm('email.send');
  update app.email_messages set status = 'cancelled', updated_at = now() where id = p_id and status = 'queued';
  if not found then perform app.err('not_cancellable'); end if;
  perform app.audit('email.cancelled', 'email', p_id::text, '{}'::jsonb);
  return jsonb_build_object('id', p_id, 'status', 'cancelled');
end $$;

-- ================================================================ settings, roles, audit
create or replace function public.admin_get_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_perm('analytics.view');
  return jsonb_build_object(
    'settings', (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from app.settings where key <> 'email_worker_status'),
    'email_worker', app.setting('email_worker_status'),
    'can_manage', app.has_perm('settings.manage'),
    'counts', jsonb_build_object('events', (select count(*) from app.events), 'oldest_event', (select min(occurred_at) from app.events),
                                 'queued_emails', (select count(*) from app.email_messages where status = 'queued'),
                                 'failed_emails', (select count(*) from app.email_messages where status = 'failed')));
end $$;

create or replace function public.admin_update_setting(p_key text, p_value jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_old jsonb; v_ok boolean := false; v_n integer;
begin
  perform app.require_perm('settings.manage');
  case p_key
    when 'site_name' then v_ok := jsonb_typeof(p_value) = 'string' and char_length(p_value #>> '{}') between 2 and 60;
    when 'notify_email' then v_ok := jsonb_typeof(p_value) = 'string' and (p_value #>> '{}') ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
    when 'analytics_retention_days' then v_ok := jsonb_typeof(p_value) = 'number' and (p_value #>> '{}')::numeric between 30 and 1095;
    when 'inactivity_days' then v_ok := jsonb_typeof(p_value) = 'number' and (p_value #>> '{}')::numeric between 1 and 365;
    when 'contact_reasons' then
      v_ok := jsonb_typeof(p_value) = 'array' and jsonb_array_length(p_value) between 1 and 12
              and not exists (select 1 from jsonb_array_elements(p_value) r where coalesce(r ->> 'key', '') !~ '^[a-z][a-z0-9_]{1,30}$'
                              or coalesce(char_length(r ->> 'en'), 0) not between 2 and 60 or coalesce(char_length(r ->> 'ar'), 0) not between 2 and 60);
    when 'contact_status_labels' then
      v_ok := jsonb_typeof(p_value) = 'object' and not exists (select 1 from jsonb_object_keys(p_value) k where k not in ('new', 'pending', 'contacted', 'in_progress', 'resolved', 'closed'));
    when 'privacy' then
      v_ok := jsonb_typeof(p_value) = 'object' and not exists (select 1 from jsonb_object_keys(p_value) k where k not in ('require_analytics_consent', 'tracking_enabled', 'policy_version', 'policy_url'))
              and jsonb_typeof(coalesce(p_value -> 'require_analytics_consent', 'true')) = 'boolean' and jsonb_typeof(coalesce(p_value -> 'tracking_enabled', 'true')) = 'boolean';
    when 'welcome_email' then v_ok := jsonb_typeof(p_value) = 'object' and jsonb_typeof(p_value -> 'enabled') = 'boolean';
    when 'branding' then v_ok := jsonb_typeof(p_value) = 'object' and coalesce(p_value ->> 'primary_color', '#3D5AFE') ~ '^#[0-9A-Fa-f]{6}$';
    else perform app.err('unknown_setting');
  end case;
  if not v_ok then perform app.err('invalid_setting_value'); end if;
  select value into v_old from app.settings where key = p_key;
  insert into app.settings (key, value, updated_by, updated_at) values (p_key, p_value, auth.uid(), now())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
  perform app.audit('setting.updated', 'setting', p_key, jsonb_build_object('from', v_old, 'to', p_value));
  return public.admin_get_settings();
end $$;

create or replace function public.admin_list_staff() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_perm('settings.manage');
  return (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'full_name', p.full_name, 'email', p.email, 'role', r.role,
            'status', p.status, 'granted_at', r.granted_at, 'granted_by', g.full_name, 'last_seen_at', p.last_seen_at) order by r.role, p.full_name), '[]'::jsonb)
          from app.staff_roles r join app.profiles p on p.id = r.user_id left join app.profiles g on g.id = r.granted_by);
end $$;

create or replace function public.admin_set_staff_role(p_email text, p_role text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_old app.staff_role;
begin
  perform app.require_perm('roles.manage');
  if (select count(*) from app.profiles where lower(email) = lower(btrim(p_email)) and status = 'active' and auth_provider = 'google' and email_verified) > 1 then
    perform app.err('ambiguous_email');
  end if;
  select id into v_user from app.profiles where lower(email) = lower(btrim(p_email)) and status = 'active' and auth_provider = 'google' and email_verified;
  if v_user is null then perform app.err('user_not_found'); end if;   -- the person must sign in with Google once first
  if p_role is not null and p_role not in ('owner', 'admin', 'support', 'analyst') then perform app.err('invalid_role'); end if;
  select role into v_old from app.staff_roles where user_id = v_user;
  if v_old = 'owner' and coalesce(p_role, '') <> 'owner' and (select count(*) from app.staff_roles where role = 'owner') <= 1 then
    perform app.err('last_owner');
  end if;
  if p_role is null then
    delete from app.staff_roles where user_id = v_user;
  else
    insert into app.staff_roles (user_id, role, granted_by) values (v_user, p_role::app.staff_role, auth.uid())
    on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by, granted_at = now();
  end if;
  perform app.audit('role.changed', 'user', v_user::text, jsonb_build_object('email', lower(p_email), 'from', v_old, 'to', p_role));
  return public.admin_list_staff();
end $$;

create or replace function public.admin_audit_log(p_action text default null, p_limit integer default 50, p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_perm('audit.view');
  p_limit := least(greatest(coalesce(p_limit, 50), 1), 200); p_offset := greatest(coalesce(p_offset, 0), 0);
  return jsonb_build_object(
    'total', (select count(*) from app.audit_log where p_action is null or action like p_action || '%'),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'at', a.at, 'action', a.action, 'target_type', a.target_type, 'target_id', a.target_id,
               'details', a.details, 'actor', coalesce(p.full_name, p.email, 'system')) order by a.at desc), '[]'::jsonb)
             from (select * from app.audit_log where p_action is null or action like p_action || '%' order by at desc limit p_limit offset p_offset) a
             left join app.profiles p on p.id = a.actor_id));
end $$;

-- First owner: run ONCE in the Supabase SQL editor after you have signed in with Google on the site:
--   select app.bootstrap_owner('you@example.com');
-- It refuses to run if an owner already exists, and it is not callable from the website.
create or replace function app.bootstrap_owner(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if exists (select 1 from app.staff_roles where role = 'owner') then raise exception 'An owner already exists. Use the dashboard (Settings → Team) to add people.'; end if;
  if (select count(*) from app.profiles where lower(email) = lower(btrim(p_email)) and status = 'active' and auth_provider = 'google' and email_verified) > 1 then
    raise exception 'More than one account uses that e-mail. Resolve it in the Auth dashboard first.';
  end if;
  select id into v_user from app.profiles where lower(email) = lower(btrim(p_email)) and status = 'active' and auth_provider = 'google' and email_verified;
  if v_user is null then raise exception 'No verified Google account with that email yet. Sign in with Google on the site first, then run this again.'; end if;
  insert into app.staff_roles (user_id, role) values (v_user, 'owner');
  insert into app.audit_log (actor_id, action, target_type, target_id, details) values (null, 'role.bootstrap_owner', 'user', v_user::text, jsonb_build_object('email', lower(p_email)));
  return 'Owner role granted to ' || lower(p_email);
end $$;

-- ================================================================ grants: admin functions are callable by signed-in users only (and then gated by role)
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'admin\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
revoke all on all functions in schema app from public, anon, authenticated;
grant execute on all functions in schema app to service_role;
