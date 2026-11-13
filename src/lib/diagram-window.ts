type Measure = (codePoint: number) => number;

export function sliceColumns(text: string, offset: number, width: number, measure: Measure): string {
  let column = 0, output = '', used = 0;
  for (const char of text) {
    const size = Math.max(0, measure(char.codePointAt(0)!));
    const start = column;
    column += size;
    if (column <= offset && size > 0) continue;
    if (start < offset) { output += ' '; used++; continue; }
    if (column > offset + width) break;
    if (size === 0 && !output) continue;
    output += char;
    used += size;
  }
  return output + ' '.repeat(Math.max(0, width - used));
}

export function diagramWindow(canvasWidth: number, paneWidth: number, requestedOffset: number | null) {
  const width = Math.max(8, paneWidth - 4);
  const overflowing = canvasWidth > width;
  const bodyWidth = overflowing ? width - 2 : width;
  const maxOffset = Math.max(0, canvasWidth - bodyWidth);
  const offset = requestedOffset === null ? Math.floor(maxOffset / 2)
    : Math.max(0, Math.min(maxOffset, requestedOffset));
  return { width, bodyWidth, offset, maxOffset, overflowing };
}

export function diagramRow(text: string, canvasWidth: number, paneWidth: number,
  requestedOffset: number | null, measure: Measure): string {
  const view = diagramWindow(canvasWidth, paneWidth, requestedOffset);
  const body = sliceColumns(text, view.offset, view.bodyWidth, measure);
  if (!view.overflowing) return body.trimEnd();
  return `${view.offset ? '‹' : ' '}${body}${view.offset < view.maxOffset ? '›' : ' '}`;
}
