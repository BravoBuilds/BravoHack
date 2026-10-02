# BravoHack Server Key Authorization

Place `BravoHackKeyAuth.server.lua` inside **ServerScriptService** of the Roblox experience that is authorized to run BravoHack.

## How the binding works

The client sends only the access key. The server gets the real `Player.UserId` from Roblox and never trusts a client-supplied ID.

On first successful use:
- the key is stored in `BravoHackKeyBindingsV1`
- the key is permanently bound to that Roblox UserId
- another UserId cannot claim or use that key

On later logins, the same UserId can reuse its bound key as long as the key remains present in `Keys.txt`.

If `Keys.txt` contains no active keys, authentication is rejected for everyone.

## Setup

Enable **Allow HTTP Requests** in Game Settings → Security.

Use a published experience with DataStore access enabled.

Keep `Keys.txt` in the root of the GitHub repository, one key per line. Lines beginning with `#` and empty lines are ignored.

A secure server cannot modify the public GitHub file without a GitHub write credential. The implementation therefore stores the consumed/bound state in Roblox DataStore rather than embedding a GitHub token inside `Main.txt`.
