import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { findMermaidBlocks } from '../src/lib/mermaid.ts';
const blocks = findMermaidBlocks(readFileSync(process.argv[2], 'utf8'));
for (const [index, block] of blocks.entries()) {
  const start = performance.now();
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import {readFileSync} from 'node:fs';
    import {renderGlyphDiagram} from '@glyphcss/diagrams';
    import {renderGlyphSequence} from '@glyphcss/diagrams/sequence';
    const source = readFileSync(0, 'utf8');
    const renderer = source.startsWith('sequenceDiagram') ? renderGlyphSequence : renderGlyphDiagram;
    const result = await renderer(source, {target:'chat', color:'none', charset:'box', width:80,height:24,
      ${process.argv[3] === 'expand' ? "overflow:'expand',autoDirection:false" : ''}});
    const rows = result.text.split('\u005cn');
    console.log(JSON.stringify({rows: rows.length, maxWidth: Math.max(...rows.map(r=>r.length))}));
  `], { input: block.source, encoding: 'utf8', timeout: 4000 });
  console.log({ index, chars: block.source.length, ms: Math.round(performance.now() - start),
    status: result.status, error: result.error?.message, output: result.stdout?.trim(), stderr: result.stderr?.slice(-1200) });
}
