import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadComposeWidth, saveComposeWidth } from '../src/lib/compose-width.ts';

test('full viewport width is the default, and None survives serialized state', () => {
  let saved: unknown;
  const editor = { getGlobalState: () => saved, setGlobalState: (_key: string, value: unknown) => {
    saved = JSON.parse(JSON.stringify(value)); return true;
  }};
  assert.equal(loadComposeWidth(editor), null);
  saveComposeWidth(editor, 120);
  assert.equal(loadComposeWidth(editor), 120);
  saveComposeWidth(editor, null);
  assert.deepEqual(saved, {width: null});
  assert.equal(loadComposeWidth(editor), null);
});

test('invalid saved widths fall back to full viewport', () => {
  for (const saved of [80, {width: 0}, {width: -1}, {width: 301}, {width: 'None'}, {width: 100.5}]) {
    assert.equal(loadComposeWidth({getGlobalState: () => saved, setGlobalState: () => true}), null);
  }
});
