import { renderGlyphSequence } from '@glyphcss/diagrams/sequence';
import { renderConnectedGraph } from './connected-graph.ts';

// This module belongs exclusively to the external renderer. Never import it
// into the Fresh plugin: async library APIs still do CPU work synchronously.
export async function renderMermaid(source: string, width: number): Promise<string[]> {
  const options = { target: 'chat' as const, color: 'none' as const,
    charset: 'box' as const, width: Math.max(20, Math.min(300, Math.floor(width))), height: 24,
    overflow: 'expand' as const, autoDirection: false };
  const sequence = /^\s*(?:%%[^\n]*\n\s*)*sequenceDiagram\b/.test(source);
  const result = sequence ? await renderGlyphSequence(source, options) : await renderConnectedGraph(source);
  const rows = result.text.replace(/\r/g, '').split('\n').map(row => row.trimEnd());
  while (rows.length && !rows[0]) rows.shift();
  while (rows.length && !rows[rows.length - 1]) rows.pop();
  // Remove unused exterior margins, keeping the coordinates within the graph
  // intact. Canvas width is independent of the pane used to inspect it.
  const indent = Math.min(...rows.filter(row => row.trim()).map(row => row.search(/\S/)));
  if (Number.isFinite(indent) && indent > 0) {
    for (let i = 0; i < rows.length; i++) rows[i] = rows[i].slice(indent);
  }
  if (!rows.length || rows.length > 512 || rows.some(row => row.length > 1024)) {
    throw new Error('Empty or oversized Mermaid rendering');
  }
  return rows;
}
