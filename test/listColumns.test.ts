import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COLUMNS,
  FILL_COLUMN,
  FILL_MIN_WIDTH,
  MAX_WIDTH,
  MIN_WIDTH,
  defaultColumns,
  moveColumn,
  normalizeColumns,
  setVisible,
  setWidth,
  tableMinWidth,
} from '../src/webview/listColumns';

const ids = (cols: { id: string }[]) => cols.map((c) => c.id);
const visibleIds = (cols: { id: string; visible: boolean }[]) => ids(cols.filter((c) => c.visible));

test('defaults show the five original columns in their original order', () => {
  assert.deepEqual(visibleIds(defaultColumns()), ['state', 'session', 'folder', 'where', 'activity']);
  assert.equal(defaultColumns().length, COLUMNS.length);
});

test('normalizeColumns falls back to defaults for missing or broken layouts', () => {
  assert.deepEqual(normalizeColumns(undefined), defaultColumns());
  assert.deepEqual(normalizeColumns('nonsense'), defaultColumns());
  assert.deepEqual(normalizeColumns([{ id: 'gone' }, null, 3]), defaultColumns());
});

test('normalizeColumns keeps saved order, drops unknown and repeated ids, appends new columns hidden', () => {
  const out = normalizeColumns([
    { id: 'activity', visible: true, width: 90 },
    { id: 'retired', visible: true },
    { id: 'session', visible: false, width: 500 },
    { id: 'activity', visible: false },
    { id: 'state', visible: false },
  ]);
  assert.deepEqual(ids(out).slice(0, 3), ['activity', 'session', 'state']);
  assert.equal(out.length, COLUMNS.length);
  assert.deepEqual(visibleIds(out), ['activity', 'session']);
  // Session always shows and never stores a width; repeats keep the first entry.
  assert.deepEqual(out[1], { id: 'session', visible: true });
  assert.equal(out[0].width, 90);
});

test('widths are clamped', () => {
  const out = normalizeColumns([{ id: 'folder', visible: true, width: 5 }, { id: 'path', visible: true, width: 9999 }, { id: 'where', visible: true, width: NaN }]);
  assert.equal(out[0].width, MIN_WIDTH);
  assert.equal(out[1].width, MAX_WIDTH);
  assert.equal(out[2].width, undefined);
  assert.equal(setWidth(out, 'folder', 123.6).find((c) => c.id === 'folder')!.width, 124);
  assert.equal(setWidth(out, 'folder', undefined).find((c) => c.id === 'folder')!.width, undefined);
});

test('session cannot be hidden or sized', () => {
  const cols = defaultColumns();
  assert.equal(setVisible(cols, FILL_COLUMN, false), cols);
  assert.equal(setWidth(cols, FILL_COLUMN, 300), cols);
  assert.deepEqual(visibleIds(setVisible(cols, 'folder', false)), ['state', 'session', 'where', 'activity']);
});

test('moveColumn swaps with the next visible column and stops at the ends', () => {
  const cols = defaultColumns(); // state session prompt* folder path* where agent* started* activity
  assert.deepEqual(visibleIds(moveColumn(cols, 'folder', -1)), ['state', 'folder', 'session', 'where', 'activity']);
  assert.deepEqual(visibleIds(moveColumn(cols, 'where', 1)), ['state', 'session', 'folder', 'activity', 'where']);
  assert.equal(moveColumn(cols, 'state', -1), cols);
  assert.equal(moveColumn(cols, 'activity', 1), cols);
  assert.equal(moveColumn(cols, 'nope', 1), cols);
});

test('tableMinWidth adds the fixed columns, room for session and the actions column', () => {
  const cols = setWidth(defaultColumns(), 'folder', 200);
  // state 200 + folder 200 + where 110 + activity 130
  assert.equal(tableMinWidth(cols, 100), 200 + 200 + 110 + 130 + FILL_MIN_WIDTH + 100);
});
