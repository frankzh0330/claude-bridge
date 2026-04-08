import "dotenv/config";

export interface BotConfig {
  token: string;
  cwd: string;
  maxTurns: number;
  maxBudgetUsd: number;
}

export interface AppConfig {
  bots: BotConfig[];
  allowedUserId: number;
  messageExpiryMinutes: number;
}

export function loadConfig(): AppConfig {
  const allowedUserId = process.env.ALLOWED_USER_ID;
  if (!allowedUserId) throw new Error("ALLOWED_USER_ID is required");

  const bots = loadBotConfigs();
  if (bots.length === 0) throw new Error("No bot configured. Set BOT_TOKEN/BOT_CWD or BOT_<N>_TOKEN/BOT_<N>_CWD");

  return {
    bots,
    allowedUserId: parseInt(allowedUserId, 10),
    messageExpiryMinutes: parseInt(process.env.MESSAGE_EXPIRY_MINUTES || "20", 10),
  };
}

function loadBotConfigs(): BotConfig[] {
  const defaultMaxTurns = parseInt(process.env.BOT_MAX_TURNS || "30", 10);
  const defaultMaxBudgetUsd = parseFloat(process.env.BOT_MAX_BUDGET_USD || "1.0");

  // Single bot: BOT_TOKEN + BOT_CWD
  const singleToken = process.env.BOT_TOKEN;
  if (singleToken) {
    return [{
      token: singleToken,
      cwd: process.env.BOT_CWD || process.cwd(),
      maxTurns: defaultMaxTurns,
      maxBudgetUsd: defaultMaxBudgetUsd,
    }];
  }

  // Multiple bots: BOT_1_TOKEN + BOT_1_CWD, BOT_2_TOKEN + BOT_2_CWD, ...
  const bots: BotConfig[] = [];
  for (let i = 1; i <= 20; i++) {
    const token = process.env[`BOT_${i}_TOKEN`];
    if (!token) break;
    bots.push({
      token,
      cwd: process.env[`BOT_${i}_CWD`] || process.cwd(),
      maxTurns: parseInt(process.env[`BOT_${i}_MAX_TURNS`] || String(defaultMaxTurns), 10),
      maxBudgetUsd: parseFloat(process.env[`BOT_${i}_MAX_BUDGET_USD`] || String(defaultMaxBudgetUsd)),
    });
  }
  return bots;
}
