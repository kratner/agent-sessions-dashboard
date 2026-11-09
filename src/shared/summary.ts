import type { AgentSession } from './types';

/** "6 (waiting 1, busy 2, idle 3)" for the log. */
export function summarize(sessions: AgentSession[]): string {
  const counts = new Map<string, number>();
  for (const s of sessions) counts.set(s.state, (counts.get(s.state) ?? 0) + 1);
  const parts = ['waiting', 'busy', 'idle', 'ended'].filter((k) => counts.has(k)).map((k) => `${k} ${counts.get(k)}`);
  return `${sessions.length}${parts.length ? ` (${parts.join(', ')})` : ''}`;
}
