// Edge Function logic, written against standard Web APIs (fetch, Request, Response, crypto.subtle)
// so the same code runs in Supabase Edge Functions (Deno) and in the local Node test server.
import { renderEmail } from "./templates.js";

const RESEND_URL = "https://api.resend.com/emails";

// ------------------------------------------------------------------ small helpers
export function cors(env, req) {
  const allowed = String(env.ALLOWED_ORIGINS || "https://hudera-ai.github.io").split(",").map((s) => s.trim());
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
// Legacy keys are JWTs and go in both headers; the newer sb_secret_/sb_publishable_ keys go in "apikey" only.
const isJwt = (k) => String(k || "").split(".").length === 3;
const keyHeaders = (k) => ({ apikey: k, ...(isJwt(k) ? { authorization: `Bearer ${k}` } : {}) });
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

function rpc(env, fetchImpl, fn, args) {
  return fetchImpl(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { ...keyHeaders(env.SUPABASE_SERVICE_ROLE_KEY), "content-type": "application/json" },
    body: JSON.stringify(args || {}),
  }).then(async (r) => {
    const text = await r.text();
    const data = text ? JSON.parse(text) : null;
    if (!r.ok) throw new Error(`rpc ${fn} ${r.status}: ${data?.message || text}`);
    return data;
  });
}

// returns the Supabase user for a caller's access token, or null
async function userFromToken(env, fetchImpl, req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token || token === env.SUPABASE_ANON_KEY) return null;
  const r = await fetchImpl(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? u : null;
}

function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

// ------------------------------------------------------------------ sending one e-mail through Resend
// Resend answers 2xx with {id}; 429 and 5xx are temporary; other 4xx are permanent (bad address, unverified domain…).
export async function sendViaResend(msg, env, fetchImpl) {
  const rendered = renderEmail(msg, { siteUrl: env.SITE_URL, siteName: msg.site_name });
  let r;
  try {
    r = await fetchImpl(env.RESEND_API_URL || RESEND_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json", "idempotency-key": msg.idem || `hudera-${msg.id}` },
      body: JSON.stringify({
        from: env.EMAIL_FROM, to: [msg.to_email], subject: rendered.subject, html: rendered.html, text: rendered.text,
        ...(env.EMAIL_REPLY_TO ? { reply_to: env.EMAIL_REPLY_TO } : {}),
        tags: [{ name: "template", value: msg.template }, { name: "category", value: msg.category }],
      }),
    });
  } catch (e) {
    return { result: "retry", error: `network: ${e.message}`, subject: rendered.subject };
  }
  const body = await r.json().catch(() => ({}));
  if (r.ok && body.id) return { result: "sent", providerId: body.id, subject: rendered.subject };
  const error = `${r.status} ${body.name || ""} ${body.message || ""}`.trim();
  if (r.status === 429 || r.status >= 500) {
    const ra = Number(r.headers.get("retry-after"));
    return { result: "retry", error, retryIn: Number.isFinite(ra) && ra > 0 ? ra : null, subject: rendered.subject };
  }
  return { result: "failed", error, subject: rendered.subject };
}

export async function processQueue(env, fetchImpl, { limit = 20 } = {}) {
  const configured = !!(env.RESEND_API_KEY && env.EMAIL_FROM);
  if (!configured) {
    await rpc(env, fetchImpl, "worker_heartbeat", { p_status: { configured: false, provider: "resend", from: env.EMAIL_FROM || null, note: "RESEND_API_KEY or EMAIL_FROM is not set" } });
    return { configured: false, processed: 0 };
  }
  const batch = await rpc(env, fetchImpl, "worker_claim_emails", { p_limit: limit });
  const out = { configured: true, processed: 0, sent: 0, retry: 0, failed: 0 };
  for (const msg of batch || []) {
    let res;
    try { res = await sendViaResend(msg, env, fetchImpl); }
    catch (e) { res = { result: e.permanent ? "failed" : "retry", error: e.message }; }
    const backoff = res.retryIn || Math.min(21600, 60 * 2 ** Math.max(0, (msg.attempts || 1) - 1));
    await rpc(env, fetchImpl, "worker_complete_email", {
      p_id: msg.id, p_result: res.result, p_provider_id: res.providerId || null, p_error: res.error || null,
      p_retry_in_seconds: backoff, p_subject: res.subject || null,
    });
    out.processed++; out[res.result]++;
  }
  await rpc(env, fetchImpl, "worker_heartbeat", { p_status: { configured: true, provider: "resend", from: env.EMAIL_FROM, webhook: !!env.RESEND_WEBHOOK_SECRET, last_run: out } });
  return out;
}

// ------------------------------------------------------------------ email-worker endpoint
// Called every minute by pg_cron (x-worker-secret) and right after an admin queues a message (staff JWT).
export async function handleWorker(req, env, fetchImpl = fetch) {
  const h = cors(env, req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, h);
  let allowed = !!env.WORKER_SECRET && safeEqual(req.headers.get("x-worker-secret") || "", env.WORKER_SECRET);
  if (!allowed) {
    const user = await userFromToken(env, fetchImpl, req);
    allowed = !!user && (await rpc(env, fetchImpl, "worker_is_staff", { p_user: user.id })) === true;
  }
  if (!allowed) return json({ error: "forbidden" }, 403, h);
  const body = await req.json().catch(() => ({}));
  if (body?.action === "status") {
    return json({ provider: "resend", configured: !!(env.RESEND_API_KEY && env.EMAIL_FROM), from: env.EMAIL_FROM || null,
                  reply_to: env.EMAIL_REPLY_TO || null, webhook_configured: !!env.RESEND_WEBHOOK_SECRET, cron_secret_configured: !!env.WORKER_SECRET }, 200, h);
  }
  try {
    return json(await processQueue(env, fetchImpl, { limit: 25 }), 200, h);
  } catch (e) {
    console.error("email-worker", e);
    return json({ error: "worker_failed" }, 500, h);
  }
}

// ------------------------------------------------------------------ email-webhook endpoint (Resend → Svix signature)
const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytesToB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));

export async function verifySvix(secret, headers, payload, nowSec = Math.floor(Date.now() / 1000)) {
  const id = headers.get("svix-id"), ts = headers.get("svix-timestamp"), sigs = headers.get("svix-signature");
  if (!secret || !id || !ts || !sigs) return false;
  if (!/^\d{9,11}$/.test(ts) || Math.abs(nowSec - Number(ts)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", b64ToBytes(secret.replace(/^whsec_/, "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = bytesToB64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${payload}`)));
  return sigs.split(" ").some((s) => { const [v, sig] = s.split(","); return v === "v1" && safeEqual(sig || "", mac); });
}

export async function handleWebhook(req, env, fetchImpl = fetch) {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const payload = await req.text();
  if (!(await verifySvix(env.RESEND_WEBHOOK_SECRET, req.headers, payload))) return json({ error: "invalid_signature" }, 401);
  let ev; try { ev = JSON.parse(payload); } catch { return json({ error: "bad_json" }, 400); }
  const d = ev.data || {};
  const detail = d.bounce?.message || d.bounce?.subType || d.failed?.reason || null;
  const res = await rpc(env, fetchImpl, "worker_email_event", {
    p_provider_message_id: d.email_id || null, p_event_id: req.headers.get("svix-id"), p_type: ev.type, p_detail: detail, p_at: ev.created_at || null,
  });
  // not matched yet: the worker may not have stored the provider id — ask Resend to retry later
  if (res && res.matched === false && res.recent) return json({ ok: false, retry: true }, 409);
  return json({ ok: true, ...res });
}

// ------------------------------------------------------------------ account-delete endpoint (the signed-in user deletes their own account)
export async function handleAccountDelete(req, env, fetchImpl = fetch) {
  const h = cors(env, req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, h);
  const user = await userFromToken(env, fetchImpl, req);
  if (!user) return json({ error: "not_authenticated" }, 401, h);
  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "DELETE") return json({ error: "confirmation_required" }, 400, h);
  try {
    await rpc(env, fetchImpl, "worker_anonymize_user", { p_user: user.id });
    const r = await fetchImpl(`${env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE", headers: keyHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
    });
    if (!r.ok) throw new Error(`auth delete ${r.status}`);
    return json({ deleted: true }, 200, h);
  } catch (e) {
    console.error("account-delete", e);
    return json({ error: "delete_failed" }, 500, h);
  }
}
