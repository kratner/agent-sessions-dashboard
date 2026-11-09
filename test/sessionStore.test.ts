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
