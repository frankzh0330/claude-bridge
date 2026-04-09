import { Bot, type Context } from "grammy";
import type {
  ChannelAdapter,
  MessageContext,
  MessageHandler,
} from "../core/types.js";

export interface TelegramConfig {
  token: string;
  allowedUserId: number;
  messageExpiryMinutes: number;
}

export class TelegramAdapter implements ChannelAdapter {
  readonly name = "telegram";
  private bot: Bot<Context>;
  private config: TelegramConfig;
  private messageHandler: MessageHandler | null = null;

  constructor(config: TelegramConfig) {
    this.config = config;
    this.bot = new Bot<Context>(config.token);

    // Auth + expiry middleware
    this.bot.use(async (ctx, next) => {
      console.log(`[telegram] received update: ${JSON.stringify(ctx.update).slice(0, 200)}`);
      if (ctx.from?.id !== config.allowedUserId) {
        console.log(`[telegram] rejected user ${ctx.from?.id}, expected ${config.allowedUserId}`);
        return;
      }
      const msgDate = ctx.message?.date;
      if (msgDate) {
        const ageSeconds = Date.now() / 1000 - msgDate;
        if (ageSeconds > config.messageExpiryMinutes * 60) {
          console.log(`[telegram] message expired: ${ageSeconds}s old`);
          return;
        }
      }
      await next();
    });

    this.bot.command("start", async (ctx) => {
      await ctx.reply(
        "Claude Code Bridge\n\n" +
          "/new - New conversation\n" +
          "/stop - Cancel current request\n" +
          "/status - Session status\n" +
          "/plan - Plan mode (no execution)\n" +
          "/code - Code mode (bypass permissions)"
      );
    });

    this.bot.on("message:text", async (ctx, next) => {
      // Pass commands through to command handlers registered later
      if (ctx.message.text.startsWith("/")) return await next();
      if (!this.messageHandler) return;
      const context: MessageContext = {
        chatId: String(ctx.chat.id),
        userId: String(ctx.from?.id),
        timestamp: ctx.message.date,
      };
      await this.messageHandler(ctx.message.text, context);
    });
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  async sendMessage(chatId: string, text: string): Promise<string> {
    const msg = await this.bot.api.sendMessage(Number(chatId), text);
    return String(msg.message_id);
  }

  async editMessage(
    chatId: string,
    messageId: string,
    text: string,
  ): Promise<void> {
    await this.bot.api.editMessageText(
      Number(chatId),
      Number(messageId),
      text,
    );
  }

  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    await this.bot.api.deleteMessage(Number(chatId), Number(messageId));
  }

  /** Register commands with session callbacks */
  registerCommands(callbacks: {
    onNew: (chatId: string) => Promise<string>;
    onStop: (chatId: string) => Promise<string>;
    onStatus: (chatId: string) => Promise<string>;
    onPlan: (chatId: string) => Promise<string>;
    onCode: (chatId: string) => Promise<string>;
  }): void {
    this.bot.command("new", async (ctx) => {
      const reply = await callbacks.onNew(String(ctx.chat.id));
      await ctx.reply(reply);
    });

    this.bot.command("stop", async (ctx) => {
      const reply = await callbacks.onStop(String(ctx.chat.id));
      await ctx.reply(reply);
    });

    this.bot.command("status", async (ctx) => {
      const reply = await callbacks.onStatus(String(ctx.chat.id));
      await ctx.reply(reply);
    });

    this.bot.command("plan", async (ctx) => {
      const reply = await callbacks.onPlan(String(ctx.chat.id));
      await ctx.reply(reply);
    });

    this.bot.command("code", async (ctx) => {
      const reply = await callbacks.onCode(String(ctx.chat.id));
      await ctx.reply(reply);
    });
  }

  async start(): Promise<void> {
    const info = await this.bot.api.getMe();
    this._botInfo = info;
    console.log(`[telegram] @${info.username} starting long polling...`);
    // bot.start() blocks forever — do not await it
    this.bot.start({
      onStart: (info) => {
        console.log(`[telegram] @${info.username} polling started`);
      },
    });
  }

  private _botInfo: { username: string } | null = null;

  get botUsername(): string | null {
    return this._botInfo?.username ?? null;
  }

  stop(): void {
    this.bot.stop();
  }
}
