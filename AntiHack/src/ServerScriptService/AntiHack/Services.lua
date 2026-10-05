local HttpService=game:GetService("HttpService")
local U=require(game.ReplicatedStorage.AntiHack.Utilities)
local S={};S.__index=S
function S.new(c)return setmetatable({C=c,R={},E={},M={},B={},X={},Q={}},S)end
local function state(t,k)local x=t[k];if not x then x={};t[k]=x end;return x end
function S:detect(p,d)
 local r=state(self.R,p);local now=os.clock();r.score=math.max(0,(r.score or 0)-(now-(r.last or now))*self.C.Risk.DecayPerSecond);r.last=now
 r.cats=r.cats or{};r.signals=(r.signals or 0)+1;local w=(d.Severity or 1)*(.35+(d.Confidence or 0))
 if not r.cats[d.Category]then r.cats[d.Category]=true;w*=1.35 end;r.score=math.clamp(r.score+w,0,1000)
 local independent=0;for _ in pairs(r.cats)do independent+=1 end;local a="Log"
 if r.score>=self.C.Risk.AutoBanThreshold and independent>=self.C.Risk.AutoBanIndependentSignals then a=self.C.Punishment.AutoBanEnabled and"PermanentBan"or"Restrict"
 elseif r.score>=self.C.Risk.RestrictThreshold then a="Restrict"elseif r.score>=self.C.Risk.FlagThreshold then a="Flag"elseif r.score>=self.C.Risk.WarningThreshold then a="Warn"end
 d.Id=HttpService:GenerateGUID(false);d.PlayerId=p.UserId;d.Timestamp=os.time();d.Action=a;local e=state(self.E,p);table.insert(e,d)
 while #e>self.C.Evidence.MaxTimeline do table.remove(e,1)end
 if self.C.Logging.PrintDetections then print(string.format("[AntiHack] %s %s sev=%d conf=%.2f risk=%.1f action=%s",p.Name,d.Type,d.Severity,d.Confidence,r.score,a))end
 return d,{Score=r.score,IndependentSignalCount=independent,SignalCount=r.signals,Action=a}
end
function S:remote(p,name,args,rule)
 rule=rule or{};local b=state(self.B,tostring(p.UserId)..":"..name);local now=os.clock();local win=rule.Window or self.C.RemoteSecurity.DefaultWindow
 b.started=b.started or now;if now-b.started>=win then b.started=now;b.count=0 end;b.count=(b.count or 0)+1
 if b.count>(rule.RateLimit or self.C.RemoteSecurity.DefaultRateLimit)then return false,"RateLimited"end
 if type(args)~="table"or #args>(rule.MaxArguments or self.C.RemoteSecurity.MaxArguments)then return false,"InvalidArgumentCount"end
 for i,t in ipairs(rule.ArgumentTypes or{})do local v=args[i]
  if t=="number"and not U.IsFiniteNumber(v)then return false,"InvalidNumber"end
  if t=="string"and(type(v)~="string"or#v>self.C.RemoteSecurity.MaxStringLength)then return false,"InvalidString"end
  if t=="Vector3"and not U.IsFiniteVector3(v)then return false,"InvalidVector3"end
  if t=="Instance"and typeof(v)~="Instance"then return false,"InvalidInstance"end
 end;return true
end
function S:authorize(p,reason,duration)self.X[p]={untilTime=os.clock()+(duration or self.C.Movement.GraceWindow),reason=tostring(reason or"authorized")}end
function S:heartbeat(p,seq)
 local s=state(self.Q,p);s.id=s.id or HttpService:GenerateGUID(false);s.last=os.clock();s.seq=s.seq or 0
 if type(seq)~="number"or seq%1~=0 or seq<=s.seq or seq>s.seq+self.C.Session.MaxSequenceJump then self:detect(p,{Type="HeartbeatSequence",Category="Network",Severity=2,Confidence=.72,Evidence={Received=seq,Expected=s.seq},Signals={"SequenceMismatch"}});return false end
 s.seq=seq;return true
end
function S:movement(p,dt)
 if not self.C.Movement.Enabled then return end
 local c=p.Character;local root=c and c:FindFirstChild("HumanoidRootPart");local h=c and c:FindFirstChildOfClass("Humanoid");if not root or not h or h.Health<=0 then self.M[p]=nil;return end
 local s=state(self.M,p);local now=os.clock();if not s.time then s.pos=root.Position;s.vel=root.AssemblyLinearVelocity;s.time=now;s.bad=0;return end
 local ex=self.X[p];if ex and ex.untilTime>now then s.pos=root.Position;s.vel=root.AssemblyLinearVelocity;s.time=now;s.bad=0;return elseif ex then self.X[p]=nil end
 local elapsed=math.max(now-s.time,dt or .25);local vel=root.AssemblyLinearVelocity;local hs=Vector3.new(vel.X,0,vel.Z).Magnitude;local accel=(vel-s.vel).Magnitude/elapsed;local dist=(root.Position-s.pos).Magnitude;local typ,conf
 if dist>self.C.Movement.TeleportDistance then typ,conf="ImpossibleMovement",.94
 elseif hs>self.C.Movement.MaxHorizontalSpeed and h:GetState()~=Enum.HumanoidStateType.Freefall then typ,conf="MovementSpeed",.82
 elseif math.abs(vel.Y)>self.C.Movement.MaxVerticalSpeed then typ,conf="VerticalVelocity",.78
 elseif accel>self.C.Movement.MaxAcceleration then typ,conf="MovementAcceleration",.76 end
 if typ then s.bad+=1 else s.bad=math.max(0,s.bad-1)end
 if typ and s.bad>=self.C.Movement.SuspiciousSamples then self:detect(p,{Type=typ,Category="Movement",Severity=s.bad>=self.C.Movement.HardSamples and 5 or 3,Confidence=math.min(.99,conf+s.bad*.01),Evidence={Position=root.Position,Velocity=vel,HorizontalSpeed=hs,Acceleration=accel,Distance=dist,Samples=s.bad,State=h:GetState().Name},Signals={typ}});s.bad=0 end
 s.pos=root.Position;s.vel=vel;s.time=now
end
function S:combat(p,weapon,target,damage)
 local c=p.Character;local root=c and c:FindFirstChild("HumanoidRootPart");local tr=target and target:IsA("Model")and target:FindFirstChild("HumanoidRootPart");local h=target and target:IsA("Model")and target:FindFirstChildOfClass("Humanoid")
 if not root or not tr or not h or h.Health<=0 then self:detect(p,{Type="InvalidTarget",Category="Combat",Severity=3,Confidence=.92,Evidence={},Signals={"InvalidTarget"}});return false end
 local range=(weapon and weapon:GetAttribute("AttackRange"))or self.C.Combat.DefaultRange;local dist=(root.Position-tr.Position).Magnitude
 if dist>range+self.C.Combat.RangeTolerance then self:detect(p,{Type="CombatRange",Category="Combat",Severity=4,Confidence=.96,Evidence={Distance=dist,MaxRange=range},Signals={"ExcessiveRange"}});return false end
 local s=state(self.Q,p);local now=os.clock();local min=1/self.C.Combat.MaxAttacksPerSecond
 if s.attack and now-s.attack+self.C.Combat.CooldownTolerance<min then self:detect(p,{Type="AttackRate",Category="Combat",Severity=4,Confidence=.9,Evidence={Interval=now-s.attack,Minimum=min},Signals={"CooldownViolation"}});return false end
 if not U.IsFiniteNumber(tonumber(damage))or damage<=0 or damage>self.C.Combat.MaxDamage then self:detect(p,{Type="InvalidDamage",Category="Combat",Severity=5,Confidence=.99,Evidence={Damage=damage},Signals={"ClientDamageRejected"}});return false end
 s.attack=now;return true
end
return S