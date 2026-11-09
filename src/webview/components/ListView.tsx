import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { AgentSession, ListColumnPref } from '../../shared/types';
import { folderName, shortDate, stateLabel, timeAgo } from '../format';
import {
  FILL_COLUMN,
  clampWidth,
  columnLabel,
  moveColumn,
  setVisible,
  setWidth,
  tableMinWidth,
  widthOf,
} from '../listColumns';
import type { ViewProps } from '../viewRegistry';
import { Highlight } from './Highlight';

const ACTIONS_WIDTH = 150;
const KEY_STEP = 10;

export function ListView({ sessions, now, terms, onOpen, onCopyResume, onRemove, onUnhide, listColumns, onListColumns }: ViewProps) {
  // While dragging, the width lives here and is saved once on release.
  const [drag, setDrag] = useState<{ id: string; width: number }>();
  const shown = listColumns
    .filter((c) => c.visible)
    .map((c) => (drag && drag.id === c.id ? { ...c, width: drag.width } : c));
  const promptShown = shown.some((c) => c.id === 'prompt');

  const startResize = (e: ReactPointerEvent<HTMLSpanElement>, col: ListColumnPref) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events have no live pointer to capture; the drag still works while over the handle.
    }
    const startX = e.clientX;
    const startWidth = widthOf(col);
    let width = startWidth;
    const onMove = (ev: PointerEvent) => {
      width = clampWidth(startWidth + ev.clientX - startX);
      setDrag({ id: col.id, width });
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      setDrag(undefined);
      if (width !== startWidth) onListColumns(setWidth(listColumns, col.id, width));
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  };

  const keyResize = (e: ReactKeyboardEvent, col: ListColumnPref) => {
    const step = e.shiftKey ? KEY_STEP * 5 : KEY_STEP;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      onListColumns(setWidth(listColumns, col.id, widthOf(col) + (e.key === 'ArrowRight' ? step : -step)));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onListColumns(setWidth(listColumns, col.id, undefined));
    }
  };

  const cell = (id: string, s: AgentSession) => {
    switch (id) {
      case 'state':
        return (
          <td key={id}>
            <span className="state-cell" title={s.waitingFor ? `Waiting for: ${s.waitingFor}` : undefined}>
              <span className="dot" />
              {stateLabel(s.state)}
              {s.state === 'waiting' && s.waitingFor ? <span className="state-reason">· {s.waitingFor}</span> : null}
            </span>
          </td>
        );
      case 'session':
        return (
          <td key={id} className="title-cell" title={s.lastPrompt}>
            <Highlight text={s.title} terms={terms} />
            {/* Without a prompt column, show the prompt while searching if that's where it matched. */}
            {!promptShown && s.lastPrompt && terms.some((t) => s.lastPrompt!.toLowerCase().includes(t)) ? (
              <span className="row-prompt">
                <Highlight text={s.lastPrompt} terms={terms} />
              </span>
            ) : null}
          </td>
        );
      case 'prompt':
        return (
          <td key={id} className="prompt-cell" title={s.lastPrompt}>
            {s.lastPrompt ? <Highlight text={s.lastPrompt} terms={terms} /> : null}
          </td>
        );
      case 'folder':
        return (
          <td key={id} title={s.cwd}>
            <Highlight text={folderName(s.cwd)} terms={terms} />
          </td>
        );
      case 'path':
        return (
          <td key={id} className="path-cell" title={s.cwd}>
            {s.cwd ? <Highlight text={s.cwd} terms={terms} /> : null}
          </td>
        );
      case 'where':
        return (
          <td key={id}>
            <Highlight text={s.surface ?? s.sourceLabel} terms={terms} />
          </td>
        );
      case 'agent':
        return <td key={id}>{s.sourceLabel}</td>;
      case 'started':
        return (
          <td key={id} title={s.startedAt ? new Date(s.startedAt).toLocaleString() : undefined}>
            {s.startedAt ? shortDate(s.startedAt, now) : ''}
          </td>
        );
      case 'activity':
        return (
          <td key={id} title={s.updatedAt ? new Date(s.updatedAt).toLocaleString() : undefined}>
            {timeAgo(s.updatedAt, now)}
          </td>
        );
      default:
        return <td key={id} />;
    }
  };

  return (
    <div className="list-wrap">
      <table className="list" style={{ minWidth: tableMinWidth(shown, ACTIONS_WIDTH) }}>
        <colgroup>
          {shown.map((c) => (
            <col key={c.id} style={c.id === FILL_COLUMN ? undefined : { width: widthOf(c) }} />
          ))}
          <col style={{ width: ACTIONS_WIDTH }} />
        </colgroup>
        <thead>
          <tr>
            {shown.map((c) => (
              <th key={c.id} className={drag?.id === c.id ? 'resizing' : undefined}>
                <span className="th-label">{columnLabel(c.id)}</span>
                {c.id === FILL_COLUMN ? null : (
                  <span
                    className="col-resize"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize ${columnLabel(c.id)} column`}
                    aria-valuenow={widthOf(c)}
                    tabIndex={0}
                    title="Drag to resize · double-click to reset"
                    onPointerDown={(e) => startResize(e, c)}
                    onDoubleClick={() => onListColumns(setWidth(listColumns, c.id, undefined))}
                    onKeyDown={(e) => keyResize(e, c)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </th>
            ))}
            <th className="actions-th">
              <ColumnsMenu columns={listColumns} onChange={onListColumns} />
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.key} className={`state-${s.state}${s.hidden ? ' is-hidden' : ''}`} tabIndex={0} onClick={() => onOpen(s)} onKeyDown={(e) => e.key === 'Enter' && onOpen(s)}>
              {shown.map((c) => cell(c.id, s))}
              <td className="actions-cell">
                {s.state === 'ended' ? (
                  <button
                    className="link-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyResume(s);
                    }}
                  >
                    Copy resume
                  </button>
                ) : null}
                <button
                  className={s.hidden ? 'link-button' : 'link-button row-remove'}
                  title={s.hidden ? 'Put this session back on the board' : 'Remove from the board (hide it, or end its process)'}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (s.hidden) onUnhide(s);
                    else onRemove(s);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {s.hidden ? 'Unhide' : 'Remove'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ColumnsMenu({ columns, onChange }: { columns: ListColumnPref[]; onChange(cols: ListColumnPref[] | undefined): void }) {
  // Fixed to the viewport, so the list's sideways scroll area can't clip it.
  const [pos, setPos] = useState<{ top: number; right: number }>();
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const open = pos !== undefined;

  const toggle = () => {
    const r = buttonRef.current?.getBoundingClientRect();
    setPos(open || !r ? undefined : { top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(undefined);
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    };
    // Scrolling the list (but not the menu itself) would leave it floating; close it instead.
    const onScroll = (e: Event) => {
      if (!(e.target instanceof Node && ref.current?.contains(e.target))) close();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const visible = columns.filter((c) => c.visible);
  return (
    <div className="columns-menu" ref={ref}>
      <button ref={buttonRef} className="columns-button" aria-haspopup="true" aria-expanded={open} title="Choose and order columns" onClick={toggle}>
        Columns
      </button>
      {pos ? (
        <div className="columns-popover" role="dialog" aria-label="Columns" style={{ top: pos.top, right: pos.right }}>
          <ul>
            {columns.map((c) => {
              const pos = visible.findIndex((v) => v.id === c.id);
              const fill = c.id === FILL_COLUMN;
              return (
                <li key={c.id} className={c.visible ? undefined : 'off'}>
                  <label title={fill ? 'Session is always shown' : undefined}>
                    <input type="checkbox" checked={c.visible} disabled={fill} onChange={(e) => onChange(setVisible(columns, c.id, e.target.checked))} />
                    {columnLabel(c.id)}
                  </label>
                  <span className="move">
                    <button aria-label={`Move ${columnLabel(c.id)} up`} title="Move up (further left)" disabled={!c.visible || pos <= 0} onClick={() => onChange(moveColumn(columns, c.id, -1))}>
                      ↑
                    </button>
                    <button
                      aria-label={`Move ${columnLabel(c.id)} down`}
                      title="Move down (further right)"
                      disabled={!c.visible || pos < 0 || pos >= visible.length - 1}
                      onClick={() => onChange(moveColumn(columns, c.id, 1))}
                    >
                      ↓
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="columns-hint">Drag a column's edge to resize it; double-click the edge to reset it.</p>
          <button className="link-button" onClick={() => onChange(undefined)}>
            Reset columns
          </button>
        </div>
      ) : null}
    </div>
  );
}
