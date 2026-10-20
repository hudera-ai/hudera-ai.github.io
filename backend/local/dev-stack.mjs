// LOCAL TESTING ONLY — a small stand-in for a Supabase project:
//   /rest/v1/*       → PostgREST (the same REST layer Supabase uses) on the local Postgres
//   /auth/v1/*       → a fake Google sign-in + GoTrue subset (authorize/PKCE token/user/logout/admin delete)
//   /functions/v1/*  → the real Edge Function handlers from ../supabase/functions/_shared/handlers.js
//   /_resend/*       → a fake Resend API that records messages (and can be told to fail)
// Run: node local/dev-stack.mjs   (needs PostgREST binary path in PGRST_BIN and Postgres running)
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import pg from "pg";
import { handleWorker, handleWebhook, handleAccountDelete } from "../supabase/functions/_shared/handlers.js";

export const JWT_SECRET = "local-only-jwt-secret-for-tests-0123456789abcdef";
const PORT = Number(process.env.PORT || 54321);
const PGRST_PORT = Number(process.env.PGRST_PORT || 3400);
const DB = process.env.DB_URI || "postgres://root@/hudera_test?host=/var/run/postgresql";
const b64u = (b) => Buffer.from(b).toString("base64url");
export function sign(claims, ttl = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const body = { iat: now, exp: now + ttl, ...claims };
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" })), pay = b64u(JSON.stringify(body));
  return `${head}.${pay}.${crypto.createHmac("sha256", JWT_SECRET).update(`${head}.${pay}`).digest("base64url")}`;
}
function verify(token) {
  const [h, p, s] = String(token || "").split(".");
  if (!s || crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url") !== s) return null;
  const c = JSON.parse(Buffer.from(p, "base64url"));
  return c.exp > Date.now() / 1000 ? c : null;
}
export const ANON_KEY = sign({ role: "anon", iss: "local" }, 10 * 365 * 86400);
export const SERVICE_KEY = sign({ role: "service_role", iss: "local" }, 10 * 365 * 86400);
const SITE = process.env.SITE_URL || "http://localhost:3301";

const pool = new pg.Pool({ connectionString: DB });
const codes = new Map();      // auth code → { userId, challenge }
const refresh = new Map();    // refresh token → userId
export const resendLog = [];  // fake Resend outbox
let resendMode = process.env.RESEND_MODE || "ok"; // ok | fail500 | fail422

const TEST_ACCOUNTS = [
  { sub: "109000000000000000001", email: "owner@hudera.test", name: "Ahmed Owner" },
  { sub: "109000000000000000002", email: "sara.client@example.com", name: "Sara Al-Qahtani" },
  { sub: "109000000000000000003", email: "omar.client@example.com", name: "Omar Al-Harbi" },
  { sub: "109000000000000000004", email: "support@hudera.test", name: "Mona Support" },
];

async function userJson(id) {
  const { rows } = await pool.query("select id, email, raw_user_meta_data, raw_app_meta_data, created_at, last_sign_in_at from auth.users where id = $1", [id]);
  const u = rows[0]; if (!u) return null;
  return { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, app_metadata: u.raw_app_meta_data, user_metadata: u.raw_user_meta_data,
           created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, identities: [] };
}
async function session(userId) {
  const user = await userJson(userId);
  const rt = crypto.randomBytes(16).toString("hex"); refresh.set(rt, userId);
  return { access_token: sign({ sub: userId, role: "authenticated", aud: "authenticated", email: user.email }), token_type: "bearer",
           expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: rt, user };
}
// what GoTrue does on a Google sign-in: create the user on first sign-in, then stamp last_sign_in_at
export async function googleSignIn(acc) {
  const meta = { sub: acc.sub, provider_id: acc.sub, name: acc.name, full_name: acc.name, email: acc.email, email_verified: true,
                 avatar_url: `https://lh3.googleusercontent.com/a/${acc.sub}`, picture: `https://lh3.googleusercontent.com/a/${acc.sub}`, iss: "https://accounts.google.com" };
  let { rows } = await pool.query("select id from auth.users where email = $1", [acc.email]);
  if (!rows[0]) {
    ({ rows } = await pool.query("insert into auth.users (email, raw_user_meta_data, raw_app_meta_data, email_confirmed_at) values ($1, $2, $3, now()) returning id",
                                 [acc.email, meta, { provider: "google", providers: ["google"] }]));
    await pool.query("insert into auth.identities (user_id, provider, provider_id, identity_data) values ($1, 'google', $2, $3)", [rows[0].id, acc.sub, meta]);
  }
  await pool.query("update auth.users set last_sign_in_at = now(), raw_user_meta_data = $2 where id = $1", [rows[0].id, meta]);
  return rows[0].id;
}

const env = {
  SUPABASE_URL: `http://localhost:${PORT}`, SUPABASE_ANON_KEY: ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  RESEND_API_KEY: "re_local_test", RESEND_API_URL: `http://localhost:${PORT}/_resend/emails`, EMAIL_FROM: "HUDERA AI <hello@huderaai.test>",
  EMAIL_REPLY_TO: "hudera.ai@gmail.com", SITE_URL: SITE, WORKER_SECRET: "local-worker-secret", RESEND_WEBHOOK_SECRET: "whsec_" + Buffer.from("local-webhook-secret-32-bytes!!!").toString("base64"),
  ALLOWED_ORIGINS: `${SITE},http://localhost:${PORT}`,
};
export const LOCAL_ENV = env;

const readBody = (req) => new Promise((res) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => res(Buffer.concat(c))); });
const send = (res, status, body, headers = {}) => { res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", ...headers }); res.end(typeof body === "string" ? body : JSON.stringify(body)); };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, prefer, accept-profile, content-profile, x-worker-secret, x-supabase-api-version", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS" };

async function toWebRequest(req, url, body) {
  const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  return new Request(url, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (req.method === "OPTIONS" && !url.pathname.startsWith("/functions/")) { res.writeHead(204, CORS); return res.end(); }
    // ---------------- REST → PostgREST
    if (url.pathname.startsWith("/rest/v1/")) {
      const body = await readBody(req);
      const headers = { ...req.headers }; delete headers.host; delete headers["content-length"];
      if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
      const r = await fetch(`http://localhost:${PGRST_PORT}${url.pathname.slice(8)}${url.search}`, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
      const out = Buffer.from(await r.arrayBuffer());
      res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "application/json", ...CORS }); return res.end(out);
    }
    // ---------------- fake Google + GoTrue
    if (url.pathname === "/auth/v1/authorize") {
      const redirect = url.searchParams.get("redirect_to") || SITE, challenge = url.searchParams.get("code_challenge");
      if (url.searchParams.get("pick")) {
        const acc = TEST_ACCOUNTS.find((a) => a.email === url.searchParams.get("pick")) || { sub: String(Date.now()), email: url.searchParams.get("pick"), name: url.searchParams.get("pick").split("@")[0] };
        const userId = await googleSignIn(acc);
        const code = crypto.randomUUID(); codes.set(code, { userId, challenge });
        const to = new URL(redirect); to.searchParams.set("code", code);
        res.writeHead(302, { location: to.toString() }); return res.end();
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(`<!doctype html><title>Local Google sign-in (test)</title><body style="font-family:sans-serif;padding:40px"><h2>Choose an account (local test)</h2>${TEST_ACCOUNTS.map((a) => `<p><a id="pick-${a.email.split("@")[0].replace(/\W/g, "")}" href="${url.pathname}${url.search}&pick=${encodeURIComponent(a.email)}">${a.name} — ${a.email}</a></p>`).join("")}</body>`);
    }
    if (url.pathname === "/auth/v1/token") {
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      const grant = url.searchParams.get("grant_type");
      if (grant === "pkce") {
        const c = codes.get(body.auth_code); codes.delete(body.auth_code);
        const ok = c && crypto.createHash("sha256").update(body.code_verifier || "").digest("base64url") === c.challenge;
        if (!ok) return send(res, 400, { error: "invalid_grant", error_description: "bad code or verifier" }, CORS);
        return send(res, 200, await session(c.userId), CORS);
      }
      if (grant === "refresh_token") {
        const uid = refresh.get(body.refresh_token); if (!uid) return send(res, 400, { error: "invalid_grant" }, CORS);
        refresh.delete(body.refresh_token); return send(res, 200, await session(uid), CORS);
      }
      return send(res, 400, { error: "unsupported_grant_type" }, CORS);
    }
    if (url.pathname === "/auth/v1/user") {
      const c = verify((req.headers.authorization || "").replace(/^Bearer /i, ""));
      if (!c?.sub) return send(res, 401, { msg: "invalid JWT" }, CORS);
      const u = await userJson(c.sub); return u ? send(res, 200, u, CORS) : send(res, 404, { msg: "user not found" }, CORS);
    }
    if (url.pathname === "/auth/v1/logout") { res.writeHead(204, CORS); return res.end(); }
    if (url.pathname.startsWith("/auth/v1/admin/users/") && req.method === "DELETE") {
      const c = verify((req.headers.authorization || "").replace(/^Bearer /i, ""));
      if (c?.role !== "service_role") return send(res, 403, { msg: "forbidden" });
      await pool.query("delete from auth.users where id = $1", [url.pathname.split("/").pop()]);
      return send(res, 200, {});
    }
    // ---------------- Edge Functions (real handlers)
    if (url.pathname.startsWith("/functions/v1/")) {
      const name = url.pathname.split("/")[3];
      const fn = { "email-worker": handleWorker, "email-webhook": handleWebhook, "account-delete": handleAccountDelete }[name];
      if (!fn) return send(res, 404, { error: "no such function" });
      const r = await fn(await toWebRequest(req, url.toString(), await readBody(req)), env, fetch);
      res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
    }
    // ---------------- fake Resend
    if (url.pathname === "/_resend/emails" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString());
      if (resendMode === "fail500") return send(res, 503, { name: "internal_server_error", message: "temporary" });
      if (resendMode === "fail422" || /@bounce\./.test(body.to?.[0] || "")) return send(res, 422, { name: "validation_error", message: "Invalid `to` field" });
      const id = crypto.randomUUID(); resendLog.push({ id, ...body, idem: req.headers["idempotency-key"] });
      return send(res, 200, { id });
    }
    if (url.pathname === "/_resend/log") return send(res, 200, resendLog.map(({ html, ...m }) => m), CORS);
    if (url.pathname === "/_resend/mode") { resendMode = url.searchParams.get("m") || "ok"; return send(res, 200, { mode: resendMode }); }
    if (url.pathname === "/_test/keys") return send(res, 200, { anon: ANON_KEY, service: SERVICE_KEY, webhook_secret: env.RESEND_WEBHOOK_SECRET, worker_secret: env.WORKER_SECRET }, CORS);
    send(res, 404, { error: "not found" });
  } catch (e) {
    console.error(e); send(res, 500, { error: String(e.message || e) }, CORS);
  }
});

let pgrst = null;
export function start() {
  return new Promise((resolve) => {
    if (process.env.PGRST_BIN) {
      pgrst = spawn(process.env.PGRST_BIN, [], { env: { ...process.env,
        PGRST_DB_URI: process.env.PGRST_DB_URI || "postgres://authenticator:authenticator@localhost:5432/hudera_test",
        PGRST_DB_SCHEMAS: "public", PGRST_DB_ANON_ROLE: "anon", PGRST_JWT_SECRET: JWT_SECRET, PGRST_SERVER_PORT: String(PGRST_PORT),
        PGRST_DB_CHANNEL_ENABLED: "true", PGRST_LOG_LEVEL: "warn" }, stdio: ["ignore", "inherit", "inherit"] });
    }
    server.listen(PORT, () => setTimeout(resolve, 1200));
  });
}
export function stop() { pgrst?.kill(); server.close(); return pool.end(); }
if (import.meta.url === `file://${process.argv[1]}`) start().then(() => console.log(`local stack on :${PORT}`));
