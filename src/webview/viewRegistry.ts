import type { ComponentType } from 'react';
import type { AgentSession, ListColumnPref } from '../shared/types';
import { KanbanView } from './components/KanbanView';
import { ListView } from './components/ListView';

export interface ViewProps {
  sessions: AgentSession[];
  /** Current time, ticked by the view manager so relative times stay fresh. */
  now: number;
  /** Lower-cased search terms, for highlighting; the sessions are already filtered. */
  terms: string[];
  onOpen(session: AgentSession): void;
  onCopyResume(session: AgentSession): void;
  /** Hide the session, or end its process (the host asks which). */
  onRemove(session: AgentSession): void;
  onUnhide(session: AgentSession): void;
  /** The List view's column layout (normalized: every known column, in order). */
  listColumns: ListColumnPref[];
  /** Save a new layout; undefined resets to the defaults. */
  onListColumns(columns: ListColumnPref[] | undefined): void;
}

export interface ViewDefinition {
  id: string;
  label: string;
  component: ComponentType<ViewProps>;
}

// To add a view: create a component that takes ViewProps and add one entry here.
// The id is what gets saved as the active view, so don't change existing ids.
export const VIEWS: ViewDefinition[] = [
  { id: 'kanban', label: 'Kanban', component: KanbanView },
  { id: 'list', label: 'List', component: ListView },
];

export const findView = (id: string | undefined): ViewDefinition => VIEWS.find((v) => v.id === id) ?? VIEWS[0];
