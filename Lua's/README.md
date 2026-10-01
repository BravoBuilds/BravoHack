# BravoHack Lua modules

Put your own `.lua` modules in this folder. Open the Lua tab in BravoHack, press Refresh, select a module, and press Run Selected.

`InventoryView.lua` is the built-in inventory viewer module.

Modules run in the current executor environment. They can use:
- `getgenv().BravoHackAPI` when available
- `_G.BravoHackAPI` as fallback

Keep module filenames ending in `.lua`.
