return {
 Version="1.0.0",
 Session={HeartbeatInterval=8,Timeout=28,MaxSequenceJump=2},
 RemoteSecurity={Enabled=true,DefaultRateLimit=20,DefaultWindow=1,MaxStringLength=256,MaxArguments=12},
 Movement={Enabled=true,SampleInterval=0.25,MaxHorizontalSpeed=32,MaxVerticalSpeed=85,MaxAcceleration=160,TeleportDistance=85,GraceWindow=1.25,SuspiciousSamples=4,HardSamples=8},
 Combat={Enabled=true,DefaultRange=18,RangeTolerance=3,CooldownTolerance=0.08,MaxDamage=250,MaxAttacksPerSecond=12},
 Risk={DecayPerSecond=0.15,WarningThreshold=20,FlagThreshold=45,RestrictThreshold=70,AutoBanThreshold=95,AutoBanIndependentSignals=3},
 Punishment={WarnEnabled=true,KickEnabled=true,AutoBanEnabled=false,TemporaryBanSeconds=86400},
 Evidence={MaxTimeline=40},
 Whitelist={},
 Logging={PrintDetections=true,PrintSecurityErrors=true},
}