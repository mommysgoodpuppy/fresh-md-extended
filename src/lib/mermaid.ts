import { byteLength } from './text.ts';

export interface DiagramBlock {
  source: string;
  lines: Array<{ start: number; content: string }>;
}

// Track every fence, so a Mermaid-looking example inside another code block
// cannot accidentally become a diagram. Nested list/blockquote fences are left
// to the upstream preview until their container semantics are implemented.
export function findMermaidBlocks(text: string): DiagramBlock[] {
  const blocks: DiagramBlock[] = [];
  let fence: { char: string; length: number; mermaid: boolean; lines: DiagramBlock['lines'] } | undefined;
  let offset = 0;
  for (const content of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const body = content.replace(/\r?\n$/, '');
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(body);
    if (!fence) {
      if (match && !(match[1][0] === '`' && match[2].includes('`'))) {
        fence = { char: match[1][0], length: match[1].length,
          mermaid: match[2].trim().toLowerCase() === 'mermaid',
          lines: [{ start: offset, content }] };
      }
    } else {
      fence.lines.push({ start: offset, content });
      if (match && match[1][0] === fence.char && match[1].length >= fence.length && !match[2].trim()) {
        if (fence.mermaid) blocks.push({
          source: fence.lines.slice(1, -1).map(line => line.content).join(''),
          lines: fence.lines,
        });
        fence = undefined;
      }
    }
    offset += byteLength(content);
  }
  return blocks;
}

