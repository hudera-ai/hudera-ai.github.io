-- HUDERA AI platform · 0002 · helpers, Google sign-in hooks, event tracking, user self-service, contact form
-- Every function is SECURITY DEFINER with an empty search_path and fully qualified names.

-- ================================================================ helpers (private)
create or replace function app.setting(p_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select value from app.settings where key = p_key $$;

create or replace function app.err(p_code text) returns void
language plpgsql set search_path = '' as $$
begin
  if p_code = 'not_authenticated' then raise exception 'not_authenticated' using errcode = '42501', hint = 'sign_in';
  elsif p_code = 'forbidden' then raise exception 'forbidden' using errcode = '42501';
  else raise exception '%', p_code using errcode = 'P0001';
  end if;
end $$;

-- the active staff role of the caller, or null
create or replace function app.caller_role() returns app.staff_role
language sql stable security definer set search_path = '' as $$
  select r.role from app.staff_roles r join app.profiles p on p.id = r.user_id
   where r.user_id = auth.uid() and p.status = 'active' $$;

create or replace function app.has_perm(p_perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(case app.caller_role()
    when 'owner'   then true
    when 'admin'   then p_perm <> 'roles.manage'
    when 'support' then p_perm in ('analytics.view', 'users.view', 'leads.view', 'leads.manage', 'email.send', 'features.view')
    when 'analyst' then p_perm in ('analytics.view', 'features.view')
  end, false) $$;

create or replace function app.require_perm(p_perm text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then perform app.err('not_authenticated'); end if;
  if not app.has_perm(p_perm) then perform app.err('forbidden'); end if;
  return auth.uid();
end $$;

create or replace function app.require_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_status app.account_status;
begin
  if auth.uid() is null then perform app.err('not_authenticated'); end if;
  select status into v_status from app.profiles where id = auth.uid();
  if v_status is null then perform app.err('not_authenticated'); end if;
  if v_status <> 'active' then perform app.err('account_' || v_status); end if;
  return auth.uid();
end $$;

create or replace function app.audit(p_action text, p_target_type text, p_target_id text, p_details jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into app.audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb)) $$;

-- fixed-window rate limiter; returns false when the bucket is full
create or replace function app.hit(p_bucket text, p_max integer, p_window interval) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window));
        v_hits integer;
begin
  insert into app.rate_limits (bucket, window_start, hits) values (p_bucket, v_start, 1)
  on conflict (bucket, window_start) do update set hits = app.rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

create or replace function app.clean_text(p text, p_max integer) returns text
language sql immutable set search_path = '' as $$
  select nullif(left(btrim(regexp_replace(coalesce(p, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), p_max), '') $$;

-- single-line text (names, subjects): also removes tabs and line breaks (header / CSV injection)
create or replace function app.clean_line(p text, p_max integer) returns text
language sql immutable set search_path = '' as $$
  select app.clean_text(regexp_replace(coalesce(p, ''), '[\t\r\n]+', ' ', 'g'), p_max) $$;

-- +9665..., 009665..., 05... (Saudi), 01... (Egypt) → E.164, or null if it cannot be read
create or replace function app.normalize_phone(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare d text := regexp_replace(coalesce(p, ''), '[\s\-\(\)\.]', '', 'g');
begin
  d := translate(d, '٠١٢٣٤٥٦٧٨٩', '0123456789');
  if d = '' then return null; end if;
  if d ~ '^00' then d := '+' || substr(d, 3); end if;
  if d ~ '^05[0-9]{8}$' then d := '+966' || substr(d, 2); end if;
  if d ~ '^01[0-9]{9}$' then d := '+20' || substr(d, 2); end if;
  if d ~ '^\+[1-9][0-9]{7,14}$' then return d; end if;
  return 'invalid';
end $$;

create or replace function app.parse_ua(p_ua text, out device_type text, out browser text, out os text)
language plpgsql immutable set search_path = '' as $$
declare ua text := lower(coalesce(p_ua, ''));
begin
  device_type := case when ua ~ '(bot|crawler|spider|headless|lighthouse|preview)' then 'bot'
                      when ua ~ '(ipad|tablet|kindle|silk)' or (ua ~ 'android' and ua !~ 'mobile') then 'tablet'
                      when ua ~ '(mobi|iphone|ipod|android)' then 'mobile'
                      when ua = '' then 'unknown' else 'desktop' end;
  browser := case when ua ~ 'edg/' then 'Edge' when ua ~ '(opr/|opera)' then 'Opera'
                  when ua ~ 'samsungbrowser' then 'Samsung Internet' when ua ~ '(chrome|crios)/' then 'Chrome'
                  when ua ~ '(firefox|fxios)/' then 'Firefox' when ua ~ 'safari/' then 'Safari'
                  when ua = '' then 'Unknown' else 'Other' end;
  os := case when ua ~ 'windows' then 'Windows' when ua ~ '(iphone|ipad|ipod)' then 'iOS'
             when ua ~ 'android' then 'Android' when ua ~ 'mac os' then 'macOS' when ua ~ 'linux' then 'Linux'
             when ua = '' then 'Unknown' else 'Other' end;
end $$;

create or replace function app.classify_source(p_ref text, p_utm_source text, p_utm_medium text) returns text
language sql immutable set search_path = '' as $$
  select case
    when coalesce(p_utm_source, p_utm_medium) is not null then 'campaign'
    when p_ref is null or p_ref = '' then 'direct'
    when p_ref ~ '(^|\.)(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia)\.' then 'search'
    when p_ref ~ '(^|\.)(linkedin|lnkd|facebook|fb|instagram|t\.co|twitter|x\.com|whatsapp|wa\.me|tiktok|youtube|snapchat|reddit)' then 'social'
    else 'referral' end $$;

create or replace function app.feature_for(p_name text, p_props jsonb) returns text
language sql stable security definer set search_path = '' as $$
  select key from app.features
   where active and match_event = p_name
     and (match_prop is null or p_props ->> match_prop = match_value)
   order by (match_prop is not null) desc, sort, key limit 1 $$;

-- events the server records itself (sign-up, login, contact submitted…) — never trusted from the browser
create or replace function app.server_event(p_name text, p_user uuid, p_props jsonb default '{}'::jsonb, p_success boolean default true) returns void
language sql security definer set search_path = '' as $$
  insert into app.events (event_id, name, occurred_at, user_id, feature_key, success, source, props)
  values (gen_random_uuid(), p_name, now(), p_user, app.feature_for(p_name, coalesce(p_props, '{}'::jsonb)), p_success, 'server', coalesce(p_props, '{}'::jsonb)) $$;

create or replace function app.enqueue_email(p_template text, p_to text, p_user uuid, p_data jsonb,
  p_category text default 'transactional', p_request uuid default null, p_subject text default null,
  p_body text default null, p_idem text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_to is null or p_to !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return null; end if;
  insert into app.email_messages (template, to_email, user_id, data, category, related_request_id, subject, body_text, idempotency_key, created_by)
  values (p_template, lower(p_to), p_user, coalesce(p_data, '{}'::jsonb), p_category, p_request, p_subject, p_body, p_idem, auth.uid())
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  return v_id;
end $$;

-- ================================================================ Google sign-in hooks (auth.users → profiles)
-- Only fields the user cannot edit themselves are trusted: provider (raw_app_meta_data), e-mail confirmation
-- (email_confirmed_at) and the Google identity row (auth.identities). raw_user_meta_data is user-writable
-- through auth.updateUser(), so it is used for nothing that matters.
create or replace function app.sync_profile(p_user auth.users) returns void
language plpgsql security definer set search_path = '' as $$
declare v_idn jsonb; v_sub text; v_avatar text; v_name text; v_provider text := coalesce(p_user.raw_app_meta_data ->> 'provider', 'email');
begin
  select i.identity_data, i.provider_id into v_idn, v_sub
    from auth.identities i where i.user_id = p_user.id and i.provider = 'google' order by i.created_at limit 1;
  v_avatar := coalesce(v_idn ->> 'avatar_url', v_idn ->> 'picture');
  if v_avatar !~ '^https://[a-z0-9.-]*googleusercontent\.com/' then v_avatar := null; end if;
  v_name := app.clean_line(coalesce(v_idn ->> 'full_name', v_idn ->> 'name', p_user.raw_user_meta_data ->> 'full_name', p_user.raw_user_meta_data ->> 'name'), 120);
  update app.profiles set
    email          = coalesce(lower(p_user.email), email),
    email_verified = p_user.email_confirmed_at is not null,
    auth_provider  = v_provider,
    google_sub     = coalesce(google_sub, case when v_sub is not null and not exists (select 1 from app.profiles o where o.google_sub = v_sub and o.id <> p_user.id) then v_sub end),
    full_name      = coalesce(full_name, v_name),
    avatar_url     = coalesce(v_avatar, avatar_url),
    updated_at     = now()
  where id = p_user.id;
end $$;

create or replace function app.record_login(p_user auth.users) returns void
language plpgsql security definer set search_path = '' as $$
declare v_first boolean;
begin
  update app.profiles set last_login_at = p_user.last_sign_in_at, login_count = login_count + 1,
         last_seen_at = greatest(coalesce(last_seen_at, p_user.last_sign_in_at), p_user.last_sign_in_at)
   where id = p_user.id returning login_count = 1 into v_first;
  perform app.server_event('login', p_user.id, '{}'::jsonb);
  -- welcome e-mail once, only to a confirmed Google account (never to an address someone merely typed in)
  if v_first and p_user.email_confirmed_at is not null and p_user.raw_app_meta_data ->> 'provider' = 'google'
     and coalesce((app.setting('welcome_email') ->> 'enabled')::boolean, true) then
    perform app.enqueue_email('welcome', p_user.email, p_user.id,
      jsonb_build_object('name', (select full_name from app.profiles where id = p_user.id)),
      'transactional', null, null, null, 'welcome:' || p_user.id);
  end if;
end $$;

create or replace function app.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into app.profiles (id, email, email_verified, auth_provider, created_at)
  values (new.id, lower(coalesce(new.email, '')), new.email_confirmed_at is not null, coalesce(new.raw_app_meta_data ->> 'provider', 'email'), coalesce(new.created_at, now()))
  on conflict (id) do nothing;
  perform app.sync_profile(new);
  perform app.server_event('user_registered', new.id, jsonb_build_object('provider', coalesce(new.raw_app_meta_data ->> 'provider', 'email')));
  if new.last_sign_in_at is not null then perform app.record_login(new); end if;
  return new;
end $$;

create or replace function app.on_auth_user_updated() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.sync_profile(new);
  if new.last_sign_in_at is distinct from old.last_sign_in_at and new.last_sign_in_at is not null then
    perform app.record_login(new);
  end if;
  return new;
end $$;

-- identities are written after the user row on first sign-in: sync again when the Google identity appears
create or replace function app.on_auth_identity_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare u auth.users;
begin
  select * into u from auth.users where id = new.user_id;
  if u.id is not null then perform app.sync_profile(u); end if;
  return new;
end $$;

drop trigger if exists hudera_on_auth_user_created on auth.users;
create trigger hudera_on_auth_user_created after insert on auth.users for each row execute function app.on_auth_user_created();
drop trigger if exists hudera_on_auth_user_updated on auth.users;
create trigger hudera_on_auth_user_updated after update on auth.users for each row execute function app.on_auth_user_updated();
drop trigger if exists hudera_on_auth_identity_changed on auth.identities;
create trigger hudera_on_auth_identity_changed after insert or update on auth.identities for each row execute function app.on_auth_identity_changed();
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant usage on schema app to supabase_auth_admin;
    grant execute on function app.on_auth_user_created(), app.on_auth_user_updated(), app.on_auth_identity_changed() to supabase_auth_admin;
  end if;
end $$;

-- ================================================================ public API: site config + tracking
create or replace function public.site_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'site_name',        coalesce(app.setting('site_name') #>> '{}', 'HUDERA AI'),
    'require_consent',  coalesce((app.setting('privacy') ->> 'require_analytics_consent')::boolean, true),
    'tracking_enabled', coalesce((app.setting('privacy') ->> 'tracking_enabled')::boolean, true),
    'contact_reasons',  coalesce(app.setting('contact_reasons'), '[]'::jsonb),
    'privacy_version',  coalesce(app.setting('privacy') ->> 'policy_version', '2026-10'),
    'events',           (select coalesce(jsonb_agg(name order by name), '[]'::jsonb) from app.event_catalog where client_allowed)) $$;

create or replace function public.track(p_visitor uuid, p_session uuid, p_context jsonb, p_events jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ua record;
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v_ctx jsonb := coalesce(p_context, '{}'::jsonb);
  v_ref text := lower(app.clean_text(v_ctx ->> 'referrer', 120));
  v_utm_s text := lower(app.clean_text(v_ctx ->> 'utm_source', 60));
  v_utm_m text := lower(app.clean_text(v_ctx ->> 'utm_medium', 60));
  v_utm_c text := lower(app.clean_text(v_ctx ->> 'utm_campaign', 80));
  v_path text := app.clean_text(split_part(v_ctx ->> 'path', '?', 1), 300);
  v_ip text := coalesce(nullif(btrim(split_part(coalesce(v_headers ->> 'cf-connecting-ip', v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1)), ''), 'unknown');
  v_sess_visitor uuid; v_e jsonb; v_cat record; v_props jsonb; v_when timestamptz; v_rows integer;
  v_acc integer := 0; v_dup integer := 0; v_rej integer := 0; v_pv integer := 0;
begin
  if p_visitor is null or p_session is null or jsonb_typeof(p_events) is distinct from 'array'
     or jsonb_array_length(p_events) = 0 or jsonb_array_length(p_events) > 50 then
    perform app.err('bad_request');
  end if;
  if not coalesce((app.setting('privacy') ->> 'tracking_enabled')::boolean, true) then
    return jsonb_build_object('accepted', 0, 'disabled', true);
  end if;
  -- limits per browser id, per network address (ids are chosen by the caller) and overall
  if not app.hit('track:' || p_visitor, 600, interval '10 minutes')
     or not app.hit('track_ip:' || md5(v_ip), 1500, interval '10 minutes')
     or not app.hit('track_all', 30000, interval '1 minute') then
    return jsonb_build_object('accepted', 0, 'throttled', true);
  end if;
  if not exists (select 1 from app.visitors where id = p_visitor)
     and not app.hit('new_visitor_ip:' || md5(v_ip), 60, interval '1 hour') then
    return jsonb_build_object('accepted', 0, 'throttled', true);
  end if;
  if v_uid is not null and not exists (select 1 from app.profiles where id = v_uid and status = 'active') then v_uid := null; end if;
  if v_ref ~ '(^|\.)hudera-ai\.github\.io$' then v_ref := null; end if;           -- internal navigation is not a source
  select * into v_ua from app.parse_ua(v_headers ->> 'user-agent');
  if v_ua.device_type = 'bot' then return jsonb_build_object('accepted', 0, 'bot', true); end if;

  insert into app.visitors as v (id, user_id, first_referrer_domain, first_utm_source, device_type, browser, os)
  values (p_visitor, v_uid, v_ref, v_utm_s, v_ua.device_type, v_ua.browser, v_ua.os)
  on conflict (id) do update set last_seen_at = now(), user_id = coalesce(excluded.user_id, v.user_id),
     device_type = excluded.device_type, browser = excluded.browser, os = excluded.os;

  select visitor_id into v_sess_visitor from app.sessions where id = p_session;
  if v_sess_visitor is null then
    insert into app.sessions (id, visitor_id, user_id, landing_path, referrer_domain, source, utm_source, utm_medium, utm_campaign, device_type, browser, os, is_returning)
    values (p_session, p_visitor, v_uid, v_path, v_ref, app.classify_source(v_ref, v_utm_s, v_utm_m), v_utm_s, v_utm_m, v_utm_c,
            v_ua.device_type, v_ua.browser, v_ua.os,
            exists (select 1 from app.sessions s where s.visitor_id = p_visitor));
  elsif v_sess_visitor <> p_visitor then
    perform app.err('bad_request');
  end if;

  for v_e in select * from jsonb_array_elements(p_events) loop
    select * into v_cat from app.event_catalog where name = v_e ->> 'name' and client_allowed;
    if v_cat.name is null or coalesce(v_e ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_rej := v_rej + 1; continue;
    end if;
    select coalesce(jsonb_object_agg(key, case when jsonb_typeof(value) = 'string' then to_jsonb(left(value #>> '{}', 120)) else value end), '{}'::jsonb)
      into v_props
      from jsonb_each(case when jsonb_typeof(v_e -> 'props') = 'object' then v_e -> 'props' else '{}'::jsonb end)
     where key = any (v_cat.allowed_props) and jsonb_typeof(value) in ('string', 'number', 'boolean');
    v_when := null;
    if coalesce(v_e ->> 'at', '') ~ '^\d{4}-\d{2}-\d{2}T[0-9:.]+(Z|[+-]\d{2}:?\d{2})$' then
      begin v_when := (v_e ->> 'at')::timestamptz; exception when others then v_when := null; end;
    end if;
    if v_when is null or v_when < now() - interval '1 day' or v_when > now() + interval '5 minutes' then v_when := now(); end if;
    insert into app.events (event_id, name, occurred_at, visitor_id, session_id, user_id, path, feature_key, success, props)
    values ((v_e ->> 'id')::uuid, v_cat.name, v_when, p_visitor, p_session, v_uid,
            coalesce(app.clean_text(split_part(v_e ->> 'path', '?', 1), 300), v_path),
            app.feature_for(v_cat.name, v_props),
            case when jsonb_typeof(v_e -> 'success') = 'boolean' then (v_e ->> 'success')::boolean end,
            v_props)
    on conflict (event_id) do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 1 then
      v_acc := v_acc + 1;
      if v_cat.name = 'page_view' then v_pv := v_pv + 1; end if;
    else v_dup := v_dup + 1; end if;
  end loop;

  update app.sessions set last_seen_at = now(), page_views = page_views + v_pv, event_count = event_count + v_acc,
         user_id = coalesce(v_uid, user_id)
   where id = p_session;
  if v_uid is not null then
    update app.profiles set last_seen_at = now() where id = v_uid and (last_seen_at is null or last_seen_at < now() - interval '1 minute');
  end if;
  return jsonb_build_object('accepted', v_acc, 'duplicates', v_dup, 'rejected', v_rej);
end $$;

-- ================================================================ public API: the signed-in user
create or replace function public.me() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := app.require_user(); v jsonb;
begin
  select jsonb_build_object(
      'id', p.id, 'full_name', p.full_name, 'email', p.email, 'email_verified', p.email_verified,
      'avatar_url', p.avatar_url, 'phone', p.phone, 'locale', p.locale,
      'marketing_consent', p.marketing_consent, 'privacy_accepted_at', p.privacy_accepted_at,
      'created_at', p.created_at, 'staff_role', app.caller_role(),
      'requests', (select coalesce(jsonb_agg(jsonb_build_object('ref', c.ref, 'subject', c.subject, 'status', c.status, 'created_at', c.created_at) order by c.created_at desc), '[]'::jsonb)
                     from app.contact_requests c where c.user_id = p.id))
    into v from app.profiles p where p.id = v_uid;
  return v;
end $$;

create or replace function public.update_my_profile(p_full_name text default null, p_phone text default null, p_clear_phone boolean default false,
  p_locale text default null, p_marketing_consent boolean default null, p_accept_privacy boolean default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.require_user(); v_phone text; v_had_phone boolean;
begin
  if not app.hit('profile:' || v_uid, 30, interval '1 hour') then perform app.err('rate_limited'); end if;
  if p_phone is not null and btrim(p_phone) <> '' then
    v_phone := app.normalize_phone(p_phone);
    if v_phone = 'invalid' then perform app.err('invalid_phone'); end if;
  end if;
  if p_locale is not null and p_locale not in ('ar', 'en') then perform app.err('invalid_locale'); end if;
  select phone is not null into v_had_phone from app.profiles where id = v_uid;
  update app.profiles set
    full_name = coalesce(app.clean_line(p_full_name, 120), full_name),
    phone = case when p_clear_phone then null else coalesce(v_phone, phone) end,
    phone_updated_at = case when p_clear_phone or v_phone is not null then now() else phone_updated_at end,
    locale = coalesce(p_locale, locale),
    marketing_consent = coalesce(p_marketing_consent, marketing_consent),
    marketing_consent_at = case when p_marketing_consent is not null then now() else marketing_consent_at end,
    privacy_accepted_at = case when p_accept_privacy then now() else privacy_accepted_at end,
    updated_at = now()
  where id = v_uid;
  if v_phone is not null and not v_had_phone then perform app.server_event('phone_added', v_uid); end if;
  if p_marketing_consent is not null then perform app.server_event('marketing_consent_changed', v_uid, jsonb_build_object('granted', p_marketing_consent)); end if;
  return public.me();
end $$;

create or replace function public.my_data_export() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.require_user(); v jsonb;
begin
  if not app.hit('export:' || v_uid, 5, interval '1 day') then perform app.err('rate_limited'); end if;
  insert into app.data_requests (user_id, kind, status, processed_at) values (v_uid, 'export', 'done', now());
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'google_sub' from app.profiles p where p.id = v_uid),
    'contact_requests', (select coalesce(jsonb_agg(jsonb_build_object('ref', ref, 'subject', subject, 'message', message, 'status', status,
                          'preferred_method', preferred_method, 'created_at', created_at) order by created_at), '[]'::jsonb)
                         from app.contact_requests where user_id = v_uid),
    'emails', (select coalesce(jsonb_agg(jsonb_build_object('template', template, 'subject', subject, 'status', status, 'created_at', created_at) order by created_at), '[]'::jsonb)
               from app.email_messages where user_id = v_uid),
    'activity', (select coalesce(jsonb_agg(jsonb_build_object('event', name, 'at', occurred_at, 'path', path) order by occurred_at), '[]'::jsonb)
                 from (select name, occurred_at, path from app.events where user_id = v_uid order by occurred_at desc limit 5000) e)
  ) into v;
  return v;
end $$;

-- ================================================================ public API: contact form (signed-in users)
create or replace function public.submit_contact(p_full_name text, p_phone text, p_company text, p_reason text, p_subject text,
  p_message text, p_preferred_method text, p_preferred_time text, p_consent boolean, p_client_token uuid, p_path text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.require_user(); p record; v_phone text; v_id uuid; v_ref text; v_existing record; v_reasons jsonb;
begin
  select * into p from app.profiles where id = v_uid;
  if p_client_token is not null then
    select id, ref, status into v_existing from app.contact_requests where user_id = v_uid and client_token = p_client_token;
    if v_existing.id is not null then
      return jsonb_build_object('id', v_existing.id, 'ref', v_existing.ref, 'status', v_existing.status, 'duplicate', true);
    end if;
  end if;
  if not app.hit('contact:' || v_uid, 5, interval '1 hour') then perform app.err('rate_limited'); end if;
  if p_consent is not true then perform app.err('consent_required'); end if;
  if coalesce(char_length(app.clean_line(p_full_name, 200)), 0) < 2 or char_length(app.clean_line(p_full_name, 200)) > 120 then perform app.err('invalid_name'); end if;
  if coalesce(char_length(app.clean_line(p_subject, 400)), 0) < 3 or char_length(app.clean_line(p_subject, 400)) > 150 then perform app.err('invalid_subject'); end if;
  if coalesce(char_length(app.clean_text(p_message, 5000)), 0) < 10 or char_length(app.clean_text(p_message, 5000)) > 4000 then perform app.err('invalid_message'); end if;
  if p_preferred_method not in ('email', 'phone', 'whatsapp') then perform app.err('invalid_method'); end if;
  v_reasons := coalesce(app.setting('contact_reasons'), '[]'::jsonb);
  if not exists (select 1 from jsonb_array_elements(v_reasons) r where r ->> 'key' = p_reason) then perform app.err('invalid_reason'); end if;
  if p_phone is not null and btrim(p_phone) <> '' then
    v_phone := app.normalize_phone(p_phone);
    if v_phone = 'invalid' then perform app.err('invalid_phone'); end if;
  end if;
  v_phone := coalesce(v_phone, p.phone);
  if p_preferred_method in ('phone', 'whatsapp') and v_phone is null then perform app.err('phone_required'); end if;

  v_ref := 'HR-' || to_char(now() at time zone 'Asia/Riyadh', 'YYMM') || '-' || nextval('app.contact_ref_seq');
  insert into app.contact_requests (ref, user_id, client_token, full_name, email, phone, company, reason, subject, message,
                                    preferred_method, preferred_time, consent_at, source_path)
  values (v_ref, v_uid, p_client_token, app.clean_line(p_full_name, 120), p.email, v_phone, app.clean_line(p_company, 120), p_reason,
          app.clean_line(p_subject, 150), app.clean_text(p_message, 4000), p_preferred_method, app.clean_line(p_preferred_time, 80), now(),
          app.clean_text(split_part(p_path, '?', 1), 300))
  returning id into v_id;
  insert into app.contact_status_history (request_id, from_status, to_status, changed_by) values (v_id, null, 'new', v_uid);
  if p.phone is null and v_phone is not null then
    update app.profiles set phone = v_phone, phone_updated_at = now() where id = v_uid;
    perform app.server_event('phone_added', v_uid);
  end if;
  perform app.server_event('contact_submitted', v_uid, jsonb_build_object('reason', p_reason, 'method', p_preferred_method));
  perform app.enqueue_email('contact_confirmation', p.email, v_uid,
    jsonb_build_object('name', app.clean_line(p_full_name, 120), 'ref', v_ref, 'subject', app.clean_line(p_subject, 150)),
    'transactional', v_id, null, null, 'contact_confirmation:' || v_id);
  perform app.enqueue_email('admin_new_contact', coalesce(app.setting('notify_email') #>> '{}', 'hudera.ai@gmail.com'), null,
    jsonb_build_object('ref', v_ref, 'request_id', v_id, 'name', app.clean_line(p_full_name, 120), 'email', p.email, 'phone', v_phone,
                       'reason', p_reason, 'subject', app.clean_line(p_subject, 150), 'method', p_preferred_method),
    'transactional', v_id, null, null, 'admin_new_contact:' || v_id);
  return jsonb_build_object('id', v_id, 'ref', v_ref, 'status', 'new', 'duplicate', false);
end $$;

-- ================================================================ account deletion (called by the account-delete Edge Function with the service role)
create or replace function app.anonymize_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_placeholder text := 'deleted-' || left(p_user::text, 8) || '@deleted.invalid'; v_reqs uuid[]; v_email text;
begin
  select email into v_email from app.profiles where id = p_user;
  select coalesce(array_agg(id), '{}') into v_reqs from app.contact_requests where user_id = p_user;
  update app.contact_requests set full_name = 'Deleted user', email = v_placeholder, phone = null, company = null,
         subject = '[removed]', message = '[removed at the user''s request]', preferred_time = null, updated_at = now()
   where id = any (v_reqs);
  delete from app.contact_notes where request_id = any (v_reqs);
  update app.contact_attempts set notes = null where request_id = any (v_reqs);
  -- the team notification e-mails about those requests carry name / e-mail / phone in their data
  update app.email_messages set data = jsonb_build_object('ref', data ->> 'ref', 'request_id', data ->> 'request_id'), subject = '[removed]', body_text = null
   where related_request_id = any (v_reqs) and user_id is null;
  update app.email_messages set to_email = v_placeholder, data = '{}'::jsonb, body_text = null, subject = '[removed]' where user_id = p_user;
  update app.audit_log set details = details - 'email' where target_id = p_user::text or details ->> 'email' = v_email;
  update app.events set user_id = null where user_id = p_user;
  update app.sessions set user_id = null where user_id = p_user;
  update app.visitors set user_id = null where user_id = p_user;
  insert into app.data_requests (user_id, kind, status, processed_at) values (null, 'delete', 'done', now());
  insert into app.audit_log (actor_id, action, target_type, target_id, details) values (null, 'account.deleted_by_user', 'user', p_user::text, '{}'::jsonb);
  -- the profile row itself is removed when the auth user is deleted (on delete cascade); until then the
  -- account stays usable so a failed deletion can simply be retried
  update app.profiles set full_name = null, phone = null, avatar_url = null, marketing_consent = false where id = p_user;
end $$;

-- ================================================================ data retention (run daily by pg_cron, see docs)
create or replace function app.purge_analytics() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_days integer := coalesce((app.setting('analytics_retention_days') #>> '{}')::integer, 395); v_e integer; v_s integer; v_v integer;
begin
  delete from app.events where occurred_at < now() - make_interval(days => v_days) and source = 'client';
  get diagnostics v_e = row_count;
  delete from app.sessions s where s.last_seen_at < now() - make_interval(days => v_days)
     and not exists (select 1 from app.events e where e.session_id = s.id);
  get diagnostics v_s = row_count;
  delete from app.visitors v where v.last_seen_at < now() - make_interval(days => v_days) and v.user_id is null
     and not exists (select 1 from app.sessions s where s.visitor_id = v.id);
  get diagnostics v_v = row_count;
  delete from app.rate_limits where window_start < now() - interval '2 days';
  return jsonb_build_object('events', v_e, 'sessions', v_s, 'visitors', v_v, 'retention_days', v_days);
end $$;

-- ================================================================ grants
revoke all on all functions in schema app from public, anon, authenticated;
grant execute on all functions in schema app to service_role;
revoke all on function public.site_config(), public.track(uuid, uuid, jsonb, jsonb), public.me(),
  public.update_my_profile(text, text, boolean, text, boolean, boolean), public.my_data_export(),
  public.submit_contact(text, text, text, text, text, text, text, text, boolean, uuid, text) from public;
grant execute on function public.site_config(), public.track(uuid, uuid, jsonb, jsonb) to anon, authenticated;
grant execute on function public.me(), public.update_my_profile(text, text, boolean, text, boolean, boolean), public.my_data_export(),
  public.submit_contact(text, text, text, text, text, text, text, text, boolean, uuid, text) to authenticated;
revoke execute on function public.me(), public.update_my_profile(text, text, boolean, text, boolean, boolean), public.my_data_export(),
  public.submit_contact(text, text, text, text, text, text, text, text, boolean, uuid, text) from anon;
