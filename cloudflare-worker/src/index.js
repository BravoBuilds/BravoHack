const KEYS_URL = "https://raw.githubusercontent.com/BravoBuilds/BravoHack/main/Keys.txt";
const KEY_DURATION_MS = 24 * 60 * 60 * 1000;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  },
});

async function ensureSchema(db) {
  await db.exec("CREATE TABLE IF NOT EXISTS key_claims (key TEXT PRIMARY KEY, user_id TEXT NOT NULL, claimed_at TEXT NOT NULL, expires_at TEXT)");
  const columns = await db.prepare("PRAGMA table_info(key_claims)").all();
  const hasExpires = (columns.results || []).some(column => column.name === "expires_at");
  if (!hasExpires) await db.exec("ALTER TABLE key_claims ADD COLUMN expires_at TEXT");

  // All keys are now 24-hour keys. Convert older permanent claims to a
  // 24-hour expiry based on their original claim time.
  await db.exec(`UPDATE key_claims
    SET expires_at = datetime(claimed_at, '+24 hours')
    WHERE expires_at IS NULL`);
}

function parseDuration(value) {
  const v = String(value || "perm").trim().toLowerCase();
  if (!v || v === "perm" || v === "permanent" || v === "forever") return null;

  const match = v.match(/^(\d+(?:\.\d+)?)(s|m|h|d|w)$/);
  if (!match) return undefined;

  const amount = Number(match[1]);
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  const ms = amount * units[match[2]];
  if (!Number.isFinite(ms) || ms <= 0) return undefined;
  return ms;
}

async function getKeyInfo(key) {
  const response = await fetch(KEYS_URL, { headers: { "User-Agent": "BravoHack-KeyAPI/1.0" } });
  if (!response.ok) return null;

  const text = await response.text();
  for (const line of text.split(/\\r?\\n/)) {
    const parts = line.split("|").map(part => part.trim());
    if (!parts[0]) continue;
    if (parts[0].toLowerCase() !== key.toLowerCase()) continue;

    const duration = parseDuration(parts[1] || "perm");
    if (duration === undefined) return { invalidDuration: true };
    return { key: parts[0], duration };
  }
  return false;
}

async function handlePost(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ ok:false, error:"INVALID_JSON" }, 400); }

  const key = typeof body?.key === "string" ? body.key.trim() : "";
  const userId = typeof body?.userId === "string" ? body.userId.trim() : String(body?.userId ?? "").trim();

  if (!key) return json({ ok:false, error:"MISSING_KEY" }, 400);
  if (!/^\d{1,20}$/.test(userId)) return json({ ok:false, error:"INVALID_USER_ID" }, 400);

  const keyInfo = await getKeyInfo(key);
  if (keyInfo === null) return json({ ok:false, error:"KEY_SOURCE_UNAVAILABLE" }, 503);
  if (!keyInfo) return json({ ok:false, error:"INVALID_KEY" }, 404);
  if (keyInfo.invalidDuration) return json({ ok:false, error:"INVALID_KEY_DURATION" }, 500);

  await ensureSchema(env.DB);

  const existing = await env.DB.prepare("SELECT user_id, claimed_at, expires_at FROM key_claims WHERE key = ?").bind(key).first();
  if (existing?.expires_at && Date.parse(existing.expires_at) <= Date.now()) {
    return json({ ok:false, error:"KEY_EXPIRED", expiredAt:existing.expires_at }, 410);
  }

  const claimedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + KEY_DURATION_MS).toISOString();

  // The primary key makes the first claim win atomically.
  await env.DB.prepare("INSERT OR IGNORE INTO key_claims (key, user_id, claimed_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(key, userId, claimedAt, expiresAt).run();

  const row = await env.DB.prepare("SELECT user_id, claimed_at, expires_at FROM key_claims WHERE key = ?").bind(key).first();
  if (!row) return json({ ok:false, error:"DATABASE_ERROR" }, 500);

  if (String(row.user_id) !== userId) {
    return json({ ok:false, error:"KEY_ALREADY_USED", userId:String(row.user_id) }, 409);
  }

  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) {
    return json({ ok:false, error:"KEY_EXPIRED", expiredAt:row.expires_at }, 410);
  }

  return json({ ok:true, claimed:!existing, key, userId, claimedAt:row.claimed_at, expiresAt:row.expires_at, permanent:!row.expires_at });
}

async function handleList(env) {
  const response = await fetch(KEYS_URL, { headers: { "User-Agent": "BravoHack-KeyAPI/1.0" } });
  if (!response.ok) return json({ ok:false, error:"KEY_SOURCE_UNAVAILABLE" }, 503);

  const source = await response.text();
  await ensureSchema(env.DB);

  const rows = await env.DB.prepare("SELECT key, user_id, claimed_at, expires_at FROM key_claims").all();
  const claims = new Map((rows.results || []).map(row => [String(row.key).toLowerCase(), row]));

  const keys = [];
  for (const line of source.split(/\r?\n/)) {
    const parts = line.split("|").map(part => part.trim());
    const key = parts[0];
    if (!key) continue;

    const row = claims.get(key.toLowerCase());
    const expired = !!row?.expires_at && Date.parse(row.expires_at) <= Date.now();
    keys.push({
      key,
      used: !!row,
      expired,
      expiresAt: row?.expires_at || null
    });
  }

  return json({ ok:true, durationHours:24, keys });
}

async function handleGet(request, env) {
  const url = new URL(request.url);
  const key = (url.searchParams.get("key") || "").trim();
  if (!key) return json({ ok:false, error:"MISSING_KEY" }, 400);

  const keyInfo = await getKeyInfo(key);
  if (keyInfo === null) return json({ ok:false, error:"KEY_SOURCE_UNAVAILABLE" }, 503);
  if (!keyInfo) return json({ ok:false, error:"INVALID_KEY" }, 404);
  if (keyInfo.invalidDuration) return json({ ok:false, error:"INVALID_KEY_DURATION" }, 500);

  await ensureSchema(env.DB);
  const row = await env.DB.prepare("SELECT user_id, claimed_at, expires_at FROM key_claims WHERE key = ?").bind(key).first();

  if (!row) return json({ ok:true, valid:true, used:false, userId:null, duration: keyInfo.duration ? true : false });
  const expired = !!row.expires_at && Date.parse(row.expires_at) <= Date.now();
  return json({ ok:true, valid:!expired, used:true, expired, userId:String(row.user_id), claimedAt:row.claimed_at, expiresAt:row.expires_at, permanent:false, durationHours:24 });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, {
      status:204,
      headers:{
        "Access-Control-Allow-Origin":"*",
        "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
        "Access-Control-Allow-Headers":"Content-Type"
      }
    });

    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/key" && request.method === "POST") return await handlePost(request, env);
      if (url.pathname === "/api/key" && request.method === "GET") return await handleGet(request, env);
      if (url.pathname === "/api/keys" && request.method === "GET") return await handleList(env);
      return json({ ok:true, service:"BravoHack Key API", endpoint:"/api/key" });
    } catch {
      return json({ ok:false, error:"INTERNAL_ERROR", message:"Key API is temporarily unavailable." }, 500);
    }
  }
};
