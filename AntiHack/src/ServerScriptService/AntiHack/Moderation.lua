local DataStoreService=game:GetService("DataStoreService")
local Store=DataStoreService:GetDataStore("AntiHack_Bans_v1")
local M={};M.__index=M
function M.new(config)return setmetatable({Config=config,Cache={}},M)end
function M:IsBanned(userId)
 local c=self.Cache[userId];if c then if c.ExpiresAt and c.ExpiresAt<=os.time()then self.Cache[userId]=nil;return false end;return true,c end
 local ok,v=pcall(Store.GetAsync,Store,tostring(userId));if not ok or not v then return false end
 if v.ExpiresAt and v.ExpiresAt<=os.time()then return false end;self.Cache[userId]=v;return true,v
end
function M:Ban(player,reason,duration,evidence)
 local record={UserId=player.UserId,Username=player.Name,Reason=string.sub(tostring(reason),1,200),CreatedAt=os.time(),ExpiresAt=duration and os.time()+duration or nil,Evidence=evidence}
 local ok=pcall(Store.SetAsync,Store,tostring(player.UserId),record);if not ok then return false,"DataStoreFailure"end
 self.Cache[player.UserId]=record;player:Kick("Anti-cheat action: "..record.Reason);return true
end
return M