# AntiHack

Server-authoritative Roblox/Luau anti-cheat package for BravoHack.

The repository did not contain a Rojo/Wally Roblox project, so this package is isolated under AntiHack and does not replace the existing client/web/API code.

## Install

1. Install Rojo.
2. Run `rojo serve default.project.json` from AntiHack.
3. Connect Roblox Studio to Rojo and sync.
4. Keep Bootstrap.server.lua in ServerScriptService and Client.client.lua in StarterPlayerScripts.

## Security model

Client input is hostile. The client heartbeat is only a weak liveness signal. It never decides bans, damage, risk, exemptions, or moderation permissions.

Gameplay remotes should call:

```lua
_G.AntiHack:ValidateRemote(player, "BuyItem", {itemId, amount}, {
    RateLimit = 4,
    ArgumentTypes = {"string", "number"},
})
```

Combat should use ValidateCombat, then calculate and apply damage entirely on the server.

## Developer API

- AuthorizeTeleport(player, reason, duration)
- AuthorizeImpulse(player, reason, duration)
- AuthorizeMovementOverride(player, duration)
- RecordLegitimateAction(player, action)
- Flag(player, detection)
- GetPlayerState(player)
- ValidateCombat(player, weapon, target, damage)
- ValidateRemote(player, remoteName, args, rule)

Exemptions are server-created, player-specific, time-limited and reason-tagged.

## Detection

Movement uses sampled server observations for speed, vertical velocity, acceleration and large displacement. Combat validates target state, range, attack rate and damage bounds. Remote validation checks types, finite numbers, argument count and rate limits. Risk decays over time and weights independent categories more strongly.

Automatic permanent bans are disabled by default. Tune thresholds against legitimate sprinting, vehicles, knockback, launch pads, teleports and abilities before enabling automatic punishment.

## Dashboard and moderation

The existing repository contains a separate web/API application. This package intentionally does not expose an unauthenticated moderation API. A production dashboard must authenticate moderators server-side and audit every mutation.

Recommended dashboard views are Overview, Live Players, Detections, Player Investigation, Bans, Servers and Settings.

## Webhooks

Webhook secrets/URLs must never be shipped to the client. Add server-side delivery through deployment configuration, with rate limiting, retries and sanitized evidence.

## Persistence

Use DataStoreService for ban state with caching and bounded retries. For larger games, use MessagingService or MemoryStoreService for cross-server coordination.

## Tests

tests/TestRunner.lua contains a Luau smoke test. Expand it in the game's chosen test framework for movement, combat, remotes, heartbeat sequence/timeout, risk decay, persistence and authorization boundaries.

## Limitations

No Roblox Luau anti-cheat can guarantee detection of every executor. The strongest defense is server-authoritative game design: clients request actions; the server validates and computes the result.

This implementation is original and does not copy proprietary Electron AntiCheat source, branding, artwork or assets.