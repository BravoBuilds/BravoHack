-- BravoHack Key Authorization Server
-- Install this Script in ServerScriptService in your Roblox experience.
--
-- Each key can be claimed once. The first Roblox UserId that successfully
-- claims a key becomes its permanent owner in DataStore. Future attempts
-- with another UserId are rejected.
--
-- IMPORTANT:
-- This server script is authoritative. Do not move the key list into a
-- LocalScript/ReplicatedStorage, because clients must not be trusted.

local DataStoreService = game:GetService("DataStoreService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local KEY_STORE = DataStoreService:GetDataStore("BravoHack_KeyBindings_v1")

local VALID_KEYS = {
    ["KEYLFFTAA0F30IFX6UXHIM8GIMML5RCUH3J"] = true,
    ["KEY0PMZG9SMTBUEJAGTG9KHMIAJJVB5VMB5"] = true,
    ["KEY3UX5WUEDLM66JD79MTSZ6NX5SIWXPCUJ"] = true,
    ["KEYGSWWMLZPS8VYBA75TCCNBLSUEJGXRU2L"] = true,
    ["KEY95P6U6FJZBCV8FMPWPCKQPUZOQL1AFHH"] = true,
    ["KEYR0BATGDZYM6PWFLYNQRVYKLWIHXZIGYT"] = true,
    ["KEYTESDGXD3E5SVNX6BFQEDHM3YJGLQYANI"] = true,
    ["KEYRVZURTBOBFVYWYOTY1WTU1GTII4IDIFB"] = true,
    ["KEYFIU0JAJXRIQGA1QSB07FB1YFCZRFIFNY"] = true,
    ["KEYTT4ZJBEVUAZUP3HY8MAPLRMIOM4KLCGQ"] = true,
    ["KEYCTYJF6UAU2RPBQ9WBW7U6S7HTWDRIS89"] = true,
    ["KEYNIAXQ5LPBDOHGCIR1TLKRRV3POW2N2EQ"] = true,
    ["KEYJE5XNYY946BEZR0AWPEUSPTMOSHGA2CH"] = true,
    ["KEYJ39EF7QAWJWN1HAKZK4CKOGD2BR3W5IH"] = true,
    ["KEYOT3LWPSMJIQPSDMPCXEIZ75LAVGZFBAW"] = true,
    ["KEYLX6PIU48HRIO2BDYPG25WFBXJDUP2FZN"] = true,
    ["KEYAZBO1DO2I6OREB1LGRGY5Z5FIJUUJN2Q"] = true,
    ["KEYTOM16W5AXZUWBSN0P65401ZHWDWTFNMZ"] = true,
    ["KEYVP7WN790VCNEBVL1SXBLVQCFKH2LYKWS"] = true,
    ["KEYWUAXXGSXYM7GDRF6XUJVDZCOS6IUYPNS"] = true,
    ["KEYONE3QFFSNCWP8T44LWIBXPWQPZIZ08LD"] = true,
    ["KEY6G0RZFHNNMTFKD2ZKZFC3M0UH54SSI7Q"] = true,
    ["KEYIW8S8CC8C5ZJ8RWHHANEKCZEA8RXQCMB"] = true,
    ["KEYZV1LOVOCRWXC0ZGXXEAHGOOJV2JSTEQF"] = true,
    ["KEYNDFBTWZ1NHJPJSWBVEVPVTFZ1NW8YJGW"] = true,
    ["KEYRWHDMBYKYTUCIWWMPLUYRXXZZ5OQHSTD"] = true,
    ["KEYWRDAUSHVGCR72JZLMJTPKFJOEROIRIPK"] = true,
    ["KEYIPXLD4JCF3X3KSMRCAH5YXBLU38COXHT"] = true,
    ["KEY6OUP7ENPTBVRNDXRELBQZSFUZ6JXFVRR"] = true,
    ["KEYNWTHHIGH1AJCJ2A0RGRHW9BFCWKOHC0G"] = true,
    ["KEYLD2X0PFRCZ0YOP3XDBJZFZDDH2UI7JOJ"] = true,
    ["KEY7AI9NUEXZE6HQMRIV2ZNJWOZBF9CK58Q"] = true,
    ["KEYG68E3WVALREWXHINKAVLXG9A9IPIR1JE"] = true,
    ["KEYVVAIHARWKJCT8U6V059PSPGST55SL8JQ"] = true,
    ["KEYISDJ9Y1SVAW8MKIM1UDAMGAFXOI4QIMM"] = true,
    ["KEYPLEFGIA5XCJNSUYNQUKTVP8JRRXHDOQT"] = true,
    ["KEYLOE61RWW4NGSW8ZYDKKATWV4BLEN1N15"] = true,
    ["KEYEZ2EUOBNYKTKQJAWGEJV1MYWWJTXU7I8"] = true,
    ["KEYKZNVH6ZANUZFCT66XDIHXRYIE1SLLXYR"] = true,
    ["KEYV3DTGYD1JYPC2COL9IYKZOBYWZ18I6VI"] = true,
    ["KEYJXTVBH2UDYYGFBM9IY4JCT5DCL5XAVEZ"] = true,
    ["KEYT5ID7ZVUTGYNLEBATZLHKTU0K1UTXRPH"] = true,
    ["KEYQ2DG4178QDWZLYQCPXCLSRPD4JTZNGVD"] = true,
    ["KEYSGLV4OU5WQZT0XQRH4PK3CTBVJPTUFHB"] = true,
    ["KEYNV0XI9AXDPFUOKX76CAXWVSQJL0LYSRV"] = true,
    ["KEYJAUBQSRLD9OBU7ETJPOTESR6FXVAMUQE"] = true,
    ["KEY7ENJM3FZ3SFJJKZH0U911KLDLWQNP4FZ"] = true,
    ["KEYK0NP5GVW41CWY5KGII29PT6T48DYC1NO"] = true,
    ["KEYGTH2U0M637QSV84CPZF835BR6FSSO7DB"] = true,
    ["KEYHCZ5QUEHOVC7TAHJSKEKRCLXNVC7FKXS"] = true,
    ["KEYVQXASVVTRFD6Z33FRDSTIRMU6UNSMTKD"] = true,
    ["KEYGTIAEEJ2PSVJUIMTNBYVXID5WZTRYGT1"] = true,
    ["KEYEUQS8MJOFJT2WQS2TF8CMXSWYHK16WKT"] = true,
    ["KEYSELMWZJF7RKFKI9F8YBK1SZ2KSRK57CI"] = true,
    ["KEYBSKDBT3V6HQSKYRAVAD3G7VFE62NI7AA"] = true,
    ["KEYBS9IUIF7WYEWQCWX4BM8M3HE0TTGOA8S"] = true,
    ["KEYMI0NAAYVLKRB2XAUDT7IGBABJHQYNXSX"] = true,
    ["KEYECIWQLWITGF6JZOOA88SAHMQN2DCZQFL"] = true,
    ["KEYCZJXYPKCLFPQV6WDU9M37I7BCKOWLHRF"] = true,
    ["KEYFOOOYYQPRW1Q1MPRXCWTNGKJJ0HBHDUJ"] = true,
    ["KEY4IWTGRTDL2IZBCOHIJHUBJDNXSMXIXHW"] = true,
    ["KEY2KGFQPOARB31COMM8Q3J4XXQAMDCB66X"] = true,
    ["KEYRYZ0OQ5WGTSUALAWFZ8EMXBBHEXHDLKC"] = true,
    ["KEYMLHLOXXN81VOCGN800EIGFPG67Q9EF1M"] = true,
    ["KEYA0IZD4VB9KPDX8W3CYEDBKFKHFKUOZYZ"] = true,
    ["KEYA8FDCGGGV8FZX0UPPFMJ1ZIRQ6Q0BSER"] = true,
    ["KEYYVIWAHLKV6WD5X0WIVQEIDWT1ZHHAS08"] = true,
    ["KEY4FBMQECNLVMT6OBLMVJ2SPZXWDXFW6WJ"] = true,
    ["KEYGYKIMVW1KHSLXR4ECZYTB01SRNVKEIVR"] = true,
    ["KEYED4I1H3SXTR88WVO70Q0GHBZWJGI75HU"] = true,
    ["KEYWSUY3BMX8GAOGUJ7I0AW69SQMOP27MAS"] = true,
    ["KEY2WLPUBTOXWZVSUKJFCUBQGBMLCLVYVEP"] = true,
    ["KEYPQY1JHCTRKLNUWQIERRYEQW1PQUSYW97"] = true,
    ["KEYKGHRNVW34XHBRRI3FTVV0BCJZ2MPD6VJ"] = true,
    ["KEYILCZUWADANIJ6SGRJGHRIBHALTXKOP0X"] = true,
    ["KEYOGDRTC39N9RBC3RKGDAXA8NPDYGVXONZ"] = true,
    ["KEYBKFAS4DSKQ97ZWREFJZBEXPZUMG6ILAW"] = true,
    ["KEYXNOHW9KCLIKOBPIGFJYCRLZJHJT1G99S"] = true,
    ["KEY8TFHTEVRYGPO1EQTSDLAOQVUB6DU63BY"] = true,
    ["KEY9ETLWFSWXUKMRX3TGARLB9OMBAUHFMEF"] = true,
    ["KEYBPZYNQ5DVDZFJ8LG7CL7PIXH5YPAX7B3"] = true,
    ["KEYVKZYMOJBUCVOYQFSIXV4S3GBJFA78CHQ"] = true,
    ["KEYXLLOOVRY2S2RATR7SPWH9M8TAQWGDTDF"] = true,
    ["KEYFBF3G5WD2V6WUIQW37FQKPT7C21LSCHM"] = true,
    ["KEY9Z6RSJCVCYQNVLOSCCVBEE5HA1MZUT96"] = true,
    ["KEY3EJNY2IFOZVBXSCCAHJAMK1NIHXXP7FD"] = true,
    ["KEYM6ZBKG8GVWW9VTFJQKAK4FRUJSRDMEVS"] = true,
    ["KEYZTD9XEPOT6IEUCLRRG5TE6IJZ9MJZ7MX"] = true,
    ["KEYR4HDBTDHKI0PLAMGTO9X9F5NTAOPGX5I"] = true,
    ["KEY6SZL01NR6GVS7ZAM1GYL2REMYO8ZWNJU"] = true,
    ["KEY7B7KB6JVDQRF7PYVTBDNQRITMZCABOHV"] = true,
    ["KEY519B361UTMZUENQOHOR2Z6NV9F6TAKMS"] = true,
    ["KEYQGIPM2TDLOH1GNTXVECNTTHL0UNWLNYB"] = true,
    ["KEYS4Z1SBSJN7JG7G3VFOARCRHBURJLUE0I"] = true,
    ["KEYLU3L9TOO68WMZ6ZPTYTIJSFWBG5ZXKDC"] = true,
    ["KEY9KI6Z7JQVTEGIGKJKMDAIRJWUR7A18TB"] = true,
    ["KEY3POUOS2FG6CLWJZNT3USSQPHH2WPKNZ6"] = true,
    ["KEYN8FU1DIPESY6YOSTE3IXON07CBE8M3I9"] = true,
    ["KEYSGLP3REAPWBWEDEKWM6O1RLPZHMDEITP"] = true,
    ["KEYPFXXYIQX19WLGGM1EXZRUDIQPSFNXT25"] = true,
}

local remote = ReplicatedStorage:FindFirstChild("BravoHackKeyAuth")
if remote and not remote:IsA("RemoteFunction") then
    remote:Destroy()
    remote = nil
end

if not remote then
    remote = Instance.new("RemoteFunction")
    remote.Name = "BravoHackKeyAuth"
    remote.Parent = ReplicatedStorage
end

local function normalizeKey(value)
    if type(value) ~= "string" then
        return nil
    end

    value = value:gsub("%s+", ""):upper()
    if value == "" or #value > 128 then
        return nil
    end

    return value
end

remote.OnServerInvoke = function(player, suppliedKey)
    if not player or not player:IsA("Player") then
        return false, "Invalid player."
    end

    local key = normalizeKey(suppliedKey)
    if not key or not VALID_KEYS[key] then
        return false, "Invalid key."
    end

    local userId = tostring(player.UserId)
    local storeKey = "key:" .. key

    local success, storedOwner = pcall(function()
        return KEY_STORE:UpdateAsync(storeKey, function(currentOwner)
            if currentOwner == nil then
                return userId
            end

            return currentOwner
        end)
    end)

    if not success then
        warn("[BravoHack] Key binding DataStore error for " .. storeKey .. ": " .. tostring(storedOwner))
        return false, "Key server temporarily unavailable."
    end

    storedOwner = tostring(storedOwner)

    if storedOwner == userId then
        return true, "Access granted. This key is bound to your Roblox UserId."
    end

    return false, "This key is already bound to another Roblox UserId."
end

print("[BravoHack] Key authorization server ready.")
