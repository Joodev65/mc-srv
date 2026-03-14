const { MinecraftServer } = require('@dimzxzzx07/mc-headless');
const axios = require('axios');
const path = require('path');
const os = require('os');

const CONFIG = {
  owner: "NamaOwnerKamu",
  version: "1.20.1",
  type: "paper",
  memory: { init: "1G", max: "2G", useAikarsFlags: true },
  network: { ip: "0.0.0.0", port: 25565, bedrockPort: 19132, motd: "§bHeadless Server §7| §ePowered by Joomoddss", onlineMode: false },
  world: { levelName: "Hello-World", difficulty: "normal", maxPlayers: 20, gamemode: "survival", pvp: true, hardcore: false, allowFlight: true, spawnProtection: 0, viewDistance: 8, simulationDistance: 6 },
  gameplay: { keepInventory: true, doDaylightCycle: true, doWeatherCycle: true, mobGriefing: true, naturalRegeneration: true, doMobSpawning: true, doFireTick: true, fallDamage: true, fireDamage: true, drowningDamage: true, announceAdvancements: true, commandBlockOutput: false, randomTickSpeed: 3 },
  whitelist: { enabled: false, players: ["NamaOwnerKamu"] },
  monitoring: { enabled: true, intervalMs: 60000, autoSaveIntervalMs: 300000 },
  restart: { enabled: true, delayMs: 15000, maxAttempts: 999999 }
};

// Gunakan folder Termux-safe
const SERVER_DIR = path.join(process.env.HOME, "mc-server");

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

// FUNGSI UTAMA
async function boot() {
  publicIp = await detectPublicIp();

  const server = new MinecraftServer({
    platform: "all",
    version: CONFIG.version,
    type: CONFIG.type,
    autoAcceptEula: true,
    dataPath: SERVER_DIR,  // <<< pakai folder Termux
    memory: CONFIG.memory,
    network: CONFIG.network,
    world: CONFIG.world
  });

  serverInstance = server;

  server.on("ready", (info) => {
    console.clear();
    console.log(`\n[MC HEADLESS] Server ready!`);
    console.log(`IP: ${publicIp} | Java Port: ${info.port}`);
    if (info.bedrockPort) console.log(`Bedrock Port: ${info.bedrockPort}`);
    console.log(`World: ${CONFIG.world.levelName} | Owner: ${CONFIG.owner}`);
  });

  server.on("player-join", (player) => {
    onlinePlayers.add(player.name);
    console.log(`${player.name} joined the server.`);
  });

  server.on("player-leave", (name) => {
    onlinePlayers.delete(name);
    console.log(`${name} left the server.`);
  });

  server.on("error", (err) => console.error(`[SERVER ERROR] ${err.message}`));

  await server.start();
}

// LOOP AUTO RESTART
async function main() {
  while (true) {
    try {
      await boot();
      break;
    } catch (err) {
      console.error(`[BOOT ERROR] ${err.message}`);
      if (!CONFIG.restart.enabled) process.exit(1);
      restartCount++;
      if (restartCount > CONFIG.restart.maxAttempts) process.exit(1);
      console.log(`[SYSTEM] Restarting in ${CONFIG.restart.delayMs / 1000}s...`);
      await new Promise(res => setTimeout(res, CONFIG.restart.delayMs));
    }
  }
}

process.on("SIGINT", () => {
  console.log("\n[SYSTEM] SIGINT received, shutting down...");
  if (serverInstance) serverInstance.sendCommand("save-all");
  setTimeout(() => process.exit(0), 1500);
});

process.on("SIGTERM", () => {
  console.log("\n[SYSTEM] SIGTERM received, shutting down...");
  if (serverInstance) serverInstance.sendCommand("save-all");
  setTimeout(() => process.exit(0), 1500);
});

main().catch(err => console.error(`fatal error: ${err.message}`));
