import { readFileSync, writeFileSync } from 'node:fs';
import { glyphGraphFromMermaid, layoutGlyphGraph, routeGlyphGraphEdges, glyphDiagramGroupRects, paintGlyphDiagram } from '@glyphcss/diagrams';
import { findMermaidBlocks } from '../src/lib/mermaid.ts';
const graph = glyphGraphFromMermaid(findMermaidBlocks(readFileSync('tests/fixtures/architecture.md','utf8'))[0].source);
for (const spacing of [4, 6, 8, 12]) {
  const raw = await layoutGlyphGraph(graph, {charset:'box',labelWidth:24,nodesep:spacing,ranksep:spacing,margin:spacing*2});
  // Keep the public geometry, without Dagre's advisory edge waypoints.
  const {nodes,edges,groups,ports,direction,loops,frameInset,width,height,ledger} = raw;
  const layout = {nodes,edges,groups,ports,direction,loops,frameInset,width,height,ledger};
  for (const node of nodes) for (const side of ['n','s','e','w']) {
    const fan = ports.filter(p=>p.nodeId===node.id&&p.end==='from'&&p.side===side);
    const axis = side==='n'||side==='s' ? 'x':'y';
    const slots = fan.map(p=>({anchor:p.anchor,escape:p.escape,offset:p.offset})).sort((a,b)=>a.anchor[axis]-b.anchor[axis]);
    fan.sort((a,b)=>{
      const ta=ports.find(p=>p.edgeId===a.edgeId&&p.end==='to'), tb=ports.find(p=>p.edgeId===b.edgeId&&p.end==='to');
      return ta.anchor[axis]-tb.anchor[axis] || a.edgeId.localeCompare(b.edgeId);
    }).forEach((p,i)=>Object.assign(p,slots[i]));
  }
  const orderedLayout = {...layout, edges:edges.map(edge=>{
    const pair=ports.filter(p=>p.edgeId===edge.id), a=pair.find(p=>p.end==='from').anchor,b=pair.find(p=>p.end==='to').anchor;
    const internal=groups.some(g=>g.members.includes(edge.from)&&g.members.includes(edge.to));
    return {...edge,priority:(internal?10000:0)-(Math.abs(a.x-b.x)+Math.abs(a.y-b.y))};
  })};
  const routing = routeGlyphGraphEdges(orderedLayout, {width,height});
  const host = glyphDiagramGroupRects(layout, {cols:width,rows:height}).get('HOST');
  const route = routing.routes.find(r=>r.edge.from==='MAIN'&&r.edge.to==='WEBXR');
  console.log({spacing,width,height,routes:routing.routes.length,missed:routing.unroutable,
    excursions:routing.routes.filter(r=>groups.some(g=>g.members.includes(r.edge.from)&&g.members.includes(r.edge.to)&&r.cells.some(p=>{
      const box=glyphDiagramGroupRects(layout,{cols:width,rows:height}).get(g.id);
      return p.x<=box.x0||p.x>=box.x1||p.y<=box.y0||p.y>=box.y1;
    }))).map(r=>r.edge.from+'->'+r.edge.to),
    outside:route?.cells.filter(p=>p.x<=host.x0||p.x>=host.x1||p.y<=host.y0||p.y>=host.y1).length,
    sourceGap:nodes.find(n=>n.id==='MAIN').y0-nodes.find(n=>n.id==='PS').y1-1});
  writeFileSync(`.integration/routing-${spacing}.txt`,paintGlyphDiagram(layout,routing,{width,height,charset:'box',color:'none'}).text);
}
