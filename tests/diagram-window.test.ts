import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagramRow, diagramWindow, sliceColumns } from '../src/lib/diagram-window.ts';
const measure = (cp: number) => cp === '界'.codePointAt(0) ? 2 : cp === 0x301 ? 0 : 1;

test('oversized diagrams are clipped with overflow hints instead of word-wrapped', () => {
  assert.equal(diagramRow('1234567890', 10, 12, null, measure), '‹345678›');
  assert.equal(diagramRow('1234567890', 10, 12, 0, measure), ' 123456›');
  assert.equal(diagramRow('1234567890', 10, 12, 999, measure), '‹567890 ');
  assert.equal(diagramRow('tiny', 4, 12, null, measure), 'tiny');
  assert.equal(diagramWindow(244, 100, null).offset, 75);
});

test('column slicing preserves Unicode characters and never cuts wide characters in half', () => {
  assert.equal(sliceColumns('界XY', 0, 3, measure), '界X');
  assert.equal(sliceColumns('界XY', 1, 3, measure), ' XY');
  assert.equal(sliceColumns('e\u0301X', 0, 2, measure), 'e\u0301X');
});
