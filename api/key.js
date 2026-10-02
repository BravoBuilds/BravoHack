// BravoHack key API for Vercel
// POST /api/key  { "key": "...", "userId": "123" } -> atomically claims the key.
// GET  /api/key?key=... -> returns current usage/owner.
// Required Vercel environment variables:
//   GITHUB_TOKEN  = GitHub token with Contents read/write access
//   GITHUB_REPO   = BravoBuilds/BravoHack
// Optional:
//   GITHUB_BRANCH = main

const REPO = process.env.GITHUB_REPO || "BravoBuilds/BravoHack";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const TOKEN = process.env.GITHUB_TOKEN;

function normalizeKey(value) {
  if (typeof value !== "string") return null;
  const key = value.replace(/\s+/g, "").toUpperCase();
  if (!key || key.length > 128 || !/^KEY[A-Z0-9]+$/.test(key)) return null;
  return key;
}

function normalizeUserId(value) {
  const id = String(value ?? "").trim();
  if (!/^\d{1,30}$/.test(id)) return null;
  return id;
}

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

async function github(path, options = {}) {
  if (!TOKEN) throw new Error("GITHUB_TOKEN is not configured.");
  const response = await fetch("https://api.github.com" + path, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + TOKEN,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch (_) {}
  if (!response.ok) {
    const error = new Error((data && data.message) || ("GitHub HTTP " + response.status));
    error.status = response.status;
    throw error;
  }
  return data;
}

async function readKeys() {
  const data = await github(
    "/repos/" + encodeURIComponent(REPO.split("/")[0]) + "/" +
    encodeURIComponent(REPO.split("/")[1]) + "/contents/Keys.txt?ref=" +
    encodeURIComponent(BRANCH)
  );
  if (!data || data.type !== "file" || typeof data.content !== "string") {
    throw new Error("Keys.txt could not be read.");
  }
  const content = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
  return { content, sha: data.sha };
}

function parseKeys(content) {
  const entries = new Map();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const parts = line.split("|");
    const key = normalizeKey(parts[0]);
    if (!key) continue;

    const status = (parts[1] || "UNUSED").trim().toUpperCase();
    const userId = parts[2] ? normalizeUserId(parts[2]) : null;
    entries.set(key, {
      key,
      used: status === "USED",
      userId: status === "USED" ? userId : null,
    });
  }
  return entries;
}

function updateKeyLine(content, wantedKey, userId) {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const currentKey = normalizeKey(trimmed.split("|")[0]);
    if (currentKey !== wantedKey) continue;

    const prefix = raw.slice(0, raw.indexOf(trimmed));
    lines[i] = prefix + wantedKey + "|USED|" + userId;
    changed = true;
    break;
  }

  if (!changed) return null;
  return lines.join(newline);
}

async function claimKey(key, userId) {
  // GitHub's blob SHA makes the write conditional. If another request changed
  // Keys.txt first, GitHub returns 409 and we reread/retry.
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await readKeys();
    const entries = parseKeys(current.content);
    const entry = entries.get(key);

    if (!entry) {
      return { status: 404, body: { ok: false, key, used: false, userId: null, error: "INVALID_KEY" } };
    }

    if (entry.used) {
      if (entry.userId === userId) {
        return { status: 200, body: { ok: true, key, used: true, userId, claimed: false, message: "Key is already bound to this UserId." } };
      }
      return { status: 409, body: { ok: false, key, used: true, userId: entry.userId, error: "KEY_ALREADY_USED" } };
    }

    const nextContent = updateKeyLine(current.content, key, userId);
    if (nextContent == null) throw new Error("Key disappeared while updating Keys.txt.");

    const owner = REPO.split("/");
    const path = "/repos/" + encodeURIComponent(owner[0]) + "/" +
      encodeURIComponent(owner[1]) + "/contents/Keys.txt";

    try {
      await github(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Bind key " + key + " to Roblox UserId " + userId,
          content: Buffer.from(nextContent, "utf8").toString("base64"),
          sha: current.sha,
          branch: BRANCH,
        }),
      });
      return { status: 200, body: { ok: true, key, used: true, userId, claimed: true, message: "Key successfully bound." } };
    } catch (error) {
      if (error.status === 409) continue;
      throw error;
    }
  }

  return {
    status: 409,
    body: { ok: false, key, used: null, userId: null, error: "CONCURRENT_UPDATE", message: "Try again." },
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const key = normalizeKey(req.query && req.query.key);
      if (!key) return json(res, 400, { ok: false, error: "INVALID_REQUEST" });

      const current = await readKeys();
      const entry = parseKeys(current.content).get(key);
      if (!entry) return json(res, 404, { ok: false, key, used: false, userId: null, error: "INVALID_KEY" });

      return json(res, 200, {
        ok: true,
        key,
        used: entry.used,
        userId: entry.userId,
      });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const key = normalizeKey(body.key);
      const userId = normalizeUserId(body.userId);

      if (!key || !userId) {
        return json(res, 400, { ok: false, error: "INVALID_REQUEST" });
      }

      const result = await claimKey(key, userId);
      return json(res, result.status, result.body);
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    console.error("[BravoHack API]", error);
    return json(res, 500, {
      ok: false,
      error: "API_ERROR",
      message: "Key API temporarily unavailable.",
    });
  }
}
