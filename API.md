# BravoHack Key API

The active key API is the Cloudflare Worker in `cloudflare-worker/src/index.js`. It uses the D1 database configured in `cloudflare-worker/wrangler.toml`.

## Client endpoints

### Claim or validate a key

`POST /api/key`

Body:

```json
{
  "key": "KEY...",
  "userId": "123456789"
}
```

A first claim binds a key to that UserId and records the claim time. Repeating the request from the same UserId is idempotent; a different UserId is rejected. The response includes `claimedAt`, `expiresAt`, and the duration. New keys use their configured duration starting from their first claim.

### Check one known key

`GET /api/key?key=KEY...`

Returns validity, usage, the claimed UserId and expiry for that key. Treat UserIds as potentially sensitive operational data even though the legacy endpoint is compatible with the existing client.

### Legacy public listing

`GET /api/keys`

Returns the legacy inventory from `Keys.txt`. It does not expose claim owner UserIds. New keys generated through the admin panel are stored in D1 and are deliberately not added to the public `Keys.txt` file.

## Authenticated admin endpoint

`/api/admin/keys` requires this header:

```text
Authorization: Bearer YOUR_ADMIN_API_TOKEN
```

The token is configured as a **Cloudflare Worker secret** named `ADMIN_API_TOKEN`. Do not place it in `Main.txt`, a browser script, `Keys.txt`, or any public file.

| Method | URL | Purpose |
|---|---|---|
| GET | `/api/admin/keys` | List legacy and D1 keys, claim status, bound UserId, claimed time and expiry |
| POST | `/api/admin/keys` | Generate between 1 and 50 keys |
| DELETE | `/api/admin/keys?key=KEY...` | Revoke a key |

Example admin POST body:

```json
{
  "count": 5,
  "duration": "7d"
}
```

Supported durations: `24h`, `7d`, `30d`, `90d`. Validity starts on the first successful claim. New key records live in the private D1 catalog; claim ownership/time is kept in the existing `key_claims` table. The Worker creates `key_catalog` automatically when first used.

Revocation blocks future authorization checks. It does not forcibly unload an already-open client menu, and the API does not add hidden execution tracking. The admin panel reports key claims that reached the API, not script starts that never authenticate.

## Deploy the Worker

From the repository root:

```powershell
cd cloudflare-worker
npx wrangler secret put ADMIN_API_TOKEN
npx wrangler deploy
```

Generate a strong random token locally, then use the exact same token for the Cloudflare secret and `admin-panel/.env`.

## Run the local admin panel

Follow [admin-panel/README.md](admin-panel/README.md). The dashboard's Node.js server listens only on `127.0.0.1`, protects itself with a local password, and forwards authorized admin requests to the Worker. The admin token never enters the browser.

## Legacy Vercel endpoint

`api/key.js` is an older Vercel endpoint that binds keys by updating `Keys.txt`. The current `Main.txt` uses the Cloudflare Worker URL. Do not use the legacy Vercel endpoint for private D1-backed keys or admin functions.
