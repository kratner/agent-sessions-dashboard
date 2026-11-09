import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SessionStore } from '../src/sessionStore';
import { summarize } from '../src/shared/summary';
import type { AgentSession } from '../src/shared/types';
import type { SessionSource } from '../src/sources/SessionSource';

const session = (id: string, state: AgentSession['state']): AgentSession =>
  ({ key: `t:${id}`, source: 't', sourceLabel: 'T', id, title: id, state, updatedAt: 1 }) as AgentSession;

function source(list: () => Promise<AgentSession[]>): SessionSource {
  return { id: 't', label: 'T', onDidChange: () => ({ dispose() {} }), list, open: async () => {}, dispose() {} } as unknown as SessionSource;
}

test('summarize counts sessions by state', () => {
  assert.equal(summarize([]), '0');
  assert.equal(summarize([session('a', 'busy'), session('b', 'idle'), session('c', 'busy')]), '3 (busy 2, idle 1)');
});

test('a refresh that never settles does not freeze the store', async () => {
  const realNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  try {
    let calls = 0;
    const store = new SessionStore([
      source(() => (++calls === 1 ? new Promise<AgentSession[]>(() => {}) : Promise.resolve([session('a', 'busy')]))),
    ]);
    const hung = store.refresh(); // never resolves
    void hung;
    await store.refresh(); // within a minute: queued behind the hung one
    assert.equal(store.current.length, 0);
    now += 61_000;
    await store.refresh(); // past a minute: starts over
    assert.deepEqual(store.current.map((s) => s.state), ['busy']);
    store.dispose();
  } finally {
    Date.now = realNow;
  }
});

test('hide persists, survives a failed list, and new activity brings the session back', async () => {
  const saved = new Map<string, unknown>();
  const memory = { get: (k: string, d: unknown) => (saved.has(k) ? saved.get(k) : d), update: async (k: string, v: unknown) => void saved.set(k, v) };
  let list: () => Promise<AgentSession[]> = async () => [session('a', 'waiting')];
  const store = new SessionStore([source(() => list())], memory as never);
  await store.refresh();
  await store.hide(store.current[0]);
  assert.equal(store.current[0].hidden, true);
  assert.deepEqual(saved.get('agentSessions.hiddenSessions'), { 't:a': 1 });

  // A restart reads the saved map.
  const again = new SessionStore([source(() => list())], memory as never);
  await again.refresh();
  assert.equal(again.current[0].hidden, true);

  // A failed list keeps the entry instead of forgetting it.
  list = () => Promise.reject(new Error('boom'));
  await again.refresh();
  assert.deepEqual(saved.get('agentSessions.hiddenSessions'), { 't:a': 1 });

  // New activity: back on the board, entry dropped.
  list = async () => [{ ...session('a', 'waiting'), updatedAt: 2 }];
  await again.refresh();
  assert.equal(again.current[0].hidden, undefined);
  assert.deepEqual(saved.get('agentSessions.hiddenSessions'), {});

  await again.unhide('t:a'); // no-op when not hidden
  store.dispose();
  again.dispose();
});
