/// <reference path="./fresh.d.ts" />
type WidthState = Pick<EditorAPI, 'getGlobalState' | 'setGlobalState'>;
const KEY = 'composeWidthPreference';

export function loadComposeWidth(editor: WidthState): number | null {
  const saved = editor.getGlobalState(KEY) as { width?: unknown } | null;
  const width = saved && typeof saved === 'object' ? saved.width : undefined;
  return typeof width === 'number' && Number.isInteger(width) && width > 20 && width < 300
    ? width : null;
}

export function saveComposeWidth(editor: WidthState, width: number | null): void {
  // Passing null directly deletes a global-state key in Fresh. Keep None in an
  // object so it survives restarts and wins over old per-buffer session widths.
  editor.setGlobalState(KEY, { width });
}
