import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  SDKAssistantMessage,
  SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";

export interface ClaudeStreamEvent {
  type: "text_delta";
  content: string;
}

export interface ClaudeCompleteEvent {
  type: "complete";
  sessionId: string;
  costUsd: number;
  result: string;
}

export interface ClaudeErrorEvent {
  type: "error";
  error: string;
}

export type ClaudeEvent =
  | ClaudeStreamEvent
  | ClaudeCompleteEvent
  | ClaudeErrorEvent;

export interface ClaudeQueryOptions {
  prompt: string;
  sessionId?: string;
  abortController: AbortController;
  cwd: string;
  maxTurns: number;
  maxBudgetUsd: number;
}

export async function* streamClaude(
  options: ClaudeQueryOptions
): AsyncGenerator<ClaudeEvent, void> {
  const { prompt, sessionId, abortController, cwd, maxTurns, maxBudgetUsd } = options;
  let capturedSessionId = "";

  try {
    const q = query({
      prompt,
      options: {
        cwd,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns,
        maxBudgetUsd,
        abortController,
        resume: sessionId,
      },
    });

    for await (const msg of q) {
      if ("session_id" in msg && msg.session_id) {
        capturedSessionId = msg.session_id;
      }

      if (msg.type === "assistant") {
        const assistantMsg = msg as SDKAssistantMessage;
        for (const block of assistantMsg.message.content) {
          if (block.type === "text" && "text" in block) {
            yield { type: "text_delta", content: (block as { type: "text"; text: string }).text };
          }
        }
      } else if (msg.type === "result") {
        const resultMsg = msg as SDKResultMessage;
        yield {
          type: "complete",
          sessionId: capturedSessionId,
          costUsd: resultMsg.total_cost_usd,
          result: resultMsg.subtype === "success" ? resultMsg.result || "" : "",
        };
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return;
    }
    yield {
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
