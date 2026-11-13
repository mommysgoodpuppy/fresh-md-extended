import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBoundedWorker } from '../src/renderer/watchdog.mjs';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { findMermaidBlocks } from '../src/lib/mermaid.ts';

test('an infinitely busy layout worker is terminated by the independent watchdog', async () => {
  const start = Date.now();
  await assert.rejects(runBoundedWorker(new URL('./fixtures/busy.cjs', import.meta.url), {}, 100), /time budget/);
  assert(Date.now() - start < 2000);
});

test('all six architecture diagrams finish under the renderer deadline', async () => {
  const blocks = findMermaidBlocks(await readFile(new URL('./fixtures/architecture.md', import.meta.url), 'utf8'));
  assert.equal(blocks.length, 6);
  for (const [index, block] of blocks.entries()) {
    const { stdout } = await promisify(execFile)(process.execPath, [
      resolve('dist/mermaid-renderer/runner.cjs'), JSON.stringify({source: block.source, width: 80}),
    ], { timeout: 6000 });
    const rows = JSON.parse(stdout);
    assert(rows.length > 0 && rows.length <= 512, `diagram ${index}`);
  }
});

test('changing pane width preserves the exact same connected architecture canvas', async () => {
  const [block] = findMermaidBlocks(await readFile(new URL('./fixtures/architecture.md', import.meta.url), 'utf8'));
  let previous;
  for (const width of [100, 160, 240]) {
    const { stdout } = await promisify(execFile)(process.execPath, [
      resolve('dist/mermaid-renderer/runner.cjs'), JSON.stringify({source: block.source, width}),
    ], { timeout: 6000 });
    const rows = JSON.parse(stdout);
    assert(rows.length > 0 && rows.length <= 512);
    assert.match(rows.join('\n'), /desktopControl/);
    if (previous) assert.deepEqual(rows, previous);
    previous = rows;
  }
});

test('advanced showcase renders all eight valid diagrams and rejects its intentional failure', async () => {
  const blocks = findMermaidBlocks(await readFile(new URL('../examples/advanced.md', import.meta.url), 'utf8'));
  assert.equal(blocks.length, 9);
  for (const [index, block] of blocks.slice(0, -1).entries()) {
    const { stdout } = await promisify(execFile)(process.execPath, [
      resolve('dist/mermaid-renderer/runner.cjs'), JSON.stringify({source: block.source, width: 120}),
    ], { timeout: 6000 });
    const rows = JSON.parse(stdout);
    assert(rows.length > 0 && rows.length <= 512, `advanced diagram ${index + 1}`);
    assert(rows.every((row: string) => row.length <= 1024), `advanced diagram ${index + 1} width`);
    assert(rows.some((row: string) => row.trim()), `advanced diagram ${index + 1} content`);
  }
  await assert.rejects(promisify(execFile)(process.execPath, [
    resolve('dist/mermaid-renderer/runner.cjs'), JSON.stringify({source: blocks.at(-1)!.source, width: 120}),
  ], { timeout: 6000 }), /GLYPH_MERMAID_UNSUPPORTED/);
});
