const KEYS_URL = "https://raw.githubusercontent.com/BravoBuilds/BravoHack/main/Keys.txt";

const json = (data, status = 200, allowCors = true) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
  if (allowCors) headers["Access-Control-Allow-Origin"] = "*";
  return new Response(JSON.stringify(data), { status, headers });
};
const adminJson = (data, status = 200) => json(data, status, false);

function getExpiry(claimedAt, durationMs) {
  if (durationMs == null) return null;
  const timestamp = Date.parse(claimedAt);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + durationMs).toISOString();
}

function isExpired(claimedAt, durationMs) {
  if (durationMs == null) return false;
  const timestamp = Date.parse(claimedAt);
  return Number.isFinite(timestamp) && timestamp + durationMs <= Date.now();
}

async function ensureSchema(db) {
  if (!db) throw new Error("D1 binding DB is missing.");
  await db.exec(
    "CREATE TABLE IF NOT EXISTS key_claims (key TEXT PRIMARY KEY, user_id TEXT NOT NULL, claimed_at TEXT NOT NULL)"
  );
  await db.exec(
    "CREATE TABLE IF NOT EXISTS key_catalog (key TEXT PRIMARY KEY, duration_ms INTEGER, created_at TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, revoked_at TEXT)"
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
  if (!Number.isFinite(ms) || ms <= 0 || ms > 3650 * 86400000) return undefined;
  return ms;
}

function durationLabel(durationMs) {
  if (durationMs == null) return "Permanent";
  for (const [label, unit] of [["d", 86400000], ["h", 3600000], ["m", 60000], ["s", 1000]]) {
    if (durationMs % unit === 0) return String(durationMs / unit) + label;
  }
  return String(Math.round(durationMs / 3600000 * 100) / 100) + "h";
}

async function readLegacyKey(key) {
  const response = await fetch(KEYS_URL, {
    headers: { "User-Agent": "BravoHack-KeyAPI/1.0" },
  });
  if (!response.ok) return null;

  const text = await response.text();
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split("|").map(part => part.trim());
    if (!parts[0]) continue;
    if (parts[0].toLowerCase() !== key.toLowerCase()) continue;
    const durationMs = parseDuration(parts[1] || "24h");
    if (durationMs === undefined) return { invalidDuration: true };
    return { key: parts[0], durationMs, revoked: false, source: "repository" };
  }
  return false;
}

async function getKeyInfo(key, env) {
  await ensureSchema(env.DB);
  const catalogRow = await env.DB
    .prepare("SELECT key, duration_ms, created_at, revoked, revoked_at FROM key_catalog WHERE lower(key) = lower(?) LIMIT 1")
    .bind(key)
    .first();

  if (catalogRow) {
    return {
      key: String(catalogRow.key),
      durationMs: catalogRow.duration_ms == null ? null : Number(catalogRow.duration_ms),
      revoked: Number(catalogRow.revoked) === 1,
      source: "database",
      createdAt: catalogRow.created_at,
      revokedAt: catalogRow.revoked_at || null,
    };
  }

  return await readLegacyKey(key);
}

function safeEquals(left, right) {
  const a = new TextEncoder().encode(String(left || ""));
  const b = new TextEncoder().encode(String(right || ""));
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}

function adminAuthorized(request, env) {
  const expected = String(env.ADMIN_API_TOKEN || "");
  if (!expected) return "not-configured";
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return safeEquals(token, expected);
}

function generateKey() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return "KEY" + Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function getLegacyEntries() {
  const response = await fetch(KEYS_URL, {
    headers: { "User-Agent": "BravoHack-KeyAPI/1.0" },
  });
  if (!response.ok) return null;

  const source = await response.text();
  const entries = new Map();
  for (const line of source.split(/\r?\n/)) {
    const parts = line.split("|").map(part => part.trim());
    if (!parts[0]) continue;
    const durationMs = parseDuration(parts[1] || "24h");
    entries.set(parts[0].toLowerCase(), {
      key: parts[0],
      durationMs: durationMs === undefined ? 86400000 : durationMs,
      revoked: false,
      source: "repository",
      createdAt: null,
    });
  }
  return { source, entries };
}

async function handleAdmin(request, env, url) {
  const auth = adminAuthorized(request, env);
  if (auth === "not-configured") {
    return adminJson({ ok: false, error: "ADMIN_API_NOT_CONFIGURED" }, 503);
  }
  if (!auth) return adminJson({ ok: false, error: "UNAUTHORIZED" }, 401);

  await ensureSchema(env.DB);

  if (request.method === "GET") {
    const legacy = await getLegacyEntries();
    if (!legacy) return adminJson({ ok: false, error: "KEY_SOURCE_UNAVAILABLE" }, 503);

    const [catalogResult, claimsResult] = await Promise.all([
      env.DB.prepare("SELECT key, duration_ms, created_at, revoked, revoked_at FROM key_catalog").all(),
      env.DB.prepare("SELECT key, user_id, claimed_at FROM key_claims").all(),
    ]);

    const entries = new Map(legacy.entries);
    for (const row of (catalogResult.results || [])) {
      entries.set(String(row.key).toLowerCase(), {
        key: String(row.key),
        durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
        revoked: Number(row.revoked) === 1,
        source: "database",
        createdAt: row.created_at || null,
        revokedAt: row.revoked_at || null,
      });
    }

    const claims = new Map(
      (claimsResult.results || []).map(row => [String(row.key).toLowerCase(), row])
    );

    const keys = [];
    for (const entry of entries.values()) {
      const claim = claims.get(entry.key.toLowerCase());
      const expired = !!claim && isExpired(claim.claimed_at, entry.durationMs);
      const status = entry.revoked ? "REVOKED" : !claim ? "UNUSED" : expired ? "EXPIRED" : "USED";
      keys.push({
        key: entry.key,
        duration: durationLabel(entry.durationMs),
        durationMs: entry.durationMs,
        status,
        used: !!claim,
        expired,
        revoked: entry.revoked,
        userId: claim ? String(claim.user_id) : null,
        claimedAt: claim ? claim.claimed_at : null,
        expiresAt: claim ? getExpiry(claim.claimed_at, entry.durationMs) : null,
        createdAt: entry.createdAt,
        source: entry.source,
      });
    }
    keys.sort((a, b) => {
      const aDate = a.createdAt || a.claimedAt || "";
      const bDate = b.createdAt || b.claimedAt || "";
      return bDate.localeCompare(aDate) || a.key.localeCompare(b.key);
    });

    return adminJson({ ok: true, keys, generatedAt: new Date().toISOString() });
  }

  if (request.method === "POST") {
    let body;
    try { body = await request.json(); }
    catch { return adminJson({ ok: false, error: "INVALID_JSON" }, 400); }

    const count = Number(body?.count ?? 1);
    const durationInput = String(body?.duration || "24h").trim().toLowerCase();
    const durationMs = parseDuration(durationInput);
    const allowedDurations = new Set(["24h", "7d", "30d", "90d"]);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      return adminJson({ ok: false, error: "INVALID_COUNT", message: "Count must be between 1 and 50." }, 400);
    }
    if (!allowedDurations.has(durationInput) || durationMs == null || durationMs === undefined) {
      return adminJson({ ok: false, error: "INVALID_DURATION", message: "Choose 24h, 7d, 30d, or 90d." }, 400);
    }

    const legacy = await getLegacyEntries();
    if (!legacy) return adminJson({ ok: false, error: "KEY_SOURCE_UNAVAILABLE" }, 503);
    const usedNames = new Set(legacy.entries.keys());
    const createdAt = new Date().toISOString();
    const created = [];
    const statements = [];

    while (created.length < count) {
      const key = generateKey();
      if (usedNames.has(key.toLowerCase())) continue;
      usedNames.add(key.toLowerCase());
      created.push({ key, duration: durationLabel(durationMs), status: "UNUSED", createdAt });
      statements.push(
        env.DB.prepare("INSERT INTO key_catalog (key, duration_ms, created_at, revoked, revoked_at) VALUES (?, ?, ?, 0, NULL)")
          .bind(key, durationMs, createdAt)
      );
    }

    await env.DB.batch(statements);
    return adminJson({ ok: true, created, count: created.length });
  }

  if (request.method === "DELETE") {
    const key = (url.searchParams.get("key") || "").trim();
    if (!key) return adminJson({ ok: false, error: "MISSING_KEY" }, 400);

    const keyInfo = await getKeyInfo(key, env);
    if (keyInfo === null) return adminJson({ ok: false, error: "KEY_SOURCE_UNAVAILABLE" }, 503);
    if (!keyInfo) return adminJson({ ok: false, error: "INVALID_KEY" }, 404);
    if (keyInfo.invalidDuration) return adminJson({ ok: false, error: "INVALID_KEY_DURATION" }, 500);
    if (keyInfo.revoked) return adminJson({ ok: true, key: keyInfo.key, status: "REVOKED", alreadyRevoked: true });

    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO key_catalog (key, duration_ms, created_at, revoked, revoked_at) VALUES (?, ?, ?, 1, ?) " +
      "ON CONFLICT(key) DO UPDATE SET revoked = 1, revoked_at = excluded.revoked_at"
    ).bind(keyInfo.key, keyInfo.durationMs == null ? null : keyInfo.durationMs, keyInfo.createdAt || now, now).run();

    return adminJson({ ok: true, key: keyInfo.key, status: "REVOKED" });
  }

  return adminJson({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
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

  const keyInfo = await getKeyInfo(key, env);
  if (keyInfo === null) return json({ ok: false, error: "KEY_SOURCE_UNAVAILABLE" }, 503);
  if (!keyInfo) return json({ ok: false, error: "INVALID_KEY" }, 404);
  if (keyInfo.revoked) return json({ ok: false, error: "KEY_REVOKED" }, 410);
  if (keyInfo.invalidDuration) return json({ ok: false, error: "INVALID_KEY_DURATION" }, 500);

  const canonicalKey = keyInfo.key;
  const durationMs = keyInfo.durationMs;
  const existing = await env.DB
    .prepare("SELECT user_id, claimed_at FROM key_claims WHERE key = ?")
    .bind(canonicalKey)
    .first();

  if (existing && isExpired(existing.claimed_at, durationMs)) {
    return json({
      ok: false,
      error: "KEY_EXPIRED",
      expiredAt: getExpiry(existing.claimed_at, durationMs),
    }, 410);
  }

  const claimedAt = new Date().toISOString();
  await env.DB
    .prepare("INSERT OR IGNORE INTO key_claims (key, user_id, claimed_at) VALUES (?, ?, ?)")
    .bind(canonicalKey, userId, claimedAt)
    .run();

  const row = await env.DB
    .prepare("SELECT user_id, claimed_at FROM key_claims WHERE key = ?")
    .bind(canonicalKey)
    .first();

  if (!row) return json({ ok: false, error: "DATABASE_ERROR" }, 500);

  if (String(row.user_id) !== userId) {
    return json({ ok: false, error: "KEY_ALREADY_USED", userId: String(row.user_id) }, 409);
  }

  if (isExpired(row.claimed_at, durationMs)) {
    return json({
      ok: false,
      error: "KEY_EXPIRED",
      expiredAt: getExpiry(row.claimed_at, durationMs),
    }, 410);
  }

  return json({
    ok: true,
    claimed: !existing,
    key: canonicalKey,
    userId,
    claimedAt: row.claimed_at,
    expiresAt: getExpiry(row.claimed_at, durationMs),
    permanent: durationMs == null,
    duration: durationLabel(durationMs),
  });
}

async function handleList(env) {
  const response = await fetch(KEYS_URL, {
    headers: { "User-Agent": "BravoHack-KeyAPI/1.0" },
  });
  if (!response.ok) return json({ ok: false, error: "KEY_SOURCE_UNAVAILABLE" }, 503);

  const source = await response.text();
  await ensureSchema(env.DB);
  const rows = await env.DB.prepare("SELECT key, user_id, claimed_at FROM key_claims").all();
  const claims = new Map((rows.results || []).map(row => [String(row.key).toLowerCase(), row]));

  const keys = [];
  for (const line of source.split(/\r?\n/)) {
    const parts = line.split("|").map(part => part.trim());
    const key = parts[0];
    if (!key) continue;
    const durationMs = parseDuration(parts[1] || "24h");
    if (durationMs === undefined) continue;
    const row = claims.get(key.toLowerCase());
    const expired = !!row && isExpired(row.claimed_at, durationMs);
    keys.push({
      key,
      used: !!row,
      expired,
      expiresAt: row ? getExpiry(row.claimed_at, durationMs) : null,
    });
  }
  return json({ ok: true, keys });
}

async function handleGet(request, env) {
  const url = new URL(request.url);
  const key = (url.searchParams.get("key") || "").trim();
  if (!key) return json({ ok: false, error: "MISSING_KEY" }, 400);

  const keyInfo = await getKeyInfo(key, env);
  if (keyInfo === null) return json({ ok: false, error: "KEY_SOURCE_UNAVAILABLE" }, 503);
  if (!keyInfo) return json({ ok: false, error: "INVALID_KEY" }, 404);
  if (keyInfo.revoked) return json({ ok: false, error: "KEY_REVOKED" }, 410);
  if (keyInfo.invalidDuration) return json({ ok: false, error: "INVALID_KEY_DURATION" }, 500);

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
      duration: keyInfo.durationMs == null ? "Permanent" : durationLabel(keyInfo.durationMs),
      durationMs: keyInfo.durationMs,
      durationHours: keyInfo.durationMs == null ? null : keyInfo.durationMs / 3600000,
    });
  }

  const expired = isExpired(row.claimed_at, keyInfo.durationMs);
  return json({
    ok: true,
    valid: !expired,
    used: true,
    expired,
    userId: String(row.user_id),
    claimedAt: row.claimed_at,
    expiresAt: getExpiry(row.claimed_at, keyInfo.durationMs),
    permanent: keyInfo.durationMs == null,
    duration: keyInfo.durationMs == null ? "Permanent" : durationLabel(keyInfo.durationMs),
    durationMs: keyInfo.durationMs,
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/admin/keys") {
        return await handleAdmin(request, env, url);
      }
      if ((url.pathname === "/" || url.pathname === "/api/key") && request.method === "POST") {
        return await handlePost(request, env);
      }
      if (url.pathname === "/api/key" && request.method === "GET") {
        return await handleGet(request, env);
      }
      if (url.pathname === "/api/keys" && request.method === "GET") {
        return await handleList(env);
      }
      return json({ ok: true, service: "BravoHack Key API", endpoint: "/api/key" });
    } catch (error) {
      console.error("BravoHack Key API error:", error);
      return json({ ok: false, error: "INTERNAL_ERROR", message: "Key API internal error." }, 500);
    }
  },
};
