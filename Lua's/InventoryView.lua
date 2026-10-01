-- BravoHack Lua module: Inventory View
-- Requires BravoHackAPI from Main.txt.

local api
if type(getgenv) == "function" then
    api = getgenv().BravoHackAPI
else
    api = _G.BravoHackAPI
end

if type(api) ~= "table" or not api.State then
    warn("[BravoHack] InventoryView: BravoHackAPI is unavailable.")
    return
end

local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer

if type(api.CloseLuaGui) == "function" then
    pcall(api.CloseLuaGui, "BravoHackInventoryLua")
end

local gui = Instance.new("ScreenGui")
gui.Name = "BravoHackInventoryLua"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.DisplayOrder = 1200
gui.Parent = LocalPlayer:WaitForChild("PlayerGui")

local frame = Instance.new("Frame")
frame.AnchorPoint = Vector2.new(0.5, 0.5)
frame.Position = UDim2.fromScale(0.5, 0.62)
frame.Size = UDim2.fromOffset(330, 260)
frame.BackgroundColor3 = Color3.fromRGB(20, 20, 24)
frame.BorderSizePixel = 0
frame.Parent = gui

local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 8)
corner.Parent = frame

local stroke = Instance.new("UIStroke")
stroke.Color = Color3.fromRGB(52, 52, 58)
stroke.Thickness = 1
stroke.Parent = frame

local title = Instance.new("TextLabel")
title.BackgroundTransparency = 1
title.Position = UDim2.fromOffset(12, 8)
title.Size = UDim2.new(1, -52, 0, 24)
title.Font = Enum.Font.GothamBold
title.TextSize = 14
title.TextColor3 = Color3.fromRGB(230, 230, 235)
title.TextXAlignment = Enum.TextXAlignment.Left
title.Text = "Inventory View"
title.Parent = frame

local close = Instance.new("TextButton")
close.Size = UDim2.fromOffset(24, 24)
close.Position = UDim2.new(1, -32, 0, 8)
close.BackgroundColor3 = Color3.fromRGB(34, 34, 38)
close.BorderSizePixel = 0
close.Text = "✕"
close.Font = Enum.Font.GothamBold
close.TextSize = 11
close.TextColor3 = Color3.fromRGB(230, 230, 235)
close.AutoButtonColor = false
close.Parent = frame

local closeCorner = Instance.new("UICorner")
closeCorner.CornerRadius = UDim.new(0, 5)
closeCorner.Parent = close

local selected = Instance.new("TextLabel")
selected.BackgroundTransparency = 1
selected.Position = UDim2.fromOffset(12, 38)
selected.Size = UDim2.new(1, -24, 0, 20)
selected.Font = Enum.Font.GothamMedium
selected.TextSize = 11
selected.TextColor3 = Color3.fromRGB(150, 150, 160)
selected.TextXAlignment = Enum.TextXAlignment.Left
selected.Parent = frame

local body = Instance.new("ScrollingFrame")
body.Position = UDim2.fromOffset(12, 64)
body.Size = UDim2.new(1, -24, 1, -108)
body.BackgroundColor3 = Color3.fromRGB(16, 16, 18)
body.BackgroundTransparency = 0.1
body.BorderSizePixel = 0
body.ScrollBarThickness = 4
body.ScrollBarImageColor3 = Color3.fromRGB(0, 105, 255)
body.AutomaticCanvasSize = Enum.AutomaticSize.Y
body.CanvasSize = UDim2.new()
body.Parent = frame

local bodyCorner = Instance.new("UICorner")
bodyCorner.CornerRadius = UDim.new(0, 5)
bodyCorner.Parent = body

local padding = Instance.new("UIPadding")
padding.PaddingTop = UDim.new(0, 6)
padding.PaddingLeft = UDim.new(0, 6)
padding.PaddingRight = UDim.new(0, 6)
padding.PaddingBottom = UDim.new(0, 6)
padding.Parent = body

local layout = Instance.new("UIListLayout")
layout.Padding = UDim.new(0, 3)
layout.Parent = body

local refresh = Instance.new("TextButton")
refresh.Position = UDim2.new(0, 12, 1, -36)
refresh.Size = UDim2.new(1, -24, 0, 28)
refresh.BackgroundColor3 = Color3.fromRGB(0, 105, 255)
refresh.BorderSizePixel = 0
refresh.Text = "Refresh"
refresh.Font = Enum.Font.GothamBold
refresh.TextSize = 11
refresh.TextColor3 = Color3.fromRGB(255, 255, 255)
refresh.AutoButtonColor = false
refresh.Parent = frame

local refreshCorner = Instance.new("UICorner")
refreshCorner.CornerRadius = UDim.new(0, 5)
refreshCorner.Parent = refresh

local function rebuild()
    for _, child in ipairs(body:GetChildren()) do
        if child:IsA("TextLabel") then
            child:Destroy()
        end
    end

    local target = api.State.SelectedPlayer
    if not target or target == LocalPlayer or not target.Parent then
        selected.Text = "Selected: none"
        local label = Instance.new("TextLabel")
        label.Size = UDim2.new(1, 0, 0, 22)
        label.BackgroundTransparency = 1
        label.Text = "Select a player first in Player List."
        label.Font = Enum.Font.Gotham
        label.TextSize = 11
        label.TextColor3 = Color3.fromRGB(150, 150, 160)
        label.TextXAlignment = Enum.TextXAlignment.Left
        label.Parent = body
        return
    end

    selected.Text = "Selected: @" .. target.Name

    local inventory = target:FindFirstChild("Inventory") or target:FindFirstChild("Inevtorie")
    if not inventory then
        local label = Instance.new("TextLabel")
        label.Size = UDim2.new(1, 0, 0, 22)
        label.BackgroundTransparency = 1
        label.Text = "Inventory not found."
        label.Font = Enum.Font.Gotham
        label.TextSize = 11
        label.TextColor3 = Color3.fromRGB(230, 80, 90)
        label.TextXAlignment = Enum.TextXAlignment.Left
        label.Parent = body
        return
    end

    local items = {}
    for _, item in ipairs(inventory:GetChildren()) do
        local value
        local valueObject = item:FindFirstChild("Value")
        if item:IsA("IntValue") or item:IsA("NumberValue") then
            value = item.Value
        elseif valueObject and (valueObject:IsA("IntValue") or valueObject:IsA("NumberValue")) then
            value = valueObject.Value
        end

        if type(value) == "number" and value >= 1 then
            items[#items + 1] = {
                Name = item.Name,
                Value = value,
            }
        end
    end

    table.sort(items, function(a, b)
        return a.Name:lower() < b.Name:lower()
    end)

    if #items == 0 then
        local label = Instance.new("TextLabel")
        label.Size = UDim2.new(1, 0, 0, 22)
        label.BackgroundTransparency = 1
        label.Text = "No inventory items with Value >= 1."
        label.Font = Enum.Font.Gotham
        label.TextSize = 11
        label.TextColor3 = Color3.fromRGB(150, 150, 160)
        label.TextXAlignment = Enum.TextXAlignment.Left
        label.Parent = body
        return
    end

    for _, item in ipairs(items) do
        local label = Instance.new("TextLabel")
        label.Size = UDim2.new(1, -4, 0, 22)
        label.BackgroundTransparency = 1
        label.Font = Enum.Font.Gotham
        label.TextSize = 11
        label.TextColor3 = Color3.fromRGB(230, 230, 235)
        label.TextXAlignment = Enum.TextXAlignment.Left
        label.Text = math.floor(item.Value) == item.Value and string.format("%s  x%d", item.Name, item.Value) or string.format("%s  x%.2f", item.Name, item.Value)
        label.Parent = body
    end
end

close.MouseButton1Click:Connect(function()
    gui:Destroy()
end)

refresh.MouseButton1Click:Connect(rebuild)

if type(api.RegisterLuaGui) == "function" then
    api.RegisterLuaGui("BravoHackInventoryLua", gui)
end

rebuild()
