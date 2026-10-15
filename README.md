# Workflow Builder

A node-based workflow editor. Drag nodes onto a grid, connect their ports with wires, undo/redo anything, and export/import the workflow as JSON.

Built with React 18, TypeScript and Vite. The canvas, wire routing, validation and history are written from scratch (no React Flow / D3 / graph libraries).

## Getting started

Requires Node.js 18+.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # run the test suite
npm run build    # type-check + production build
```

## Features

| Requirement | How it works | Code |
|---|---|---|
| Bezier / orthogonal connectors | Wires are SVG paths computed from node positions, so they redraw smoothly while you drag. Toggle the style from the toolbar. | [geometry.ts](src/core/geometry.ts), [Wire.tsx](src/components/Wire.tsx) |
| Port matching rules | Ports are typed. Incompatible types, output→output, self-connections, duplicate wires, a second wire into a single input, and cycles are all blocked, with a tooltip saying why. | [validation.ts](src/core/validation.ts) |
| Undo / redo | Command pattern. Every change (add, move, delete, connect, add/remove port, rename, import) is a command with `do` / `undo`. A whole drag counts as one step. | [commands.ts](src/core/commands.ts), [history.ts](src/core/history.ts) |
| Export / import JSON | Export downloads or copies the graph as JSON. Import validates the JSON and lists every error before loading. | [schema.ts](src/core/schema.ts), [ImportDialog.tsx](src/components/ImportDialog.tsx) |

## Using the editor

- **Add a node:** drag it from the left palette onto the canvas (or click it).
- **Connect:** drag from one port to another. Valid targets light up while you drag.
- **Add / remove ports:** click *+ Add output* on a node; ports you added can be removed again.
- **Select:** click a node or wire, Shift+click to select several.
- **Pan / zoom:** drag the empty background / mouse wheel.
- **Example:** click *Load example* in the toolbar to see a ready-made workflow.

### Shortcuts

| Keys | Action |
|---|---|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Delete` / `Backspace` | Delete selection |
| `Escape` | Cancel wire / clear selection |

## Port rules

| Output type | Can connect to input type |
|---|---|
| `trigger` | `action` |
| `action` | `action` |
| `data` | `data` |

Inputs take one wire by default; outputs take any number. Workflows must stay acyclic.

## JSON format

```json
{
  "version": 1,
  "meta": { "name": "Order Notification Workflow" },
  "nodes": [
    {
      "id": "node-webhook",
      "type": "webhook",
      "label": "Webhook Trigger",
      "position": { "x": 80, "y": 140 },
      "ports": [
        { "id": "wh-out", "name": "Trigger", "direction": "out", "type": "trigger", "maxConnections": null }
      ]
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": { "nodeId": "node-webhook", "portId": "wh-out" },
      "target": { "nodeId": "node-http", "portId": "http-in" }
    }
  ]
}
```

`maxConnections: null` means unlimited. A full example is in [src/samples/example.json](src/samples/example.json).

## Project structure

```
src/
  core/        pure logic, no React: types, geometry, validation, commands, history, schema
  state/       app store (useReducer + context) and UI-only state
  components/  canvas, nodes, ports, wires, toolbar, palette, import dialog
  hooks/       node dragging, keyboard shortcuts
tests/         unit tests for the core logic
```

## Assumptions

- Pan and zoom are view settings, so they are not part of undo history.
- Importing a workflow is a single undoable step.
- Undo history keeps the last 200 steps.
