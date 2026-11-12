-- Standalone settings persistence for the BravoBuilds UI.
-- This module intentionally contains no gameplay, targeting, input-hook, or remote-call logic.
--
-- Adapter contract:
--   local store = SettingsStore.new({
--       read = function() return readfile("bravohack-settings.json") end,
--       write = function(data) writefile("bravohack-settings.json", data) end,
--       encode = function(value) return HttpService:JSONEncode(value) end,
--       decode = function(data) return HttpService:JSONDecode(data) end,
--   })
--
-- Register each UI setting once. The optional apply callback must update only that
-- setting's UI control, e.g. function(value) slider:Set(value) end.
-- Keybind values are Enum.KeyCode names (strings); false means unassigned.
-- Only the menu key has a default: RightShift.

local SettingsStore = {}
SettingsStore.__index = SettingsStore

local VERSION = 1

local function isFiniteNumber(value)
    return type(value) == "number"
        and value == value
        and value ~= math.huge
        and value ~= -math.huge
end

local function copyMap(source)
    local result = {}
    for key, value in pairs(source) do
        result[key] = value
    end
    return result
end

local function publicValue(value)
    if value == false then return nil end
    return value
end

local function callApply(entry, value)
    if entry.apply then
        local ok, err = pcall(entry.apply, publicValue(value))
        if not ok then
            warn("[SettingsStore] UI update failed for " .. entry.name .. ": " .. tostring(err))
        end
    end
end

function SettingsStore.new(adapter)
    assert(type(adapter) == "table", "storage adapter is required")
    assert(type(adapter.read) == "function", "adapter.read is required")
    assert(type(adapter.write) == "function", "adapter.write is required")
    assert(type(adapter.encode) == "function", "adapter.encode is required")
    assert(type(adapter.decode) == "function", "adapter.decode is required")

    return setmetatable({
        adapter = adapter,
        entries = { toggles = {}, sliders = {}, keybinds = {} },
        values = { toggles = {}, sliders = {}, keybinds = {} },
    }, SettingsStore)
end

function SettingsStore:_register(kind, name, default, options, apply)
    assert(type(name) == "string" and name ~= "", "setting name must be a non-empty string")
    assert(self.entries[kind][name] == nil, "setting already registered: " .. name)
    assert(apply == nil or type(apply) == "function", "apply must be a function")

    local entry = {
        name = name,
        default = default,
        min = options and options.min,
        max = options and options.max,
        step = options and options.step,
        apply = apply,
    }
    self.entries[kind][name] = entry
    self.values[kind][name] = default
    return entry
end

function SettingsStore:RegisterToggle(name, default, apply)
    assert(type(default) == "boolean", "toggle default must be boolean")
    return self:_register("toggles", name, default, nil, apply)
end

function SettingsStore:RegisterSlider(name, default, min, max, step, apply)
    assert(isFiniteNumber(default), "slider default must be finite")
    assert(isFiniteNumber(min) and isFiniteNumber(max) and min <= max, "invalid slider bounds")
    assert(default >= min and default <= max, "slider default is outside its bounds")
    if step ~= nil then
        assert(isFiniteNumber(step) and step > 0, "slider step must be positive")
    end
    return self:_register("sliders", name, default, {
        min = min, max = max, step = step,
    }, apply)
end

function SettingsStore:RegisterKeybind(name, default, apply)
    if name == "ToggleMenu" and default == nil then
        default = "RightShift"
    end
    assert(default == nil or (type(default) == "string" and default ~= ""),
        "keybind must be a KeyCode name string or nil")
    return self:_register("keybinds", name, default or false, nil, apply)
end

function SettingsStore:_normalize(kind, entry, value)
    if kind == "toggles" then
        if type(value) ~= "boolean" then return nil end
        return value
    elseif kind == "sliders" then
        if not isFiniteNumber(value) then return nil end
        value = math.clamp(value, entry.min, entry.max)
        if entry.step then
            value = entry.min + math.floor(((value - entry.min) / entry.step) + 0.5) * entry.step
            value = math.clamp(value, entry.min, entry.max)
        end
        return value
    elseif kind == "keybinds" then
        if value == false or value == nil or value == "" then
            return false
        end
        if type(value) ~= "string" or not Enum.KeyCode[value] then
            return nil
        end
        return value
    end
    return nil
end

function SettingsStore:Set(kind, name, value)
    local entry = self.entries[kind] and self.entries[kind][name]
    assert(entry, "unknown setting: " .. tostring(name))
    local normalized = self:_normalize(kind, entry, value)
    assert(normalized ~= nil, "invalid value for setting: " .. name)
    self.values[kind][name] = normalized
    callApply(entry, normalized)
    return publicValue(normalized)
end

function SettingsStore:Get(kind, name)
    local values = self.values[kind]
    assert(values and self.entries[kind][name], "unknown setting: " .. tostring(name))
    local value = values[name]
    return publicValue(value)
end

function SettingsStore:Reset()
    for kind, entries in pairs(self.entries) do
        for name, entry in pairs(entries) do
            self.values[kind][name] = entry.default
            callApply(entry, entry.default)
        end
    end
end

function SettingsStore:Save()
    local payload = {
        version = VERSION,
        toggles = copyMap(self.values.toggles),
        sliders = copyMap(self.values.sliders),
        keybinds = copyMap(self.values.keybinds),
    }
    local encoded = self.adapter.encode(payload)
    assert(type(encoded) == "string", "adapter.encode must return a string")
    return self.adapter.write(encoded)
end

function SettingsStore:Load()
    local okRead, raw = pcall(self.adapter.read)
    if not okRead or type(raw) ~= "string" or raw == "" then
        return false, "No saved settings could be read"
    end

    local okDecode, payload = pcall(self.adapter.decode, raw)
    if not okDecode or type(payload) ~= "table" or payload.version ~= VERSION then
        return false, "Saved settings are invalid or use an unsupported version"
    end

    -- Apply only registered settings. Missing or invalid entries retain their defaults.
    for kind, entries in pairs(self.entries) do
        local saved = type(payload[kind]) == "table" and payload[kind] or {}
        for name, entry in pairs(entries) do
            local candidate = saved[name]
            if candidate ~= nil then
                local normalized = self:_normalize(kind, entry, candidate)
                if normalized ~= nil then
                    self.values[kind][name] = normalized
                    callApply(entry, normalized)
                end
            end
        end
    end
    return true
end

return SettingsStore
