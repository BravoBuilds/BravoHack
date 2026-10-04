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

function getExpiry(claimedAt) {
  const timestamp = Date.parse(claimedAt);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + KEY_DURATION_MS).toISOString();
}

function isExpired(claimedAt) {
  const timestamp = Date.parse(claimedAt);
  return Number.isFinite(timestamp) && timestamp + KEY_DURATION_MS <= Date.now();
}

async function ensureSchema(db) {
  if (!db) throw new Error("D1 binding DB is missing.");

  // Keep the database schema minimal and compatible with the original table.
  // Expiry is derived from claimed_at, so no ALTER TABLE migration is needed.
  await db.exec(
    "CREATE TABLE IF NOT EXISTS key_claims (key TEXT PRIMARY KEY, user_id TEXT NOT NULL, claimed_at TEXT NOT NULL)"
  );
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
  const response = await fetch(KEYS_URL, {
    headers: { "User-Agent": "BravoHack-KeyAPI/1.0" },
  });
  if (!response.ok) return null;

  const text = await response.text();
  for (const line of text.split(/\r?\n/)) {
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
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "INVALID_JSON" }, 400);
  }

  const key = typeof body?.key === "string" ? body.key.trim() : "";
  const userId = typeof body?.userId === "string"
    ? body.userId.trim()
    : String(body?.userId ?? "").trim();

  if (!key) return json({ ok: false, error: "MISSING_KEY" }, 400);
  if (!/^\d{1,20}$/.test(userId)) {
    return json({ ok: false, error: "INVALID_USER_ID" }, 400);
  }

  const keyInfo = await getKeyInfo(key);
  if (keyInfo === null) {
    return json({ ok: false, error: "KEY_SOURCE_UNAVAILABLE" }, 503);
  }
  if (!keyInfo) return json({ ok: false, error: "INVALID_KEY" }, 404);
  if (keyInfo.invalidDuration) {
    return json({ ok: false, error: "INVALID_KEY_DURATION" }, 500);
  }

  const canonicalKey = keyInfo.key;
  await ensureSchema(env.DB);

  const existing = await env.DB
    .prepare("SELECT user_id, claimed_at FROM key_claims WHERE key = ?")
    .bind(canonicalKey)
    .first();

  if (existing && isExpired(existing.claimed_at)) {
    return json({
      ok: false,
      error: "KEY_EXPIRED",
      expiredAt: getExpiry(existing.claimed_at),
    }, 410);
  }

  const claimedAt = new Date().toISOString();

  // The primary key makes the first claim win atomically.
  await env.DB
    .prepare(
      "INSERT OR IGNORE INTO key_claims (key, user_id, claimed_at) VALUES (?, ?, ?)"
    )
    .bind(canonicalKey, userId, claimedAt)
    .run();

  const row = await env.DB
    .prepare("SELECT user_id, claimed_at FROM key_claims WHERE key = ?")
    .bind(canonicalKey)
    .first();

  if (!row) return json({ ok: false, error: "DATABASE_ERROR" }, 500);

  if (String(row.user_id) !== userId) {
    return json({
      ok: false,
      error: "KEY_ALREADY_USED",
      userId: String(row.user_id),
    }, 409);
  }

  if (isExpired(row.claimed_at)) {
    return json({
      ok: false,
      error: "KEY_EXPIRED",
      expiredAt: getExpiry(row.claimed_at),
    }, 410);
  }

  return json({
    ok: true,
    claimed: !existing,
    key: canonicalKey,
    userId,
    claimedAt: row.claimed_at,
    expiresAt: getExpiry(row.claimed_at),
    permanent: false,
  });
}

async function handleList(env) {
  const response = await fetch(KEYS_URL, {
    headers: { "User-Agent": "BravoHack-KeyAPI/1.0" },
  });
  if (!response.ok) {
    return json({ ok: false, error: "KEY_SOURCE_UNAVAILABLE" }, 503);
  }

  const source = await response.text();
  await ensureSchema(env.DB);

  const rows = await env.DB
    .prepare("SELECT key, user_id, claimed_at FROM key_claims")
    .all();

  const claims = new Map(
    (rows.results || []).map(row => [String(row.key).toLowerCase(), row])
  );

  const keys = [];
  for (const line of source.split(/\r?\n/)) {
    const parts = line.split("|").map(part => part.trim());
    const key = parts[0];
    if (!key) continue;

    const row = claims.get(key.toLowerCase());
    const expired = !!row && isExpired(row.claimed_at);

    keys.push({
      key,
      used: !!row,
      expired,
      expiresAt: row ? getExpiry(row.claimed_at) : null,
    });
  }

  return json({ ok: true, durationHours: 24, keys });
}

async function handleGet(request, env) {
  const url = new URL(request.url);
  const key = (url.searchParams.get("key") || "").trim();
  if (!key) return json({ ok: false, error: "MISSING_KEY" }, 400);

  const keyInfo = await getKeyInfo(key);
  if (keyInfo === null) {
    return json({ ok: false, error: "KEY_SOURCE_UNAVAILABLE" }, 503);
  }
  if (!keyInfo) return json({ ok: false, error: "INVALID_KEY" }, 404);
  if (keyInfo.invalidDuration) {
    return json({ ok: false, error: "INVALID_KEY_DURATION" }, 500);
  }

  await ensureSchema(env.DB);

  const row = await env.DB
    .prepare("SELECT user_id, claimed_at FROM key_claims WHERE key = ?")
    .bind(keyInfo.key)
    .first();

  if (!row) {
    return json({
      ok: true,
      valid: true,
      used: false,
      userId: null,
      duration: keyInfo.duration ? true : false,
      durationHours: 24,
    });
  }

  const expired = isExpired(row.claimed_at);
  return json({
    ok: true,
    valid: !expired,
    used: true,
    expired,
    userId: String(row.user_id),
    claimedAt: row.claimed_at,
    expiresAt: getExpiry(row.claimed_at),
    permanent: false,
    durationHours: 24,
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    try {
      const url = new URL(request.url);

      if ((url.pathname === "/" || url.pathname === "/api/key") && request.method === "POST") {
        return await handlePost(request, env);
      }

      if (url.pathname === "/api/key" && request.method === "GET") {
        return await handleGet(request, env);
      }

      if (url.pathname === "/api/keys" && request.method === "GET") {
        return await handleList(env);
      }

      return json({
        ok: true,
        service: "BravoHack Key API",
        endpoint: "/api/key",
      });
    } catch (error) {
      console.error("BravoHack Key API error:", error);
      return json({
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Key API internal error.",
      }, 500);
    }
  },
};
