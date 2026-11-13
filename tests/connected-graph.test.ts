import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { findMermaidBlocks } from '../src/lib/mermaid.ts';
import { renderConnectedGraph } from '../src/lib/connected-graph.ts';
import { glyphDiagramGroupRects } from '@glyphcss/diagrams';

test('architecture fan-out stays on one canvas with all 13 edges and nine MAIN branches', async () => {
  const [block] = findMermaidBlocks(await readFile(new URL('./fixtures/architecture.md', import.meta.url), 'utf8'));
  const { layout, routing, text } = await renderConnectedGraph(block.source);
  assert.equal(layout.nodes.length, 13);
  assert.equal(layout.groups.length, 2);
  assert.equal(layout.edges.length, 13);
  assert.equal(routing.routes.length, 13);
  assert.deepEqual(routing.unroutable, []);
  assert.deepEqual(routing.routes.filter(route => route.edge.from === 'MAIN').map(route => route.edge.to).sort(),
    ['OPENVR','WRIST','CAMORG','WEBXR','REPL','HMD','ORIGIN','DOH','DCON'].sort());
  assert.equal(layout.ports.filter(port => port.nodeId === 'MAIN' && port.end === 'from').length, 9);
  assert.equal(text.match(/PostalService/g)?.length, 1, 'the root must not repeat across split panels');
  assert.match(text, /root actor, supervisor/);
  assert(layout.width > 140, 'the canvas may exceed the pane instead of degrading the topology');
  const postal = layout.nodes.find(node => node.id === 'PS')!;
  const main = layout.nodes.find(node => node.id === 'MAIN')!;
  for (const node of layout.nodes) {
    assert.equal(node.x1 - node.x0 + 1, node.width, `node width preserved: ${node.id}`);
    assert.equal(node.y1 - node.y0 + 1, node.height, `node body preserved: ${node.id}`);
  }
  // Measured from xlsx-viewer 2.0.4's bundled Mermaid 11 default renderer.
  const siblings = ['OPENVR','WRIST','CAMORG','REPL','WEBXR','HMD','ORIGIN','DCON'];
  assert.deepEqual(layout.nodes.filter(node => siblings.includes(node.id))
    .sort((a,b) => a.x0 - b.x0).map(node => node.id), siblings);
  assert(layout.width < 200, 'straight-wire columns should not spread the sibling row');
  const repl = layout.nodes.find(node => node.id === 'REPL')!;
  const xr = layout.nodes.find(node => node.id === 'WEBXR')!;
  assert(xr.x0 - repl.x1 - 1 <= 4, 'adjacent siblings should have compact spacing');
  const overlay = routing.routes.find(route => route.edge.from === 'WEBXR' && route.edge.to === 'DOH')!;
  assert(overlay.cells.length <= 25, 'WebXR should sit near its display overlay child');
  assert(main.y0 - postal.y1 - 1 <= 4, 'the simple PostalService-to-main connector must stay short');
  const boxes = glyphDiagramGroupRects(layout, {cols: layout.width, rows: layout.height});
  const webxr = routing.routes.find(route => route.edge.from === 'MAIN' && route.edge.to === 'WEBXR')!;
  const first = webxr.cells[0], last = webxr.cells[webxr.cells.length - 1];
  assert.equal(webxr.cells.length - 1, Math.abs(first.x - last.x) + Math.abs(first.y - last.y),
    'MAIN->WEBXR should take a shortest-length orthogonal path');
  for (const group of layout.groups) {
    const box = boxes.get(group.id)!;
    for (const route of routing.routes.filter(route => group.members.includes(route.edge.from) && group.members.includes(route.edge.to))) {
      assert(route.cells.every(cell => cell.x > box.x0 && cell.x < box.x1 && cell.y > box.y0 && cell.y < box.y1),
        `${route.edge.from}->${route.edge.to} must stay inside ${group.id}`);
    }
  }
  for (const route of routing.routes) {
    assert(route.cells.length > 1, route.edge.id);
    for (let i = 1; i < route.cells.length; i++) {
      const a = route.cells[i - 1], b = route.cells[i];
      assert.equal(Math.abs(a.x - b.x) + Math.abs(a.y - b.y), 1, `continuous route: ${route.edge.id}`);
    }
  }
});

test('parallel state transitions are all routed instead of omitted', async () => {
  const blocks = findMermaidBlocks(await readFile(new URL('./fixtures/architecture.md', import.meta.url), 'utf8'));
  const { layout, routing } = await renderConnectedGraph(blocks[3].source);
  assert.equal(layout.edges.length, 7);
  assert.equal(routing.routes.length, 7);
  assert.deepEqual(routing.unroutable, []);
});
