require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder, Events } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LIBRARY = path.join(ROOT, "messages.json");
const DATA = path.join(ROOT, "data");
const STATE = path.join(DATA, "state.json");
const LOG = path.join(DATA, "bot.log");
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const INTERVAL = Number.parseInt(process.env.POST_INTERVAL_MINUTES || "1", 10);
const HISTORY_SIZE = Number.parseInt(process.env.RECENT_HISTORY_SIZE || "50", 10);

if (!TOKEN || TOKEN === "put_your_bot_token_here") throw new Error("Set DISCORD_BOT_TOKEN in .env.");
if (!CHANNEL_ID || CHANNEL_ID === "put_your_text_channel_id_here") throw new Error("Set DISCORD_CHANNEL_ID in .env.");
if (!Number.isInteger(INTERVAL) || INTERVAL < 1) throw new Error("POST_INTERVAL_MINUTES must be an integer >= 1.");
if (!Number.isInteger(HISTORY_SIZE) || HISTORY_SIZE < 1) throw new Error("RECENT_HISTORY_SIZE must be an integer >= 1.");
fs.mkdirSync(DATA, { recursive: true });

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFileSync(LOG, line + "\\n", "utf8");
}
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { if (e.code !== "ENOENT") log(`Could not read ${path.basename(file)}: ${e.message}`); return fallback; }
}
function loadLibrary() {
  const entries = readJson(LIBRARY, null);
  if (!Array.isArray(entries)) throw new Error("messages.json must be a JSON array.");
  const valid = entries.filter(x => x && typeof x.id === "string" && x.id.trim() &&
    typeof x.category === "string" && x.category.trim() && typeof x.text === "string" && x.text.trim());
  if (!valid.length) throw new Error("messages.json has no valid entries.");
  return valid;
}
function loadState() {
  const s = readJson(STATE, {});
  return { recentIds: Array.isArray(s.recentIds) ? s.recentIds.filter(x => typeof x === "string") : [],
    lastText: typeof s.lastText === "string" ? s.lastText : "" };
}
function choose(library, state) {
  const recent = new Set(state.recentIds);
  let options = library.filter(x => !recent.has(x.id));
  if (!options.length) options = library.filter(x => x.text.trim() !== state.lastText);
  if (!options.length) options = library;
  return options[Math.floor(Math.random() * options.length)];
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let busy = false;
let timer;
async function postMessage() {
  if (busy) return log("Skipped post: previous post is still running.");
  busy = true;
  try {
    // Reload the library each run so edits take effect without restarting.
    const library = loadLibrary();
    const state = loadState();
    const item = choose(library, state);
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel || !channel.isTextBased() || typeof channel.send !== "function")
      throw new Error("Channel not found or not a sendable text channel.");
    const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(item.category)
      .setDescription(item.text).setFooter({ text: "Educational content only • Not financial advice" })
      .setTimestamp(new Date());
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    state.recentIds.push(item.id);
    state.recentIds = state.recentIds.slice(-HISTORY_SIZE);
    state.lastText = item.text.trim();
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2), "utf8");
    log(`Posted id="${item.id}" category="${item.category}" to ${CHANNEL_ID}.`);
  } catch (e) { log(`Post failed: ${e.stack || e.message || String(e)}`); }
  finally { busy = false; }
}
client.once(Events.ClientReady, async c => {
  log(`Logged in as ${c.user.tag}; interval=${INTERVAL} minute(s).`);
  await postMessage();
  timer = setInterval(postMessage, INTERVAL * 60 * 1000);
});
client.on(Events.Error, e => log(`Discord client error: ${e.message}`));
process.on("unhandledRejection", e => log(`Unhandled rejection: ${e?.stack || e}`));
function shutdown(signal) {
  log(`Received ${signal}; shutting down.`);
  if (timer) clearInterval(timer);
  client.destroy();
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
client.login(TOKEN).catch(e => { log(`Discord login failed: ${e.message}`); process.exit(1); });
