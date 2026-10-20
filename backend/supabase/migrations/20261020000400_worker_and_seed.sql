-- HUDERA AI platform · 0004 · email-worker API (service role only), default settings, event catalog, feature registry

create or replace function app.require_service() returns void
language plpgsql stable set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

-- claim due emails (and recover ones stuck in "sending" for 10+ minutes)
create or replace function public.worker_claim_emails(p_limit integer default 20) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  perform app.require_service();
  update app.email_messages set status = case when attempts >= max_attempts then 'failed'::app.email_status else 'queued'::app.email_status end,
         updated_at = now(), last_error = coalesce(last_error, 'no result from the worker after 10 minutes')
   where status = 'sending' and updated_at < now() - interval '10 minutes';
  with due as (
    select id from app.email_messages where status = 'queued' and next_attempt_at <= now()
     order by next_attempt_at limit least(greatest(coalesce(p_limit, 20), 1), 100) for update skip locked),
  claimed as (
    update app.email_messages m set status = 'sending', attempts = m.attempts + 1, updated_at = now()
      from due where m.id = due.id returning m.*)
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'to_email', to_email, 'template', template, 'category', category, 'data', data,
           'subject', subject, 'body_text', body_text, 'attempts', attempts, 'idem', 'hudera-' || id || '-' || max_attempts, 'max_attempts', max_attempts, 'user_id', user_id,
           'site_name', coalesce(app.setting('site_name') #>> '{}', 'HUDERA AI'))), '[]'::jsonb) into v from claimed;
  return v;
end $$;

-- p_result: 'sent' | 'retry' | 'failed'
create or replace function public.worker_complete_email(p_id uuid, p_result text, p_provider_id text default null, p_error text default null,
  p_retry_in_seconds integer default 60, p_subject text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare m app.email_messages;
begin
  perform app.require_service();
  select * into m from app.email_messages where id = p_id for update;
  if m.id is null or m.status <> 'sending' then return; end if;   -- only the worker run that claimed it may complete it
  if p_result = 'sent' then
    update app.email_messages set status = 'sent', sent_at = now(), provider_message_id = p_provider_id, last_error = null,
           subject = coalesce(subject, left(p_subject, 200)), updated_at = now() where id = p_id;
  elsif p_result = 'retry' and m.attempts < m.max_attempts then
    update app.email_messages set status = 'queued', last_error = left(p_error, 500),
           next_attempt_at = now() + make_interval(secs => least(greatest(coalesce(p_retry_in_seconds, 60), 30), 21600)), updated_at = now() where id = p_id;
  else
    update app.email_messages set status = 'failed', last_error = left(coalesce(p_error, 'failed'), 500), updated_at = now() where id = p_id;
  end if;
end $$;

-- delivery webhooks. Status only moves forward: a late "sent" never overwrites "delivered".
create or replace function public.worker_email_event(p_provider_message_id text, p_event_id text, p_type text, p_detail text default null, p_at timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m app.email_messages; v_new app.email_status; v_rank_old integer; v_rank_new integer;
begin
  perform app.require_service();
  select * into m from app.email_messages where provider_message_id = p_provider_message_id for update;
  if m.id is null then return jsonb_build_object('matched', false, 'recent', coalesce(p_at, now()) > now() - interval '30 minutes'); end if;
  insert into app.email_events (email_id, provider_event_id, type, detail, occurred_at)
  values (m.id, p_event_id, p_type, left(p_detail, 300), coalesce(p_at, now()))
  on conflict (provider_event_id) do nothing;
  if not found then return jsonb_build_object('matched', true, 'duplicate', true); end if;
  v_new := case p_type when 'email.sent' then 'sent' when 'email.delivered' then 'delivered' when 'email.delivery_delayed' then 'delivery_delayed'
                       when 'email.bounced' then 'bounced' when 'email.complained' then 'complained' when 'email.failed' then 'failed' end;
  if v_new is null then return jsonb_build_object('matched', true, 'ignored', p_type); end if;
  v_rank_old := array_position(array['queued', 'sending', 'sent', 'delivery_delayed', 'delivered', 'failed', 'bounced', 'complained']::text[], m.status::text);
  v_rank_new := array_position(array['queued', 'sending', 'sent', 'delivery_delayed', 'delivered', 'failed', 'bounced', 'complained']::text[], v_new::text);
  if v_rank_new > coalesce(v_rank_old, 0) then
    update app.email_messages set status = v_new, updated_at = now(),
           delivered_at = case when v_new = 'delivered' then coalesce(p_at, now()) else delivered_at end,
           last_error = case when v_new in ('bounced', 'complained', 'failed') then left(coalesce(p_detail, p_type), 500) else last_error end
     where id = m.id;
  end if;
  return jsonb_build_object('matched', true, 'status', v_new);
end $$;

create or replace function public.worker_heartbeat(p_status jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_service();
  insert into app.settings (key, value, updated_at) values ('email_worker_status', coalesce(p_status, '{}'::jsonb) || jsonb_build_object('at', now()), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

create or replace function public.worker_anonymize_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_service();
  perform app.anonymize_user(p_user);
end $$;

create or replace function public.worker_is_staff(p_user uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_service();
  return exists (select 1 from app.staff_roles r join app.profiles p on p.id = r.user_id where r.user_id = p_user and p.status = 'active' and r.role in ('owner', 'admin', 'support'));
end $$;

create or replace function public.worker_purge_analytics() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_service();
  return app.purge_analytics();
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'worker\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
revoke all on function app.require_service() from public, anon, authenticated;
grant execute on function app.require_service() to service_role;

-- ================================================================ default settings
insert into app.settings (key, value) values
  ('site_name', '"HUDERA AI"'),
  ('notify_email', '"hudera.ai@gmail.com"'),
  ('analytics_retention_days', '395'),
  ('inactivity_days', '30'),
  ('privacy', '{"require_analytics_consent": true, "tracking_enabled": true, "policy_version": "2026-10", "policy_url": "https://hudera-ai.github.io/privacy.html"}'),
  ('welcome_email', '{"enabled": true}'),
  ('branding', '{"primary_color": "#3D5AFE"}'),
  ('contact_status_labels', '{"new": "New", "pending": "Pending", "contacted": "Contacted", "in_progress": "In progress", "resolved": "Resolved", "closed": "Closed"}'),
  ('contact_reasons', '[
     {"key": "ai_employee", "en": "An AI employee (HR, collections, sales)", "ar": "موظف ذكاء اصطناعي (موارد بشرية، تحصيل، مبيعات)"},
     {"key": "contractor_os", "en": "Contractor OS for my company", "ar": "Contractor OS لشركتي"},
     {"key": "whatsapp", "en": "WhatsApp assistant", "ar": "مساعد واتساب"},
     {"key": "custom_system", "en": "A custom system or dashboard", "ar": "نظام أو لوحة مؤشرات مخصصة"},
     {"key": "pricing", "en": "Pricing", "ar": "الأسعار"},
     {"key": "partnership", "en": "Partnership", "ar": "شراكة"},
     {"key": "other", "en": "Something else", "ar": "موضوع آخر"}]')
on conflict (key) do nothing;

-- ================================================================ event catalog (what the site may send)
insert into app.event_catalog (name, description, category, allowed_props, is_important, client_allowed) values
  ('page_view',           'A page or in-page product view was shown',            'navigation', '{title,lang}', false, true),
  ('section_view',        'A homepage section scrolled into view',               'navigation', '{section}', false, true),
  ('platform_opened',     'Opened a live platform demo (Workforce, Contractor OS)', 'demo',    '{platform,mode}', true, true),
  ('demo_opened',         'Opened a product demo page',                          'demo',       '{product}', false, true),
  ('system_opened',       'Opened one of the focused systems',                   'demo',       '{system}', false, true),
  ('github_clicked',      'Clicked a GitHub repository link',                    'outbound',   '{repo}', false, true),
  ('roi_calculated',      'Used the AI-employee value calculator',               'tool',       '{requests,minutes,share,cost}', true, true),
  ('faq_opened',          'Opened a FAQ answer',                                 'content',    '{question}', false, true),
  ('whatsapp_clicked',    'Clicked a WhatsApp link',                             'contact',    '{placement}', true, true),
  ('contact_started',     'Started filling the contact form',                    'contact',    '{}', false, true),
  ('contact_failed',      'The contact form could not be submitted',             'contact',    '{code}', false, true),
  ('sign_in_started',     'Clicked “Sign in with Google”',                       'account',    '{placement}', false, true),
  ('logout',              'Signed out',                                          'account',    '{}', false, true),
  ('profile_opened',      'Opened the account panel',                            'account',    '{}', false, true),
  ('language_changed',    'Switched the site language',                          'preference', '{lang}', false, true),
  ('theme_changed',       'Switched light / dark theme',                         'preference', '{theme}', false, true),
  ('client_error',        'An error the visitor saw',                            'error',      '{code,where}', false, true),
  ('user_registered',     'Created an account with Google (server)',             'account',    '{provider}', true, false),
  ('login',               'Signed in (server)',                                  'account',    '{}', false, false),
  ('phone_added',         'Added a phone number (server)',                       'account',    '{}', true, false),
  ('contact_submitted',   'Submitted a contact request (server)',                'contact',    '{reason,method}', true, false),
  ('marketing_consent_changed', 'Changed e-mail announcement consent (server)',  'account',    '{granted}', false, false)
on conflict (name) do nothing;

insert into app.features (key, name, description, category, eligibility, match_event, match_prop, match_value, sort) values
  ('workforce_demo',   'HUDERA Workforce demo',       'Opened the AI-employees platform demo',           'Platforms', 'everyone',   'platform_opened', 'platform', 'workforce', 10),
  ('contractor_demo',  'Contractor OS demo',          'Opened the construction platform demo',           'Platforms', 'everyone',   'platform_opened', 'platform', 'contractor-os', 11),
  ('product_demos',    'Product demos',               'Opened any product demo page',                    'Demos',     'everyone',   'demo_opened', null, null, 20),
  ('focused_systems',  'Focused systems',             'Opened SiteLog, QuoteFlow or Attendify',          'Demos',     'everyone',   'system_opened', null, null, 21),
  ('roi_calculator',   'Value calculator',            'Moved the sliders of the AI-employee calculator', 'Tools',     'everyone',   'roi_calculated', null, null, 30),
  ('faq',              'FAQ',                         'Opened a question in the FAQ',                    'Content',   'everyone',   'faq_opened', null, null, 40),
  ('github',           'GitHub links',                'Opened a repository on GitHub',                   'Content',   'everyone',   'github_clicked', null, null, 41),
  ('whatsapp',         'WhatsApp contact',            'Clicked any WhatsApp link',                       'Contact',   'everyone',   'whatsapp_clicked', null, null, 50),
  ('contact_form',     'Contact request',             'Submitted the contact form',                      'Contact',   'registered', 'contact_submitted', null, null, 51),
  ('google_sign_in',   'Google sign-in',              'Signed in with Google',                           'Account',   'everyone',   'login', null, null, 60),
  ('phone_number',     'Phone number on file',        'Added a phone number',                            'Account',   'registered', 'phone_added', null, null, 61),
  ('language_switch',  'Language switch',             'Switched between Arabic and English',             'Preferences', 'everyone', 'language_changed', null, null, 70),
  ('dark_mode',        'Theme switch',                'Switched light / dark theme',                     'Preferences', 'everyone', 'theme_changed', null, null, 71)
on conflict (key) do nothing;

-- ================================================================ scheduled jobs (only when pg_cron is enabled in the project)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('hudera-purge-analytics', '17 3 * * *', 'select app.purge_analytics()');
  end if;
exception when others then raise notice 'pg_cron schedule skipped: %', sqlerrm;
end $$;
