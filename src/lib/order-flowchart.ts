import type { GlyphDiagramLayout, GlyphDiagramPositionedNode, GlyphGraph } from '@glyphcss/diagrams';

// Resolve mirror-equivalent Dagre arrangements in source order, then make only
// conservative, equal-footprint sibling exchanges to shorten outgoing links.
export function orderFlowchart(layout: GlyphDiagramLayout, graph: GlyphGraph): GlyphDiagramLayout {
  if (layout.loops.length) return layout;
  const horizontal = layout.direction === 'TB' || layout.direction === 'BT';
  const axis = horizontal ? 'x' : 'y';
  const lo = horizontal ? 'x0' : 'y0', hi = horizontal ? 'x1' : 'y1';
  const rankLo = horizontal ? 'y0' : 'x0', rankHi = horizontal ? 'y1' : 'x1';
  const sameRank = (a: GlyphDiagramPositionedNode, b: GlyphDiagramPositionedNode) =>
    a[rankLo] <= b[rankHi] && b[rankLo] <= a[rankHi];
  const sourceOrder = new Map(graph.nodes.map((node, i) => [node.id, i]));
  let normal = 0, reversed = 0;
  for (const a of layout.nodes) for (const b of layout.nodes) {
    if (sourceOrder.get(a.id)! >= sourceOrder.get(b.id)! || !sameRank(a, b)) continue;
    if (a[lo] < b[lo]) normal++;
    else if (a[lo] > b[lo]) reversed++;
  }
  if (reversed > normal) {
    const extent = horizontal ? layout.width : layout.height;
    const mirror = (point: {x:number;y:number}) => ({ ...point, [axis]: extent - 1 - point[axis] });
    const nodes = layout.nodes.map(node => ({ ...node, [lo]: extent - 1 - node[hi], [hi]: extent - 1 - node[lo] }));
    const byId = new Map(nodes.map(node => [node.id, node]));
    layout = { ...layout, nodes, ports: layout.ports.map(port => {
      const side = horizontal ? ({e:'w',w:'e'} as const)[port.side as 'e'|'w']
        : ({n:'s',s:'n'} as const)[port.side as 'n'|'s'];
      const anchor = mirror(port.anchor), node = byId.get(port.nodeId)!;
      const actualSide = side ?? port.side;
      return { ...port, side: actualSide, anchor, escape: mirror(port.escape),
        offset: actualSide === 'n' || actualSide === 's' ? anchor.x - node.x0 : anchor.y - node.y0 };
    }) };
  }
  const parents = (id: string) => [...new Set(layout.edges.filter(edge => edge.to === id).map(edge => edge.from))].sort().join('\0');
  const memberships = (id: string) => layout.groups.filter(group => group.members.includes(id)).map(group => group.id).sort().join('\0');
  const outgoing = (id: string) => layout.edges.some(edge => edge.from === id && edge.to !== id);
  const center = (node: GlyphDiagramPositionedNode) => ({x:(node.x0+node.x1)/2,y:(node.y0+node.y1)/2});
  function cost(nodes: readonly GlyphDiagramPositionedNode[]) {
    const byId = new Map(nodes.map(node => [node.id, center(node)]));
    return layout.edges.reduce((sum, edge) => {
      const a = byId.get(edge.from)!, b = byId.get(edge.to)!;
      return sum + Math.abs(a.x-b.x) + Math.abs(a.y-b.y);
    }, 0);
  }
  for (const id of layout.nodes.map(node => node.id)) {
    const a = layout.nodes.find(node => node.id === id)!;
    const b = layout.nodes.filter(node => node[lo] > a[lo] && sameRank(a, node))
      .sort((left, right) => left[lo] - right[lo])[0];
    if (!b) continue;
    if (!sameRank(a,b) || a.width !== b.width || a.height !== b.height ||
      parents(a.id) !== parents(b.id) || !parents(a.id) || memberships(a.id) !== memberships(b.id) ||
      outgoing(a.id) === outgoing(b.id)) continue;
    const delta = b[lo] - a[lo];
    const move = (node: GlyphDiagramPositionedNode) => node.id === a.id
      ? {...node,[lo]:node[lo]+delta,[hi]:node[hi]+delta} : node.id === b.id
        ? {...node,[lo]:node[lo]-delta,[hi]:node[hi]-delta} : node;
    const proposed = layout.nodes.map(move);
    if (cost(proposed) >= cost(layout.nodes)) continue;
    layout = { ...layout, nodes: proposed, ports: layout.ports.map(port => {
      const shift = port.nodeId === a.id ? delta : port.nodeId === b.id ? -delta : 0;
      return { ...port, anchor: {...port.anchor,[axis]:port.anchor[axis]+shift},
        escape: {...port.escape,[axis]:port.escape[axis]+shift} };
    }) };
  }
  // Keep fan-out slots ordered by the destinations after reflecting/exchanging
  // siblings, otherwise the old slots introduce avoidable wire crossings.
  const ports = [...layout.ports];
  for (const node of layout.nodes) for (const side of ['n','s','e','w'] as const) {
    const transverse = side === 'n' || side === 's' ? 'x' : 'y';
    const fan = ports.filter(port => port.nodeId === node.id && port.end === 'from' && port.side === side);
    const slots = fan.map(port => ({anchor:port.anchor,escape:port.escape,offset:port.offset})).sort((a,b)=>a.anchor[transverse]-b.anchor[transverse]);
    fan.sort((a,b)=>{
      const ta = ports.find(port=>port.edgeId===a.edgeId&&port.end==='to')!;
      const tb = ports.find(port=>port.edgeId===b.edgeId&&port.end==='to')!;
      return ta.anchor[transverse]-tb.anchor[transverse];
    }).forEach((port,i)=>{ ports[ports.indexOf(port)] = {...port,...slots[i]}; });
  }
  return {...layout, ports};
}
