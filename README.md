# Workflow Builder

A performant, zero-dependency node-based workflow and diagram editor built with React 18, TypeScript (strict), Vite, and Vitest. Designed from first principles without heavy third-party canvas or diagram libraries (no React Flow, no D3, no graph libraries), featuring dynamic Bezier/Orthogonal connectors, typed port validation with cycle prevention, a pure command-pattern time-travel history engine, and robust JSON graph serialization.

---

## 1. Overview & Key Capabilities

Workflow Builder provides a responsive canvas interface allowing users to assemble, configure, and inspect event-driven pipelines:
- **Dynamic Bezier & Orthogonal Connectors**: Live SVG path recalculation as nodes move, maintaining smooth curves even when target ports sit behind source ports.
- **Strict Port Matching & Cycle Prevention**: Typed ports (`trigger`, `action`, `data`) with compatibility enforcement and real-time DFS cycle detection.
- **Time-Travel State Engine**: Complete Command-Pattern undo/redo history tracking node movements, connections, dynamic port changes, and batch deletions.
- **Deterministic Schema IO**: Versioned JSON schema serialization with comprehensive error reporting for import/export round-trips.

---

## 2. Setup & Running Instructions

### Prerequisites
- **Node.js**: $\ge 18.0.0$
- **npm**: $\ge 9.0.0$

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Run Test Suite
```bash
npm run test
```
Executes all 59 unit and integration tests across 6 suites with Vitest and JSDOM.

### Production Build
```bash
npm run build
```
Type-checks with strict TypeScript compiler options (`noUncheckedIndexedAccess: true`) and bundles production assets with Vite.

### Linting / Type Checking
```bash
npm run lint
```

---

## 3. Features Mapped 1:1 to Requirements

| Requirement | Implementation Detail | Source Location |
|---|---|---|
| **1. Dynamic Bezier / Orthogonal Connectors** | Math-based port coordinate calculation; cubic Bezier curves with minimum offset $dx \ge 50$ for reverse S-loops; orthogonal routing with quadratic rounded corners; live drag updates with zero latency. | [`src/core/geometry.ts`](file:///c:/projects/Legman-AI/src/core/geometry.ts), [`src/components/Wire.tsx`](file:///c:/projects/Legman-AI/src/components/Wire.tsx) |
| **2. Port Matching Rules & Validation** | Pure validation pipeline normalizing directions; type compatibility matrix; self-loop blocking; `maxConnections` tracking; DFS cycle prevention; visual glow/dim feedback and hover error tooltips. | [`src/core/validation.ts`](file:///c:/projects/Legman-AI/src/core/validation.ts), [`src/core/constants.ts`](file:///c:/projects/Legman-AI/src/core/constants.ts) |
| **3. Time-Travel State Engine** | Pure immutable Command Pattern with `do` and `undo`; captures inverse deltas on construction; drag coalescing (one commit on pointer release); stack capped at 200; `Ctrl+Z` / `Ctrl+Y` shortcuts with toast feedback. | [`src/core/commands.ts`](file:///c:/projects/Legman-AI/src/core/commands.ts), [`src/core/history.ts`](file:///c:/projects/Legman-AI/src/core/history.ts), [`src/state/store.tsx`](file:///c:/projects/Legman-AI/src/state/store.tsx) |
| **4. Export / Import Schema** | Schema v1 with sorted node/edge arrays for stable diffs; `Infinity` $\leftrightarrow$ `null` connection mapping; non-throwing multi-error schema parser; clipboard copy and file upload/download. | [`src/core/schema.ts`](file:///c:/projects/Legman-AI/src/core/schema.ts), [`src/components/ImportDialog.tsx`](file:///c:/projects/Legman-AI/src/components/ImportDialog.tsx) |

---

## 4. Architecture Summary & State Management

```
src/
├── core/                     # Pure TypeScript (Zero React dependencies)
│   ├── types.ts              # Domain entities: Graph, WorkflowNode, Port, Edge
│   ├── constants.ts          # Dimensions (NODE_W, ROW_H) and COMPATIBLE matrix
│   ├── nodeTemplates.ts      # Standard node definitions (Webhook, HTTP, Condition...)
│   ├── geometry.ts           # Pure port position math, Bezier & Orthogonal routing
│   ├── validation.ts         # canConnect(), wouldCreateCycle(), validTargets()
│   ├── commands.ts           # 10 Immutable Command implementations
│   ├── history.ts            # Time-travel history state machine (past/present/future)
│   ├── schema.ts             # JSON exportGraph() & multi-error parseGraph()
│   └── id.ts                 # Collision-free ID generation & counter synchronization
├── state/
│   ├── store.tsx             # useReducer + Context, selection sanitizer
│   └── ui.ts                 # UI-only state (viewport, draftWire, dragPositions, toast)
├── components/
│   ├── Canvas.tsx            # Viewport coordinate transformations, pan/zoom, dot grid
│   ├── NodeView.tsx          # Node card body, dynamic ports, category stripes
│   ├── PortView.tsx          # Typed port dots, hover states, remove buttons
│   ├── Wire.tsx              # Committed SVG wire paths + 14px hit-testing area
│   ├── DraftWire.tsx         # In-progress interactive connector path
│   ├── Palette.tsx           # Drag-to-canvas / click-to-add node sidebar
│   ├── Toolbar.tsx           # History controls, connector modes, snap, theme toggle
│   ├── Toast.tsx             # Animated feedback toasts
│   └── ImportDialog.tsx      # Modal with paste, file upload, and validation list
└── hooks/
    ├── useDrag.ts            # Pointer capture node drag with grid snapping
    └── useShortcuts.ts       # Global keybindings (Ctrl+Z, Ctrl+Y, Delete, Escape)
```

### Why the Command Pattern?
1. **Delta Memory Efficiency**: Rather than snapshotting entire graph trees on every action, each Command (`AddNode`, `MoveNodes`, `RemoveNodes`, `AddEdge`, `RemovePort`, etc.) encapsulates only the minimal forward and inverse state deltas.
2. **Composite Inversion**: Deleting a node automatically records all attached edges; calling `.undo()` restores both the node and its connections in a single atomic step.
3. **Strict Separation of Concerns**: Canvas rendering, pan/zoom viewports, and transient drag coordinates are UI state, completely decoupled from domain history.

---

## 5. Port Compatibility Matrix & Cycle Policy

### Port Types
- `trigger`: Emitted by trigger nodes (e.g. Webhook, Schedule).
- `action`: Control flow connections between actions (e.g. HTTP, Condition, Email).
- `data`: Data payload output/input (e.g. Transform).

### Compatibility Matrix (`COMPATIBLE`)
| Source (Output) | Allowed Target (Input) | Notes |
|---|---|---|
| `trigger` | `action` | Trigger node feeds downstream action |
| `action` | `action` | Action feeds next action step |
| `data` | `data` | Data stream feeds data transformation |

All other combinations (such as `data → action`, `trigger → trigger`, `out → out`, or `in → in`) are prohibited with visible explanation tooltips.

### Cycle Policy
Workflows operate as **Directed Acyclic Graphs (DAGs)**. When a connection attempt is evaluated, a Depth-First Search (DFS) traverses forward from the candidate target node; if the source node is reachable, the connection is rejected with `"Would create a cycle"`. Valid non-cyclic diamond configurations ($A \to B, A \to C, B \to D, C \to D$) are fully supported without false positives.

---

## 6. JSON Graph Schema (v1)

```json
{
  "version": 1,
  "meta": {
    "name": "Order Notification Workflow",
    "exportedAt": "2026-10-15T12:00:00.000Z"
  },
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
  ],
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  }
}
```

- **Sorted Diff Stability**: Nodes and edges are sorted alphabetically by ID upon export.
- **Infinite Connections**: Uncapped connections are serialized as `null` and parsed as `Infinity`.

---

## 7. Keyboard Shortcuts

| Shortcut | Action | Scope |
|---|---|---|
| `Ctrl + Z` / `Cmd + Z` | Undo most recent action | Global |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo previously undone action | Global |
| `Delete` / `Backspace` | Delete selected nodes and wires | Global |
| `Escape` | Cancel active draft wire / Deselect items | Canvas |
| `Shift + Click` | Multi-select nodes or wires | Canvas |
| `Mouse Wheel` | Zoom in/out centered on cursor ($0.25\times - 2.0\times$) | Canvas |
| `Click + Drag Background` | Pan canvas viewport | Canvas |

---

## 8. Assumptions & Known Limitations

### Assumptions
- **Input Edge Capacity**: Input ports accept a maximum of 1 connection by default; output ports accept unlimited connections (`Infinity`).
- **DAG Workflow**: Cycles are prohibited to ensure predictable execution graphs.
- **Viewport Isolation**: Pan and zoom coordinates are viewport UI state and do not populate the undo/redo history stack.
- **Atomic Import**: Importing a workflow executes as a single undoable `ReplaceGraphCommand`.

### Known Limitations
- Touch device gestures (e.g. pinch-to-zoom) are functional via pointer events but desktop pointer navigation is prioritized.
- Minimap navigation is not implemented as part of the core 8-hour scope.

---

## 9. Future Roadmap
1. **Minimap Overview**: A scaled preview thumbnail in the bottom corner with interactive viewport rectangle navigation.
2. **Clipboard Copy/Paste**: Node duplication via `Ctrl+C` and `Ctrl+V` with coordinate offsets.
3. **Auto-Layout Algorithm**: Hierarchical Sugiyama or force-directed graph layout for tangled graphs.

---

## 10. AI Tool Disclosure

In accordance with project transparency guidelines, this project was architected, implemented, and tested in pair-programming collaboration using **Antigravity**.
