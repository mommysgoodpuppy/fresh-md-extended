import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
const root = process.argv[2];
let source = await readFile(join(root, 'markdown_compose.ts'), 'utf8');
function replace(from, to) {
  if (source.split(from).length !== 2) throw new Error(`Expected one integration point: ${from}`);
  source = source.replace(from, to);
}
replace('const editor = getEditor();', `import { createMermaidPreview } from './lib/mermaid-preview.ts';
const editor = getEditor();
const mermaidPreview = createMermaidPreview(editor);`);
replace('function disableMarkdownCompose(bufferId: number): void {',
  'function disableMarkdownCompose(bufferId: number): void {\n  mermaidPreview.clear(bufferId);');
replace('const measure = effectiveComposeWidth(batchViewport ? batchViewport.width : 80);',
  'const measure = effectiveComposeWidth(batchViewport ? batchViewport.width : 80);\n  mermaidPreview.ensure(data.buffer_id, measure);');
replace('const blockIndents = new Map<number, number>();',
  'const blockIndents = new Map<number, number>();\n  const diagramRows = new Set<number>();');
replace('clearCodeRails(data.buffer_id, line.byte_start, line.byte_end);',
  `clearCodeRails(data.buffer_id, line.byte_start, line.byte_end);
    if (mermaidPreview.draw(data.buffer_id, line)) {
      diagramRows.add(line.byte_start);
      continue;
    }`);
replace('processFlowBlock(data.buffer_id, block, measure, blockIndents);',
  'if (block.lines.some(line => diagramRows.has(line.byte_start))) continue;\n    processFlowBlock(data.buffer_id, block, measure, blockIndents);');
for (const name of ['after_insert', 'after_delete', 'buffer_closed']) {
  replace(`editor.on("${name}", (data) => {`,
    `editor.on("${name}", (data) => {\n  mermaidPreview.clear(data.buffer_id);${name === 'buffer_closed' ? '' : '\n  if (isComposingInAnySplit(data.buffer_id)) editor.refreshLines(data.buffer_id);'}`);
}
await writeFile('src/markdown_compose_extended.ts', source);
await copyFile(join(root, 'markdown_compose.i18n.json'), 'src/markdown_compose_extended.i18n.json');
await copyFile(join(root, 'lib/fresh.d.ts'), 'src/lib/fresh.d.ts');
