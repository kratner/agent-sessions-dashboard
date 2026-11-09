import { STATES } from '../format';
import type { ViewProps } from '../viewRegistry';
import { SessionCard } from './SessionCard';

export function KanbanView({ sessions, now, terms, onOpen, onCopyResume, onRemove, onUnhide }: ViewProps) {
  const actions = { onOpen, onCopyResume, onRemove, onUnhide };
  return (
    <div className="kanban">
      {STATES.map((state) => {
        const items = sessions.filter((s) => s.state === state.id);
        return (
          <section key={state.id} className={`column state-${state.id}`} aria-label={state.label}>
            <header className="column-head">
              <span className="dot" />
              <span>{state.label}</span>
              <span className="count">{items.filter((s) => !s.hidden).length}</span>
            </header>
            <div className="column-body">
              {items.length ? (
                items.map((s) => <SessionCard key={s.key} session={s} now={now} terms={terms} {...actions} />)
              ) : (
                <p className="empty">None</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
