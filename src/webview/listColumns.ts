import type { ListColumnPref } from '../shared/types';

// The List view's columns. Ids are saved in the user's layout, so never rename one;
// a new column only needs an entry here (it starts hidden for anyone with a saved layout).

export interface ColumnDef {
  id: string;
  label: string;
  /** Width in px when the user hasn't resized it. */
  width: number;
  /** Shown in a fresh layout. */
  visible: boolean;
}

/** Session takes whatever width the other columns leave, so it has no stored width and can't be hidden. */
export const FILL_COLUMN = 'session';
export const FILL_MIN_WIDTH = 160;
export const MIN_WIDTH = 48;
export const MAX_WIDTH = 800;

export const COLUMNS: ColumnDef[] = [
  { id: 'state', label: 'State', width: 200, visible: true },
  { id: 'session', label: 'Session', width: 0, visible: true },
  { id: 'prompt', label: 'Last prompt', width: 300, visible: false },
  { id: 'folder', label: 'Folder', width: 110, visible: true },
  { id: 'path', label: 'Path', width: 260, visible: false },
  { id: 'where', label: 'Where', width: 110, visible: true },
  { id: 'agent', label: 'Agent', width: 110, visible: false },
  { id: 'started', label: 'Started', width: 100, visible: false },
  { id: 'activity', label: 'Last activity', width: 130, visible: true },
];

const byId = new Map(COLUMNS.map((c) => [c.id, c]));

export const columnLabel = (id: string) => byId.get(id)?.label ?? id;
export const defaultWidth = (id: string) => byId.get(id)?.width ?? 120;

export function defaultColumns(): ListColumnPref[] {
  return COLUMNS.map((c) => ({ id: c.id, visible: c.visible }));
}

export const clampWidth = (w: number) => Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w)));

/**
 * Turns a saved layout (possibly from an older or newer version, or hand-edited) into a usable one:
 * unknown and repeated ids are dropped, missing columns are appended hidden, widths are clamped,
 * and the fill column is always visible.
 */
export function normalizeColumns(saved: unknown): ListColumnPref[] {
  if (!Array.isArray(saved)) return defaultColumns();
  const seen = new Set<string>();
  const out: ListColumnPref[] = [];
  for (const item of saved) {
    const id = (item as ListColumnPref | null)?.id;
    if (typeof id !== 'string' || !byId.has(id) || seen.has(id)) continue;
    seen.add(id);
    const pref: ListColumnPref = { id, visible: id === FILL_COLUMN || (item as ListColumnPref).visible !== false };
    const w = (item as ListColumnPref).width;
    if (id !== FILL_COLUMN && typeof w === 'number' && Number.isFinite(w)) pref.width = clampWidth(w);
    out.push(pref);
  }
  if (!out.length) return defaultColumns();
  for (const c of COLUMNS) if (!seen.has(c.id)) out.push({ id: c.id, visible: c.id === FILL_COLUMN });
  return out;
}

export const widthOf = (p: ListColumnPref) => p.width ?? defaultWidth(p.id);

export function setVisible(cols: ListColumnPref[], id: string, visible: boolean): ListColumnPref[] {
  if (id === FILL_COLUMN) return cols;
  return cols.map((c) => (c.id === id ? { ...c, visible } : c));
}

export function setWidth(cols: ListColumnPref[], id: string, width: number | undefined): ListColumnPref[] {
  if (id === FILL_COLUMN) return cols;
  return cols.map((c) => {
    if (c.id !== id) return c;
    const next: ListColumnPref = { id: c.id, visible: c.visible };
    if (width !== undefined) next.width = clampWidth(width);
    return next;
  });
}

/** Moves a column one step among the visible columns (hidden ones keep their place). */
export function moveColumn(cols: ListColumnPref[], id: string, dir: -1 | 1): ListColumnPref[] {
  const from = cols.findIndex((c) => c.id === id);
  if (from < 0) return cols;
  let to = from + dir;
  while (to >= 0 && to < cols.length && !cols[to].visible) to += dir;
  if (to < 0 || to >= cols.length) return cols;
  const next = cols.slice();
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Table width: the fixed columns plus room for the fill column, never narrower than the panel. */
export function tableMinWidth(cols: ListColumnPref[], actionsWidth: number): number {
  return cols.filter((c) => c.visible && c.id !== FILL_COLUMN).reduce((sum, c) => sum + widthOf(c), FILL_MIN_WIDTH + actionsWidth);
}
