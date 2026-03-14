const { MinecraftServer } = require('@dimzxzzx07/mc-headless');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const CONFIG = {
  owner: "NamaOwnerKamu",
  version: "1.20.1",
  type: "paper",
  memory: { init: "1G", max: "2G", useAikarsFlags: true },
  network: { ip: "0.0.0.0", port: 25565, bedrockPort: 19132, motd: "§bHeadless Server §7| §ePowered by Dimzxzzx07", onlineMode: false },
  world: { levelName: "Hello-World", difficulty: "normal", maxPlayers: 20, gamemode: "survival", pvp: true, hardcore: false, allowFlight: true, spawnProtection: 0, viewDistance: 8, simulationDistance: 6 },
  gameplay: { keepInventory: true, doDaylightCycle: true, doWeatherCycle: true, mobGriefing: true, naturalRegeneration: true, doMobSpawning: true, doFireTick: true, fallDamage: true, fireDamage: true, drowningDamage: true, announceAdvancements: true, commandBlockOutput: false, randomTickSpeed: 3 },
  whitelist: { enabled: false, players: ["NamaOwnerKamu"] },
  monitoring: { enabled: true, intervalMs: 60000, autoSaveIntervalMs: 300000 },
  restart: { enabled: true, delayMs: 15000, maxAttempts: 999999 }
};

const SERVER_DIR = path.join(process.env.HOME || os.homedir(), "mc-server");
fs.ensureDirSync(SERVER_DIR);

let serverInstance = null;
let publicIp = "127.0.0.1";
let startTime = Date.now();
let restartCount = 0;
let onlinePlayers = new Set();
let monitorInterval = null;
let autoSaveInterval = null;

async function detectPublicIp() {
  try {
    const res = await axios.get("https://api.ipify.org?format=json", { timeout: 10000 });
    return res?.data?.ip || "127.0.0.1";
  } catch {
    console.log("Failed to detect public IP, using default");
    return "127.0.0.1";
  }
}

function formatBytes(bytes) {
  const units = ["B","KB","MB","GB","TB"];
  let i=0, val=bytes;
  while(val>=1024 && i<units.length-1){val/=1024;i++;}
  return `${val.toFixed(2)} ${units[i]}`;
}

function formatUptime(ms){
  const total=Math.floor(ms/1000);
  const d=Math.floor(total/86400),h=Math.floor((total%86400)/3600),m=Math.floor((total%3600)/60),s=total%60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

function logBanner(info){
  console.clear();
  console.log(`\n==================================================`);
  console.log(` Minecraft Headless - Powered By Joomoddss`);
  console.log(` IP Address     : ${publicIp}`);
  console.log(` Java Port      : ${info.port}`);
  if(info.bedrockPort) console.log(` Bedrock Port   : ${info.bedrockPort}`);
  console.log(` Engine         : ${info.type} v${info.version}`);
  console.log(` World          : ${CONFIG.world.levelName}`);
  console.log(` Gamemode       : ${CONFIG.world.gamemode}`);
  console.log(` Difficulty     : ${CONFIG.world.difficulty}`);
  console.log(` Max Players    : ${CONFIG.world.maxPlayers}`);
  console.log(` Owner          : ${CONFIG.owner}`);
  console.log(` Online Mode    : ${CONFIG.network.onlineMode?"ON":"OFF"}`);
  console.log(` KeepInventory  : ${CONFIG.gameplay.keepInventory?"ON":"OFF"}`);
  console.log(` Status         : Secure & Headless`);
  console.log(`==================================================\n`);
}

function safeCommand(command,label=command){
  try{serverInstance.sendCommand(command); console.log(`[CMD] ${label}`);}catch(err){console.log(`[CMD-ERROR] ${label}: ${err.message}`);}
}

function applyServerRules(){
  console.log("[INIT] Applying server rules...");
  safeCommand(`difficulty ${CONFIG.world.difficulty}`);
  safeCommand(`defaultgamemode ${CONFIG.world.gamemode}`);
  safeCommand(`gamerule keepInventory ${CONFIG.gameplay.keepInventory}`);
  safeCommand(`gamerule doDaylightCycle ${CONFIG.gameplay.doDaylightCycle}`);
  safeCommand(`gamerule doWeatherCycle ${CONFIG.gameplay.doWeatherCycle}`);
  safeCommand(`gamerule mobGriefing ${CONFIG.gameplay.mobGriefing}`);
  safeCommand(`gamerule naturalRegeneration ${CONFIG.gameplay.naturalRegeneration}`);
  safeCommand(`gamerule doMobSpawning ${CONFIG.gameplay.doMobSpawning}`);
  safeCommand(`gamerule doFireTick ${CONFIG.gameplay.doFireTick}`);
  safeCommand(`gamerule fallDamage ${CONFIG.gameplay.fallDamage}`);
  safeCommand(`gamerule fireDamage ${CONFIG.gameplay.fireDamage}`);
  safeCommand(`gamerule drowningDamage ${CONFIG.gameplay.drowningDamage}`);
  safeCommand(`gamerule announceAdvancements ${CONFIG.gameplay.announceAdvancements}`);
  safeCommand(`gamerule commandBlockOutput ${CONFIG.gameplay.commandBlockOutput}`);
  safeCommand(`gamerule randomTickSpeed ${CONFIG.gameplay.randomTickSpeed}`);
  if(CONFIG.owner?.trim()) safeCommand(`op ${CONFIG.owner}`);
  if(CONFIG.whitelist.enabled){
    safeCommand(`whitelist on`);
    for(const p of CONFIG.whitelist.players) safeCommand(`whitelist add ${p}`);
  }else safeCommand(`whitelist off`);
  safeCommand(`save-on`);
}

function startMonitoring(){
  if(!CONFIG.monitoring.enabled) return;
  if(monitorInterval) clearInterval(monitorInterval);
  if(autoSaveInterval) clearInterval(autoSaveInterval);

  monitorInterval=setInterval(()=>{
    const mem=process.memoryUsage();
    const uptime=formatUptime(Date.now()-startTime);
    console.log(`\n[MONITOR] ================================`);
    console.log(`[MONITOR] Uptime      : ${uptime}`);
    console.log(`[MONITOR] Players     : ${onlinePlayers.size}/${CONFIG.world.maxPlayers}`);
    console.log(`[MONITOR] Player List : ${[...onlinePlayers].join(",")||"-"}`);
    console.log(`[MONITOR] RAM Used    : ${formatBytes(mem.rss)}`);
    console.log(`[MONITOR] Heap Used   : ${formatBytes(mem.heapUsed)}`);
    console.log(`[MONITOR] System Load : ${os.loadavg().map(v=>v.toFixed(2)).join(" | ")}`);
    console.log(`[MONITOR] Restarts    : ${restartCount}`);
    console.log(`[MONITOR] =================================\n`);
  }, CONFIG.monitoring.intervalMs);

  autoSaveInterval=setInterval(()=>safeCommand("save-all","auto save-all"), CONFIG.monitoring.autoSaveIntervalMs);
}

async function boot(){
  publicIp=await detectPublicIp();

  const server=new MinecraftServer({
    platform:"all",
    version:CONFIG.version,
    type:CONFIG.type,
    autoAcceptEula:true,
    dataPath:SERVER_DIR,
    memory:CONFIG.memory,
    network:CONFIG.network,
    world:CONFIG.world
  });

  serverInstance=server;

  server.on("ready",(info)=>{
    startTime=Date.now();
    logBanner(info);
    applyServerRules();
    startMonitoring();
    safeCommand(`say Server is online!`);
    safeCommand(`say Owner: ${CONFIG.owner}`);
  });

  server.on("player-join",(player)=>{
    onlinePlayers.add(player.name);
    console.log(`${player.name} joined the server.`);
    setTimeout(()=>{
      try{
        const welcome=JSON.stringify([
          { text:"Welcome to ", color:"gray" },
          { text:"Minecraft Headless ", color:"aqua", bold:true },
          { text:"- Powered By ", color:"gray" },
          { text:"Joomoddss", color:"yellow" }
        ]);
        server.sendCommand(`tellraw ${player.name} ${welcome}`);
        if(CONFIG.owner && player.name.toLowerCase()===CONFIG.owner.toLowerCase()){
          server.sendCommand(`op ${player.name}`);
          server.sendCommand(`tellraw ${player.name} {"text":"Owner privileges restored.","color":"gold","bold":true}`);
        }
      }catch(err){console.error("error:",err.message);}
    },2000);
  });

  server.on("player-leave",(name)=>{
    onlinePlayers.delete(name);
    console.log(`${name} exited the server.`);
  });

  server.on("error",(err)=>console.error(`[SERVER ERROR] ${err.message}`));

  await server.start();
}

async function main(){
  while(true){
    try{
      await boot();
      break;
    }catch(err){
      console.error(`[BOOT ERROR] ${err.message}`);
      if(!CONFIG.restart.enabled) process.exit(1);
      restartCount++;
      if(restartCount>CONFIG.restart.maxAttempts){
        console.error("[SYSTEM] Max restart attempts reached.");
        process.exit(1);
      }
      console.log(`[SYSTEM] Restarting in ${CONFIG.restart.delayMs/1000}s...`);
      await new Promise(r=>setTimeout(r, CONFIG.restart.delayMs));
    }
  }
}

process.on("SIGINT",()=>{
  console.log("\n[SYSTEM] Caught SIGINT, shutting down...");
  try{if(serverInstance){safeCommand("say Server shutting down...");safeCommand("save-all","save-all before shutdown");}}catch{}
  setTimeout(()=>process.exit(0),1500);
});

process.on("SIGTERM",()=>{
  console.log("\n[SYSTEM] Caught SIGTERM, shutting down...");
  try{if(serverInstance){safeCommand("say Server shutting down...");safeCommand("save-all","save-all before shutdown");}}catch{}
  setTimeout(()=>process.exit(0),1500);
});

main().catch(err=>console.error(`fatal error: ${err.message}`));