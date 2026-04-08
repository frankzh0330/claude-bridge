import { loadConfig } from "./config.js";
import { createBot } from "./bot.js";
import pino from "pino";

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: { colorize: true },
  },
});

async function main() {
  const config = loadConfig();
  logger.info(`Starting bridge with ${config.bots.length} bot(s)`);

  const instances = config.bots.map((botConfig) => createBot(botConfig, config));

  for (const { config: bc } of instances) {
    logger.info({ cwd: bc.cwd }, `Bot configured`);
  }

  const shutdown = async () => {
    logger.info("Shutting down...");
    for (const { bot } of instances) {
      bot.stop();
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await Promise.all(
    instances.map(({ bot, config: bc }) =>
      bot.start({
        onStart: (info) => {
          logger.info(`Bot @${info.username} started (CWD: ${bc.cwd})`);
        },
      })
    )
  );
}

main().catch((err) => {
  logger.fatal(err, "Fatal error");
  process.exit(1);
});
