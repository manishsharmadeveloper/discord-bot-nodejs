
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
} = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

// --------------------------------------------------
// Configuration
// --------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const LIBRARY_PATH = path.join(ROOT, "messages.json");
const DATA_DIR = path.join(ROOT, "data");
const STATE_PATH = path.join(DATA_DIR, "state.json");
const LOG_PATH = path.join(DATA_DIR, "bot.log");

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

const INTERVAL_MINUTES = Number.parseInt(
  process.env.POST_INTERVAL_MINUTES || "1",
  10
);

const HISTORY_SIZE = Number.parseInt(
  process.env.RECENT_HISTORY_SIZE || "50",
  10
);

if (!TOKEN || TOKEN === "put_your_bot_token_here") {
  throw new Error("Set DISCORD_BOT_TOKEN in your .env file.");
}

if (!CHANNEL_ID || CHANNEL_ID === "put_your_text_channel_id_here") {
  throw new Error("Set DISCORD_CHANNEL_ID in your .env file.");
}

if (!Number.isInteger(INTERVAL_MINUTES) || INTERVAL_MINUTES < 1) {
  throw new Error("POST_INTERVAL_MINUTES must be an integer >= 1.");
}

if (!Number.isInteger(HISTORY_SIZE) || HISTORY_SIZE < 1) {
  throw new Error("RECENT_HISTORY_SIZE must be an integer >= 1.");
}

fs.mkdirSync(DATA_DIR, { recursive: true });

// --------------------------------------------------
// Logging
// --------------------------------------------------

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;

  console.log(line);

  fs.appendFileSync(LOG_PATH, line + "\n", "utf8");
}

// --------------------------------------------------
// JSON helpers
// --------------------------------------------------

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      log(
        `Could not read ${path.basename(filePath)}: ${error.message}`
      );
    }

    return fallback;
  }
}

// --------------------------------------------------
// Load editable message library
// --------------------------------------------------

function loadLibrary() {
  const entries = readJson(LIBRARY_PATH, null);

  if (!Array.isArray(entries)) {
    throw new Error("messages.json must contain a JSON array.");
  }

  const validEntries = entries.filter((entry) => {
    return (
      entry &&
      typeof entry.id === "string" &&
      entry.id.trim() &&
      typeof entry.category === "string" &&
      entry.category.trim() &&
      typeof entry.text === "string" &&
      entry.text.trim()
    );
  });

  if (validEntries.length === 0) {
    throw new Error("messages.json contains no valid messages.");
  }

  return validEntries;
}

// --------------------------------------------------
// Load duplicate-prevention state
// --------------------------------------------------

function loadState() {
  const state = readJson(STATE_PATH, {});

  return {
    recentIds: Array.isArray(state.recentIds)
      ? state.recentIds.filter((id) => typeof id === "string")
      : [],

    lastText:
      typeof state.lastText === "string"
        ? state.lastText
        : "",
  };
}

// --------------------------------------------------
// Select a message without recent duplicates
// --------------------------------------------------

function chooseMessage(library, state) {
  const recentIds = new Set(state.recentIds);

  let candidates = library.filter(
    (entry) => !recentIds.has(entry.id)
  );

  // If all IDs were recently used, begin another cycle.
  // Avoid immediately repeating the last text if possible.
  if (candidates.length === 0) {
    candidates = library.filter(
      (entry) => entry.text.trim() !== state.lastText
    );
  }

  if (candidates.length === 0) {
    candidates = library;
  }

  const index = Math.floor(Math.random() * candidates.length);

  return candidates[index];
}

// --------------------------------------------------
// Discord client
// --------------------------------------------------

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

let isPosting = false;
let intervalTimer = null;

// --------------------------------------------------
// Typing indicator
// --------------------------------------------------

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function showTypingIndicator(channel) {
  // Ask Discord to display the bot's typing indicator.
  await channel.sendTyping();

  // Keep the bot typing briefly before sending the message.
  await delay(3000);
}

// --------------------------------------------------
// Send a trading message
// --------------------------------------------------

async function postMessage() {
  if (isPosting) {
    log("Skipped post because the previous post is still running.");
    return;
  }

  isPosting = true;

  try {
    // Reload messages.json so edits can take effect without
    // restarting the bot.
    const library = loadLibrary();
    const state = loadState();

    const entry = chooseMessage(library, state);

    // Fetch the configured Discord channel.
    const channel = await client.channels.fetch(CHANNEL_ID);

    if (
      !channel ||
      !channel.isTextBased() ||
      typeof channel.send !== "function"
    ) {
      throw new Error(
        "Channel not found or not a sendable text channel."
      );
    }

    // Show typing before sending the trading message.
    await showTypingIndicator(channel);

    // Build the message embed.
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(entry.category)
      .setDescription(entry.text)
      .setFooter({
        text: "Educational content only • Not financial advice",
      })
      .setTimestamp(new Date());

    // Send the message without triggering user or role mentions.
    await channel.send({
      embeds: [embed],
      allowedMentions: {
        parse: [],
      },
    });

    // Save history after the message has successfully sent.
    state.recentIds.push(entry.id);

    state.recentIds = state.recentIds.slice(-HISTORY_SIZE);

    state.lastText = entry.text.trim();

    fs.writeFileSync(
      STATE_PATH,
      JSON.stringify(state, null, 2),
      "utf8"
    );

    log(
      `Posted id="${entry.id}" category="${entry.category}" ` +
      `to channel ${CHANNEL_ID}.`
    );
  } catch (error) {
    log(`Post failed: ${error.stack || error.message || error}`);
  } finally {
    isPosting = false;
  }
}

// --------------------------------------------------
// When the bot connects
// --------------------------------------------------

client.once(Events.ClientReady, async (readyClient) => {
  log(
    `Logged in as ${readyClient.user.tag}. ` +
    `Posting every ${INTERVAL_MINUTES} minute(s).`
  );

  // Send the first message immediately after connecting.
  await postMessage();

  // Continue posting at the configured interval.
  intervalTimer = setInterval(
    postMessage,
    INTERVAL_MINUTES * 60 * 1000
  );
});

// --------------------------------------------------
// Error handling
// --------------------------------------------------

client.on(Events.Error, (error) => {
  log(`Discord client error: ${error.message}`);
});

process.on("unhandledRejection", (error) => {
  log(`Unhandled rejection: ${error?.stack || error}`);
});

// --------------------------------------------------
// Graceful shutdown
// --------------------------------------------------

function shutdown(signal) {
  log(`Received ${signal}; shutting down.`);

  if (intervalTimer) {
    clearInterval(intervalTimer);
  }

  client.destroy();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// --------------------------------------------------
// Log in to Discord
// --------------------------------------------------

client.login(TOKEN).catch((error) => {
  log(`Discord login failed: ${error.message}`);
  process.exit(1);
});
