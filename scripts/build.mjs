import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/markdown_compose_extended.ts'],
  outfile: 'dist/markdown_compose_extended.js',
  bundle: true, format: 'esm', platform: 'neutral', target: 'es2022',
  legalComments: 'eof',
});
await build({
  entryPoints: ['src/renderer/runner.mjs'],
  outfile: 'dist/mermaid-renderer/runner.cjs',
  bundle: true, format: 'cjs', platform: 'node', target: 'node22', legalComments: 'eof',
});
await copyFile('src/markdown_compose_extended.i18n.json', 'dist/markdown_compose_extended.i18n.json');
await copyFile('LICENSE', 'dist/LICENSE');
const packages = ['@glyphcss/diagrams', '@glyphcss/core', 'glyphcss', '@dagrejs/dagre', '@dagrejs/graphlib'];
const notices = await Promise.all(packages.map(async name =>
  `${name}\n${await readFile(`node_modules/${name}/LICENSE`, 'utf8')}`));
await writeFile('dist/THIRD_PARTY_LICENSES.txt', notices.join('\n\n'));
