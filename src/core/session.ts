import type { SessionState, PermissionMode } from "./types.js";

export class SessionManager {
  private sessions = new Map<string, SessionState>();

  get(chatId: string): SessionState {
    let session = this.sessions.get(chatId);
    if (!session) {
      session = { sessionId: null, abortController: null, isProcessing: false, permissionMode: "bypassPermissions" };
      this.sessions.set(chatId, session);
    }
    return session;
  }

  reset(chatId: string): void {
    const session = this.get(chatId);
    if (session.abortController) {
      session.abortController.abort();
    }
    session.sessionId = null;
    session.abortController = null;
    session.isProcessing = false;
  }

  cancel(chatId: string): boolean {
    const session = this.get(chatId);
    if (session.abortController) {
      session.abortController.abort();
      session.abortController = null;
      session.isProcessing = false;
      return true;
    }
    return false;
  }

  setMode(chatId: string, mode: PermissionMode): void {
    const session = this.get(chatId);
    session.permissionMode = mode;
  }

  getMode(chatId: string): PermissionMode {
    return this.get(chatId).permissionMode;
  }
}
