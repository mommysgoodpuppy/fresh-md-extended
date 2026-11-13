import { layoutGlyphGraph, type GlyphGraph, type GlyphDiagramLayout, type GlyphDiagramLayoutOptions } from '@glyphcss/diagrams';
import { orderFlowchart } from './order-flowchart.ts';

// glyphcss alphabetizes ids before inserting nodes/edges into Dagre. Preserve
// Mermaid source insertion order for flowcharts instead, then restore every
// original identity before routing, painting or exposing graph metadata.
export async function layoutSourceOrdered(graph: GlyphGraph, options: GlyphDiagramLayoutOptions): Promise<GlyphDiagramLayout> {
  const key = (prefix: string, index: number) => `${prefix}${String(index).padStart(6, '0')}`;
  const nodeKeys = new Map(graph.nodes.map((node, i) => [node.id, key('node-', i)]));
  const groupKeys = new Map((graph.groups ?? []).map((group, i) => [group.id, key('group-', i)]));
  const nodeOriginals = new Map(graph.nodes.map(node => [nodeKeys.get(node.id)!, node]));
  const groupOriginals = new Map((graph.groups ?? []).map(group => [groupKeys.get(group.id)!, group]));
  const edgeOriginals = new Map(graph.edges.map((edge, i) => [key('edge-', i), { ...edge, id: edge.id ?? `source-edge-${i}` }]));
  const ordered: GlyphGraph = {
    ...graph,
    nodes: graph.nodes.map(node => ({ ...node, id: nodeKeys.get(node.id)!,
      ...(node.group ? { group: groupKeys.get(node.group) } : {}) })),
    groups: graph.groups?.map(group => ({ ...group, id: groupKeys.get(group.id)!,
      members: group.members.map(id => nodeKeys.get(id)!),
      ...(group.parent ? { parent: groupKeys.get(group.parent) } : {}) })),
    edges: graph.edges.map((edge, i) => ({ ...edge, id: key('edge-', i), from: nodeKeys.get(edge.from)!, to: nodeKeys.get(edge.to)! })),
  };
  const result = await layoutGlyphGraph(ordered, options);
  const trunkKeys = new Map<string, string>();
  const restored: GlyphDiagramLayout = {
    nodes: result.nodes.map(node => ({ ...node, id: nodeOriginals.get(node.id)!.id,
      ...(node.group ? { group: nodeOriginals.get(node.id)!.group } : {}) })),
    edges: result.edges.map(edge => edgeOriginals.get(edge.id)!),
    groups: result.groups.map(group => groupOriginals.get(group.id)!),
    ports: result.ports.map(port => {
      if (port.trunk && !trunkKeys.has(port.trunk)) trunkKeys.set(port.trunk, `source-trunk-${trunkKeys.size}`);
      return { ...port, nodeId: nodeOriginals.get(port.nodeId)!.id, edgeId: edgeOriginals.get(port.edgeId)!.id,
        ...(port.trunk ? { trunk: trunkKeys.get(port.trunk) } : {}) };
    }),
    loops: result.loops.map(loop => ({ ...loop, nodeId: nodeOriginals.get(loop.nodeId)!.id, edgeId: edgeOriginals.get(loop.edgeId)!.id })),
    direction: result.direction, frameInset: result.frameInset,
    width: result.width, height: result.height, ledger: result.ledger,
  };
  return orderFlowchart(restored, graph);
}
