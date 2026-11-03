-- BravoHack Lua module: Plant Field Studio Tester
-- Studio-only developer utility for testing the plant ProximityPrompts.
-- Expected hierarchy:
-- Workspace.Scripts.Onderwereld.Pluk.Velden.PlantenVeld1
--
-- This module intentionally refuses to run outside Roblox Studio.

local RunService = game:GetService("RunService")
if not RunService:IsStudio() then
    warn("[PlantFieldTester] Studio-only tool; it will not run in a live server.")
    return
end

local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")
local LocalPlayer = Players.LocalPlayer

if not LocalPlayer then
    warn("[PlantFieldTester] LocalPlayer not available. Run this from a Studio client test.")
    return
end

local api
pcall(function()
    if type(getgenv) == "function" then
        local env = getgenv()
        if type(env) == "table" then
            api = env.BravoHackAPI
        end
    end
end)
if type(api) ~= "table" and type(_G) == "table" then
    api = _G.BravoHackAPI
end

local GUI_NAME = "BravoHackPlantFieldTester"
if type(api) == "table" and type(api.CloseLuaGui) == "function" then
    pcall(api.CloseLuaGui, GUI_NAME)
end

local oldGui = LocalPlayer:WaitForChild("PlayerGui"):FindFirstChild(GUI_NAME)
if oldGui then
    oldGui:Destroy()
end

local gui = Instance.new("ScreenGui")
gui.Name = GUI_NAME
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.DisplayOrder = 1250
gui.Parent = LocalPlayer:WaitForChild("PlayerGui")

local frame = Instance.new("Frame")
frame.Name = "Window"
frame.AnchorPoint = Vector2.new(0.5, 0.5)
frame.Position = UDim2.fromScale(0.5, 0.55)
frame.Size = UDim2.fromOffset(360, 190)
frame.BackgroundColor3 = Color3.fromRGB(18, 20, 25)
frame.BorderSizePixel = 0
frame.Parent = gui

local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 10)
corner.Parent = frame

local stroke = Instance.new("UIStroke")
stroke.Color = Color3.fromRGB(55, 60, 70)
stroke.Thickness = 1
stroke.Parent = frame

local title = Instance.new("TextLabel")
title.BackgroundTransparency = 1
title.Position = UDim2.fromOffset(14, 10)
title.Size = UDim2.new(1, -52, 0, 24)
title.Font = Enum.Font.GothamBold
title.TextSize = 14
title.TextColor3 = Color3.fromRGB(235, 238, 245)
title.TextXAlignment = Enum.TextXAlignment.Left
title.Text = "Plant Field Tester  •  Studio"
title.Parent = frame

local close = Instance.new("TextButton")
close.Position = UDim2.new(1, -36, 0, 8)
close.Size = UDim2.fromOffset(26, 26)
close.BackgroundColor3 = Color3.fromRGB(38, 41, 48)
close.BorderSizePixel = 0
close.Text = "×"
close.Font = Enum.Font.GothamBold
close.TextSize = 16
close.TextColor3 = Color3.fromRGB(235, 238, 245)
close.Parent = frame
Instance.new("UICorner", close).CornerRadius = UDim.new(0, 6)

local description = Instance.new("TextLabel")
description.BackgroundTransparency = 1
description.Position = UDim2.fromOffset(14, 42)
description.Size = UDim2.new(1, -28, 0, 34)
description.Font = Enum.Font.Gotham
description.TextSize = 11
description.TextWrapped = true
description.TextColor3 = Color3.fromRGB(155, 162, 174)
description.TextXAlignment = Enum.TextXAlignment.Left
description.Text = "Teleports your Studio test character to each Plant and activates its E ProximityPrompt."
description.Parent = frame

local status = Instance.new("TextLabel")
status.BackgroundColor3 = Color3.fromRGB(12, 14, 18)
status.BackgroundTransparency = 0.1
status.Position = UDim2.fromOffset(14, 82)
status.Size = UDim2.new(1, -28, 0, 32)
status.Font = Enum.Font.GothamMedium
status.TextSize = 11
status.TextColor3 = Color3.fromRGB(190, 196, 207)
status.TextXAlignment = Enum.TextXAlignment.Left
status.Text = "Status: idle"
status.Parent = frame
Instance.new("UICorner", status).CornerRadius = UDim.new(0, 6)

local startButton = Instance.new("TextButton")
startButton.Position = UDim2.fromOffset(14, 128)
startButton.Size = UDim2.new(0.5, -20, 0, 34)
startButton.BackgroundColor3 = Color3.fromRGB(0, 105, 235)
startButton.BorderSizePixel = 0
startButton.Text = "Start"
startButton.Font = Enum.Font.GothamBold
startButton.TextSize = 12
startButton.TextColor3 = Color3.new(1, 1, 1)
startButton.Parent = frame
Instance.new("UICorner", startButton).CornerRadius = UDim.new(0, 7)

local stopButton = Instance.new("TextButton")
stopButton.Position = UDim2.new(0.5, 6, 0, 128)
stopButton.Size = UDim2.new(0.5, -20, 0, 34)
stopButton.BackgroundColor3 = Color3.fromRGB(48, 52, 61)
stopButton.BorderSizePixel = 0
stopButton.Text = "Stop"
stopButton.Font = Enum.Font.GothamBold
stopButton.TextSize = 12
stopButton.TextColor3 = Color3.fromRGB(235, 238, 245)
stopButton.Parent = frame
Instance.new("UICorner", stopButton).CornerRadius = UDim.new(0, 7)

local running = false
local closed = false

local function setStatus(message, color)
    if status and status.Parent then
        status.Text = "Status: " .. tostring(message)
        status.TextColor3 = color or Color3.fromRGB(190, 196, 207)
    end
end

local function getPlantFolder()
    local scripts = Workspace:FindFirstChild("Scripts")
    local underworld = scripts and scripts:FindFirstChild("Onderwereld")
    local pluk = underworld and underworld:FindFirstChild("Pluk")
    local velden = pluk and pluk:FindFirstChild("Velden")
    return velden and velden:FindFirstChild("PlantenVeld1")
end

local function getPromptPart(prompt)
    local parent = prompt.Parent
    if not parent then
        return nil
    end
    if parent:IsA("BasePart") then
        return parent
    end
    if parent:IsA("Attachment") then
        local attachmentParent = parent.Parent
        if attachmentParent and attachmentParent:IsA("BasePart") then
            return attachmentParent
        end
    end
    if parent:IsA("Model") then
        return parent.PrimaryPart or parent:FindFirstChildWhichIsA("BasePart", true)
    end
    local model = prompt:FindFirstAncestorOfClass("Model")
    if model then
        return model.PrimaryPart or model:FindFirstChildWhichIsA("BasePart", true)
    end
    return nil
end

local function getPlantRecords()
    local folder = getPlantFolder()
    if not folder then
        return nil, "Path not found: Workspace.Scripts.Onderwereld.Pluk.Velden.PlantenVeld1"
    end

    local records = {}
    local usedPrompts = {}

    for _, object in ipairs(folder:GetDescendants()) do
        if object.Name == "Plant" and (object:IsA("Model") or object:IsA("BasePart")) then
            local prompt = object:FindFirstChildWhichIsA("ProximityPrompt", true)
            if prompt and not usedPrompts[prompt] then
                local part = getPromptPart(prompt)
                if part then
                    usedPrompts[prompt] = true
                    records[#records + 1] = {
                        plant = object,
                        prompt = prompt,
                        part = part,
                    }
                end
            end
        end
    end

    return records
end

local function getCharacterParts()
    local character = LocalPlayer.Character
    if not character then
        return nil, nil
    end
    local humanoid = character:FindFirstChildOfClass("Humanoid")
    local root = character:FindFirstChild("HumanoidRootPart")
    if not humanoid or humanoid.Health <= 0 or not root then
        return nil, nil
    end
    return character, root
end

local function stop()
    running = false
    setStatus("stopping...", Color3.fromRGB(255, 185, 80))
end

local function runPlantLoop()
    if running then
        return
    end

    local records, err = getPlantRecords()
    if not records then
        setStatus(err, Color3.fromRGB(245, 90, 100))
        return
    end
    if #records == 0 then
        setStatus("No Plant ProximityPrompts found.", Color3.fromRGB(245, 90, 100))
        return
    end

    running = true
    setStatus("found " .. #records .. " plants; starting...", Color3.fromRGB(100, 220, 145))

    task.spawn(function()
        local completed = 0
        local skipped = 0

        for index, record in ipairs(records) do
            if not running or closed then
                break
            end

            local character, root = getCharacterParts()
            if not character then
                setStatus("character unavailable; stopped", Color3.fromRGB(245, 90, 100))
                running = false
                return
            end

            local prompt = record.prompt
            local part = record.part
            if not prompt.Parent or not part.Parent or not prompt.Enabled then
                skipped += 1
            else
                -- The script is Studio-only; this teleports only the local Studio test character.
                root.CFrame = CFrame.new(part.Position + Vector3.new(0, 2.5, 0))
                task.wait(0.3)

                if not running or closed then
                    break
                end

                local holdStarted = false
                local ok, promptError = pcall(function()
                    prompt:InputHoldBegin()
                    holdStarted = true
                    task.wait(math.max(0, prompt.HoldDuration) + 0.12)
                    prompt:InputHoldEnd()
                    holdStarted = false
                end)

                if not ok then
                    if holdStarted then
                        pcall(function() prompt:InputHoldEnd() end)
                    end
                    warn("[PlantFieldTester] Prompt failed:", promptError)
                    skipped += 1
                else
                    completed += 1
                end
            end

            setStatus(string.format("%d/%d processed  •  %d skipped", index, #records, skipped))
            task.wait(0.25)
        end

        running = false
        if not closed then
            setStatus(string.format("finished  •  %d activated  •  %d skipped", completed, skipped),
                Color3.fromRGB(100, 220, 145))
        end
    end)
end

startButton.MouseButton1Click:Connect(runPlantLoop)
stopButton.MouseButton1Click:Connect(stop)
close.MouseButton1Click:Connect(function()
    closed = true
    stop()
    gui:Destroy()
end)

if type(api) == "table" and type(api.RegisterLuaGui) == "function" then
    pcall(api.RegisterLuaGui, "BravoHackPlantFieldTester", gui)
end

gui.Destroying:Connect(function()
    closed = true
    running = false
end)

setStatus("idle  •  Studio test only")
