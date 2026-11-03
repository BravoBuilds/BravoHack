# BravoHack Cheat Menu Lua Modules

Put your own `.lua` cheat-menu modules in this folder. Open the **Lua** tab in BravoHack, press **Refresh**, select a module, and press **Run Selected**.

`InventoryView.lua` is the built-in inventory viewer module.

Modules run in the current executor environment and can add standalone windows, tools, or extra cheat-menu features. They can use:
- `getgenv().BravoHackAPI` when available
- `_G.BravoHackAPI` as fallback

Keep module filenames ending in `.lua` and only run modules you trust.


## Plant Field Tester (Studio only)

`PlantFieldTester.lua` is a Roblox Studio test helper for the hierarchy:

`Workspace.Scripts.Onderwereld.Pluk.Velden.PlantenVeld1`

It finds descendants named `Plant` that contain a `ProximityPrompt`, moves the local Studio test character to each prompt, and activates the prompt using Roblox's `InputHoldBegin()` / `InputHoldEnd()` methods. Use **Start** and **Stop** in the small tester window.

The module checks `RunService:IsStudio()` and refuses to run in a live server. If it reports that no prompts were found, expand one `Plant` in Studio and confirm that it contains a `ProximityPrompt` (the default E interaction).