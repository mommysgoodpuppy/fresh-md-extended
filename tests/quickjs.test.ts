import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getQuickJS } from 'quickjs-emscripten';

test('QuickJS plugin delegates layout to a host process instead of blocking its runtime', async () => {
  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(128 * 1024 * 1024);
  const deadline = Date.now() + 15000;
  runtime.setInterruptHandler(() => Date.now() > deadline);
  const vm = runtime.newContext();
  function evaluate(code: string) {
    const result = vm.evalCode(code);
    if (result.error) {
      const error = vm.dump(result.error);
      result.error.dispose();
      throw new Error(JSON.stringify(error));
    }
    const value = vm.dump(result.value);
    result.value.dispose();
    return value;
  }
  try {
    evaluate(`
      globalThis.calls = [];
      globalThis.handlers = {};
      globalThis.getEditor = () => new Proxy({}, { get: (_, name) => {
        if (name === 'on') return (event, callback) => { handlers[event] = callback; };
        if (name === 'getGlobalState') return () => null;
        if (name === 'getBufferLength') return () => 40;
        if (name === 'utf8ByteLength' || name === 'stringWidth') return value => value.length;
        if (name === 'charWidth') return () => 1;
        if (name === 'addConceal') return (...args) => {
          if (args.length > 8 || args.slice(5).some(value => value === null)) {
            throw new TypeError('Fresh 0.5.3 optional conceal arguments must be omitted');
          }
          calls.push({name, args});
          return true;
        };
        if (name === 'getBufferText') return async () => '\x60\x60\x60mermaid\\nflowchart LR\\n A-->B\\n\x60\x60\x60';
        if (name === 'fileExists') return () => true;
        if (name === 'spawnHostProcess') return (...args) => {
          calls.push({name, args});
          return Promise.resolve({exit_code:0,stdout:'["Start --> Finish"]',stderr:''});
        };
        return (...args) => { calls.push({ name, args }); return null; };
      }});
      globalThis.registerHandler = () => {};
    `);
    evaluate(await readFile('dist/markdown_compose_extended.js', 'utf8'));
    evaluate('processLineConceals(1, "# Heading\\n", 0, 10, 80, undefined, 0, false); undefined;');
    assert(evaluate("calls.some(call => call.name === 'addConceal')"));
    evaluate('mermaidPreview.ensure(1, 80); undefined;');
    runtime.executePendingJobs().unwrap();
    assert(evaluate("calls.some(call => call.name === 'spawnHostProcess' && call.args[0] === 'node')"));
    assert(evaluate("calls.some(call => call.name === 'refreshLines')"));
    assert.equal(evaluate('typeof renderGlyphDiagram'), 'undefined');
    assert(evaluate("typeof handlers.lines_changed === 'function'"));
    assert.equal(evaluate('typeof process'), 'undefined');
    assert.equal(evaluate('typeof document'), 'undefined');
  } finally {
    vm.dispose();
    runtime.dispose();
  }
});
