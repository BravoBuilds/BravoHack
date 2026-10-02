# BravoHack Roblox server key authorization

The client key gate in `Main.txt` invokes the `BravoHackKeyAuth` RemoteFunction. The server implementation is:

`Roblox/ServerScriptService/BravoHackKeyAuth.server.lua`

## Installation

1. Open your own Roblox experience in Roblox Studio.
2. Create/open **ServerScriptService**.
3. Copy `BravoHackKeyAuth.server.lua` into **ServerScriptService** as a normal **Script**.
4. Publish the experience.
5. Make sure **Enable Studio Access to API Services** is enabled when testing DataStore behavior in Studio.
6. Run `Main.txt` from the client.

## Binding behavior

- The server reads `player.UserId`; the client cannot choose the binding UserId.
- A valid key that has never been claimed is atomically stored as owned by that UserId.
- The same UserId can reuse its own bound key.
- A different UserId receives **"This key is already bound to another Roblox UserId."**
- DataStore `UpdateAsync` is used so two users racing to claim the same key cannot both become the owner.
- Invalid keys are rejected before any DataStore write.

## Important

The server script must stay in **ServerScriptService**. Do not put the authoritative binding logic in a LocalScript or trust a UserId supplied by the client.

The repository's `Keys.txt` is still a public source file. Therefore these keys should be treated as distributable access keys, not secrets. The DataStore binding prevents reuse by a different Roblox UserId, but anyone who obtains an unclaimed key can claim it first.

If you need stronger key secrecy, move the valid-key registry to a private backend or another server-only secret store.
