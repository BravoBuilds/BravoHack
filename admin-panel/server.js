"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = __dirname;
const HTML_PATH = path.join(ROOT, "public", "index.html");
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnv(path.join(ROOT, ".env"));

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || "";
const WORKER_URL = process.env.WORKER_URL || "https://bravohack.tmneijsel.workers.dev";
const SESSION_TTL = 8 * 60 * 60 * 1000;
const ALLOWED_DURATIONS = new Set(["24h", "7d", "30d", "90d"]);
const sessions = new Map();

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  });
  res.end(JSON.stringify(body));
}
function text(res, status, body) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(body);
}
function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  if (a.length !== b.length) {
    const size = Math.max(a.length, b.length);
    const aa = Buffer.alloc(size), bb = Buffer.alloc(size);
    a.copy(aa); b.copy(bb);
    crypto.timingSafeEqual(aa, bb);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}
function isLoopbackHost(req) {
  const host = String(req.headers.host || "").toLowerCase();
  return host === "localhost:" + PORT || host === "127.0.0.1:" + PORT;
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "http:" && parsed.host.toLowerCase() === String(req.headers.host || "").toLowerCase()
      && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  } catch { return false; }
}
function cookieToken(req) {
  for (const bit of String(req.headers.cookie || "").split(";")) {
    const i = bit.indexOf("=");
    if (i >= 0 && bit.slice(0, i).trim() === "bh_admin") return decodeURIComponent(bit.slice(i + 1).trim());
  }
  return "";
}
function currentSession(req) {
  const token = cookieToken(req);
  const expiry = token && sessions.get(token);
  if (!expiry || expiry <= Date.now()) { if (token) sessions.delete(token); return null; }
  return token;
}
function requireSession(req, res) {
  if (currentSession(req)) return true;
  json(res, 401, { ok: false, error: "LOGIN_REQUIRED" });
  return false;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "", length = 0;
    req.setEncoding("utf8");
    req.on("data", chunk => {
      length += Buffer.byteLength(chunk);
      if (length > 32 * 1024) { reject(new Error("Request body too large.")); req.destroy(); return; }
      data += chunk;
    });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error("Invalid JSON.")); }
    });
    req.on("error", reject);
  });
}
function cookie(token, maxAge) {
  return "bh_admin=" + encodeURIComponent(token) + "; HttpOnly; SameSite=Strict; Path=/; Max-Age=" + maxAge;
}
async function proxyAdmin(res, method, body, key) {
  let endpoint;
  try {
    const base = new URL(WORKER_URL);
    if (base.protocol !== "https:") throw new Error("WORKER_URL must use HTTPS.");
    endpoint = new URL("/api/admin/keys", base);
  } catch {
    json(res, 500, { ok: false, error: "INVALID_WORKER_URL" });
    return;
  }
  if (method === "DELETE") endpoint.searchParams.set("key", key);
  const headers = { Accept: "application/json", Authorization: "Bearer " + ADMIN_API_TOKEN };
  const options = { method, headers, signal: AbortSignal.timeout(15000) };
  if (body !== undefined) { headers["Content-Type"] = "application/json"; options.body = JSON.stringify(body); }
  try {
    const upstream = await fetch(endpoint, options);
    let data;
    try { data = JSON.parse(await upstream.text()); } catch { data = { ok: false, error: "INVALID_UPSTREAM_RESPONSE" }; }
    json(res, upstream.status, data);
  } catch {
    json(res, 502, { ok: false, error: "KEY_API_UNREACHABLE", message: "Cannot reach the key API. Check Worker deployment and ADMIN_API_TOKEN." });
  }
}
const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  if (!isLoopbackHost(req)) { text(res, 421, "This panel only accepts localhost requests."); return; }
  const url = new URL(req.url || "/", "http://" + req.headers.host);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    try {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(fs.readFileSync(HTML_PATH));
    } catch { text(res, 500, "Missing admin-panel/public/index.html"); }
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/session") {
    json(res, 200, { ok: true, authenticated: !!currentSession(req) }); return;
  }
  if (req.method === "POST" && url.pathname === "/api/login") {
    if (!sameOrigin(req)) { json(res, 403, { ok: false, error: "BAD_ORIGIN" }); return; }
    try {
      const body = await readBody(req);
      if (!safeEqual(typeof body.password === "string" ? body.password : "", ADMIN_PASSWORD)) {
        json(res, 401, { ok: false, error: "INVALID_PASSWORD" }); return;
      }
      const token = crypto.randomBytes(32).toString("hex");
      sessions.set(token, Date.now() + SESSION_TTL);
      res.setHeader("Set-Cookie", cookie(token, SESSION_TTL / 1000));
      json(res, 200, { ok: true });
    } catch (error) { json(res, 400, { ok: false, error: "BAD_REQUEST", message: error.message }); }
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/logout") {
    if (!sameOrigin(req)) { json(res, 403, { ok: false, error: "BAD_ORIGIN" }); return; }
    if (!requireSession(req, res)) return;
    const token = currentSession(req);
    if (token) sessions.delete(token);
    res.setHeader("Set-Cookie", cookie("", 0));
    json(res, 200, { ok: true }); return;
  }
  if (url.pathname === "/api/keys") {
    if (!requireSession(req, res)) return;
    if (req.method === "GET") { await proxyAdmin(res, "GET"); return; }
    if (!sameOrigin(req)) { json(res, 403, { ok: false, error: "BAD_ORIGIN" }); return; }
    if (req.method === "POST") {
      try {
        const body = await readBody(req);
        const count = Number(body.count ?? 1);
        const duration = String(body.duration || "24h");
        if (!Number.isInteger(count) || count < 1 || count > 50) {
          json(res, 400, { ok: false, error: "INVALID_COUNT", message: "Choose between 1 and 50 keys." }); return;
        }
        if (!ALLOWED_DURATIONS.has(duration)) {
          json(res, 400, { ok: false, error: "INVALID_DURATION", message: "Choose 24h, 7d, 30d or 90d." }); return;
        }
        await proxyAdmin(res, "POST", { count, duration });
      } catch (error) { json(res, 400, { ok: false, error: "BAD_REQUEST", message: error.message }); }
      return;
    }
    if (req.method === "DELETE") {
      const key = String(url.searchParams.get("key") || "").trim();
      if (!/^KEY[A-Z0-9]{8,128}$/i.test(key)) { json(res, 400, { ok: false, error: "INVALID_KEY" }); return; }
      await proxyAdmin(res, "DELETE", undefined, key); return;
    }
  }
  json(res, 404, { ok: false, error: "NOT_FOUND" });
});
function start() {
  if (Number(process.versions.node.split(".")[0]) < 18) {
    console.error("BravoHack Admin requires Node.js 18 or newer."); process.exitCode = 1; return;
  }
  if (ADMIN_PASSWORD.length < 12) {
    console.error("Set ADMIN_PASSWORD in admin-panel/.env (at least 12 characters)."); process.exitCode = 1; return;
  }
  if (ADMIN_API_TOKEN.length < 24) {
    console.error("Set ADMIN_API_TOKEN in admin-panel/.env and as a Cloudflare Worker secret."); process.exitCode = 1; return;
  }
  server.listen(PORT, HOST, () => {
    console.log("BravoHack Admin running at http://127.0.0.1:" + PORT);
    console.log("Loopback only. Keep admin-panel/.env private.");
  });
}
if (require.main === module) start();
