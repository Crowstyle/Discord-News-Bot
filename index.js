require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

// =======================
// CONFIG
// =======================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID_NEWS = process.env.NEWS_ID;
const CHANNEL_ID_PATCH = process.env.PATCH_ID;

if (!DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN fehlt in der .env Datei!");
  process.exit(1);
}

const ALLOWED_ROLE_IDS = [
  process.env.ROLE1,
  process.env.ROLE2,
  process.env.ROLE3
];

// =======================
// const News
// =======================

const CHECK_INTERVAL_MINUTES_News = 1440; 
const NEWS_URL = "https://www.john-doe.com";
const DATA_FILE = "./shared/lastArticle.json";

// =======================
// const Patchnotes
// =======================

const CHECK_INTERVAL_MINUTES_Patch = 360; 
const PATCH_FILE = "./shared/lastPatch.json";

// =======================
// DISCORD CLIENT
// =======================

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// =======================
// NEWS GET
// =======================

async function getLatestArticle() {
  try {
    const response = await axios.get(NEWS_URL);
    const $ = cheerio.load(response.data);

    // Aktuellsten News-Titel auslesen (erstes h2 oder h3 im main-Tag)
    const latestTitle = $("main h2, main h3").first().text().trim();

    // Optional: Link zur konkreten News, falls vorhanden
    const latestLink = $("main h2 a, main h3 a").first().attr("href") || NEWS_URL;

    return { title: latestTitle, link: latestLink };
  } catch (err) {
    console.error("❌ Fehler beim Abrufen der News:", err.message);
    return null;
  }
}

// =======================
// PATCH GET
// =======================

async function getLatestPatch() {
  try {
    const response = await axios.get(
      "https://api.exaplewebsite.com",
      {
        params: {
          appid: 2399420,
          count: 1,
          maxlength: 0
        }
      }
    );

    const newsItem = response.data.appnews.newsitems[0];

    return {
      title: newsItem.title,
      link: newsItem.url
    };

  } catch (err) {
    console.error("❌ Fehler beim Abrufen der Patchnotes:", err.message);
    return null;
  }
}

// =======================
// FILE HANDLING NEWS
// =======================

function loadLastArticle() {
  if (!fs.existsSync(DATA_FILE)) return null;
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveLastArticle(article) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(article, null, 2));
}

// =======================
// FILE HANDLING PATCH
// =======================

function loadLastPatch() {
  if (!fs.existsSync(PATCH_FILE)) return null;
  return JSON.parse(fs.readFileSync(PATCH_FILE, "utf8"));
}

function saveLastPatch(article) {
  fs.writeFileSync(PATCH_FILE, JSON.stringify(article, null, 2));
}

// =======================
// NEWS CHECK
// =======================

async function checkNews(manual = false, interaction = null) {
  try {
    const latest = await getLatestArticle();
    if (!latest) {
      if (manual) {
        await interaction.reply({ content: "❌ Failed to load news", ephemeral: true });
      }
      return;
    }

    const last = loadLastArticle();

    // Oly post when news is new
    
    if (!last || latest.title !== last.title) {
      const channel = await client.channels.fetch(CHANNEL_ID_NEWS);

      await channel.send(
        `||@everyone|| \n` +
        `📰 **New News!**\n` +
        `**${latest.title}**\n` +
        `${latest.link}`
      );

      saveLastArticle(latest);

      if (manual) {
        await interaction.reply({ content: "✅ New news found an posted", ephemeral: true });
      }
    } else if (manual) {
      await interaction.reply({ content: "ℹ️ No news found", ephemeral: true });
    }
  } catch (err) {
    console.error("❌ Failed to check news", err.message);
    if (manual) {
      await interaction.reply({ content: "❌ Failed to validate news", ephemeral: true });
    }
  }
}

// =======================
// PATCH CHECK
// =======================

async function checkPatch(manual = false, interaction = null) {
  try {
    const latest = await getLatestPatch();
    if (!latest) {
      if (manual) {
        await interaction.reply({ content: "❌ Cant load news", ephemeral: true });
      }
      return;
    }

    const last = loadLastPatch();

// Oly post if patchnotes is new

    if (!last || latest.title !== last.title) {
      const channel = await client.channels.fetch(CHANNEL_ID_PATCH);

      await channel.send(
        `||@everyone|| \n` +
        `📰 **New Patchnotes!**\n` +
        `**${latest.title}**\n` +
        `${latest.link}`
      );

      saveLastPatch(latest);

      if (manual) {
        await interaction.reply({ content: "✅ New Patchnotes found", ephemeral: true });
      }
    } else if (manual) {
      await interaction.reply({ content: "ℹ️ No new Patchnotes found", ephemeral: true });
    }
  } catch (err) {
    console.error("❌ Faild to check Patchnotes", err.message);
    if (manual) {
      await interaction.reply({ content: "❌ Failed to vaildate Patchnotes", ephemeral: true });
    }
  }
}
// =======================
// EVENTS
// =======================
client.once("clientReady", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  // Initialer Check
  checkNews();

  // Automatischer Intervall-Check News
  setInterval(() => checkNews(false), CHECK_INTERVAL_MINUTES_News * 60 * 1000);

  // Initialer Check
  checkPatch();

    // Automatischer Intervall-Check Patch
  setInterval(() => checkPatch(false), CHECK_INTERVAL_MINUTES_Patch * 60 * 1000);

});

// Slash Command Handler
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "update") return;

  const member = interaction.member;
  const hasPermission = member.roles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id));

  if (!hasPermission) {
    return interaction.reply({ content: "⛔ You do not have permission to execute this command", ephemeral: true });
  }

  await checkNews(true, interaction);
  await checkPatch(true, interaction);
});

// =======================
// START BOT
// =======================
client.login(DISCORD_TOKEN);
