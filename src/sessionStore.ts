import * as vscode from 'vscode';
import type { AgentSession, SessionState } from './shared/types';
import { applyHidden, sameHidden, type HiddenMap } from './shared/hidden';
import { log } from './log';
import type { SessionSource } from './sources/SessionSource';

const STUCK_MS = 60_000;
const HIDDEN_KEY = 'agentSessions.hiddenSessions';
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
  /** The sources' merged list before hidden sessions are marked. */
  private listed: AgentSession[] = [];
  private hidden: HiddenMap;
  /** A source failed on the last refresh, so a session missing from the list may still exist. */
  private listFailed = false;

  /** `memory` keeps the hidden sessions across restarts (the extension's global state). */
  constructor(
    readonly sources: SessionSource[],
    private readonly memory?: vscode.Memento,
  ) {
    this.hidden = memory?.get<HiddenMap>(HIDDEN_KEY, {}) ?? {};
    for (const source of sources) this.subscriptions.push(source.onDidChange(() => this.schedule()));
    this.schedule();
  }

  /** Take the session off the board until it does something new. */
  async hide(session: AgentSession): Promise<void> {
    log.info(`hiding session ${session.key} ("${session.title}")`);
    this.hidden = { ...this.hidden, [session.key]: session.updatedAt };
    await this.publish(true);
  }

  async unhide(key: string): Promise<void> {
    if (!(key in this.hidden)) return;
    log.info(`unhiding session ${key}`);
    const { [key]: _, ...rest } = this.hidden;
    this.hidden = rest;
    await this.publish(true);
  }

  /** Marks hidden sessions in the latest list, saves the hidden map if it changed, and fires on change. */
  private async publish(changed = false): Promise<void> {
    const { sessions, hidden } = applyHidden(this.listed, this.hidden, this.listFailed);
    if (changed || !sameHidden(hidden, this.hidden)) {
      this.hidden = hidden;
      await this.memory?.update(HIDDEN_KEY, hidden);
    }
    const snapshot = JSON.stringify(sessions);
    if (snapshot !== this.snapshot) {
      this.snapshot = snapshot;
      this.sessions = sessions;
      this.emitter.fire(sessions);
    }
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
      let failed = false;
      const lists = await Promise.all(
        this.sources.map((s) =>
          s.list().catch((err) => {
            failed = true;
            log.error(`${s.label} failed to list sessions`, err);
            return [] as AgentSession[];
          }),
        ),
      );
      if (this.runningSince === started) {
        this.listFailed = failed;
        this.listed = lists.flat().sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || b.updatedAt - a.updatedAt);
        await this.publish();
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
