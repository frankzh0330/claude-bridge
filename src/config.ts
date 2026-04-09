import "dotenv/config";

export interface ChannelInstanceConfig {
  /** Adapter type: telegram, slack, discord */
  type: string;
  /** Working directory for Claude Code */
  cwd: string;
  maxTurns: number;
  maxBudgetUsd: number;
  /** Max message length for this channel */
  maxLength: number;
  /** Adapter-specific options */
  options: Record<string, unknown>;
}

export interface AppConfig {
  channels: ChannelInstanceConfig[];
}

export function loadConfig(): AppConfig {
  const channels = loadChannels();
  if (channels.length === 0) {
    throw new Error("No channel configured");
  }
  return { channels };
}

function loadChannels(): ChannelInstanceConfig[] {
  const defaults = {
    maxTurns: parseInt(process.env.BOT_MAX_TURNS || "30", 10),
    maxBudgetUsd: parseFloat(process.env.BOT_MAX_BUDGET_USD || "1.0"),
  };

  // Legacy single-bot format: BOT_TOKEN + BOT_CWD (assumes telegram)
  const singleToken = process.env.BOT_TOKEN;
  if (singleToken) {
    return [{
      type: "telegram",
      cwd: process.env.BOT_CWD || process.cwd(),
      maxTurns: defaults.maxTurns,
      maxBudgetUsd: defaults.maxBudgetUsd,
      maxLength: 4096,
      options: {
        token: singleToken,
        allowedUserId: parseInt(process.env.ALLOWED_USER_ID || "0", 10),
        messageExpiryMinutes: parseInt(process.env.MESSAGE_EXPIRY_MINUTES || "20", 10),
      },
    }];
  }

  // Multi-channel format: CHANNEL_1_TYPE, CHANNEL_1_TOKEN, CHANNEL_1_CWD, ...
  const channels: ChannelInstanceConfig[] = [];
  for (let i = 1; i <= 20; i++) {
    const type = process.env[`CHANNEL_${i}_TYPE`];
    if (!type) break;

    const token = process.env[`CHANNEL_${i}_TOKEN`];
    if (!token) throw new Error(`CHANNEL_${i}_TOKEN is required when CHANNEL_${i}_TYPE is set`);

    const maxLenghts: Record<string, number> = {
      telegram: 4096,
      slack: 40000,
      discord: 2000,
    };

    const options: Record<string, unknown> = { token };

    // Telegram-specific
    if (type === "telegram") {
      options.allowedUserId = parseInt(
        process.env[`CHANNEL_${i}_USER_ID`] || process.env.ALLOWED_USER_ID || "0",
        10,
      );
      options.messageExpiryMinutes = parseInt(
        process.env[`CHANNEL_${i}_EXPIRY`] || process.env.MESSAGE_EXPIRY_MINUTES || "20",
        10,
      );
    }

    channels.push({
      type,
      cwd: process.env[`CHANNEL_${i}_CWD`] || process.cwd(),
      maxTurns: parseInt(
        process.env[`CHANNEL_${i}_MAX_TURNS`] || String(defaults.maxTurns),
        10,
      ),
      maxBudgetUsd: parseFloat(
        process.env[`CHANNEL_${i}_MAX_BUDGET_USD`] || String(defaults.maxBudgetUsd),
      ),
      maxLength: maxLenghts[type] || 4096,
      options,
    });
  }
  return channels;
}
