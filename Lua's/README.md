# BravoHack Cheat Menu Lua Modules

Put your own `.lua` cheat-menu modules in this folder. Open the **Lua** tab in BravoHack, press **Refresh**, select a module, and press **Run Selected**.

`InventoryView.lua` is the built-in inventory viewer module.

Modules run in the current executor environment and can add standalone windows, tools, or extra cheat-menu features. They can use:
- `getgenv().BravoHackAPI` when available
- `_G.BravoHackAPI` as fallback

Keep module filenames ending in `.lua` and only run modules you trust.
