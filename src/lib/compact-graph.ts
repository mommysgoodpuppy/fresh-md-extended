import { glyphDiagramGroupRects, type GlyphDiagramLayout, type GlyphDiagramRoutingResult, type GlyphDiagramPlacedLabel } from '@glyphcss/diagrams';

// Remove slices containing only straight wire. Node bodies, port stems,
// turns, labels and group-border corners keep their geometry and clearance. This
// lets a large fan-out retain routing space without stretching simple chains.
export function compactGraphRows(layout: GlyphDiagramLayout, routing: GlyphDiagramRoutingResult, placed: readonly GlyphDiagramPlacedLabel[] = []) {
  // Self-loop shapes have implicit offsets; leave their geometry untouched.
  if (layout.loops.length) return { layout, routing, labels: placed };
  let labels = [...placed];
  for (const axis of ['y', 'x'] as const) {
  const lo = axis === 'y' ? 'y0' : 'x0', hi = axis === 'y' ? 'y1' : 'x1';
  const extent = axis === 'y' ? layout.height : layout.width;
  const protectedRows = new Set<number>();
  const protect = (start: number, end = start) => {
    for (let y = Math.max(0, start); y <= Math.min(extent - 1, end); y++) protectedRows.add(y);
  };
  for (const node of layout.nodes) protect(node[lo] - 1, node[hi] + 1);
  for (const label of labels) protect(label[lo] - 1, label[hi] + 1);
  for (const port of layout.ports) { protect(port.anchor[axis]); protect(port.escape[axis]); }
  const frames = glyphDiagramGroupRects(layout, { cols: layout.width, rows: layout.height });
  for (const frame of frames.values()) {
    protect(frame[lo] - 1, frame[lo] + 1);
    protect(frame[hi] - 1, frame[hi] + 1);
  }
  for (const route of routing.routes) route.cells.forEach((cell, index) => {
    const previous = route.cells[index - 1], next = route.cells[index + 1];
    if (!previous || !next || previous[axis] === cell[axis] || next[axis] === cell[axis]) {
      protect(cell[axis] - 1, cell[axis] + 1);
    }
  });
  const rowMap: number[] = [];
  let height = 0;
  for (let y = 0; y < extent; y++) {
    rowMap[y] = height;
    if (protectedRows.has(y)) height++;
  }
  const point = <T extends { x: number; y: number }>(p: T): T => ({ ...p, [axis]: rowMap[p[axis]] });
  // Rebuild from public geometry so advisory Dagre waypoints do not retain
  // coordinates from before compaction. Group frames derive from their nodes.
  const compact: GlyphDiagramLayout = {
    nodes: layout.nodes.map(node => ({ ...node, [lo]: rowMap[node[lo]], [hi]: rowMap[node[hi]] })),
    edges: layout.edges, groups: layout.groups,
    ports: layout.ports.map(port => ({ ...port, anchor: point(port.anchor), escape: point(port.escape) })),
    direction: layout.direction, loops: layout.loops, frameInset: layout.frameInset,
    width: axis === 'x' ? height : layout.width, height: axis === 'y' ? height : layout.height, ledger: layout.ledger,
  };
  routing = { ...routing, routes: routing.routes.map(route => ({
    ...route, cells: route.cells.filter(cell => protectedRows.has(cell[axis])).map(point),
  })) };
  labels = labels.map(label => ({ ...label, ...point(label), [lo]: rowMap[label[lo]], [hi]: rowMap[label[hi]] }));
  layout = compact;
  }
  return { layout, routing, labels };
}
