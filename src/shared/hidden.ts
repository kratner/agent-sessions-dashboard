import type { AgentSession } from './types';

/**
 * Sessions the user removed from the board: session key -> the session's last activity
 * (updatedAt) when it was hidden. A hidden session stays hidden until it does something new,
 * so an orphaned session that never moves stays gone, and one that comes back to life returns.
 */
export type HiddenMap = Record<string, number>;

/**
 * Marks hidden sessions and returns the map with entries that no longer apply dropped:
 * sessions that left the board, and sessions with activity since they were hidden.
 */
export function applyHidden(
  sessions: AgentSession[],
  hidden: HiddenMap,
  /** Keep entries for sessions not in the list, e.g. when a source failed to list this time. */
  keepMissing = false,
): { sessions: AgentSession[]; hidden: HiddenMap } {
  const kept: HiddenMap = {};
  if (keepMissing) {
    const listed = new Set(sessions.map((s) => s.key));
    for (const [key, at] of Object.entries(hidden)) if (!listed.has(key)) kept[key] = at;
  }
  const marked = sessions.map((s) => {
    const at = hidden[s.key];
    const isHidden = at !== undefined && s.updatedAt <= at;
    if (isHidden) kept[s.key] = at;
    const { hidden: _, ...rest } = s;
    return isHidden ? { ...rest, hidden: true } : rest;
  });
  return { sessions: marked, hidden: kept };
}

export function sameHidden(a: HiddenMap, b: HiddenMap): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}
