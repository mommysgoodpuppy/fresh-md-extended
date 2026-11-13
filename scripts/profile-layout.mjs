import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { findMermaidBlocks } from '../src/lib/mermaid.ts';
const source = findMermaidBlocks(readFileSync('tests/fixtures/architecture.md', 'utf8'))[0].source;
for (const width of [80, 100, 120, 160, 240]) {
  const start = performance.now();
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import {renderGlyphDiagram} from '@glyphcss/diagrams';
    const result = await renderGlyphDiagram(${JSON.stringify(source)}, {
      target:'chat',color:'none',charset:'box',overflow:'expand',autoDirection:true,
      width:${width},height:128,detail:'faithful',labelWidth:24,
    });
    const rows = result.text.split('\\n');
    console.log(JSON.stringify({rows:rows.length, maxWidth:Math.max(...rows.map(row=>row.length)), sample:rows.filter(row=>row.trim()).slice(0,8)}));
  `], { encoding:'utf8',timeout:4000 });
  console.log(width, Math.round(performance.now()-start), result.error?.message ?? result.stdout, result.stderr?.slice(-400));
}
