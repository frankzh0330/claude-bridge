export interface SessionState {
  sessionId: string | null;
  abortController: AbortController | null;
  isProcessing: boolean;
}
