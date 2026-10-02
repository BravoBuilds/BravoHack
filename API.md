# BravoHack Key API

This directory contains a Vercel serverless API that keeps key usage in the repository's `Keys.txt`.

## Endpoints

### Check a key

`GET /api/key?key=YOUR_KEY`

Example response:

```json
{
  "ok": true,
  "key": "KEY...",
  "used": true,
  "userId": "123456789"
}
```

### Claim a key

`POST /api/key`

Body:

```json
{
  "key": "KEY...",
  "userId": "123456789"
}
```

A successful first claim changes the corresponding line in `Keys.txt` to:

```
KEY...|USED|123456789
```

A second request from the same UserId succeeds idempotently. A different UserId receives HTTP 409 with `KEY_ALREADY_USED`.

## Deployment

Deploy the repository as a Vercel project and configure these server-side environment variables:

- `GITHUB_TOKEN`: a GitHub token with Contents read/write access to this repository.
- `GITHUB_REPO`: `BravoBuilds/BravoHack`
- `GITHUB_BRANCH`: `main`

Never put `GITHUB_TOKEN` in `Main.txt`, `Keys.txt`, or any client-side script.

The API is stateless/serverless; Vercel runs the endpoint on demand rather than requiring a permanently running process.

## Important security note

Because `Keys.txt` is in a public GitHub repository, the bound UserId will also be public. The GitHub token remains private in Vercel environment variables.

The API is the authority for first-use binding. `Main.txt` runs entirely on the Roblox client/executor and sends the current `LocalPlayer.UserId` directly to this API. No Roblox ServerScript, RemoteFunction, or DataStore is required.

## Main.txt configuration

Set `KeyGate.ApiURL` in `Main.txt` to your deployed Vercel URL:

```lua
KeyGate.ApiURL = "https://YOUR-VERCEL-PROJECT.vercel.app/api/key"
```

The executor must support one of `request`, `http_request`, or `syn.request`.
