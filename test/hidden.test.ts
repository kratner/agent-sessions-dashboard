import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyHidden, sameHidden } from '../src/shared/hidden';
import type { AgentSession } from '../src/shared/types';

function s(key: string, updatedAt: number, extra: Partial<AgentSession> = {}): AgentSession {
  return { key, source: 'claude-code', sourceLabel: 'Claude Code', id: key, title: key, state: 'waiting', updatedAt, ...extra };
}

test('a hidden session stays hidden while it has no new activity', () => {
  const { sessions, hidden } = applyHidden([s('a', 100), s('b', 200)], { a: 100 });
  assert.equal(sessions[0].hidden, true);
  assert.equal(sessions[1].hidden, undefined);
  assert.deepEqual(hidden, { a: 100 });
});

test('a hidden session comes back when it does something new, and its entry is dropped', () => {
  const { sessions, hidden } = applyHidden([s('a', 150)], { a: 100 });
  assert.equal(sessions[0].hidden, undefined);
  assert.deepEqual(hidden, {});
});

test('ending a hidden session keeps it hidden (state changes, activity does not)', () => {
  const { sessions } = applyHidden([s('a', 100, { state: 'ended' })], { a: 100 });
  assert.equal(sessions[0].hidden, true);
});

test('entries for sessions that left the board are dropped, unless a source failed', () => {
  assert.deepEqual(applyHidden([s('b', 1)], { a: 100 }).hidden, {});
  assert.deepEqual(applyHidden([s('b', 1)], { a: 100 }, true).hidden, { a: 100 });
});

test('a stale hidden flag from a previous list is cleared', () => {
  const { sessions } = applyHidden([s('a', 100, { hidden: true })], {});
  assert.equal('hidden' in sessions[0], false);
});

test('sameHidden compares keys and times', () => {
  assert.ok(sameHidden({ a: 1, b: 2 }, { b: 2, a: 1 }));
  assert.ok(!sameHidden({ a: 1 }, { a: 2 }));
  assert.ok(!sameHidden({ a: 1 }, { a: 1, b: 2 }));
});
