import type { WebviewMessage } from '../shared/types';

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

// acquireVsCodeApi may only be called once per webview.
const api = acquireVsCodeApi();

export function post(message: WebviewMessage): void {
  api.postMessage(message);
}

/** Per-tab UI state that survives VS Code unloading the hidden webview. */
export interface WebviewUiState {
  query?: string;
  /** Search past sessions too. */
  history?: boolean;
  /** Include matches inside subagent transcripts (default on). */
  includeSubagents?: boolean;
}

export function getUiState(): WebviewUiState {
  return (api.getState() as WebviewUiState | undefined) ?? {};
}

export function setUiState(patch: WebviewUiState): void {
  api.setState({ ...getUiState(), ...patch });
}

export function log(level: 'info' | 'error', message: string): void {
  post({ type: 'log', level, message });
}

// Anything that breaks in the webview shows up in the "Agent Sessions" output log.
window.addEventListener('error', (e) => log('error', `${e.message} (${e.filename}:${e.lineno})`));
window.addEventListener('unhandledrejection', (e) => log('error', `Unhandled rejection: ${String(e.reason)}`));
