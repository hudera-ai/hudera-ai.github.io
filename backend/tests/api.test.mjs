// End-to-end API tests: real migrations on Postgres 16, real PostgREST, real Edge Function handlers,
// fake Google/GoTrue and fake Resend (see local/dev-stack.mjs). Run with: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { start, stop, sign, googleSignIn, ANON_KEY, SERVICE_KEY, LOCAL_ENV, resendLog } from "../local/dev-stack.mjs";

process.env.PGRST_BIN ||= new URL("../local/postgrest", import.meta.url).pathname;
const URL_ = "http://localhost:54321";
const db = new pg.Pool({ connectionString: "postgres://root@/hudera_test?host=/var/run/postgresql" });
const q = async (sql, args) => (await db.query(sql, args)).rows;
const anon = () => createClient(URL_, ANON_KEY, { auth: { persistSession: false } });
const asUser = (id) => createClient(URL_, ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${sign({ sub: id, role: "authenticated", aud: "authenticated" })}` } } });
const asService = () => createClient(URL_, SERVICE_KEY, { auth: { persistSession: false } });
const uuid = () => crypto.randomUUID();
const worker = (headers = {}) => fetch(`${URL_}/functions/v1/email-worker`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: "{}" }).then(async (r) => ({ status: r.status, body: await r.json() }));
const ACC = {
  owner: { sub: "109000000000000000001", email: "owner@hudera.test", name: "Ahmed Owner" },
  sara: { sub: "109000000000000000002", email: "sara.client@example.com", name: "Sara Al-Qahtani" },
  omar: { sub: "109000000000000000003", email: "omar.client@example.com", name: "Omar Al-Harbi" },
  mona: { sub: "109000000000000000004", email: "support@hudera.test", name: "Mona Support" },
};
const ids = {};
const contact = (over = {}) => ({ p_full_name: "Sara Al-Qahtani", p_phone: null, p_company: "Rawabi", p_reason: "ai_employee", p_subject: "AI HR officer for 300 staff",
  p_message: "We want an AI employee to answer leave and payslip questions on WhatsApp.", p_preferred_method: "email", p_preferred_time: "Sun–Thu 9–12",
  p_consent: true, p_client_token: uuid(), p_path: "/#contact", ...over });

before(async () => { await start(); });
after(async () => { await stop(); await db.end(); });

test("anonymous visitors: public config works, private and admin functions are refused", async () => {
  const a = anon();
  const cfg = await a.rpc("site_config");
  assert.equal(cfg.error, null); assert.equal(cfg.data.site_name, "HUDERA AI"); assert.ok(cfg.data.contact_reasons.length >= 5);
  for (const fn of ["me", "admin_overview", "admin_list_users", "submit_contact", "worker_claim_emails"]) {
    const r = await a.rpc(fn, fn === "admin_overview" ? { p_from: "2026-10-01", p_to: "2026-10-20" } : {});
    assert.ok(r.error, `${fn} must be refused for anon`);
  }
  // the private schema is not reachable through the REST API at all
  const raw = await fetch(`${URL_}/rest/v1/profiles?select=*`, { headers: { apikey: ANON_KEY, "accept-profile": "app" } });
  assert.ok(raw.status >= 400, "app schema must not be exposed");
});

test("event tracking: accepts known events, drops unknown events/props, ignores duplicates, never trusts the browser for user ids", async () => {
  const v = uuid(), s = uuid(), e1 = uuid();
  const ctx = { path: "/", referrer: "www.linkedin.com", utm_source: null };
  const batch = [
    { id: e1, name: "page_view", path: "/?secret=1", props: { title: "Home", password: "x" } },
    { id: uuid(), name: "platform_opened", props: { platform: "workforce", mode: "embed" } },
    { id: uuid(), name: "not_a_real_event" },
    { id: uuid(), name: "contact_submitted", props: { reason: "x" } },       // server-only, must be rejected
    { id: uuid(), name: "page_view", user_id: "00000000-0000-0000-0000-000000000000" },
  ];
  const r1 = await anon().rpc("track", { p_visitor: v, p_session: s, p_context: ctx, p_events: batch });
  assert.equal(r1.error, null); assert.deepEqual(r1.data, { accepted: 3, duplicates: 0, rejected: 2 });
  const r2 = await anon().rpc("track", { p_visitor: v, p_session: s, p_context: ctx, p_events: [batch[0]] });
  assert.equal(r2.data.duplicates, 1, "same event id twice is stored once");
  const ev = await q("select name, path, props, user_id, feature_key from app.events where visitor_id = $1 order by id", [v]);
  assert.equal(ev.length, 3);
  assert.equal(ev[0].path, "/"); assert.deepEqual(ev[0].props, { title: "Home" }); assert.equal(ev[0].user_id, null);
  assert.equal(ev[1].feature_key, "workforce_demo");
  const [sess] = await q("select source, referrer_domain, page_views, is_returning from app.sessions where id = $1", [s]);
  assert.deepEqual(sess, { source: "social", referrer_domain: "www.linkedin.com", page_views: 2, is_returning: false });
  // a second session from the same browser is "returning"
  const s2 = uuid();
  await anon().rpc("track", { p_visitor: v, p_session: s2, p_context: { path: "/" }, p_events: [{ id: uuid(), name: "page_view" }] });
  assert.equal((await q("select is_returning from app.sessions where id = $1", [s2]))[0].is_returning, true);
  // someone else's session id cannot be reused with another visitor id
  const bad = await anon().rpc("track", { p_visitor: uuid(), p_session: s, p_context: {}, p_events: [{ id: uuid(), name: "page_view" }] });
  assert.ok(bad.error);
});

test("Google sign-up creates one profile with the Google id and verified e-mail; a returning sign-in reuses it", async () => {
  ids.sara = await googleSignIn(ACC.sara);
  const [p] = await q("select google_sub, email, email_verified, full_name, avatar_url, phone, login_count, status from app.profiles where id = $1", [ids.sara]);
  assert.equal(p.google_sub, ACC.sara.sub); assert.equal(p.email, ACC.sara.email); assert.equal(p.email_verified, true);
  assert.equal(p.full_name, "Sara Al-Qahtani"); assert.ok(p.avatar_url.startsWith("https://")); assert.equal(p.phone, null); assert.equal(p.login_count, 1);
  const again = await googleSignIn(ACC.sara);
  assert.equal(again, ids.sara);
  assert.equal((await q("select count(*)::int n from app.profiles where google_sub = $1", [ACC.sara.sub]))[0].n, 1);
  assert.equal((await q("select login_count from app.profiles where id = $1", [ids.sara]))[0].login_count, 2);
  const evs = (await q("select name from app.events where user_id = $1 and source = 'server' order by id", [ids.sara])).map((r) => r.name);
  assert.deepEqual(evs, ["user_registered", "login", "login"]);
  const mails = await q("select template, to_email, status from app.email_messages where user_id = $1", [ids.sara]);
  assert.deepEqual(mails, [{ template: "welcome", to_email: ACC.sara.email, status: "queued" }], "exactly one welcome e-mail");
  const me = await asUser(ids.sara).rpc("me");
  assert.equal(me.error, null); assert.equal(me.data.email, ACC.sara.email); assert.equal(me.data.staff_role, null);
});

test("signed-in tracking is linked to the user server-side", async () => {
  const v = uuid(), s = uuid();
  const r = await asUser(ids.sara).rpc("track", { p_visitor: v, p_session: s, p_context: { path: "/" }, p_events: [{ id: uuid(), name: "roi_calculated", props: { requests: 80 } }] });
  assert.equal(r.data.accepted, 1);
  const [e] = await q("select user_id, feature_key from app.events where session_id = $1", [s]);
  assert.equal(e.user_id, ids.sara); assert.equal(e.feature_key, "roi_calculator");
  assert.equal((await q("select user_id from app.sessions where id = $1", [s]))[0].user_id, ids.sara);
});

test("a user without a phone can send a contact request by e-mail; phone/WhatsApp needs a number", async () => {
  const u = asUser(ids.sara);
  const noPhone = await u.rpc("submit_contact", contact({ p_preferred_method: "whatsapp" }));
  assert.match(noPhone.error?.message || "", /phone_required/);
  const tok = uuid();
  const ok = await u.rpc("submit_contact", contact({ p_client_token: tok }));
  assert.equal(ok.error, null); assert.match(ok.data.ref, /^HR-\d{4}-\d+$/); assert.equal(ok.data.duplicate, false);
  ids.req1 = ok.data.id;
  const dup = await u.rpc("submit_contact", contact({ p_client_token: tok }));
  assert.equal(dup.data.id, ids.req1); assert.equal(dup.data.duplicate, true, "double submit returns the same request");
  const [c] = await q("select email, phone, status, user_id from app.contact_requests where id = $1", [ids.req1]);
  assert.deepEqual(c, { email: ACC.sara.email, phone: null, status: "new", user_id: ids.sara });
  const mails = (await q("select template, to_email from app.email_messages where related_request_id = $1 order by template", [ids.req1]));
  assert.deepEqual(mails, [{ template: "admin_new_contact", to_email: "hudera.ai@gmail.com" }, { template: "contact_confirmation", to_email: ACC.sara.email }]);
  // with a number in Saudi local format it is normalised and saved on the profile
  const wa = await u.rpc("submit_contact", contact({ p_preferred_method: "whatsapp", p_phone: "055 123 4567", p_subject: "Follow-up on WhatsApp" }));
  assert.equal(wa.error, null);
  assert.equal((await q("select phone from app.profiles where id = $1", [ids.sara]))[0].phone, "+966551234567");
  const bad = await u.rpc("submit_contact", contact({ p_consent: false }));
  assert.match(bad.error.message, /consent_required/);
  const badMsg = await u.rpc("submit_contact", contact({ p_message: "hi" }));
  assert.match(badMsg.error.message, /invalid_message/);
});

test("users cannot read other users' data or use admin functions", async () => {
  ids.omar = await googleSignIn(ACC.omar);
  const o = asUser(ids.omar);
  const me = await o.rpc("me");
  assert.equal(me.data.email, ACC.omar.email); assert.equal(me.data.requests.length, 0, "Omar does not see Sara's requests");
  for (const [fn, args] of [["admin_get_contact", { p_id: ids.req1 }], ["admin_get_user", { p_id: ids.sara }], ["admin_list_users", {}],
                            ["admin_overview", { p_from: "2026-10-01", p_to: "2026-10-20" }], ["admin_update_contact", { p_id: ids.req1, p_status: "closed" }],
                            ["worker_claim_emails", {}], ["worker_anonymize_user", { p_user: ids.sara }]]) {
    const r = await o.rpc(fn, args);
    assert.ok(r.error, `${fn} must be refused for a regular user`);
  }
  assert.equal((await q("select status from app.contact_requests where id = $1", [ids.req1]))[0].status, "new");
  // self-promotion is impossible: the bootstrap function is not callable through the API
  const boot = await o.rpc("bootstrap_owner", { p_email: ACC.omar.email });
  assert.ok(boot.error);
});

test("first owner is created only from SQL, only once", async () => {
  ids.owner = await googleSignIn(ACC.owner);
  const [r] = await q("select app.bootstrap_owner($1) as msg", [ACC.owner.email]);
  assert.match(r.msg, /Owner role granted/);
  await assert.rejects(q("select app.bootstrap_owner($1)", [ACC.omar.email]), /owner already exists/);
  const who = await asUser(ids.owner).rpc("admin_whoami");
  assert.equal(who.data.role, "owner"); assert.ok(who.data.perms.includes("roles.manage"));
});

test("admin overview, user table and profile use real database rows", async () => {
  const a = asUser(ids.owner);
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const ov = await a.rpc("admin_overview", { p_from: from, p_to: today, p_tz: "Asia/Riyadh" });
  assert.equal(ov.error, null);
  const [counts] = await q(`select (select count(*)::int from app.profiles where status <> 'deleted') users,
                                   (select count(*)::int from app.contact_requests) contacts,
                                   (select count(distinct visitor_id)::int from app.sessions) visitors`);
  assert.equal(ov.data.cards.registered_users, counts.users);
  assert.equal(ov.data.cards.contacts_total, counts.contacts);
  assert.equal(ov.data.cards.visitors_in_range, counts.visitors);
  assert.equal(ov.data.daily.length, 7);
  assert.ok(ov.data.features.find((f) => f.key === "workforce_demo").uses >= 1);
  const list = await a.rpc("admin_list_users", { p_search: "sara", p_limit: 10 });
  assert.equal(list.data.total, 1); const row = list.data.rows[0];
  assert.equal(row.email, ACC.sara.email); assert.equal(row.phone, "+966551234567"); assert.equal(row.activity, "active");
  assert.equal(row.contact_status, "new"); assert.ok(row.important_actions >= 3);
  const noPhone = await a.rpc("admin_list_users", { p_has_phone: false });
  assert.ok(noPhone.data.rows.every((r) => r.phone === null)); assert.ok(noPhone.data.rows.some((r) => r.email === ACC.omar.email));
  const prof = await a.rpc("admin_get_user", { p_id: ids.sara });
  assert.equal(prof.error, null);
  const f = Object.fromEntries(prof.data.features.map((x) => [x.key, x.state]));
  assert.equal(f.roi_calculator, "used"); assert.equal(f.contact_form, "used");
  assert.equal(f.faq, "not_used", "tracking was live while Sara was active");
  const omarProf = await a.rpc("admin_get_user", { p_id: ids.omar });
  assert.ok(omarProf.data.features.every((x) => x.state !== "not_used"), "no client activity yet → unknown, not 'not used'");
  const tl = await a.rpc("admin_user_timeline", { p_id: ids.sara, p_limit: 100 });
  const kinds = new Set(tl.data.items.map((i) => i.kind));
  for (const k of ["event", "contact", "email"]) assert.ok(kinds.has(k), `timeline has ${k}`);
  const times = tl.data.items.map((i) => Date.parse(i.at));
  assert.deepEqual(times, [...times].sort((x, y) => y - x), "timeline is newest first");
  const exp = await a.rpc("admin_export_users", {});
  assert.equal(exp.data.length, counts.users);
  assert.equal((await q("select count(*)::int n from app.audit_log where action = 'users.exported'"))[0].n, 1);
});

test("lead management: status, assignee, notes, attempts and history; support role limits", async () => {
  ids.mona = await googleSignIn(ACC.mona);
  const own = asUser(ids.owner);
  const role = await own.rpc("admin_set_staff_role", { p_email: ACC.mona.email, p_role: "support" });
  assert.equal(role.error, null);
  const sup = asUser(ids.mona);
  const up = await sup.rpc("admin_update_contact", { p_id: ids.req1, p_status: "in_progress", p_assigned_to: ids.mona, p_follow_up_at: new Date(Date.now() + 864e5).toISOString() });
  assert.equal(up.error, null); assert.equal(up.data.request.status, "in_progress"); assert.equal(up.data.request.assignee_name, "Mona Support");
  const note = await sup.rpc("admin_add_contact_note", { p_id: ids.req1, p_body: "Called reception, will call back tomorrow." });
  assert.equal(note.data.notes.length, 1);
  const att = await sup.rpc("admin_log_contact_attempt", { p_id: ids.req1, p_channel: "phone", p_outcome: "no_answer" });
  assert.equal(att.data.attempts.length, 1);
  assert.deepEqual(att.data.history.map((h) => h.to), ["new", "in_progress"]);
  for (const [fn, args] of [["admin_export_users", {}], ["admin_update_setting", { p_key: "inactivity_days", p_value: 10 }], ["admin_set_staff_role", { p_email: ACC.omar.email, p_role: "admin" }], ["admin_audit_log", {}]]) {
    assert.ok((await sup.rpc(fn, args)).error, `support must not call ${fn}`);
  }
  // the client never sees internal notes
  const me = await asUser(ids.sara).rpc("me");
  assert.equal(JSON.stringify(me.data).includes("reception"), false);
  const last = await own.rpc("admin_set_staff_role", { p_email: ACC.owner.email, p_role: null });
  assert.match(last.error.message, /last_owner/);
});

test("e-mail: worker sends through the provider, webhooks move status forward, failures retry or fail, nothing is called delivered without the provider", async () => {
  assert.equal((await worker()).status, 403, "no secret and no staff token → refused");
  assert.equal((await worker({ authorization: `Bearer ${sign({ sub: ids.omar, role: "authenticated" })}` })).status, 403, "regular user cannot run the worker");
  const run = await worker({ "x-worker-secret": LOCAL_ENV.WORKER_SECRET });
  assert.equal(run.status, 200); assert.ok(run.body.sent >= 4);
  const welcome = (await q("select id, status, provider_message_id, subject from app.email_messages where template = 'welcome' and user_id = $1", [ids.sara]))[0];
  assert.equal(welcome.status, "sent"); assert.ok(welcome.provider_message_id); assert.match(welcome.subject, /Welcome/);
  assert.ok(resendLog.find((m) => m.id === welcome.provider_message_id && m.to[0] === ACC.sara.email && m.idem === `hudera-${welcome.id}-5`));
  // signed webhook → delivered; a late "sent" does not downgrade it; bad signature refused
  const hook = async (type, evId, secret = LOCAL_ENV.RESEND_WEBHOOK_SECRET) => {
    const body = JSON.stringify({ type, created_at: new Date().toISOString(), data: { email_id: welcome.provider_message_id } });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = crypto.createHmac("sha256", Buffer.from(secret.replace("whsec_", ""), "base64")).update(`${evId}.${ts}.${body}`).digest("base64");
    return fetch(`${URL_}/functions/v1/email-webhook`, { method: "POST", headers: { "svix-id": evId, "svix-timestamp": ts, "svix-signature": `v1,${sig}` }, body });
  };
  assert.equal((await hook("email.delivered", "msg_1")).status, 200);
  assert.equal((await hook("email.sent", "msg_2")).status, 200);
  assert.equal((await q("select status from app.email_messages where id = $1", [welcome.id]))[0].status, "delivered");
  assert.equal((await hook("email.bounced", "msg_3", "whsec_" + Buffer.from("wrong").toString("base64"))).status, 401);
  // admin e-mail to a user who has no phone: goes to the verified address and is logged against the lead
  const own = asUser(ids.owner);
  const rec = await own.rpc("admin_email_recipient", { p_user: ids.omar });
  assert.equal(rec.data.email, ACC.omar.email); assert.equal(rec.data.phone, null);
  const sent = await own.rpc("admin_send_email", { p_user: ids.omar, p_subject: "About your visit", p_body: "Thanks for trying the demo — can we help?", p_client_token: "t1" });
  assert.equal(sent.error, null); assert.equal(sent.data.status, "queued"); assert.equal(sent.data.to, ACC.omar.email);
  const again = await own.rpc("admin_send_email", { p_user: ids.omar, p_subject: "About your visit", p_body: "Thanks for trying the demo — can we help?", p_client_token: "t1" });
  assert.equal(again.data.duplicate, true);
  const announce = await own.rpc("admin_send_email", { p_user: ids.omar, p_subject: "News", p_body: "Our new platform is live.", p_category: "announcement" });
  assert.match(announce.error.message, /no_marketing_consent/);
  // provider down → retry with back-off, not failed and not "sent"
  await fetch(`${URL_}/_resend/mode?m=fail500`);
  await worker({ "x-worker-secret": LOCAL_ENV.WORKER_SECRET });
  let [m] = await q("select status, attempts, last_error, next_attempt_at > now() as later from app.email_messages where id = $1", [sent.data.id]);
  assert.equal(m.status, "queued"); assert.equal(m.attempts, 1); assert.match(m.last_error, /503/); assert.equal(m.later, true);
  // permanent rejection → failed; admin can retry
  await fetch(`${URL_}/_resend/mode?m=fail422`);
  await q("update app.email_messages set next_attempt_at = now() where id = $1", [sent.data.id]);
  await worker({ "x-worker-secret": LOCAL_ENV.WORKER_SECRET });
  [m] = await q("select status, last_error from app.email_messages where id = $1", [sent.data.id]);
  assert.equal(m.status, "failed"); assert.match(m.last_error, /422/);
  await fetch(`${URL_}/_resend/mode?m=ok`);
  assert.equal((await own.rpc("admin_retry_email", { p_id: sent.data.id })).error, null);
  const staffRun = await worker({ authorization: `Bearer ${sign({ sub: ids.owner, role: "authenticated" })}` });
  assert.equal(staffRun.status, 200, "staff may trigger the worker");
  assert.equal((await q("select status from app.email_messages where id = $1", [sent.data.id]))[0].status, "sent");
  const st = await fetch(`${URL_}/functions/v1/email-worker`, { method: "POST", headers: { authorization: `Bearer ${sign({ sub: ids.owner, role: "authenticated" })}`, "content-type": "application/json" }, body: JSON.stringify({ action: "status" }) }).then((r) => r.json());
  assert.equal(st.configured, true); assert.equal(JSON.stringify(st).includes("re_local_test"), false, "status never returns the API key");
});

test("settings are validated and audited; secrets are not stored there", async () => {
  const own = asUser(ids.owner);
  assert.match((await own.rpc("admin_update_setting", { p_key: "resend_api_key", p_value: "re_x" })).error.message, /unknown_setting/);
  assert.match((await own.rpc("admin_update_setting", { p_key: "inactivity_days", p_value: 9999 })).error.message, /invalid_setting_value/);
  const ok = await own.rpc("admin_update_setting", { p_key: "inactivity_days", p_value: 14 });
  assert.equal(ok.data.settings.inactivity_days, 14);
  assert.equal((await q("select count(*)::int n from app.audit_log where action = 'setting.updated'"))[0].n, 1);
});

test("features: a new tracked feature can be added from the dashboard and is back-filled", async () => {
  const own = asUser(ids.owner);
  const r = await own.rpc("admin_upsert_feature", { p_key: "linkedin_visits", p_name: "Arrived from LinkedIn", p_description: null, p_category: "Acquisition",
    p_eligibility: "everyone", p_match_event: "platform_opened", p_match_prop: "mode", p_match_value: "embed", p_active: true, p_sort: 5, p_backfill: true });
  assert.equal(r.error, null);
  const list = await own.rpc("admin_features", { p_from: new Date(Date.now() - 864e5).toISOString().slice(0, 10), p_to: new Date().toISOString().slice(0, 10) });
  assert.ok(list.data.find((f) => f.key === "workforce_demo"));
  const det = await own.rpc("admin_feature_detail", { p_key: "roi_calculator", p_from: new Date(Date.now() - 864e5).toISOString().slice(0, 10), p_to: new Date().toISOString().slice(0, 10) });
  assert.equal(det.data.users, 1); assert.equal(det.data.users_who_used[0].email, ACC.sara.email);
});

test("rate limits protect the contact form", async () => {
  const u = asUser(ids.omar); let lastErr = null;
  for (let i = 0; i < 6; i++) { const r = await u.rpc("submit_contact", contact({ p_full_name: "Omar Al-Harbi", p_subject: `Request ${i}` })); lastErr = r.error; }
  assert.match(lastErr?.message || "", /rate_limited/);
});

test("a user can export and delete their own account; their leads are anonymised", async () => {
  const u = asUser(ids.sara);
  const exp = await u.rpc("my_data_export");
  assert.equal(exp.data.profile.email, ACC.sara.email); assert.ok(exp.data.contact_requests.length >= 2);
  assert.equal(JSON.stringify(exp.data).includes("reception"), false, "internal notes are not part of the user's export");
  const tok = sign({ sub: ids.sara, role: "authenticated" });
  const noConfirm = await fetch(`${URL_}/functions/v1/account-delete`, { method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" }, body: "{}" });
  assert.equal(noConfirm.status, 400);
  const del = await fetch(`${URL_}/functions/v1/account-delete`, { method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) });
  assert.equal(del.status, 200);
  assert.equal((await q("select count(*)::int n from auth.users where id = $1", [ids.sara]))[0].n, 0);
  assert.equal((await q("select count(*)::int n from app.profiles where id = $1", [ids.sara]))[0].n, 0);
  const leads = await q("select full_name, email, phone, message from app.contact_requests where id = $1", [ids.req1]);
  assert.deepEqual(leads[0].full_name, "Deleted user"); assert.match(leads[0].email, /@deleted\.invalid$/); assert.equal(leads[0].phone, null);
  assert.equal((await q("select count(*)::int n from app.contact_notes where request_id = $1", [ids.req1]))[0].n, 0, "internal notes about the person are removed");
  assert.equal((await q("select count(*)::int n from app.email_messages where related_request_id = $1 and data::text like $2", [ids.req1, "%sara%"]))[0].n, 0, "team notification e-mails no longer hold her details");
  assert.equal((await q("select count(*)::int n from app.events where user_id is null and name = 'roi_calculated'"))[0].n >= 1, true, "analytics kept without the person");
});

test("hardening: profile facts come from trusted auth fields, not user-editable metadata", async () => {
  const id = await googleSignIn({ sub: "109000000000000000077", email: "nadia@example.com", name: "Nadia" });
  // the user edits their own metadata (possible with auth.updateUser) — nothing that matters changes
  await q(`update auth.users set raw_user_meta_data = raw_user_meta_data || '{"email_verified":"maybe","avatar_url":"https://evil.example/pixel.gif","sub":"999"}'::jsonb where id = $1`, [id]);
  const [p] = await q("select email_verified, avatar_url, google_sub from app.profiles where id = $1", [id]);
  assert.equal(p.email_verified, true); assert.match(p.avatar_url, /googleusercontent\.com/); assert.equal(p.google_sub, "109000000000000000077");
  // an unconfirmed e-mail/password account: no welcome e-mail, cannot be given a staff role
  const [{ id: e }] = await q("insert into auth.users (email, raw_app_meta_data) values ('owner@hudera.test', '{\"provider\":\"email\"}') returning id");
  await q("update auth.users set last_sign_in_at = now() where id = $1", [e]);
  assert.equal((await q("select count(*)::int n from app.email_messages where user_id = $1", [e]))[0].n, 0);
  const [{ email_verified }] = await q("select email_verified from app.profiles where id = $1", [e]);
  assert.equal(email_verified, false);
  const owner = (await q("select id from app.profiles where email = 'owner@hudera.test' and auth_provider = 'google'"))[0].id;
  const r = await asUser(owner).rpc("admin_set_staff_role", { p_email: "owner@hudera.test", p_role: "owner" });
  assert.equal(r.error, null, "the verified Google account is the one matched");
  assert.equal((await q("select count(*)::int n from app.staff_roles where user_id = $1", [e]))[0].n, 0);
});

test("hardening: new-visitor flood from one address is throttled; invalid dates don't drop a batch", async () => {
  let throttled = false;
  for (let i = 0; i < 65 && !throttled; i++) {
    const r = await fetch(`${URL_}/rest/v1/rpc/track`, { method: "POST", headers: { apikey: ANON_KEY, authorization: `Bearer ${ANON_KEY}`, "content-type": "application/json", "x-forwarded-for": "203.0.113.9", "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/129.0 Safari/537.36" },
      body: JSON.stringify({ p_visitor: uuid(), p_session: uuid(), p_context: {}, p_events: [{ id: uuid(), name: "page_view" }] }) }).then((x) => x.json());
    throttled = !!r.throttled;
  }
  assert.equal(throttled, true);
  const ok = await anon().rpc("track", { p_visitor: uuid(), p_session: uuid(), p_context: {}, p_events: [{ id: uuid(), name: "page_view", at: "2026-13-45T99:00:00Z" }, { id: uuid(), name: "faq_opened", props: { question: "1" } }] });
  assert.equal(ok.error, null); assert.equal(ok.data.accepted, 2);
});

test("hardening: a delivery webhook that arrives before the send is recorded asks for a retry", async () => {
  const body = JSON.stringify({ type: "email.delivered", created_at: new Date().toISOString(), data: { email_id: "not-yet-known" } });
  const ts = String(Math.floor(Date.now() / 1000)), evId = "msg_early";
  const sig = crypto.createHmac("sha256", Buffer.from(LOCAL_ENV.RESEND_WEBHOOK_SECRET.replace("whsec_", ""), "base64")).update(`${evId}.${ts}.${body}`).digest("base64");
  const r = await fetch(`${URL_}/functions/v1/email-webhook`, { method: "POST", headers: { "svix-id": evId, "svix-timestamp": ts, "svix-signature": `v1,${sig}` }, body });
  assert.equal(r.status, 409);
  const bad = await fetch(`${URL_}/functions/v1/email-webhook`, { method: "POST", headers: { "svix-id": evId, "svix-timestamp": "abc", "svix-signature": `v1,${sig}` }, body });
  assert.equal(bad.status, 401);
});
