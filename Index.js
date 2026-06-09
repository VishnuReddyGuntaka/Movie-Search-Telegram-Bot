import { Telegraf, Markup } from "telegraf";
import express from "express";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { or, ilike, eq } from "drizzle-orm";

/* ---------------- EXPRESS ---------------- */
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (_req, res) => {
  res.send("🚀 Movie Bot Running");
});

app.listen(port, () => {
  console.log("Server running on", port);
});

/* ---------------- ENV ---------------- */
if (!process.env.BOT_TOKEN) throw new Error("BOT_TOKEN missing");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");

/* ---------------- DB ---------------- */
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

/* ---------------- TABLE ---------------- */
const moviesTable = pgTable("movies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  fileId: text("file_id").notNull(),
  caption: text("caption"),
});

/* ---------------- BOT INIT ---------------- */
const bot = new Telegraf(process.env.BOT_TOKEN);

/* ---------------- FORCE JOIN SYSTEM ---------------- */
const CHANNEL = "@TeluguCinemasTG";

async function isUserJoined(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(CHANNEL, ctx.from.id);
    return ["member", "administrator", "creator"].includes(member.status);
  } catch (err) {
    return false;
  }
}

/* ---------------- HELPERS ---------------- */
function getFileId(msg) {
  return (
    msg?.video?.file_id ||
    msg?.document?.file_id ||
    msg?.photo?.at(-1)?.file_id
  );
}

function getName(msg) {
  return msg?.caption || msg?.text || "Unknown Movie";
}

/* ---------------- START ---------------- */
bot.start(async (ctx) => {
  const joined = await isUserJoined(ctx);

  if (!joined) {
    return ctx.reply(
      "🎬 Movies access kosam mundhu channel join avvandi",
      Markup.inlineKeyboard([
        [Markup.button.url("📢 Join Channel", "https://t.me/TeluguCinemasTG")],
        [Markup.button.callback("🔄 I Joined", "check_join")]
      ])
    );
  }

  ctx.reply("👋 Send movie name to search");
});

/* ---------------- CHECK JOIN BUTTON ---------------- */
bot.action("check_join", async (ctx) => {
  const joined = await isUserJoined(ctx);

  if (!joined) {
    return ctx.answerCbQuery("❌ Inka join avvaledu!", { show_alert: true });
  }

  await ctx.answerCbQuery("✅ Verified!");
  return ctx.editMessageText("🎉 Thank you! Ippudu movies search cheyyandi.");
});

/* ---------------- SAVE CHANNEL POSTS ---------------- */
bot.on("channel_post", async (ctx) => {
  const msg = ctx.channelPost;

  const fileId = getFileId(msg);
  if (!fileId) return;

  const name = getName(msg);

  await db.insert(moviesTable).values({
    name,
    fileId,
    caption: msg?.caption || null,
  });

  console.log("Saved:", name);
});

/* ---------------- SEARCH (PROTECTED) ---------------- */
bot.on("text", async (ctx) => {
  const joined = await isUserJoined(ctx);

  if (!joined) {
    return ctx.reply(
      "⚠️ Mundhu channel join avvandi",
      Markup.inlineKeyboard([
        [Markup.button.url("📢 Join Channel", "https://t.me/TeluguCinemasTG")]
      ])
    );
  }

  const query = ctx.message.text.trim();
  if (!query || query.startsWith("/")) return;

  const results = await db
    .select()
    .from(moviesTable)
    .where(
      or(
        ilike(moviesTable.name, `%${query}%`),
        ilike(moviesTable.caption, `%${query}%`)
      )
    )
    .limit(10);

  if (!results.length) {
    return ctx.reply("❌ No movies found");
  }

  const buttons = results.map((m) => [
    Markup.button.callback(m.name, `dl_${m.id}`),
  ]);

  return ctx.reply(
    `🎬 Found ${results.length} results`,
    Markup.inlineKeyboard(buttons)
  );
});

/* ---------------- DOWNLOAD + TIMEOUT ---------------- */
bot.action(/^dl_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});

  const id = Number(ctx.match[1]);

  const [movie] = await db
    .select()
    .from(moviesTable)
    .where(eq(moviesTable.id, id));

  if (!movie) return ctx.reply("❌ Not found");

  const warningText = `🚨 Time Out: Copyright safety kosam ee movie 3 minutes tarvata automatic ga delete avuthundi bro!
👉 Save chesuko leda evarikaina forward cheyyi, lekapothe miss avuthav.`;

  const warningMsg = await ctx.reply(warningText);

  const sentMovie = await ctx.replyWithVideo(movie.fileId, {
    caption: movie.caption || movie.name,
  });

  setTimeout(async () => {
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, sentMovie.message_id);
      await ctx.telegram.deleteMessage(ctx.chat.id, warningMsg.message_id);

      await ctx.reply(
        "🚨 Time Out: Movie has been deleted automatically after 3 minutes for copyright safety."
      );
    } catch (e) {
      console.log("Delete error:", e);
    }
  }, 180000);
});

/* ---------------- BOT START ---------------- */
bot.launch({
  dropPendingUpdates: true,
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
