import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentSession, DashboardState, HostMessage, ListColumnPref } from '../../shared/types';
import { clampThreshold } from '../historyPaging';
import { defaultColumns, normalizeColumns } from '../listColumns';
import { filterSessions, searchTerms } from '../search';
import { HistoryPanel } from './HistoryPanel';
import { VIEWS, findView } from '../viewRegistry';
import { FourOuncesMark, ProductIcon } from './BrandMarks';
import { getUiState, log, post, setUiState } from '../vscodeApi';

const TICK_MS = 15_000;
/** The host resends state every 15 s; this long without one means updates stopped arriving. */
const QUIET_MS = 40_000;

export function ViewManager() {
  const [state, setState] = useState<DashboardState>();
  const [viewId, setViewId] = useState<string>();
  const [now, setNow] = useState(Date.now());
  // Undefined until the first state arrives; after that this tab's changes win over the host's echo.
  const [listColumns, setListColumns] = useState<ListColumnPref[]>();
  const [query, setQuery] = useState(() => getUiState().query ?? '');
  const [history, setHistory] = useState(() => getUiState().history ?? false);
  const [includeSubagents, setIncludeSubagents] = useState(() => getUiState().includeSubagents ?? true);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let first = true;
    let lastState = Date.now();
    const onMessage = (event: MessageEvent<HostMessage>) => {
      const m = event.data;
      if (m?.type !== 'state') return; // history messages are handled by HistoryPanel
      lastState = Date.now();
      if (first) {
        first = false;
        log('info', `first state received: ${m.sessions.length} sessions`);
      }
      setState(m);
      setNow(Date.now());
      // The saved view only applies on first load; after that the user's choice in this tab wins.
      setViewId((current) => current ?? m.viewId);
      setListColumns((current) => current ?? normalizeColumns(m.listColumns));
    };
    window.addEventListener('message', onMessage);
    log('info', 'webview script running; sending ready');
    post({ type: 'ready' });
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    // Self-heal: if state stops arriving while the board is on screen, ask for it. Coming back to
    // the board (focus) also asks, so it never shows what it had when you looked away.
    const watchdog = setInterval(() => {
      const quiet = Date.now() - lastState;
      if (document.visibilityState === 'visible' && quiet > QUIET_MS) {
        lastState = Date.now(); // one request per quiet spell, not one per check
        post({ type: 'resync', reason: `no update for ${Math.round(quiet / 1000)}s` });
      }
    }, 10_000);
    const onFocus = () => post({ type: 'resync', reason: 'focus' });
    const onVisible = () => document.visibilityState === 'visible' && onFocus();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(tick);
      clearInterval(watchdog);
    };
  }, []);

  // "/" or Ctrl/Cmd+F jumps to search; the webview has no find widget of its own to collide with.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const find = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f';
      if (find || (e.key === '/' && !typing)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const appearance = state?.appearance ?? 'brand';
  useEffect(() => {
    document.body.dataset.appearance = appearance;
  }, [appearance]);

  const updateQuery = (value: string) => {
    setQuery(value);
    setUiState({ query: value });
  };
  const toggleHistory = () => {
    setHistory(!history);
    setUiState({ history: !history });
    searchRef.current?.focus();
  };
  const updateIncludeSubagents = (value: boolean) => {
    setIncludeSubagents(value);
    setUiState({ includeSubagents: value });
  };

  const view = findView(viewId);
  const selectView = (id: string) => {
    setViewId(id);
    post({ type: 'setView', viewId: id });
  };
  const actions = {
    onOpen: (s: AgentSession) => post({ type: 'open', key: s.key }),
    onCopyResume: (s: AgentSession) => post({ type: 'copyResume', key: s.key }),
    listColumns: listColumns ?? defaultColumns(),
    onListColumns: (cols: ListColumnPref[] | undefined) => {
      setListColumns(cols ?? defaultColumns());
      post({ type: 'setListColumns', columns: cols });
    },
  };

  const allSessions = state?.sessions ?? [];
  const terms = useMemo(() => searchTerms(query), [query]);
  const sessions = useMemo(() => filterSessions(allSessions, terms), [allSessions, terms]);
  const searching = terms.length > 0;
  const count = (st: AgentSession['state']) => sessions.filter((s) => s.state === st).length;
  const View = view.component;

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">
          <ProductIcon />
          <h1>Agent Sessions</h1>
        </div>
        <div className="tabs" role="tablist" aria-label="View">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={v.id === view.id}
              className={v.id === view.id ? 'tab active' : 'tab'}
              onClick={() => selectView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="search">
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder={history ? 'Search all sessions, past and present  ( / )' : 'Search sessions  ( / )'}
            aria-label="Search sessions"
            spellCheck={false}
            onChange={(e) => updateQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                updateQuery('');
                e.currentTarget.blur();
              }
            }}
          />
          {searching && state ? (
            <span className="search-count" aria-live="polite">
              {sessions.length} of {allSessions.length}
            </span>
          ) : null}
          <button
            className={history ? 'toggle on' : 'toggle'}
            aria-pressed={history}
            title="Also search every past Claude Code session on this machine"
            onClick={toggleHistory}
          >
            History
          </button>
        </div>
        <div className="summary">
          {state ? (
            <>
              <span className={count('waiting') ? 'pill state-waiting nonzero' : 'pill state-waiting'}>{count('waiting')} waiting</span>
              <span className="pill state-busy">{count('busy')} working</span>
              <span className="pill state-idle">{count('idle')} idle</span>
            </>
          ) : null}
          <button className="icon-button" title="Refresh" aria-label="Refresh" onClick={() => post({ type: 'refresh' })}>
            ↻
          </button>
        </div>
      </header>
      <main className="content">
        {!state ? (
          <p className="placeholder">Loading sessions…</p>
        ) : (
          <>
            {allSessions.length === 0 ? (
              <p className="placeholder">No {state.sources.join(' or ')} sessions are running or ended recently.</p>
            ) : searching && sessions.length === 0 ? (
              history ? (
                <p className="placeholder">No current sessions match.</p>
              ) : (
                <p className="placeholder">
                  No sessions match “{query.trim()}”.{' '}
                  <button className="link-button inline" onClick={() => updateQuery('')}>
                    Clear search
                  </button>{' '}
                  or{' '}
                  <button className="link-button inline" onClick={toggleHistory}>
                    search history
                  </button>
                </p>
              )
            ) : (
              <View sessions={sessions} now={now} terms={terms} {...actions} />
            )}
            {history && searching ? (
              <HistoryPanel
                query={query}
                terms={terms}
                includeSubagents={includeSubagents}
                onIncludeSubagents={updateIncludeSubagents}
                threshold={clampThreshold(state.historyThreshold)}
                now={now}
              />
            ) : history ? (
              <p className="placeholder history-hint">History is on: type in the search box to search every past session too.</p>
            ) : null}
          </>
        )}
      </main>
      <footer className="credit">
        <a href="https://fourounces.live/" target="_blank" rel="noreferrer">
          <FourOuncesMark />
          <span>Four Ounces</span>
        </a>
      </footer>
    </div>
  );
}
