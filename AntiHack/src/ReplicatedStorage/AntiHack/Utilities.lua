local M={}
function M.IsFiniteNumber(v)return type(v)=="number" and v==v and v>-math.huge and v<math.huge end
function M.IsFiniteVector3(v)return typeof(v)=="Vector3" and M.IsFiniteNumber(v.X) and M.IsFiniteNumber(v.Y) and M.IsFiniteNumber(v.Z)end
function M.Sanitize(v,d,seen)
 d=d or 0;seen=seen or{};if d>3 then return "<depth-limit>"end
 local k=typeof(v)
 if k=="string"then return string.sub(v,1,256)elseif k=="number"or k=="boolean"then return v
 elseif k=="Vector3"then return{X=v.X,Y=v.Y,Z=v.Z}elseif k=="Instance"then return{ClassName=v.ClassName,Name=string.sub(v.Name,1,100)}
 elseif type(v)=="table"then if seen[v]then return"<cycle>"end;seen[v]=true;local o={};local n=0
  for key,val in pairs(v)do n+=1;if n>64 then break end;o[tostring(key)]=M.Sanitize(val,d+1,seen)end;seen[v]=nil;return o end
 return tostring(v)
end
return M