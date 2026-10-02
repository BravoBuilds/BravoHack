const KEYS_URL = "https://raw.githubusercontent.com/BravoBuilds/BravoHack/main/Keys.txt";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  },
});

async function ensureSchema(db) {
  await db.exec("CREATE TABLE IF NOT EXISTS key_claims (key TEXT PRIMARY KEY, user_id TEXT NOT NULL, claimed_at TEXT NOT NULL)");
}

async function isValidKey(key) {
  const response = await fetch(KEYS_URL, { headers: { "User-Agent": "BravoHack-KeyAPI/1.0" } });
  if (!response.ok) return null;
  const text = await response.text();
  const valid = new Set(text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => line.split("|")[0].trim().toLowerCase()));
  return valid.has(key.toLowerCase());
}

async function handlePost(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ ok:false, error:"INVALID_JSON" }, 400); }

  const key = typeof body?.key === "string" ? body.key.trim() : "";
  const userId = typeof body?.userId === "string" ? body.userId.trim() : String(body?.userId ?? "").trim();

  if (!key) return json({ ok:false, error:"MISSING_KEY" }, 400);
  if (!/^\d{1,20}$/.test(userId)) return json({ ok:false, error:"INVALID_USER_ID" }, 400);

  const valid = await isValidKey(key);
  if (valid === null) return json({ ok:false, error:"KEY_SOURCE_UNAVAILABLE" }, 503);
  if (!valid) return json({ ok:false, error:"INVALID_KEY" }, 404);

  await ensureSchema(env.DB);

  // The primary key makes the first claim win atomically.
  await env.DB.prepare("INSERT OR IGNORE INTO key_claims (key, user_id, claimed_at) VALUES (?, ?, ?)")
    .bind(key, userId, new Date().toISOString()).run();

  const row = await env.DB.prepare("SELECT user_id, claimed_at FROM key_claims WHERE key = ?").bind(key).first();
  if (!row) return json({ ok:false, error:"DATABASE_ERROR" }, 500);

  if (String(row.user_id) !== userId) {
    return json({ ok:false, error:"KEY_ALREADY_USED", userId:String(row.user_id) }, 409);
  }

  return json({ ok:true, claimed:true, key, userId, claimedAt:row.claimed_at });
}

async function handleGet(request, env) {
  const url = new URL(request.url);
  const key = (url.searchParams.get("key") || "").trim();
  if (!key) return json({ ok:false, error:"MISSING_KEY" }, 400);

  const valid = await isValidKey(key);
  if (valid === null) return json({ ok:false, error:"KEY_SOURCE_UNAVAILABLE" }, 503);
  if (!valid) return json({ ok:false, error:"INVALID_KEY" }, 404);

  await ensureSchema(env.DB);
  const row = await env.DB.prepare("SELECT user_id, claimed_at FROM key_claims WHERE key = ?").bind(key).first();

  if (!row) return json({ ok:true, valid:true, used:false, userId:null });
  return json({ ok:true, valid:true, used:true, userId:String(row.user_id), claimedAt:row.claimed_at });
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
      return json({ ok:true, service:"BravoHack Key API", endpoint:"/api/key" });
    } catch {
      return json({ ok:false, error:"INTERNAL_ERROR", message:"Key API is temporarily unavailable." }, 500);
    }
  }
};
