import * as vscode from 'vscode';
import type { AgentSession, SessionState } from './shared/types';
import { log } from './log';
import type { SessionSource } from './sources/SessionSource';

const STUCK_MS = 60_000;
const STATE_ORDER: Record<SessionState, number> = { waiting: 0, busy: 1, idle: 2, ended: 3 };

/** Merges every source into one sorted list and fires only when that list actually changes. */
export class SessionStore implements vscode.Disposable {
  private sessions: AgentSession[] = [];
  private snapshot = '';
  private readonly emitter = new vscode.EventEmitter<AgentSession[]>();
  readonly onDidChange = this.emitter.event;

  private readonly subscriptions: vscode.Disposable[] = [];
  private debounce?: NodeJS.Timeout;
  private running = false;
  private runningSince = 0;
  private queued = false;

  constructor(readonly sources: SessionSource[]) {
    for (const source of sources) this.subscriptions.push(source.onDidChange(() => this.schedule()));
    this.schedule();
  }

  get current(): AgentSession[] {
    return this.sessions;
  }

  find(key: string): { session: AgentSession; source: SessionSource } | undefined {
    const session = this.sessions.find((s) => s.key === key);
    const source = session && this.sources.find((s) => s.id === session.source);
    return session && source ? { session, source } : undefined;
  }

  schedule(): void {
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.refresh(), 150);
  }

  async refresh(): Promise<void> {
    if (this.running) {
      // A list that never settles would freeze the board for good; after a minute, start over.
      if (Date.now() - this.runningSince < STUCK_MS) {
        this.queued = true;
        return;
      }
      log.error(`a session refresh has been running for ${Math.round((Date.now() - this.runningSince) / 1000)}s; starting a new one`);
    }
    this.running = true;
    const started = (this.runningSince = Date.now());
    try {
      const lists = await Promise.all(
        this.sources.map((s) =>
          s.list().catch((err) => {
            log.error(`${s.label} failed to list sessions`, err);
            return [] as AgentSession[];
          }),
        ),
      );
      const next = lists.flat().sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || b.updatedAt - a.updatedAt);
      const snapshot = JSON.stringify(next);
      if (this.runningSince === started && snapshot !== this.snapshot) {
        this.snapshot = snapshot;
        this.sessions = next;
        this.emitter.fire(next);
      }
    } finally {
      // A newer refresh may have taken over from this one (see STUCK_MS); leave its flag alone.
      if (this.runningSince === started) {
        this.running = false;
        if (this.queued) {
          this.queued = false;
          void this.refresh();
        }
      }
    }
  }

  dispose(): void {
    clearTimeout(this.debounce);
    for (const s of this.subscriptions) s.dispose();
    for (const s of this.sources) s.dispose();
    this.emitter.dispose();
  }
}
