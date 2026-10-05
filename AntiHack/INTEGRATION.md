# Integration contract

The package cannot safely guess how a specific game implements weapons, inventory, economy, vehicles or teleports. Integrate validation at the server boundary.

## Remote pattern

Call _G.AntiHack:ValidateRemote(player, "BuyItem", {itemId, amount}, {RateLimit=4, ArgumentTypes={"string","number"}}) before changing state. Server-side ownership, price, stock and balance checks still happen afterwards.

## Combat pattern

Call _G.AntiHack:ValidateCombat(player, tool, targetModel, serverCalculatedDamage). If it returns false, reject the request. Calculate and apply damage on the server; never trust client damage.

## Legitimate movement

Before a server-authorized teleport, launch pad, knockback or special ability, call _G.AntiHack:AuthorizeTeleport(player, "reason", duration). The exemption is server-created and expires automatically.

## Moderation

A browser dashboard must never call Roblox moderation methods directly from an untrusted client. Verify Owner/Admin/Moderator/Viewer permissions server-side for every mutation.

## Dashboard data contract

Expose only sanitized records: player name/UserId, server JobId, risk score, confidence, detection category/type, severity, action, bounded evidence timeline, ban status and moderator audit events.

Never expose webhook secrets, DataStore credentials, arbitrary Instances or internal tokens.