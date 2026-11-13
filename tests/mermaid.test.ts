import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { findMermaidBlocks } from '../src/lib/mermaid.ts';
import { renderMermaid } from '../src/lib/render-mermaid.ts';
import { createMermaidPreview } from '../src/lib/mermaid-preview.ts';

test('fences retain UTF-8 byte offsets and CRLF', () => {
  const text = '🌱\r\n```mermaid\r\nflowchart LR\r\n A-->B\r\n```\r\nafter';
  const [block] = findMermaidBlocks(text);
  assert.equal(block.lines[0].start, Buffer.byteLength('🌱\r\n'));
  assert.equal(block.source, 'flowchart LR\r\n A-->B\r\n');
});

test('nested examples, unfinished fences, and container fences remain literal', () => {
  assert.deepEqual(findMermaidBlocks('````markdown\n```mermaid\nA-->B\n```\n````'), []);
  assert.deepEqual(findMermaidBlocks('```mermaid\nflowchart LR\n A-->B'), []);
  assert.deepEqual(findMermaidBlocks('> ```mermaid\n> A-->B\n> ```'), []);
  assert.deepEqual(findMermaidBlocks('    ```mermaid\n    A-->B\n    ```'), []);
  assert.equal(findMermaidBlocks('~~~mermaid\nflowchart LR\n A-->B\n~~~~')[0].source, 'flowchart LR\n A-->B\n');
});

test('actual glyphcss graph and sequence renderers produce uncolored diagrams', async () => {
  const graph = (await renderMermaid('flowchart LR\n A[Start] --> B[Finish]', 72)).join('\n');
  assert.match(graph, /Start/);
  assert.match(graph, /Finish/);
  assert.doesNotMatch(graph, /\x1b/);
  const sequence = (await renderMermaid('sequenceDiagram\n Client->>API: Hello', 72)).join('\n');
  assert.match(sequence, /Hello/);
  assert.match(sequence, /Client/);
  await assert.rejects(renderMermaid('not a diagram', 72));
});

function mockEditor(text: string, read = async () => text) {
  const calls: Array<{ name: string; args: unknown[] }> = [];
  const editor = new Proxy({}, { get: (_, name: string) => {
    if (name === 'getBufferLength') return () => Buffer.byteLength(text);
    if (name === 'getBufferText') return read;
    if (name === 'utf8ByteLength') return (s: string) => Buffer.byteLength(s);
    if (name === 'stringWidth') return (s: string) => [...s].length;
    if (name === 'charWidth') return () => 1;
    if (name === 'getPluginDir') return () => resolve('dist');
    if (name === 'getConfigDir') return () => resolve('dist');
    if (name === 'fileExists') return existsSync;
    if (name === 'spawnHostProcess') return (_command: string, args: string[]) => {
      let child;
      const result = new Promise<SpawnResult>(resolveResult => {
        child = execFile(process.execPath, args, (error, stdout, stderr) => resolveResult({
          exit_code: error ? 1 : 0, stdout, stderr,
        }));
      });
      return Object.assign(result, { result, processId: 1, kill: async () => child!.kill() });
    };
    return (...args: unknown[]) => { calls.push({ name, args }); return true; };
  } });
  return { editor: editor as EditorAPI, calls };
}
async function settle(calls?: Array<{ name: string }>) {
  const deadline = Date.now() + 4000;
  do {
    await new Promise(resolve => setTimeout(resolve, 20));
    if (!calls || calls.some(call => ['refreshLines', 'debug'].includes(call.name))) return;
  } while (Date.now() < deadline);
  throw new Error('Preview did not settle');
}

test('preview decorates diagram rows only in compose panes, retaining following prose', async () => {
  const text = '```mermaid\nflowchart LR\n A[Start] --> B[Finish]\n```\nafter';
  const { editor, calls } = mockEditor(text);
  const preview = createMermaidPreview(editor);
  preview.ensure(1, 72);
  await settle(calls);
  assert(calls.some(call => call.name === 'refreshLines'));
  const [block] = findMermaidBlocks(text);
  for (const line of block.lines) {
    assert(preview.draw(1, { byte_start: line.start, byte_end: line.start + Buffer.byteLength(line.content), content: line.content }));
  }
  for (const call of calls.filter(call => call.name === 'addConceal')) assert.equal(call.args.length, 5);
  for (const call of calls.filter(call => call.name === 'addVirtualLine')) assert.deepEqual(call.args[3], { composeOnly: true });
  assert.equal(preview.draw(1, { byte_start: Buffer.byteLength(text) - 5, byte_end: Buffer.byteLength(text), content: 'after' }), false);
  preview.clear(1);
  assert.equal(preview.draw(1, { byte_start: 0, byte_end: 11, content: '```mermaid\n' }), false);
});

test('an edit/close invalidates an in-flight async scan', async () => {
  let release!: (value: string) => void;
  const text = '```mermaid\nflowchart LR\n A-->B\n```';
  const { editor, calls } = mockEditor(text, () => new Promise(resolve => { release = resolve; }));
  const preview = createMermaidPreview(editor);
  preview.ensure(1, 72);
  preview.clear(1);
  release(text);
  await settle();
  assert(!calls.some(call => call.name === 'refreshLines'));
});

test('failed diagrams keep the existing Markdown code rendering', async () => {
  const text = '```mermaid\nnot a diagram\n```';
  const { editor, calls } = mockEditor(text);
  const preview = createMermaidPreview(editor);
  preview.ensure(1, 72);
  await settle(calls);
  assert.equal(preview.draw(1, { byte_start: 0, byte_end: 11, content: '```mermaid\n' }), false);
  assert(calls.some(call => call.name === 'debug'));
});

test('an edit cancels an active renderer and discards its late output', async () => {
  const text = '```mermaid\nflowchart LR\n A-->B\n```\n';
  const { editor } = mockEditor(text);
  let killed = false;
  let release!: (result: SpawnResult) => void;
  const result = new Promise<SpawnResult>(resolve => { release = resolve; });
  const spawn = () => Object.assign(result, {
    result, processId: 7, kill: async () => { throw new Error('Broken 0.5.3 handle wrapper'); },
  });
  const preview = createMermaidPreview(new Proxy(editor, {
    get: (target, name) => {
      if (name === 'spawnHostProcess') return spawn;
      if (name === 'killProcess') return (id: number) => { assert.equal(id, 7); killed = true; return true; };
      return Reflect.get(target, name);
    },
  }));
  preview.ensure(1, 80);
  await settle();
  preview.clear(1);
  assert(killed);
  release({exit_code: 0, stdout: '["stale diagram"]', stderr: ''});
  await settle();
  assert.equal(preview.draw(1, {byte_start: 0, byte_end: 11, content: '```mermaid\n'}), false);
});
