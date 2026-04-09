/** Channel-agnostic message context from an incoming message */
export interface MessageContext {
  chatId: string;
  userId: string;
  /** Unix timestamp of the message */
  timestamp: number;
}

/** Adapter interface — each channel (Telegram, Slack, Discord) implements this */
export interface ChannelAdapter {
  readonly name: string;
  start(): Promise<void>;
  stop(): void;
  /** Register a handler for incoming text messages */
  onMessage(handler: MessageHandler): void;
  /** Send a text message to a chat */
  sendMessage(chatId: string, text: string): Promise<string>;
  /** Edit an existing message (for streaming preview) */
  editMessage(chatId: string, messageId: string, text: string): Promise<void>;
  /** Delete a message */
  deleteMessage(chatId: string, messageId: string): Promise<void>;
}

export type MessageHandler = (
  text: string,
  context: MessageContext,
) => Promise<void>;

export type PermissionMode = "bypassPermissions" | "plan" | "default";

/** Per-chat session state */
export interface SessionState {
  sessionId: string | null;
  abortController: AbortController | null;
  isProcessing: boolean;
  permissionMode: PermissionMode;
}
