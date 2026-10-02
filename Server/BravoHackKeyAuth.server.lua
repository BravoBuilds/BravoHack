-- BravoHack server-side key authorization
-- Place this file in ServerScriptService in the Roblox experience that is allowed
-- to use BravoHack.
--
-- The client never supplies the authoritative identity.
-- This script uses player.UserId from Roblox and stores the first claimant of
-- each key in a DataStore. A key can then only be used by that same UserId.
--
-- Keys.txt remains the list of currently active keys. Removing all keys from
-- Keys.txt means nobody can authenticate. A previously claimed key is still
-- usable only by its bound UserId while it remains in Keys.txt.
--
-- Requirements:
--   1. Game Settings -> Security -> Allow HTTP Requests = ON
--   2. Published experience / DataStore access enabled for the environment.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")
local DataStoreService = game:GetService("DataStoreService")

local KEY_SOURCE_URL = "https://raw.githubusercontent.com/BravoBuilds/BravoHack/refs/heads/main/Keys.txt"
local DATASTORE_NAME = "BravoHackKeyBindingsV1"
local DATASTORE_KEY = "Registry"

local KeyStore = DataStoreService:GetDataStore(DATASTORE_NAME)

local Remote = ReplicatedStorage:FindFirstChild("BravoHackKeyAuth")
if Remote and not Remote:IsA("RemoteFunction") then
    Remote:Destroy()
    Remote = nil
end

if not Remote then
    Remote = Instance.new("RemoteFunction")
    Remote.Name = "BravoHackKeyAuth"
    Remote.Parent = ReplicatedStorage
end

local function NormalizeKey(value)
    value = tostring(value or "")
    value = value:gsub("%s+", ""):upper()
    if #value < 4 or #value > 128 then
        return nil
    end
    if not value:match("^[%w%-%_]+$") then
        return nil
    end
    return value
end

local function LoadActiveKeys()
    local ok, body = pcall(function()
        return HttpService:GetAsync(KEY_SOURCE_URL, false)
    end)

    if not ok or type(body) ~= "string" then
        return nil, "Could not reach the GitHub key list."
    end

    local keys = {}

    for line in body:gmatch("[^\r\n]+") do
        line = line:gsub("^%s+", ""):gsub("%s+$", "")

        if line ~= "" and not line:match("^#") then
            local key = line
            local state = "ACTIVE"
            local firstSep = line:find("|", 1, true)

            if firstSep then
                key = line:sub(1, firstSep - 1)
                state = line:sub(firstSep + 1):upper():gsub("%s+", "")
            end

            key = NormalizeKey(key)
            if key and (state == "ACTIVE" or state == "") then
                keys[key] = true
            end
        end
    end

    return keys
end

local function Authorize(player, submittedKey)
    local key = NormalizeKey(submittedKey)
    if not key then
        return false, "Invalid key format."
    end

    local activeKeys, keyMessage = LoadActiveKeys()
    if not activeKeys then
        return false, keyMessage or "Key service unavailable."
    end

    if next(activeKeys) == nil then
        return false, "No active keys are available."
    end

    if not activeKeys[key] then
        return false, "Invalid, disabled, or unavailable key."
    end

    local decision = false
    local message = "Access denied."

    local ok, err = pcall(function()
        KeyStore:UpdateAsync(DATASTORE_KEY, function(registry)
            if type(registry) ~= "table" then
                registry = {}
            end

            local existing = registry[key]

            if existing == nil then
                registry[key] = {
                    UserId = player.UserId,
                    BoundAt = os.time(),
                }
                decision = true
                message = "Access granted. This key is now bound to your Roblox UserId."
            elseif type(existing) == "table" and tonumber(existing.UserId) == player.UserId then
                decision = true
                message = "Access granted. This key belongs to your Roblox UserId."
            elseif tonumber(existing) == player.UserId then
                decision = true
                message = "Access granted. This key belongs to your Roblox UserId."
            else
                decision = false
                message = "This key is already bound to another Roblox UserId."
            end

            return registry
        end)
    end)

    if not ok then
        warn("[BravoHackKeyAuth] DataStore error:", err)
        return false, "Could not save the key binding. Login blocked."
    end

    return decision, message
end

Remote.OnServerInvoke = function(player, submittedKey)
    if not player or not player:IsA("Player") then
        return false, "Invalid player."
    end

    return Authorize(player, submittedKey)
end

Players.PlayerRemoving:Connect(function(player)
    -- No binding is removed here. Once a key is claimed, it remains bound
    -- to that Roblox UserId until the DataStore is reset administratively.
end)

print("[BravoHackKeyAuth] Server key authorization ready.")
