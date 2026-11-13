# Mermaid preview smoke test

Use Markdown Rendered or Dual mode. Text before and after each diagram should
remain visible. Editing a label in the source pane should update the diagram.

## Flowchart

```mermaid
flowchart LR
  A[Write Markdown] --> B[Render diagram]
  B --> C[Preview in Fresh]
```

This paragraph should appear below the flowchart.

## Sequence

```mermaid
sequenceDiagram
  User->>Fresh: Edit Markdown
  Fresh->>Renderer: Mermaid source
  Renderer-->>Fresh: Unicode diagram
```

This paragraph should appear below the sequence.

## Failed input stays editable

```mermaid
not a valid diagram
```

## Ordinary code is unchanged

```typescript
const message = 'Hello, Fresh';
```
