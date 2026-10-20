-- HUDERA AI platform · 0001 · core schema
-- All tables live in the private schema "app", which the REST API does not expose.
-- The browser only reaches data through the functions in "public" (migrations 0002–0004),
-- each of which checks who is calling. RLS is enabled on every table as a second line of defence.

create schema if not exists app;
revoke all on schema app from public, anon, authenticated;
grant usage on schema app to service_role;

create type app.account_status as enum ('active', 'suspended', 'deleted');
create type app.staff_role     as enum ('owner', 'admin', 'support', 'analyst');
create type app.contact_status as enum ('new', 'pending', 'contacted', 'in_progress', 'resolved', 'closed');
create type app.email_status   as enum ('queued', 'sending', 'sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'failed', 'cancelled');

-- ---------------------------------------------------------------- people
create table app.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  google_sub          text unique,                          -- Google's stable account id ("sub")
  auth_provider       text not null default 'google',
  full_name           text check (char_length(full_name) <= 120),
  email               text not null check (char_length(email) <= 254),
  email_verified      boolean not null default false,
  avatar_url          text check (char_length(avatar_url) <= 500),
  phone               text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  phone_updated_at    timestamptz,
  locale              text check (locale in ('ar', 'en')),
  status              app.account_status not null default 'active',
  marketing_consent   boolean not null default false,
  marketing_consent_at timestamptz,
  privacy_accepted_at timestamptz,
  login_count         integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  last_login_at       timestamptz,
  last_seen_at        timestamptz,
  deleted_at          timestamptz
);
create index profiles_email_idx      on app.profiles (lower(email));
create index profiles_created_idx    on app.profiles (created_at desc);
create index profiles_last_seen_idx  on app.profiles (last_seen_at desc nulls last);
create index profiles_name_idx  on app.profiles (lower(full_name));

create table app.staff_roles (
  user_id    uuid primary key references app.profiles (id) on delete cascade,
  role       app.staff_role not null,
  granted_by uuid references app.profiles (id) on delete set null,
  granted_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- analytics
-- A visitor is one browser (a random id kept in localStorage after consent). It is not a person.
create table app.visitors (
  id                    uuid primary key,
  user_id               uuid references app.profiles (id) on delete set null,
  first_seen_at         timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  first_referrer_domain text,
  first_utm_source      text,
  device_type           text,
  browser               text,
  os                    text
);
create index visitors_user_idx       on app.visitors (user_id);
create index visitors_first_seen_idx on app.visitors (first_seen_at);

-- A session ends after 30 minutes without activity (decided in the browser, validated here).
create table app.sessions (
  id              uuid primary key,
  visitor_id      uuid not null references app.visitors (id) on delete cascade,
  user_id         uuid references app.profiles (id) on delete set null,
  started_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  landing_path    text,
  referrer_domain text,
  source          text not null default 'direct',   -- direct | search | social | referral | campaign
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  device_type     text,
  browser         text,
  os              text,
  is_returning    boolean not null default false,
  page_views      integer not null default 0,
  event_count     integer not null default 0
);
create index sessions_started_idx on app.sessions (started_at);
create index sessions_user_idx    on app.sessions (user_id, started_at desc);
create index sessions_visitor_idx on app.sessions (visitor_id, started_at);

-- Which events the site may send and which properties each may carry (anything else is dropped).
create table app.event_catalog (
  name          text primary key check (name ~ '^[a-z][a-z0-9_]{1,48}$'),
  description   text not null,
  category      text not null default 'interaction',
  allowed_props text[] not null default '{}',
  is_important  boolean not null default false,   -- counted as an "important action"
  client_allowed boolean not null default true,   -- false = only the server may record it
  created_at    timestamptz not null default now()
);

-- Feature registry: a feature is matched from an event name and, optionally, one property value.
create table app.features (
  key           text primary key check (key ~ '^[a-z][a-z0-9_]{1,48}$'),
  name          text not null,
  description   text,
  category      text not null default 'general',
  eligibility   text not null default 'everyone' check (eligibility in ('everyone', 'registered')),
  match_event   text not null references app.event_catalog (name),
  match_prop    text,
  match_value   text,
  active        boolean not null default true,
  sort          integer not null default 100,
  tracking_since timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  check ((match_prop is null) = (match_value is null))
);

create table app.events (
  id          bigint generated always as identity primary key,
  event_id    uuid not null unique,                     -- generated in the browser; duplicates are ignored
  name        text not null references app.event_catalog (name),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  visitor_id  uuid references app.visitors (id) on delete cascade,
  session_id  uuid references app.sessions (id) on delete cascade,
  user_id     uuid references app.profiles (id) on delete set null,
  path        text,
  feature_key text references app.features (key) on update cascade on delete set null,
  success     boolean,
  source      text not null default 'client' check (source in ('client', 'server')),
  props       jsonb not null default '{}'::jsonb
);
create index events_time_idx     on app.events (occurred_at);
create index events_user_idx     on app.events (user_id, occurred_at desc) where user_id is not null;
create index events_feature_idx  on app.events (feature_key, occurred_at) where feature_key is not null;
create index events_name_idx     on app.events (name, occurred_at);
create index events_session_idx  on app.events (session_id);

-- ---------------------------------------------------------------- contact requests / leads
create sequence app.contact_ref_seq start 1001;
create table app.contact_requests (
  id               uuid primary key default gen_random_uuid(),
  ref              text not null unique,
  user_id          uuid references app.profiles (id) on delete set null,
  client_token     uuid,
  full_name        text not null check (char_length(full_name) between 2 and 120),
  email            text not null check (char_length(email) <= 254),
  phone            text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  company          text check (char_length(company) <= 120),
  reason           text not null check (char_length(reason) <= 60),
  subject          text not null check (char_length(subject) between 3 and 150),
  message          text not null check (char_length(message) between 10 and 4000),
  preferred_method text not null check (preferred_method in ('email', 'phone', 'whatsapp')),
  preferred_time   text check (char_length(preferred_time) <= 80),
  consent_at       timestamptz not null,
  status           app.contact_status not null default 'new',
  assigned_to      uuid references app.profiles (id) on delete set null,
  follow_up_at     timestamptz,
  source_path      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  first_response_at timestamptz,
  closed_at        timestamptz,
  unique (user_id, client_token)
);
create index contacts_created_idx on app.contact_requests (created_at desc);
create index contacts_status_idx  on app.contact_requests (status, created_at desc);
create index contacts_user_idx    on app.contact_requests (user_id, created_at desc);
create index contacts_follow_idx  on app.contact_requests (follow_up_at) where follow_up_at is not null;

create table app.contact_notes (
  id         bigint generated always as identity primary key,
  request_id uuid not null references app.contact_requests (id) on delete cascade,
  author_id  uuid references app.profiles (id) on delete set null,
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index contact_notes_req_idx on app.contact_notes (request_id, created_at);

create table app.contact_attempts (
  id           bigint generated always as identity primary key,
  request_id   uuid not null references app.contact_requests (id) on delete cascade,
  channel      text not null check (channel in ('email', 'phone', 'whatsapp', 'meeting', 'other')),
  outcome      text not null check (outcome in ('reached', 'no_answer', 'left_message', 'email_sent', 'wrong_number', 'scheduled', 'other')),
  notes        text check (char_length(notes) <= 2000),
  email_id     uuid,
  attempted_at timestamptz not null default now(),
  by_user      uuid references app.profiles (id) on delete set null
);
create index contact_attempts_req_idx on app.contact_attempts (request_id, attempted_at);

create table app.contact_status_history (
  id         bigint generated always as identity primary key,
  request_id uuid not null references app.contact_requests (id) on delete cascade,
  from_status app.contact_status,
  to_status  app.contact_status not null,
  changed_by uuid references app.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index contact_hist_req_idx on app.contact_status_history (request_id, changed_at);

-- ---------------------------------------------------------------- email
create table app.email_messages (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references app.profiles (id) on delete set null,
  to_email            text not null check (char_length(to_email) <= 254),
  template            text not null check (template in ('welcome', 'contact_confirmation', 'admin_new_contact', 'follow_up', 'account_notice', 'announcement')),
  category            text not null default 'transactional' check (category in ('transactional', 'follow_up', 'announcement')),
  data                jsonb not null default '{}'::jsonb,   -- template variables (no secrets)
  subject             text check (char_length(subject) <= 200),
  body_text           text check (char_length(body_text) <= 10000),
  status              app.email_status not null default 'queued',
  provider            text not null default 'resend',
  provider_message_id text unique,
  attempts            integer not null default 0,
  max_attempts        integer not null default 5,
  next_attempt_at     timestamptz not null default now(),
  last_error          text,
  related_request_id  uuid references app.contact_requests (id) on delete set null,
  idempotency_key     text unique,
  created_by          uuid references app.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  sent_at             timestamptz,
  delivered_at        timestamptz
);
create index email_queue_idx on app.email_messages (next_attempt_at) where status = 'queued';
create index email_user_idx  on app.email_messages (user_id, created_at desc);
create index email_req_idx   on app.email_messages (related_request_id);

create table app.email_events (
  id                bigint generated always as identity primary key,
  email_id          uuid references app.email_messages (id) on delete cascade,
  provider_event_id text unique,
  type              text not null,
  detail            text,
  occurred_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------- admin
create table app.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references app.profiles (id) on delete set null,
  action      text not null,
  target_type text,
  target_id   text,
  details     jsonb not null default '{}'::jsonb,
  at          timestamptz not null default now()
);
create index audit_at_idx    on app.audit_log (at desc);
create index audit_actor_idx on app.audit_log (actor_id, at desc);

-- Non-secret settings only. API keys live in Supabase secrets (Edge Function env), never here.
create table app.settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references app.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table app.data_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references app.profiles (id) on delete set null,
  kind         text not null check (kind in ('export', 'delete')),
  status       text not null default 'done' check (status in ('pending', 'done', 'rejected')),
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);

create table app.rate_limits (
  bucket       text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (bucket, window_start)
);

-- ---------------------------------------------------------------- RLS on everything, no policies:
-- the anon/authenticated roles cannot touch these tables directly even if the schema were exposed.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'app' loop
    execute format('alter table app.%I enable row level security', t);
    execute format('revoke all on app.%I from public, anon, authenticated', t);
    execute format('grant all on app.%I to service_role', t);
  end loop;
end $$;
grant usage, select on all sequences in schema app to service_role;
