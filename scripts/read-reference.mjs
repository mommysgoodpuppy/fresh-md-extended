import { readFileSync, writeFileSync } from 'node:fs';
const text = readFileSync('.integration/reference-dom.html','utf8');
const match = text.match(/<pre id="reference-result">([\s\S]*?)<\/pre>/);
if (!match) { console.log({bytes:text.length,tail:text.slice(-700)}); process.exit(1); }
const content = match[1].replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
const nodes = JSON.parse(content).map(node => {
  const coordinates = node.transform.match(/translate\(\s*([\d.-]+)[, ]+\s*([\d.-]+)\s*\)/);
  return {...node,x:Number(coordinates[1]),y:Number(coordinates[2])};
});
nodes.sort((a,b)=>a.y-b.y||a.x-b.x);
console.log(JSON.stringify(nodes,null,2));
writeFileSync('.integration/reference-positions.json', JSON.stringify(nodes,null,2));
