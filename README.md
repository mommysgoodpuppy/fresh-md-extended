# Fresh Markdown Extended

A standalone fork of Fresh's bundled Markdown Compose plugin, adding inline
Unicode Mermaid diagrams through `@glyphcss/diagrams`. No upstream Fresh changes
are needed. This is an initial prototype, not a published package.

## Build

Use Node.js 22.18+ (24+ recommended) for development:

```sh
npm ci
npm test
npm run typecheck
```

`npm test` builds the plugin and tests parsing, rendering, preview lifecycle,
and verifying that the distribution bundle delegates layout from QuickJS to a
separate process. A watchdog test kills an infinitely busy worker, and regression
tests render the six diagrams from the document that exposed the original freeze.
The build creates `dist/markdown_compose_extended.js` and its translation sidecar.
All renderer dependencies are bundled. **Node.js 22+ must be on Fresh's PATH at
runtime**; rendering requires no package installation or network access.

## Try it in Fresh

1. Merge the following into Fresh's `config.json`, keeping your other settings:

   ```json
   {
     "plugins": {
       "markdown_compose": { "enabled": false },
       "markdown_compose_extended": { "enabled": true }
     }
   }
   ```

2. Copy the contents of `dist/` into your Fresh configuration directory's
   `plugins/` folder. Use your actual configuration location (platform dependent).
   The JavaScript file and its `.i18n.json` sidecar must stay together. Also copy
   the entire `mermaid-renderer/` directory: it contains the companion Node
   renderer. Fresh does not load its `.cjs` file as a plugin.
3. Restart Fresh. Do not enable both Compose plugins: they register the same
   commands and handlers, intentionally preserving existing keyboard bindings.
4. Open `examples/mermaid.md` and run **Markdown: Toggle Compose/Preview**.
   Toggle it again to return to source and edit diagrams. Updates are rendered
   asynchronously after source edits.

For broader coverage, open [examples/advanced.md](examples/advanced.md): eight
diagrams exercise grouped services, deployment recovery, state cycles, sequences,
class and ER relationships, reverse layouts, and node shapes, followed by an
intentional failure to check source fallback and ordinary Markdown formatting.

For a temporary development session, first install the companion renderer as above,
disable the bundled plugin, open the saved
`dist/markdown_compose_extended.js` file in Fresh, and run **Load Plugin from
Buffer**. Keep the translation file beside it.

`markdown_source` and `markdown_toc` can remain enabled. To revert, remove the
extended plugin files, re-enable `markdown_compose`, and restart Fresh.

Preview defaults to the full pane width. **Set Compose Width** saves both numeric
widths and **None** (full width) across restarts. A stale width from a restored
buffer cannot override that preference. Diagrams refresh as their new layout
finishes; changing widths can take a few seconds for complex graphs.

Graphs keep their full topology on one canvas. Wide diagrams initially show the
center of the canvas, with `‹` / `›` at the hidden edges. Use these command-palette
commands to move horizontally without wrapping the diagram or changing prose:

- **Markdown: Pan Diagrams Left** / **Markdown: Pan Diagrams Right** (32 columns).
- **Markdown: Center Diagrams** (restore the centered view).

The header shows the visible columns. You can assign those commands shortcuts
through Fresh's keybinding settings. Panning changes the view, not the graph.

## Prototype scope

- Complete top-level backtick or tilde fences with the exact language `mermaid`.
- Graph diagram types supported by glyphcss 0.3.1, plus sequence diagrams using
  its separate renderer. This is a Mermaid subset, not full Mermaid.js parity.
- Invalid or unsupported input stays visible as a normal fenced code block;
  diagnostic details go to Fresh's debug log.
- Layout runs in a separate Node process and worker thread, with a three-second
  timeout and a 128 MiB worker heap limit. An edit, mode cleanup, or buffer close
  cancels the active process. Failed or timed-out diagrams retain their source.
- Graphs use the Mermaid parser, Dagre layout, port reservation, edge routing,
  and painter directly. No node collapsing or graph-panel splitting is used.
  Spacing grows as needed to route all edges; a graph that cannot be fully
  routed stays as source. Sequence diagrams use glyphcss's sequence renderer.
- Short internal connections are routed before cross-group connections to
  avoid unnecessary trips outside group borders. After routing, excess rows
  and columns of straight wire are removed while retaining nodes, labels, port
  clearance, turns, and border corners. Complex fan-outs keep the space they need.
- Flowcharts retain source ordering through layout, resolve mirrored sibling
  rows, and exchange equal-size siblings when that shortens their connections.
  The architecture fixture's sibling order is checked against the Mermaid view
  bundled with VS Code's xlsx-viewer 2.0.4.
- Graph canvases can exceed the pane width; rows are clipped and panned rather
  than wrapped. The raw canvas is bounded to 1,024 columns, 512 rows and 262,144
  cells before routing. Excess exterior margins are trimmed after painting.
- Nested list and blockquote fences are not supported yet.
- The prototype scans at most 1 MiB of Markdown, tries at most 64 diagram blocks,
  and skips blocks longer than 4,096 UTF-16 code units or results taller than 512
  rows. Input limits also keep Windows process arguments below its command limit.
- Diagram replacement is preview-only. Cursor-based source reveal inside a
  rendered diagram is not implemented; toggle back to source to edit it.
- Every edit invalidates the diagram cache and refreshes the preview. Fine-grained
  invalidation, very large documents, and per-pane width differences need more work.

The compatibility baseline is **Fresh 0.5.3's shipped Markdown plugin and API**,
not the newer source checkout. Automated tests cover QuickJS delegation and the
isolated Node renderer. `scripts/check-live-preview.mjs PORT` additionally checks
rendered table cells, a Mermaid diagram, and source/preview toggling against a
dedicated Fresh `--web` test session displaying the architecture regression file.
It sends viewport and toggle actions, so do not point it at your working session.

## Source and licensing

`src/markdown_compose_extended.ts` is the fork; preview additions live in
`src/lib/mermaid*.ts`, with layout in `src/lib/render-mermaid.ts` and process
isolation in `src/renderer/`.
`src/lib/text.ts`, the API type declarations, and translations are copied from
Fresh. See [UPSTREAM.md](UPSTREAM.md) for provenance.

Fresh-derived code is distributed under the copied GPLv3 license in `LICENSE`.
Glyphcss and Dagre retain their own licenses, included in
`dist/THIRD_PARTY_LICENSES.txt` by the build. This repository does not install or
modify your Fresh configuration automatically.
