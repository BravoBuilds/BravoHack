local HttpService=game:GetService("HttpService")
local W={};W.__index=W
function W.new(config)return setmetatable({Config=config,Last=0},W)end
function W:Send(event,d)
 if not self.Config.Webhook.Enabled or self.Config.Webhook.Url==""then return false end
 if os.clock()-self.Last<(self.Config.Webhook.Cooldown or 10)then return false end
 self.Last=os.clock()
 local payload={username="AntiHack",embeds={{title="ANTI-CHEAT ALERT",description=event,fields={
  {name="Player",value=tostring(d.PlayerName or"?"),inline=true},{name="UserId",value=tostring(d.UserId or"?"),inline=true},
  {name="Detection",value=tostring(d.Detection or"?"),inline=true},{name="Severity",value=tostring(d.Severity or"?"),inline=true},
  {name="Confidence",value=string.format("%.0f%%",(tonumber(d.Confidence)or 0)*100),inline=true},
  {name="Risk",value=string.format("%.1f",tonumber(d.RiskScore)or 0),inline=true},{name="Action",value=tostring(d.Action or"Log"),inline=false}
 }}}}
 task.spawn(function()pcall(function()HttpService:RequestAsync({Url=self.Config.Webhook.Url,Method="POST",Headers={["Content-Type"]="application/json"},Body=HttpService:JSONEncode(payload)})end)end)
 return true
end
return W