# BravoHack Local Admin Panel

A localhost-only dashboard for key administration and reviewing key activations. The dashboard uses a small Node.js server and has no npm dependencies.

## What it can do

- Generate 1–50 keys in one request.
- Choose validity of 24 hours, 7 days, 30 days, or 90 days, starting at the key's first claim.
- List legacy keys from `Keys.txt` and newer private D1-backed keys.
- Show key status, bound Roblox UserId, claim time, and expiry time.
- Revoke keys.
- Search keys and key claims; open the Roblox profile associated with a numerical UserId.
- Keep the Cloudflare admin token on the Node.js server rather than sending it to the browser.

The Players page shows **key claims**, not every script execution. A client that never authenticates is not detectable through this panel. It does not add IP, hardware, or device tracking.

## Requirements

- Node.js 18 or newer.
- The Cloudflare Worker in `../cloudflare-worker` deployed with its D1 binding.
- Permission to set a Worker secret.

## 1. Set an admin token on Cloudflare

Generate a long random token locally:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated value. From the repository root:

```powershell
cd cloudflare-worker
npx wrangler secret put ADMIN_API_TOKEN
npx wrangler deploy
```

When Wrangler prompts for the secret, paste the generated token. The first request to the updated Worker creates the `key_catalog` table in the configured D1 database; no manual schema migration is needed.

## 2. Configure this local dashboard

Copy `.env.example` to `.env` inside this folder. Set:

- `ADMIN_PASSWORD`: your local dashboard password (at least 12 characters).
- `ADMIN_API_TOKEN`: the exact same token that you set as the Cloudflare secret.
- `WORKER_URL`: your deployed Worker origin; the default is the existing BravoHack Worker.

Do not put the token in `index.html`, `Main.txt`, or any public repository file. The included `.gitignore` excludes `.env`.

## 3. Start

On Windows, double-click `start.bat`, or use:

```powershell
cd admin-panel
node server.js
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). The server binds only to `127.0.0.1`, requires the local admin password, uses an HttpOnly session cookie, and does not expose the dashboard to your LAN.

## Key storage and compatibility

- Newly generated keys are stored in Cloudflare D1 and are **not added to public `Keys.txt`**.
- Existing `Keys.txt` keys remain recognized for compatibility and can be revoked through the panel.
- The Worker checks D1 revocation records before allowing a claim.
- Claim ownership and expiry are stored in D1.
- Revocation blocks future authorization requests. It does not remotely close a menu that is already running; no remote command or covert heartbeat was added.

If the page reports `ADMIN_API_NOT_CONFIGURED` or `UNAUTHORIZED`, confirm that `ADMIN_API_TOKEN` matches between Cloudflare Worker secrets and this folder's private `.env`, then redeploy the Worker.
