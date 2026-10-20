# HUDERA AI platform: backend, analytics, Google sign-in and admin dashboard

This adds a backend to the static portfolio at **hudera-ai.github.io** and keeps the site's existing design, routes and demos. It covers Google sign-in, analytics that run only after the visitor consents, contact requests and lead management, e-mail, and a protected admin dashboard at **/admin/**.

> **Status:** the code is complete and tested against a local copy of the stack (results below). It isn't live yet because it needs **your** Supabase, Google Cloud and Resend accounts; see [Go-live checklist](#go-live-checklist). Until `src/config.json` holds a Supabase project, the site behaves exactly as before (WhatsApp brief form, no analytics) and `/admin/` says the backend is not connected.

---

## 1. What was built

| Area | What it does |
|---|---|
| **Google sign-in** | Supabase Auth with the Google provider and the PKCE flow. Google is the only way to register. A profile row is created automatically with the Google `sub` (stable id), name, verified-e-mail flag and photo. Visitors can browse every public page without signing in. Sign-in is required only to send a contact request. |
| **Phone (optional)** | Asked for separately, after sign-up (dismissable prompt) or in the contact form. Registration never requires it. Saudi `05…` and Egyptian `01…` numbers are normalised to E.164. Without a phone, the verified e-mail is the contact channel. |
| **Account panel** | Users can edit their phone, opt in or out of news e-mails, see their requests and statuses, download their data (JSON) and delete their account. Deletion erases their personal details from their requests. |
| **Consent + analytics** | A consent banner appears before any analytics. Events wait in memory and are sent only if the visitor accepts. Each event carries a random browser id, a 30-minute session and a client-generated event id, so duplicates are ignored. Requests are batched with `keepalive`. Errors never block the page. Bots are filtered on the server. |
| **Event catalog** | The server accepts only events listed in `app.event_catalog` and only their allowed properties; anything else is dropped. Server-only events (`user_registered`, `login`, `contact_submitted`, `phone_added`, `marketing_consent_changed`) can't be sent from the browser. |
| **Feature registry** | `app.features` maps an event (plus an optional property value) to a feature. Admins can add or edit features from **Settings → Tracking** with no code change, and past matching events are back-filled. |
| **Contact requests** | Signed-in users only. Inputs are validated and sanitised on the server, consent is required, double-submits are prevented with an idempotency token, and there is a rate limit of 5 per hour. Each request gets a reference like `HR-2610-1001`. The user receives a confirmation e-mail and the team a notification e-mail. |
| **Lead management** | Statuses: new, pending, contacted, in progress, resolved, closed. Requests can be assigned to a team member and given a follow-up date (with an overdue filter). The dashboard keeps internal notes (never shown to users), contact attempts and status history, plus the e-mails tied to each request. |
| **E-mail** | Resend through a queue table and the `email-worker` Edge Function. Temporary failures (429/5xx/network) retry with exponential back-off; permanent ones are marked failed and can be retried by an admin. Delivery status comes from signed Resend webhooks: queued → sending → sent → delivered / delayed / bounced / complained / failed. Nothing shows "delivered" unless Resend reports it. |
| **Admin dashboard** | `/admin/` in Arabic or English, light or dark, desktop or mobile. Pages: Overview, Users, User profile + timeline, Leads, Lead detail, Features, Feature detail, E-mails, Settings (general, privacy, e-mail service status, contact reasons/labels, team & roles, tracking), and Audit log. |
| **Security** | Server-side role checks on every admin function. Tables sit in a private schema the API doesn't expose, with RLS on every table. Sensitive admin actions are written to the audit log. The first owner can only be created from SQL. Secrets live only in Supabase secrets. |

## 2. Architecture

```
Browser (GitHub Pages: index.html, admin/index.html, privacy.html)
   │  supabase-js (PKCE Google sign-in) + plain fetch for analytics
   ▼
Supabase project
   ├─ Auth (Google provider) ──trigger──▶ app.profiles            (on sign-up / sign-in)
   ├─ PostgREST  /rest/v1/rpc/*  ──▶ public.* SECURITY DEFINER functions ──▶ schema "app" (private)
   ├─ Edge Functions
   │    email-worker   (queue → Resend; called by pg_cron every minute and by staff)
   │    email-webhook  (Resend → delivery status, Svix signature checked)
   │    account-delete (user deletes own account: anonymise → auth.admin delete)
   └─ pg_cron: email-worker every minute · app.purge_analytics() daily
Resend (verified sending domain) · Google Cloud (OAuth client)
```

The website never reads tables directly: the `app` schema isn't exposed by the REST API, and every call goes through a `public.*` function that checks `auth.uid()` and, for admin functions, the caller's staff role.

### Database schema (`app` schema)

| Table | Purpose · key columns |
|---|---|
| `profiles` | one per Google account: `id` (= auth.users.id), `google_sub` (unique), `full_name`, `email`, `email_verified`, `avatar_url`, `phone` (E.164, optional), `status` (active/suspended/deleted), `marketing_consent`, `login_count`, `created_at`, `last_login_at`, `last_seen_at` |
| `staff_roles` | `user_id`, `role` (owner/admin/support/analyst), `granted_by`, `granted_at` |
| `visitors` | one per consenting browser: first/last seen, first referrer, device, browser, os, linked `user_id` |
| `sessions` | `visitor_id`, `user_id`, start/last seen, landing path, referrer domain, source (direct/search/social/referral/campaign), UTM, device, `is_returning`, page views, event count |
| `events` | `event_id` (unique, dedupe), `name` → catalog, `occurred_at`, visitor/session/user, `path`, `feature_key`, `success`, `source` (client/server), `props` (whitelisted) |
| `event_catalog` | allowed event names, allowed props, `is_important`, `client_allowed` |
| `features` | registry: `key`, `name`, `category`, `eligibility` (everyone/registered), `match_event`, `match_prop`, `match_value`, `tracking_since`, `active` |
| `contact_requests` | `ref`, `user_id`, name, e-mail, phone, company, reason, subject, message, preferred method/time, `consent_at`, `status`, `assigned_to`, `follow_up_at`, `first_response_at`, `closed_at` |
| `contact_notes` · `contact_attempts` · `contact_status_history` | internal notes, call/WhatsApp/e-mail attempts with outcome, every status change |
| `email_messages` · `email_events` | queue + history (status, attempts, next attempt, provider id, last error) and webhook events |
| `audit_log` | actor, action, target, details for exports, role/status/setting changes, lead updates, e-mails queued/retried |
| `settings` | non-secret settings only (site name, notification e-mail, retention, inactivity days, privacy switches, contact reasons, status labels) |
| `data_requests` · `rate_limits` | export/delete log · fixed-window rate limiter |

Indexes cover every dashboard filter: time on events, sessions and profiles; user + time; feature + time; name + time; lead status + time; follow-up date; the e-mail queue.

## 3. Migrations (in `supabase/migrations`, apply in order)

| File | Contents |
|---|---|
| `20261020000100_core_schema.sql` | `app` schema, enums, all tables, indexes, RLS on, privileges revoked |
| `20261020000200_helpers_auth_tracking.sql` | helpers (permissions, rate limit, phone normalisation, UA parsing, source classification), **auth.users triggers** (profile + server events + welcome e-mail), `public.site_config`, `public.track`, `public.me`, `public.update_my_profile`, `public.my_data_export`, `public.submit_contact`, anonymisation, retention purge |
| `20261020000300_admin_api.sql` | all `public.admin_*` functions (overview, users, export, profile, timeline, status, leads, notes, attempts, features, event catalog, e-mail send/list/retry/cancel, settings, team, audit) + `app.bootstrap_owner` |
| `20261020000400_worker_and_seed.sql` | `public.worker_*` (service role only), default settings, event catalog, feature registry, daily purge schedule if pg_cron is on |

All four have been applied and tested on PostgreSQL 16 with the local Supabase shim (`local/00_supabase_shim.sql`; **never run the shim on a real project**). They haven't been applied to a real Supabase project yet because none exists.

## 4. Authentication & authorisation

- **Sign-in:** `supabase.auth.signInWithOAuth({ provider: 'google' })` with `flowType: 'pkce'`. Google tokens stay with Supabase Auth; we store none. Sessions are Supabase JWTs and refresh automatically.
- **Profile sync:** the `hudera_on_auth_user_created` and `hudera_on_auth_user_updated` triggers on `auth.users` create and update `app.profiles` and record `user_registered` and `login` on the server.
- **Roles** (`app.staff_roles`, checked in `app.has_perm`):

| Permission | owner | admin | support | analyst |
|---|:-:|:-:|:-:|:-:|
| analytics / features view | ✓ | ✓ | ✓ | ✓ |
| users view, leads view & manage, send e-mail | ✓ | ✓ | ✓ | – |
| export users, suspend users, settings, audit log | ✓ | ✓ | – | – |
| manage roles | ✓ | – | – | – |

- E-mail/password sign-up is switched off (`config.toml`), and roles can only be given to verified Google accounts, matched unambiguously. Profile facts (verified e-mail, Google id, photo) come from `email_confirmed_at`, `raw_app_meta_data` and `auth.identities`, never from user-editable metadata.
- No endpoint lets anyone grant themselves a role. The first owner is created with `select app.bootstrap_owner('email')` in the SQL editor; it refuses to run once an owner exists, and the API can't call it. The last owner can't be removed.
- Users can only reach their own data (`me`, `update_my_profile`, `my_data_export`, `submit_contact`). Internal notes and other people's requests are never returned to them.
- Rate limits: tracking 600 events / 10 min per browser, 1,500 per network address, 60 new browsers per address per hour, 30,000 per minute overall; contact 5 / hour; profile edits 30 / hour; data export 5 / day; admin e-mails 60 / hour; user export 20 / hour.
- CSRF: the API uses bearer tokens in headers, not cookies, so there's no ambient credential to forge. CORS on Edge Functions is restricted to `ALLOWED_ORIGINS`.
- Errors come back as short codes (`phone_required`, `forbidden`, …) without internal details.

## 5. Admin dashboard routes

| Route | Shows |
|---|---|
| `/admin/#/overview` | KPI cards (registered users, visitors in range and all time, sessions, page views, active today / 7d / 30d, new today / 7d / month, contacts total / waiting / open, returning visitors, signed-in vs anonymous sessions, registration rate), charts (visitors & sessions per day, registrations, daily active users, monthly active, feature usage, engagement, contact trend, requests by status), top pages, sources, referrers, devices, browsers, weekly retention cohorts. Date range presets and custom range, Riyadh time. |
| `/admin/#/users` · `/users/<id>` | Search (name / e-mail / phone), filters (registration date, active / inactive, account status, has phone), sort, pagination, CSV export (audited, Excel-safe). Profile: account facts, verified e-mail, phone + WhatsApp link, sessions, pages, feature matrix (used / not used / unknown), requests, e-mails, chronological timeline with "load more", send e-mail, suspend / reactivate. |
| `/admin/#/leads` · `/leads/<id>` | Status counts, search, status / assignee / overdue filters. Detail: message, contact facts, status, assignee, follow-up, internal notes, attempts log, status history, related e-mails, other requests by the same person, send e-mail. |
| `/admin/#/features` · `/features/<key>` | Adoption report (uses, users, visitors, adoption % of eligible users, last used, trend). Detail: daily chart, property breakdown, who used it, eligible users who haven't. |
| `/admin/#/emails` | Every e-mail with real provider status, attempts, errors, next retry; retry / cancel; "Send queued now". |
| `/admin/#/settings` | Site name, notification e-mail, inactivity threshold, analytics retention, privacy switches, welcome e-mail, contact reasons, status labels, e-mail service status (never shows keys), team & roles, event catalog, add / edit features. |
| `/admin/#/audit` | Audit log. |

**Metric definitions** (also shown on the dashboard): a *visitor* is one browser that allowed analytics, not a person; a *session* ends after 30 minutes without activity; *page views* are `page_view` events; a *user* is a registered Google account; *active user* means a registered user with any event in the period; *inactive* means no activity for N days (a setting), which is different from a suspended or deleted account. A feature counts as *not used* only if tracking was live while that user was active; otherwise it shows *unknown*.

## 6. Events tracked

Sent from the browser (after consent):

| Event | Props | Feature |
|---|---|---|
| `page_view` | title, lang | – |
| `section_view` | section | – |
| `platform_opened` | platform, mode | workforce_demo / contractor_demo |
| `demo_opened` | product | product_demos |
| `system_opened` | system | focused_systems |
| `roi_calculated` | requests, minutes, share, cost | roi_calculator |
| `faq_opened` | question | faq |
| `whatsapp_clicked` | placement | whatsapp |
| `github_clicked` | repo | github |
| `contact_started` | – | – |
| `contact_failed` | code | – |
| `sign_in_started` | placement | – |
| `logout` | – | – |
| `profile_opened` | – | – |
| `language_changed` | lang | language_switch |
| `theme_changed` | theme | dark_mode |
| `client_error` | code, where | – |

Recorded by the server: `user_registered`, `login` (google_sign_in), `phone_added` (phone_number), `contact_submitted` (contact_form), `marketing_consent_changed`.

To track something new in the site's code, call `HP.track('event_name', { prop: 'value' })`, add the event in **Settings → Tracking** (or `admin_upsert_event`), then add a feature for it. The analytics architecture doesn't change.

## 7. E-mail provider: Resend

- **Templates** (Arabic + English, HTML + text): `welcome`, `contact_confirmation`, `admin_new_contact` (links to the lead in the dashboard; the message body is not included), `follow_up`, `account_notice`, `announcement` (only to people who opted in; the database refuses otherwise).
- **Requirements:** a Resend account, a **domain you own verified in Resend** (SPF and DKIM DNS records; add DMARC too), an API key, and a webhook. A Gmail address can't be the sender. Until a domain is verified, Resend sends only to the account owner's own address.

## 8. Environment variables

See **`.env.example`**. The browser only ever gets the public project URL and anon (publishable) key. Every secret lives in Supabase secrets, never in the database or the frontend.

## 9. Creating the first administrator

1. Deploy (below), open the site and **sign in with Google** using the owner's account.
2. In Supabase → SQL editor run: `select app.bootstrap_owner('hudera.ai@gmail.com');`
3. Open `/admin/`. Add other people in **Settings → Team**. Each person must sign in on the site once first.

## 10. Google OAuth in production

1. Google Cloud Console → new project "HUDERA AI" → **OAuth consent screen**: External, app name, support e-mail, logo, home page `https://hudera-ai.github.io`, privacy policy `https://hudera-ai.github.io/privacy.html`; scopes `openid`, `email`, `profile`; then **Publish app**.
2. **Credentials → Create OAuth client ID → Web application.** Authorised JavaScript origin: `https://hudera-ai.github.io`. Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Supabase → Authentication → Providers → Google: paste the client ID and secret, enable.
4. Supabase → Authentication → URL configuration: Site URL `https://hudera-ai.github.io`. Redirect URLs: `https://hudera-ai.github.io/` and `https://hudera-ai.github.io/admin/`.

## 11. Deployment

```bash
# 0. once: npm i -g supabase   (or use npx supabase)
supabase login
supabase link --project-ref <project-ref>
supabase db push                                   # applies supabase/migrations in order
supabase secrets set --env-file .env               # RESEND_API_KEY, EMAIL_FROM, WORKER_SECRET, ...
supabase functions deploy email-worker email-webhook account-delete   # uses supabase/config.toml (verify_jwt = false; functions check callers themselves)
```

If you prefer, enable `pg_cron` before pushing migrations, so that 0004 schedules the daily purge itself. Then in the SQL editor, enable the schedules (Database → Extensions: turn on `pg_cron` and `pg_net` first):

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'hudera_project_url');
select vault.create_secret('<same WORKER_SECRET as above>', 'hudera_worker_secret');
select cron.schedule('hudera-email-worker', '* * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'hudera_project_url') || '/functions/v1/email-worker',
    headers := jsonb_build_object('content-type', 'application/json',
                 'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'hudera_worker_secret')),
    body    := '{}'::jsonb);
$$);
select cron.schedule('hudera-purge-analytics', '17 3 * * *', 'select app.purge_analytics()');
```

Resend → Webhooks → add `https://<project-ref>.supabase.co/functions/v1/email-webhook` for `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`. Put its signing secret in `RESEND_WEBHOOK_SECRET`.

Finally, put the project URL and anon key in `portfolio2/src/config.json`, run `python3 portfolio2/build.py`, and upload `site/index.html`, `site/admin/index.html` and `site/privacy.html` to the `hudera-ai.github.io` repository.

### Go-live checklist

- [ ] Supabase project created (choose the region closest to Saudi Arabia that Supabase offers)
- [ ] Migrations pushed
- [ ] Google OAuth client + consent screen published, provider enabled in Supabase
- [ ] Domain bought and verified in Resend, API key and webhook created
- [ ] Secrets set, functions deployed, cron schedules created
- [ ] `config.json` filled, site rebuilt and uploaded
- [ ] Owner signed in once + `app.bootstrap_owner(...)` run
- [ ] Privacy notice reviewed (ideally by a lawyer for KSA PDPL)

## 12. Tests and known limitations

**Automated (`npm test`):** 17 end-to-end tests run against real Postgres 16 with the real migrations and PostgREST 12, the real Edge Function code, a fake Google/GoTrue and a fake Resend. All pass. They cover:

- anonymous access refused
- tracking whitelist, deduplication and session-hijack refusal
- Google sign-up and returning sign-in (one profile, Google id, verified e-mail, one welcome e-mail)
- user without a phone contacted by e-mail; phone required for WhatsApp/phone
- users can't see others' data or call admin, worker or bootstrap functions
- first owner only from SQL, only once
- dashboard numbers equal database counts
- lead workflow with the support role's limits
- e-mail sent → delivered via signed webhook (late events don't downgrade), retry on 503, failed on 422, admin retry, no key leaks
- settings validation and audit
- feature added from the dashboard and back-filled
- contact rate limit
- data export and account deletion with anonymisation
- hardening: profile facts come only from trusted auth fields (not user-editable metadata); an unconfirmed e-mail account gets no welcome e-mail and can't receive a staff role; new-visitor floods from one address are throttled; invalid dates don't drop a batch; early delivery webhooks are retried

**Browser tests (Playwright, `qa` scripts):** on the site — consent banner, no events before consent, Google sign-in round trip, phone prompt, form validation messages, request submitted and visible in the account panel, sign-out, Arabic and mobile layouts, no horizontal scroll, no console errors. On the dashboard — gate for non-staff, bootstrap owner, overview, filters, CSV export, user timeline, lead update/note/attempt/e-mail, features, e-mails, settings, audit, Arabic and mobile.

**The production build was also checked with no Supabase config:** the old WhatsApp brief form works and there are no errors.

**Known limitations**

- Nothing has run against a real Supabase, Google or Resend account yet. The fakes follow their documented APIs, but the first real sign-in, send and webhook should be checked after go-live.
- Visitors who decline analytics aren't counted at all, so totals are a lower bound. Counts are per browser: the same person on two devices counts as two visitors.
- Charts query raw events. That's fine up to a few hundred thousand events; beyond that, add daily roll-up tables.
- Account deletion is immediate and self-service. Other personal-data requests (corrections, access by e-mail) are handled manually.
- Assigning leads uses team roles. There are no separate team or queue objects.
- An independent security review was run on the finished code. Its findings were fixed before release: staff roles only for verified Google accounts, per-address tracking limits, trusted profile fields, fuller anonymisation, the webhook race, timeout-safe daily queries, the e-mail state machine, CSV and header injection.
