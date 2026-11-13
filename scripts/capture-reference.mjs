// Development-only: render with the user's installed VS Code extension's own
// bundled Mermaid, in a separate headless browser profile. No VS Code state is
// read or modified. The bundle is copied only into the ignored test directory.
import { readFileSync, writeFileSync } from 'node:fs';
import { findMermaidBlocks } from '../src/lib/mermaid.ts';
const bundlePath = process.argv[2];
let bundle = readFileSync(bundlePath, 'utf8');
if (!bundle.includes('.mermaid=b$')) throw new Error('Reference bundle layout changed');
bundle = bundle.replace('.mermaid=b$', '.mermaid=globalThis.referenceMermaid=b$');
writeFileSync('.integration/reference-bundle.js', bundle);
const source = findMermaidBlocks(readFileSync('tests/fixtures/architecture.md','utf8'))[0].source;
writeFileSync('.integration/reference-render.html', `<!doctype html><html><body>
<script>window.acquireVsCodeApi=()=>({postMessage(){},getState(){return{}},setState(){}});</script>
<script src="reference-bundle.js"></script>
<script>
setTimeout(async()=>{
 try {
  const mermaid = globalThis.referenceMermaid;
  if(!mermaid) throw Error('Reference Mermaid was not exposed');
  mermaid.initialize({startOnLoad:false,theme:'default'});
  const {svg}=await mermaid.render('reference',${JSON.stringify(source)});
  const graph=document.createElement('div');graph.innerHTML=svg;document.body.append(graph);
  const nodes=[...graph.querySelectorAll('.node')].map(node=>({id:node.id,text:node.textContent,transform:node.getAttribute('transform')}));
  const result=document.createElement('pre');result.id='reference-result';result.textContent=JSON.stringify(nodes);document.body.append(result);
 } catch(error) {const result=document.createElement('pre');result.id='reference-result';result.textContent=String(error);document.body.append(result);}
},50);
</script></body></html>`);
