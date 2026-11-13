import {
  glyphGraphFromMermaid, layoutGlyphGraph, routeGlyphGraphEdges, paintGlyphDiagram,
} from '@glyphcss/diagrams';
import { compactGraphRows } from './compact-graph.ts';
import { layoutSourceOrdered } from './source-order-layout.ts';

// Use the graph primitives directly: renderGlyphDiagram's fitting pipeline may
// collapse nodes and split the topology into separate chat panels.
export async function renderConnectedGraph(source: string) {
  const graph = glyphGraphFromMermaid(source);
  const flowchart = /^\s*(?:%%[^\n]*\n\s*)*(?:flowchart|graph)\b/.test(source);
  const candidates = [
    {nodesep:4, ranksep:4}, {nodesep:4, ranksep:8}, {nodesep:4, ranksep:12}, {nodesep:4, ranksep:20},
    {nodesep:8, ranksep:8}, {nodesep:12, ranksep:12}, {nodesep:20, ranksep:20},
  ];
  for (const spacing of candidates) {
    const layout = await (flowchart ? layoutSourceOrdered : layoutGlyphGraph)(graph, {
      charset: 'box', labelWidth: 24, ...spacing, margin: spacing.ranksep * 2,
    });
    if (layout.width > 1024 || layout.height > 512 || layout.width * layout.height > 262144) {
      throw new Error('Connected diagram exceeds the canvas limit');
    }
    // Reserve short connections within a group before cross-group routes take
    // those lanes. Search priorities are temporary; preserve authored edge
    // metadata for labels and painting.
    const searchEdges = layout.edges.map(edge => {
      const ports = layout.ports.filter(port => port.edgeId === edge.id);
      const from = ports.find(port => port.end === 'from')!.anchor;
      const to = ports.find(port => port.end === 'to')!.anchor;
      const internal = layout.groups.some(group => group.members.includes(edge.from) && group.members.includes(edge.to));
      const distance = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
      return { ...edge, priority: (edge.priority ?? 0) * 1000000 + (internal ? 10000 : 0) - distance };
    });
    const hasInternal = layout.edges.some(edge => layout.groups.some(group =>
      group.members.includes(edge.from) && group.members.includes(edge.to)));
    let searched = routeGlyphGraphEdges(hasInternal ? { ...layout, edges: searchEdges } : layout,
      { width: layout.width, height: layout.height });
    // Some cyclic graphs route better in the original order. Keep that working
    // strategy available rather than sacrificing an edge for a prettier order.
    if (searched.unroutable.length && hasInternal) {
      const original = routeGlyphGraphEdges(layout, { width: layout.width, height: layout.height });
      if (original.unroutable.length < searched.unroutable.length) searched = original;
    }
    const originals = new Map(layout.edges.map(edge => [edge.id, edge]));
    const routing = { ...searched, routes: searched.routes.map(route => ({ ...route, edge: originals.get(route.edge.id)! })) };
    // Extra spacing opens routing lanes for large fan-outs, parallel edges and
    // cycles. Never silently omit an edge to force the drawing into a viewport.
    if (routing.unroutable.length) continue;
    const measured = paintGlyphDiagram(layout, routing, {
      width: layout.width, height: layout.height, charset: 'box', color: 'none',
    });
    const compact = compactGraphRows(layout, routing, measured.labels);
    const page = paintGlyphDiagram(compact.layout, compact.routing, {
      width: compact.layout.width, height: compact.layout.height, charset: 'box', color: 'none',
      labelLayout: {placed: compact.labels, dropped: [], ledger: []},
    });
    return { ...compact, text: page.text };
  }
  throw new Error('Unable to route every edge on a single connected canvas');
}
