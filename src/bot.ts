import { Bot, type Context } from "grammy";
import type { AppConfig, BotConfig } from "./config.js";
import type { SessionState } from "./types.js";
import { streamClaude } from "./claude.js";
import { chunkMessage } from "./message-utils.js";

const EDIT_INTERVAL_MS = 2500;

export interface BotInstance {
  bot: Bot<Context>;
  config: BotConfig;
}

export function createBot(botConfig: BotConfig, appConfig: AppConfig): BotInstance {
  const bot = new Bot<Context>(botConfig.token);

  const session: SessionState = {
    sessionId: null,
    abortController: null,
    isProcessing: false,
  };

  // Auth middleware
  bot.use(async (ctx, next) => {
    if (ctx.from?.id !== appConfig.allowedUserId) {
      return;
    }
    const msgDate = ctx.message?.date;
    if (msgDate) {
      const ageSeconds = Date.now() / 1000 - msgDate;
      if (ageSeconds > appConfig.messageExpiryMinutes * 60) {
        return;
      }
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    await ctx.reply(
      `Claude Code Bridge\nCWD: ${botConfig.cwd}\n\n` +
        "/new - New conversation\n" +
        "/stop - Cancel current request\n" +
        "/status - Session status"
    );
  });

  bot.command("new", async (ctx) => {
    if (session.abortController) {
      session.abortController.abort();
      session.abortController = null;
    }
    session.sessionId = null;
    session.isProcessing = false;
    await ctx.reply("New conversation started.");
  });

  bot.command("stop", async (ctx) => {
    if (session.abortController) {
      session.abortController.abort();
      session.abortController = null;
      session.isProcessing = false;
      await ctx.reply("Request cancelled.");
    } else {
      await ctx.reply("No active request.");
    }
  });

  bot.command("status", async (ctx) => {
    const lines = [
      `Processing: ${session.isProcessing}`,
      `Session: ${session.sessionId || "none"}`,
      `CWD: ${botConfig.cwd}`,
      `Max turns: ${botConfig.maxTurns}`,
    ];
    await ctx.reply(lines.join("\n"));
  });

  bot.on("message:text", async (ctx) => {
    if (session.isProcessing) {
      await ctx.reply("Still processing. Use /stop to cancel.");
      return;
    }

    session.isProcessing = true;
    const abortController = new AbortController();
    session.abortController = abortController;

    const userText = ctx.message.text;

    try {
      let fullResponse = "";
      let resultSessionId = "";

      const thinkingMsg = await ctx.reply("...");

      const stream = streamClaude({
        prompt: userText,
        sessionId: session.sessionId || undefined,
        abortController,
        cwd: botConfig.cwd,
        maxTurns: botConfig.maxTurns,
        maxBudgetUsd: botConfig.maxBudgetUsd,
      });

      let lastEditTime = 0;

      for await (const event of stream) {
        if (event.type === "text_delta") {
          fullResponse += event.content;

          const now = Date.now();
          if (now - lastEditTime >= EDIT_INTERVAL_MS && fullResponse.length > 0) {
            lastEditTime = now;
            try {
              const preview = fullResponse.slice(-3800);
              await ctx.api.editMessageText(
                ctx.chat.id,
                thinkingMsg.message_id,
                preview + "\n\n..."
              );
            } catch {
              // edit failures are non-fatal
            }
          }
        } else if (event.type === "complete") {
          resultSessionId = event.sessionId;
        } else if (event.type === "error") {
          await ctx.reply(`Error: ${event.error}`);
        }
      }

      try {
        await ctx.api.deleteMessage(ctx.chat.id, thinkingMsg.message_id);
      } catch {
        // non-fatal
      }

      if (fullResponse.trim()) {
        const chunks = chunkMessage(fullResponse);
        for (const chunk of chunks) {
          await ctx.reply(chunk);
        }
      }

      session.sessionId = resultSessionId || session.sessionId;
    } catch (err) {
      console.error("Unexpected error in message handler:", err);
      await ctx.reply("Unexpected error occurred.");
    } finally {
      session.isProcessing = false;
      session.abortController = null;
    }
  });

  return { bot, config: botConfig };
}
