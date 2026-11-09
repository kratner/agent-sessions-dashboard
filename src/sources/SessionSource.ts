import type * as vscode from 'vscode';
import type { AgentSession } from '../shared/types';

/**
 * One agent system (Claude Code today; Copilot, ChatGPT etc. later). A source reads that
 * system's own records and returns them as AgentSession cards. Adding a system means
 * writing one of these and registering it in extension.ts; the views don't change.
 */
export interface SessionSource extends vscode.Disposable {
  readonly id: string;
  readonly label: string;
  /** Fires when the source's sessions may have changed. */
  readonly onDidChange: vscode.Event<void>;
  list(): Promise<AgentSession[]>;
  /** Bring the session up in the editor, or explain where it lives. */
  open(session: AgentSession): Promise<void>;
  /** A shell command that resumes the session, if the system supports it. */
  resumeCommand?(session: AgentSession): string | undefined;
  /** Stop a live session's process, e.g. one orphaned by an app that no longer shows it. */
  endProcess?(session: AgentSession): Promise<void>;
}
