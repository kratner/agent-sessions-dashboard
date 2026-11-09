import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import type { AgentSession, SessionState } from '../shared/types';
import type { SessionSource } from './SessionSource';
import { log } from '../log';
import { TranscriptIndex, type TranscriptDetails, type TranscriptFile } from './claudeTranscripts';
import { ancestors, sameStart, startTimes } from './processInfo';

// Each running Claude Code process writes <config>/sessions/<pid>.json with its session id,
// folder, entrypoint and a status word ("busy", "idle", ...). That file is internal to Claude
// Code and undocumented, so everything here reads it defensively: unknown fields are ignored
// and unknown status words are kept as rawStatus and shown as Idle.

interface SessionFile {
  pid: number;
  sessionId: string;
  cwd?: string;
  startedAt?: number;
  kind?: string;
  entrypoint?: string;
  name?: string;
  status?: string;
  updatedAt?: number;
  statusUpdatedAt?: number;
  /** Why a waiting session is waiting, e.g. "permission prompt" or "dialog open". */
  waitingFor?: string;
  /** The process's start time (Windows FILETIME), to tell a reused PID from the real process. */
  procStart?: string;
}

const POLL_MS = 5000;
const CLAUDE_EXTENSION_ID = 'anthropic.claude-code';

export function claudeConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

export class ClaudeCodeSource implements SessionSource {
  readonly id = 'claude-code';
  readonly label = 'Claude Code';

  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;

  private readonly sessionsDir: string;
  private readonly transcripts: TranscriptIndex;
  private watcher?: fs.FSWatcher;
  private readonly timer: NodeJS.Timeout;
  /** `${pid}:${procStart}` -> whether that PID is still the process that wrote the file. */
  private readonly verified = new Map<string, boolean>();

  constructor(
    private readonly endedWithinMs: () => number,
    configDir = claudeConfigDir(),
  ) {
    this.sessionsDir = path.join(configDir, 'sessions');
    this.transcripts = new TranscriptIndex(path.join(configDir, 'projects'));
    this.watch();
    // The watcher catches status changes immediately; the poll catches processes that exit
    // without cleaning up their file, and keeps working if the watcher can't be started.
    this.timer = setInterval(() => this.emitter.fire(), POLL_MS);
  }

  private watch(): void {
    try {
      this.watcher = fs.watch(this.sessionsDir, () => this.emitter.fire());
      this.watcher.on('error', () => {
        this.watcher?.close();
        this.watcher = undefined;
      });
    } catch {
      // folder doesn't exist yet: polling covers it
    }
  }

  async list(): Promise<AgentSession[]> {
    if (!this.watcher) this.watch();
    const [files, transcripts] = await Promise.all([this.readSessionFiles(), this.transcripts.scan()]);

    const isRunning = await this.liveness(files);

    // A session id can appear in more than one file (e.g. resumed twice); keep the live one.
    const live = new Map<string, { file: SessionFile; alive: boolean }>();
    for (const file of files) {
      const alive = isRunning(file);
      const prev = live.get(file.sessionId);
      if (!prev || (alive && !prev.alive) || (alive === prev.alive && (file.updatedAt ?? 0) > (prev.file.updatedAt ?? 0))) {
        live.set(file.sessionId, { file, alive });
      }
    }

    const cutoff = Date.now() - this.endedWithinMs();
    const wanted: TranscriptFile[] = [];
    for (const t of transcripts.values()) if (live.has(t.sessionId) || t.mtime >= cutoff) wanted.push(t);
    const details = new Map<string, TranscriptDetails>();
    await Promise.all(
      wanted.map(async (t) => {
        try {
          details.set(t.sessionId, await this.transcripts.details(t));
        } catch {
          // unreadable transcript: the card falls back to the session file's own name
        }
      }),
    );
    this.transcripts.retain(new Set(wanted.map((t) => t.path)));

    const sessions: AgentSession[] = [];
    for (const { file, alive } of live.values()) {
      const t = transcripts.get(file.sessionId);
      const d = details.get(file.sessionId);
      const updatedAt = Math.max(file.statusUpdatedAt ?? 0, t?.mtime ?? 0, file.startedAt ?? 0);
      if (!alive && updatedAt < cutoff) continue;
      sessions.push({
        ...this.base(file.sessionId, d, file.name),
        cwd: file.cwd ?? d?.cwd,
        state: alive ? mapStatus(file.status) : 'ended',
        rawStatus: file.status,
        waitingFor: alive && file.waitingFor ? file.waitingFor : undefined,
        surface: surfaceOf(file),
        pid: alive ? file.pid : undefined,
        startedAt: file.startedAt,
        updatedAt,
      });
    }
    for (const t of wanted) {
      if (live.has(t.sessionId)) continue;
      const d = details.get(t.sessionId);
      sessions.push({ ...this.base(t.sessionId, d), cwd: d?.cwd, state: 'ended', updatedAt: t.mtime });
    }
    return sessions;
  }

  /**
   * Which session files belong to a process that's still running. A PID that exists isn't
   * enough on Windows, which recycles PIDs: the PID must also have the start time recorded in
   * the file. Each PID/start pair is checked once and cached; the cache entry is dropped when
   * the PID disappears.
   */
  private async liveness(files: SessionFile[]): Promise<(file: SessionFile) => boolean> {
    const exists = new Map(files.map((f) => [f.pid, isAlive(f.pid)]));
    for (const key of this.verified.keys()) {
      if (!exists.get(Number(key.split(':')[0]))) this.verified.delete(key);
    }
    const keyOf = (f: SessionFile) => `${f.pid}:${f.procStart}`;
    const unchecked = files.filter((f) => f.procStart && exists.get(f.pid) && !this.verified.has(keyOf(f)));
    if (unchecked.length) {
      try {
        const actual = await startTimes([...new Set(unchecked.map((f) => f.pid))]);
        for (const f of unchecked) {
          const start = actual.get(f.pid);
          // No answer (non-Windows, or the query failed for that PID): fall back to "exists".
          const same = start === undefined ? true : sameStart(start, f.procStart!);
          this.verified.set(keyOf(f), same);
          if (!same) log.info(`session ${f.sessionId}: PID ${f.pid} now belongs to another process; treating it as ended`);
        }
      } catch (err) {
        log.error('could not read process start times; trusting PIDs as they are', err);
        for (const f of unchecked) this.verified.set(keyOf(f), true);
      }
    }
    return (f) => !!exists.get(f.pid) && (!f.procStart || this.verified.get(keyOf(f)) !== false);
  }

  private base(sessionId: string, d: TranscriptDetails | undefined, name?: string) {
    return {
      key: `${this.id}:${sessionId}`,
      source: this.id,
      sourceLabel: this.label,
      id: sessionId,
      title: d?.customTitle ?? d?.agentName ?? d?.aiTitle ?? name ?? sessionId.slice(0, 8),
      lastPrompt: d?.lastPrompt,
    };
  }

  private async readSessionFiles(): Promise<SessionFile[]> {
    let names: string[];
    try {
      names = await fsp.readdir(this.sessionsDir);
    } catch {
      return [];
    }
    const files = await Promise.all(
      names
        .filter((n) => n.endsWith('.json'))
        .map(async (n) => {
          try {
            const data = JSON.parse(await fsp.readFile(path.join(this.sessionsDir, n), 'utf8'));
            return typeof data?.sessionId === 'string' && typeof data?.pid === 'number' ? (data as SessionFile) : undefined;
          } catch {
            return undefined; // mid-write or not a session file
          }
        }),
    );
    return files.filter((f): f is SessionFile => !!f);
  }

  async open(session: AgentSession): Promise<void> {
    const hasClaudeExtension = !!vscode.extensions.getExtension(CLAUDE_EXTENSION_ID);
    const inThisWindow = !!session.cwd && (vscode.workspace.workspaceFolders ?? []).some((f) => samePath(f.uri.fsPath, session.cwd!));
    const live = session.state !== 'ended';

    // Opening by id focuses the session's tab if it's already open here, or resumes it.
    // Only do that for a live session when it belongs to a VS Code panel in this window;
    // otherwise we'd start a second process on a session that's running somewhere else.
    if (hasClaudeExtension && inThisWindow && (!live || session.surface === 'VS Code')) {
      await vscode.commands.executeCommand('claude-vscode.editor.open', session.id);
      return;
    }

    // A CLI session in one of this window's terminals: bring that terminal to the front.
    if (live && session.surface === 'Terminal' && session.pid) {
      const terminal = await findTerminal(session.pid);
      if (terminal) {
        terminal.show();
        return;
      }
    }

    const where = session.cwd ? ` in ${session.cwd}` : '';
    const waiting = session.waitingFor ? ` It's waiting for: ${session.waitingFor}.` : '';
    const message = !live
      ? `"${session.title}" ended. Resume it from its folder${where}.`
      : session.surface === 'Terminal'
        ? `"${session.title}" is running in a terminal outside this VS Code window (process ${session.pid})${where}.${waiting}`
        : `"${session.title}" is running in ${session.surface ?? 'another process'}${where}.${waiting}`;
    const actions = session.cwd ? ['Open Folder'] : [];
    if (!live) actions.push('Copy Resume Command');
    const choice = await vscode.window.showInformationMessage(message, ...actions);
    if (choice === 'Open Folder' && session.cwd) {
      await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(session.cwd), { forceNewWindow: true });
    } else if (choice === 'Copy Resume Command') {
      await vscode.env.clipboard.writeText(this.resumeCommand(session));
    }
  }

  resumeCommand(session: AgentSession): string {
    const resume = `claude --resume ${session.id}`;
    // `;` separates commands in bash, zsh and PowerShell alike.
    return session.cwd ? `cd "${session.cwd}"; ${resume}` : resume;
  }

  /**
   * Ends the session's process. Only a PID this source has verified as the session's own
   * process gets here (list() leaves pid unset otherwise), so a recycled PID is never killed.
   * The transcript stays on disk, so the session can still be resumed afterwards.
   */
  async endProcess(session: AgentSession): Promise<void> {
    if (!session.pid || session.state === 'ended') return;
    log.info(`ending process ${session.pid} for session ${session.id} ("${session.title}")`);
    process.kill(session.pid);
    this.emitter.fire();
  }

  dispose(): void {
    clearInterval(this.timer);
    this.watcher?.close();
    this.emitter.dispose();
  }
}

function mapStatus(status: string | undefined): SessionState {
  const s = (status ?? '').toLowerCase();
  if (/wait|permission|input|approv|ask|block/.test(s)) return 'waiting';
  if (/busy|run|work|think|stream/.test(s)) return 'busy';
  return 'idle';
}

function surfaceOf(file: SessionFile): string | undefined {
  if (file.kind === 'bg') return 'Background';
  if (file.entrypoint === 'claude-vscode') return 'VS Code';
  if (file.entrypoint === 'cli') return 'Terminal';
  return file.entrypoint;
}

/** The terminal in this window whose shell is an ancestor of `pid`, if any. */
async function findTerminal(pid: number): Promise<vscode.Terminal | undefined> {
  let chain: number[];
  try {
    chain = [pid, ...(await ancestors(pid))];
  } catch (err) {
    log.error(`could not look up the parents of process ${pid}`, err);
    return undefined;
  }
  for (const terminal of vscode.window.terminals) {
    const shellPid = await terminal.processId;
    if (shellPid && chain.includes(shellPid)) return terminal;
  }
  return undefined;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: the process exists but belongs to someone else
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function samePath(a: string, b: string): boolean {
  const norm = (p: string) => {
    const r = path.resolve(p).replace(/[\\/]+$/, '');
    return process.platform === 'win32' || process.platform === 'darwin' ? r.toLowerCase() : r;
  };
  return norm(a) === norm(b);
}
