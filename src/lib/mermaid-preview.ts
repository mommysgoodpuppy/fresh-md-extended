/// <reference path="./fresh.d.ts" />
import { findMermaidBlocks } from './mermaid.ts';
import { diagramRow, diagramWindow, sliceColumns } from './diagram-window.ts';

const NS = 'md-extended-mermaid';
interface Row { content: string; replacement: string | null; extra: string[]; canvasWidth: number; header: boolean }
interface State { width: number; rows: Map<number, Row>; pan: number | null; process?: ProcessHandle<SpawnResult> }

// Async work is owned by a state identity. An edit, resize, close or mode change
// replaces/deletes that identity, so late results can never publish old offsets.
export function createMermaidPreview(editor: EditorAPI) {
  const states = new Map<number, State>();
  const cache = new Map<string, string[]>();
  const charWidths = new Map<number, number>();
  const measure = (cp: number): number => {
    if (!charWidths.has(cp)) charWidths.set(cp, editor.charWidth(cp));
    return charWidths.get(cp)!;
  };
  function clear(bufferId: number) {
    const pending = states.get(bufferId)?.process;
    states.delete(bufferId);
    // Fresh 0.5.3's ProcessHandle.kill wrapper can throw synchronously while
    // a layout is active. Use the editor's native cancellation API instead,
    // and never let cancellation abort the Markdown lines_changed handler.
    if (pending) {
      try { editor.killProcess(pending.processId); }
      catch (error) { editor.debug(`Mermaid cancellation: ${String(error)}`); }
    }
    editor.clearConcealNamespace(bufferId, NS);
    editor.clearVirtualTextNamespace(bufferId, NS);
  }
  function ensure(bufferId: number, width: number) {
    width = Number.isFinite(width) ? Math.max(20, Math.min(300, Math.floor(width))) : 80;
    if (states.get(bufferId)?.width === width) return;
    const previousRows = states.get(bufferId)?.rows;
    const previousPan = states.get(bufferId)?.pan ?? null;
    clear(bufferId);
    const state: State = { width, rows: new Map(previousRows), pan: previousPan };
    states.set(bufferId, state);
    void (async () => {
      // This first prototype deliberately bounds full-buffer scans and layout.
      if (editor.getBufferLength(bufferId) > 1024 * 1024) return;
      const text = await editor.getBufferText(bufferId);
      if (states.get(bufferId) !== state) return;
      const blocks = findMermaidBlocks(text).slice(0, 64);
      const candidates = [
        `${editor.getPluginDir()}/mermaid-renderer/runner.cjs`,
        `${editor.getConfigDir()}/plugins/mermaid-renderer/runner.cjs`,
      ];
      const runner = candidates.find(path => editor.fileExists(path));
      if (!runner && blocks.length) throw new Error('Mermaid companion renderer not installed');
      for (const block of blocks) {
        if (states.get(bufferId) !== state) return;
        if (block.source.length > 4096) continue;
        try {
          const cacheKey = JSON.stringify([width, block.source]);
          let rendered = cache.get(cacheKey);
          if (!rendered) {
          state.process = editor.spawnHostProcess('node', [runner!, JSON.stringify({
            source: block.source, width,
          })]);
          const result = await state.process;
          state.process = undefined;
          if (states.get(bufferId) !== state) return;
          if (result.exit_code !== 0) throw new Error(result.stderr || 'Node.js renderer could not start');
          const parsed: unknown = JSON.parse(result.stdout);
          if (!Array.isArray(parsed) || !parsed.length || parsed.length > 512 ||
              parsed.some(row => typeof row !== 'string' || row.length > 1024)) {
            throw new Error('Invalid Mermaid renderer output');
          }
          rendered = parsed as string[];
          cache.set(cacheKey, rendered);
          if (cache.size > 16) cache.delete(cache.keys().next().value!);
          }
          const canvasWidth = Math.max(...rendered.map(row => editor.stringWidth(row)));
          for (let i = 0; i < block.lines.length; i++) {
            const line = block.lines[i];
            state.rows.set(line.start, {
              content: line.content,
              replacement: i === 0 ? '' : rendered[i - 1] ?? (i === block.lines.length - 1 ? '' : null),
              extra: i === block.lines.length - 1 ? rendered.slice(block.lines.length - 1) : [],
              canvasWidth, header: i === 0,
            });
          }
          editor.refreshLines(bufferId);
        } catch (error) {
          editor.debug(`Mermaid preview: leaving source visible: ${String(error)}`);
        }
      }
    })().catch(error => editor.debug(`Mermaid preview: ${String(error)}`));
  }
  function draw(bufferId: number, line: { byte_start: number; byte_end: number; content: string; region?: string }): boolean {
    editor.clearVirtualLinesInRange(bufferId, NS, line.byte_start, Math.max(line.byte_end, line.byte_start + 1));
    const state = states.get(bufferId);
    const row = state?.rows.get(line.byte_start);
    if (!state || !row || row.content !== line.content) return false;
    // The editor's parser wins over the full-text scanner in HTML/front matter.
    if (line.region !== undefined && !['open', 'body', 'close'].includes(line.region)) return false;
    editor.clearConcealsInRange(bufferId, line.byte_start, line.byte_end);
    editor.clearSoftBreaksInRange(bufferId, line.byte_start, line.byte_end);
    const contentEnd = line.byte_start + editor.utf8ByteLength(line.content.replace(/\r?\n$/, ''));
    const view = diagramWindow(row.canvasWidth, state.width, state.pan);
    const windowRow = (text: string) => diagramRow(text, row.canvasWidth, state.width, state.pan, measure);
    const header = view.overflowing
      ? `Pan Diagrams Left/Right · cols ${view.offset + 1}–${Math.min(row.canvasWidth, view.offset + view.bodyWidth)}/${row.canvasWidth}`
      : 'Mermaid diagram';
    // Rendered rows retain their source newline. Surplus source rows disappear
    // including their newline, keeping diagrams shorter than their source tight.
    editor.addConceal(bufferId, NS, line.byte_start,
      row.replacement === null ? line.byte_end : contentEnd,
      row.header ? sliceColumns(header, 0, view.width, measure).trimEnd()
        : row.replacement === null ? null : windowRow(row.replacement));
    row.extra.forEach((text, index) => editor.addVirtualLine(
      bufferId, line.byte_start, windowRow(text), { composeOnly: true }, false, NS, index,
    ));
    return true;
  }
  function pan(bufferId: number, delta: number | null): boolean {
    const state = states.get(bufferId);
    if (!state || !state.rows.size) return false;
    const canvasWidth = Math.max(...[...state.rows.values()].map(row => row.canvasWidth));
    const view = diagramWindow(canvasWidth, state.width, state.pan);
    state.pan = delta === null ? null : Math.max(0, Math.min(view.maxOffset, view.offset + delta));
    editor.refreshLines(bufferId);
    return true;
  }
  return { ensure, draw, clear, pan };
}
