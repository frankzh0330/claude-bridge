import { loadConfig, type ChannelInstanceConfig } from "./config.js";
import { SessionManager } from "./core/session.js";
import { createMessageHandler } from "./core/handler.js";
import { TelegramAdapter, type TelegramConfig } from "./channels/telegram.js";
import type { ChannelAdapter } from "./core/types.js";
import pino from "pino";

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: { colorize: true },
  },
});

function createAdapter(channelConfig: ChannelInstanceConfig): ChannelAdapter {
  switch (channelConfig.type) {
    case "telegram":
      return new TelegramAdapter(channelConfig.options as unknown as TelegramConfig);
    // case "slack":
    //   return new SlackAdapter(channelConfig.options as SlackConfig);
    // case "discord":
    //   return new DiscordAdapter(channelConfig.options as DiscordConfig);
    default:
      throw new Error(`Unknown channel type: ${channelConfig.type}`);
  }
}

async function main() {
  const config = loadConfig();
  logger.info(`Starting bridge with ${config.channels.length} channel(s)`);

  const sessionManager = new SessionManager();

  for (const channelConfig of config.channels) {
    const adapter = createAdapter(channelConfig);
    const handler = createMessageHandler(adapter, sessionManager, {
      cwd: channelConfig.cwd,
      maxTurns: channelConfig.maxTurns,
      maxBudgetUsd: channelConfig.maxBudgetUsd,
      maxLength: channelConfig.maxLength,
    });

    adapter.onMessage(handler);

    // Register commands if the adapter supports it
    if (adapter instanceof TelegramAdapter) {
      adapter.registerCommands({
        onNew: async (chatId) => {
          sessionManager.reset(chatId);
          return "New conversation started.";
        },
        onStop: async (chatId) => {
          return sessionManager.cancel(chatId) ? "Request cancelled." : "No active request.";
        },
        onStatus: async (chatId) => {
          const session = sessionManager.get(chatId);
          return [
            `Processing: ${session.isProcessing}`,
            `Session: ${session.sessionId || "none"}`,
            `Mode: ${session.permissionMode}`,
            `CWD: ${channelConfig.cwd}`,
            `Max turns: ${channelConfig.maxTurns}`,
          ].join("\n");
        },
        onPlan: async (chatId) => {
          sessionManager.setMode(chatId, "plan");
          return "Switched to plan mode. Claude will analyze and plan without executing.";
        },
        onCode: async (chatId) => {
          sessionManager.setMode(chatId, "bypassPermissions");
          return "Switched to code mode. Claude will execute with full permissions.";
        },
      });
    }

    // Start all adapters in parallel (bot.start() blocks for long polling)
    adapter.start().then(() => {
      logger.info(`Channel ${adapter.name} started (CWD: ${channelConfig.cwd})`);
    });
  }

  // Wait briefly for adapters to initialize
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const shutdown = async () => {
    logger.info("Shutting down...");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.fatal(err, "Fatal error");
  process.exit(1);
});
