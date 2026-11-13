import { readFileSync, writeFileSync } from 'node:fs';
import { glyphGraphFromMermaid, layoutGlyphGraph, routeGlyphGraphEdges, paintGlyphDiagram } from '@glyphcss/diagrams';
import { findMermaidBlocks } from '../src/lib/mermaid.ts';
const blocks = findMermaidBlocks(readFileSync('tests/fixtures/architecture.md', 'utf8'));
for (const [index, block] of blocks.entries()) {
  if (block.source.startsWith('sequenceDiagram')) continue;
  const graph = glyphGraphFromMermaid(block.source);
  const start = performance.now();
  let layout, routing;
  for (const spacing of [4, 8, 12, 20]) {
    layout = await layoutGlyphGraph(graph, {labelWidth:24, charset:'box',nodesep:spacing,ranksep:spacing,margin:spacing*2});
    routing = routeGlyphGraphEdges(layout, {width:layout.width,height:layout.height});
    console.log({index,spacing,width:layout.width,height:layout.height,routes:routing.routes.length,missed:routing.unroutable.length});
    if (!routing.unroutable.length) break;
  }
  const painted = paintGlyphDiagram(layout, routing, {width:layout.width,height:layout.height,charset:'box',color:'none'});
  writeFileSync(`.integration/connected-${index}.txt`, painted.text);
  console.log({index,ms:Math.round(performance.now()-start),width:layout.width,height:layout.height,nodes:layout.nodes.length,edges:layout.edges.length,routes:routing.routes.length,unroutable:routing.unroutable});
}
