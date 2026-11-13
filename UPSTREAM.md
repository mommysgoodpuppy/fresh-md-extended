# Upstream provenance

Initial source: sibling checkout `../fresh`, commit
`59f90b268bce807f2f856154ff02566d35262cf4`.

Compatibility correction: the preview source, translation sidecar and API
declarations were subsequently rebased on the actual installed **Fresh 0.5.3**
bundle `embedded-plugins/f9cd16fc7d5f286b`. The newer checkout's nullable conceal
arguments throw in this released runtime and interrupt table rendering. The
shipped plugin's optional arguments must be omitted, not passed as null. Its
compose toggle is retained; newer Rendered/Dual commands are not backported.

Copied paths:

- `crates/fresh-editor/plugins/markdown_compose.ts`
  → `src/markdown_compose_extended.ts`
- `crates/fresh-editor/plugins/markdown_compose.i18n.json`
  → `src/markdown_compose_extended.i18n.json`
- `crates/fresh-editor/plugins/lib/text.ts` → `src/lib/text.ts`
- `crates/fresh-editor/plugins/lib/fresh.d.ts` → `src/lib/fresh.d.ts`
- `LICENSE` → `LICENSE`

The fork retains upstream command handler names, translation keys, and decoration
namespaces. It must replace the bundled Compose plugin, not run alongside it.
The added integration points are import/initialization, compose cleanup,
lines_changed processing, edit invalidation, and buffer-close cleanup.

Renderer: `@glyphcss/diagrams` 0.3.1, pinned with transitive dependencies in
`package-lock.json`. Library source: https://github.com/apresmoi/glyphcss/tree/main/packages/diagrams

The originally discussed https://github.com/apresmoi/glyphcss-diagrams packages
agent skills and CLI bundles; this plugin uses the underlying library directly.
No agent skill or CLI is installed.

The initial in-process layout prototype froze on a real architecture document:
async library entry points still perform CPU-heavy layout on Fresh's shared
QuickJS thread. Rendering now lives exclusively in the companion Node process,
with a separate worker watchdog and cancellation on preview invalidation.
`tests/fixtures/architecture.md` contains only the six Mermaid fences extracted
from `C:/Git/petplay/docs/ARCHITECTURE.md` for local regression coverage.

Width handling differs deliberately from the shipped plugin: full pane width is
the default, and an object-wrapped width preference persists numeric widths and
None through Fresh's plugin-global state. Restored buffer widths cannot override
it. Renderer output permits up to 512 rows, so widening a diagram does not reject
the previously accepted graph. Process cancellation
uses `editor.killProcess(id)` because 0.5.3's handle `.kill()` wrapper can throw.

Version 0.2.0 bypasses `renderGlyphDiagram`'s fitting, simplification and splitting
pipeline. The Mermaid parser, Dagre layout, edge router and painter are reused
directly. Spacing and outside routing margins are increased until every edge can
be routed; otherwise the source stays visible. The full architecture graph has
13 nodes and 13 routed edges, with nine simultaneous outgoing MAIN ports. Its
canvas is invariant under pane resizing. Preview rows are clipped by terminal
columns, and Pan Diagrams Left/Right/Center commands move the horizontal view
without changing topology or prose layout.

Version 0.2.1 routes short internal connections first and restores authored
priorities for painting. The original routing order remains a fallback for
cyclic graphs. A conservative vertical compaction pass removes empty stretches
of straight connector, preserving nodes, labelled routes, turns, port clearance
and group corners; implicit self-loop geometry is left untouched. Regression
checks require the PostalService/main gap to be at most four rows and every
within-group connection in the first graph to remain inside its group.
