import type { ChannelAdapter, MessageContext } from "./types.js";
import { SessionManager } from "./session.js";
import { streamClaude } from "./claude.js";
import { chunkMessage } from "./chunk.js";

const EDIT_INTERVAL_MS = 2500;

export interface HandlerConfig {
  cwd: string;
  maxTurns: number;
  maxBudgetUsd: number;
  maxLength: number;
}

export function createMessageHandler(
  adapter: ChannelAdapter,
  sessionManager: SessionManager,
  config: HandlerConfig,
) {
  return async (text: string, context: MessageContext) => {
    const chatId = context.chatId;
    const session = sessionManager.get(chatId);

    if (session.isProcessing) {
      await adapter.sendMessage(chatId, "Still processing. Use /stop to cancel.");
      return;
    }

    session.isProcessing = true;
    const abortController = new AbortController();
    session.abortController = abortController;

    try {
      let fullResponse = "";
      let resultSessionId = "";

      const thinkingMsgId = await adapter.sendMessage(chatId, "...");

      const stream = streamClaude({
        prompt: text,
        sessionId: session.sessionId || undefined,
        abortController,
        cwd: config.cwd,
        maxTurns: config.maxTurns,
        maxBudgetUsd: config.maxBudgetUsd,
        permissionMode: session.permissionMode,
      });

      let lastEditTime = 0;

      for await (const event of stream) {
        if (event.type === "text_delta") {
          fullResponse += event.content;

          const now = Date.now();
          if (now - lastEditTime >= EDIT_INTERVAL_MS && fullResponse.length > 0) {
            lastEditTime = now;
            try {
              const preview = fullResponse.slice(-(config.maxLength - 200));
              await adapter.editMessage(chatId, thinkingMsgId, preview + "\n\n...");
            } catch {
              // edit failures are non-fatal
            }
          }
        } else if (event.type === "complete") {
          resultSessionId = event.sessionId;
        } else if (event.type === "error") {
          await adapter.sendMessage(chatId, `Error: ${event.error}`);
        }
      }

      try {
        await adapter.deleteMessage(chatId, thinkingMsgId);
      } catch {
        // non-fatal
      }

      if (fullResponse.trim()) {
        const chunks = chunkMessage(fullResponse, config.maxLength);
        for (const chunk of chunks) {
          await adapter.sendMessage(chatId, chunk);
        }
      }

      session.sessionId = resultSessionId || session.sessionId;
    } catch (err) {
      console.error("Unexpected error in message handler:", err);
      await adapter.sendMessage(chatId, "Unexpected error occurred.");
    } finally {
      session.isProcessing = false;
      session.abortController = null;
    }
  };
}
