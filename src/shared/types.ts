// Types shared by the extension host and the webview. Every agent system's source
// converts its own data into AgentSession, so the views never see source-specific shapes.

export type SessionState = 'waiting' | 'busy' | 'idle' | 'ended';

export interface AgentSession {
  /** Unique across sources: `${source}:${id}`. */
  key: string;
  /** Source id, e.g. 'claude-code'. */
  source: string;
  sourceLabel: string;
  /** The source's own session id. */
  id: string;
  title: string;
  cwd?: string;
  state: SessionState;
  /** The source's status word before mapping, shown when it isn't one we recognise. */
  rawStatus?: string;
  /** For a waiting session, what it's waiting for, e.g. "permission prompt" or "dialog open". */
  waitingFor?: string;
  /** Where the session runs: 'VS Code', 'Terminal', 'Background'. */
  surface?: string;
  pid?: number;
  startedAt?: number;
  /** Last activity, epoch ms. */
  updatedAt: number;
  lastPrompt?: string;
}

/** A past session matching a history search. Subagent matches roll up to their parent. */
export interface HistoryHit {
  sessionId: string;
  title: string;
  cwd?: string;
  /** Epoch ms of the newest activity in the session or its subagents. */
  lastActivity: number;
  /** Excerpt of the parent's prompt that matched, if the parent itself matched. */
  promptSnippet?: string;
  /** Subagents whose own transcript matched, newest first. */
  subagents: {
    agentId: string;
    label: string;
    agentType?: string;
    /** 1 = started by the session, 2 = started by a subagent, … */
    depth: number;
    snippet?: string;
  }[];
}

export interface HistoryIndexStatus {
  indexed: number;
  total: number;
  done: boolean;
}

/** 'brand': the Four Ounces look (ink, or paper under a light theme). 'vscode': follow the editor's color theme. */
export type Appearance = 'brand' | 'vscode';

/** One List view column in the user's saved layout, in display order. */
export interface ListColumnPref {
  id: string;
  visible: boolean;
  /** px; absent means the column's default width. */
  width?: number;
}

export interface DashboardState {
  type: 'state';
  sessions: AgentSession[];
  viewId: string;
  /** Saved List view layout (global, not per workspace); absent until the user changes it. */
  listColumns?: ListColumnPref[];
  sources: string[];
  appearance: Appearance;
  /** Above this many history matches, show a short list first (setting, 100-200). */
  historyThreshold: number;
}

export type HostMessage =
  | DashboardState
  | { type: 'historyResults'; requestId: number; offset: number; total: number; hits: HistoryHit[]; status: HistoryIndexStatus }
  | { type: 'historyStatus'; status: HistoryIndexStatus };

/** What the host needs to open or resume a history result. */
export interface HistoryRef {
  sessionId: string;
  title: string;
  cwd?: string;
  lastActivity: number;
}

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'refresh' }
  /** The webview hasn't heard from the host for a while (or regained focus) and asks for the latest state. */
  | { type: 'resync'; reason: string }
  | { type: 'setView'; viewId: string }
  /** undefined resets the List view to its default columns. */
  | { type: 'setListColumns'; columns: ListColumnPref[] | undefined }
  | { type: 'open'; key: string }
  | { type: 'copyResume'; key: string }
  | { type: 'historySearch'; requestId: number; query: string; includeSubagents: boolean; offset: number; limit: number }
  | { type: 'openHistory'; ref: HistoryRef }
  | { type: 'copyHistoryResume'; ref: HistoryRef }
  /** Errors and milestones from the webview, written to the extension's output log. */
  | { type: 'log'; level: 'info' | 'error'; message: string };
