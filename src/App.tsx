import React, { useState } from 'react';
import { StoreProvider, useStore } from './state/store';
import { Toolbar } from './components/Toolbar';
import { Palette } from './components/Palette';
import { Canvas } from './components/Canvas';
import { sampleInitialGraph } from './samples/sampleGraph';
import { instantiateNode } from './core/nodeTemplates';
import { AddNodeCommand, AddPortCommand, RemovePortCommand, ReplaceGraphCommand } from './core/commands';
import { newId, syncIdCounterWithGraph } from './core/id';
import { Graph, Port } from './core/types';
import { useDrag } from './hooks/useDrag';
import { useShortcuts } from './hooks/useShortcuts';
import { Toast } from './components/Toast';
import { ImportDialog } from './components/ImportDialog';
import { exportGraph } from './core/schema';
import exampleWorkflowJson from './samples/example.json';

const MainLayout: React.FC = () => {
  const { state, dispatch } = useStore();
  const { startDrag, onDragMove, endDrag } = useDrag();
  useShortcuts();

  const [isImportOpen, setIsImportOpen] = useState(false);

  const handleAddNodeFromPalette = (type: string) => {
    // drop new nodes roughly in the middle of what is on screen
    const vp = state.ui.viewport;
    const worldX = Math.round((-vp.x + 300) / vp.zoom);
    const worldY = Math.round((-vp.y + 200) / vp.zoom);
    const node = instantiateNode(type, worldX, worldY);
    dispatch({ type: 'EXECUTE', command: new AddNodeCommand(node) });
    dispatch({
      type: 'SET_UI',
      payload: { selection: { nodeIds: [node.id], edgeIds: [] } },
    });
  };

  const handleDropNode = (type: string, worldPos: { x: number; y: number }) => {
    const node = instantiateNode(type, worldPos.x, worldPos.y);
    dispatch({ type: 'EXECUTE', command: new AddNodeCommand(node) });
    dispatch({
      type: 'SET_UI',
      payload: { selection: { nodeIds: [node.id], edgeIds: [] } },
    });
  };

  const handleAddPort = (nodeId: string) => {
    const node = state.history.present.nodes[nodeId];
    if (!node) return;
    const portId = newId(`${nodeId}-port`);
    const newPort: Port = {
      id: portId,
      name: `Branch ${node.ports.filter((p) => p.direction === 'out').length + 1}`,
      direction: 'out',
      type: 'action',
      maxConnections: Infinity,
    };
    dispatch({ type: 'EXECUTE', command: new AddPortCommand(nodeId, newPort) });
  };

  const handleRemovePort = (nodeId: string, portId: string) => {
    dispatch({ type: 'EXECUTE', command: new RemovePortCommand(nodeId, portId) });
  };

  const handleSelectWire = (e: React.MouseEvent, edgeId: string) => {
    if (e.shiftKey) {
      const exists = state.ui.selection.edgeIds.includes(edgeId);
      dispatch({
        type: 'SET_UI',
        payload: {
          selection: {
            ...state.ui.selection,
            edgeIds: exists
              ? state.ui.selection.edgeIds.filter((id) => id !== edgeId)
              : [...state.ui.selection.edgeIds, edgeId],
          },
        },
      });
    } else {
      dispatch({
        type: 'SET_UI',
        payload: {
          selection: {
            nodeIds: [],
            edgeIds: [edgeId],
          },
        },
      });
    }
  };

  const handleLoadExample = () => {
    const exampleGraph: Graph = {
      nodes: {},
      edges: {},
    };
    for (const n of exampleWorkflowJson.nodes) {
      exampleGraph.nodes[n.id] = {
        id: n.id,
        type: n.type,
        label: n.label,
        x: n.position.x,
        y: n.position.y,
        ports: n.ports.map((p) => ({
          id: p.id,
          name: p.name,
          direction: p.direction as 'in' | 'out',
          type: p.type as import('./core/types').PortType,
          maxConnections: p.maxConnections ?? (p.direction === 'in' ? 1 : Infinity),
        })),
      };
    }
    for (const e of exampleWorkflowJson.edges) {
      exampleGraph.edges[e.id] = e;
    }

    syncIdCounterWithGraph(exampleGraph);
    dispatch({
      type: 'EXECUTE',
      command: new ReplaceGraphCommand(state.history.present, exampleGraph, 'Load example template'),
    });
    if (exampleWorkflowJson.viewport) {
      dispatch({
        type: 'SET_UI',
        payload: { viewport: exampleWorkflowJson.viewport },
      });
    }
  };

  const handleClear = () => {
    const emptyGraph: Graph = { nodes: {}, edges: {} };
    dispatch({
      type: 'EXECUTE',
      command: new ReplaceGraphCommand(state.history.present, emptyGraph, 'Clear canvas'),
    });
  };

  const handleFitToView = () => {
    const nodes = Object.values(state.history.present.nodes);
    if (nodes.length === 0) {
      dispatch({ type: 'SET_UI', payload: { viewport: { x: 0, y: 0, zoom: 1 } } });
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 200);
      maxY = Math.max(maxY, n.y + 160);
    }

    const padding = 80;
    const canvasEl = document.querySelector('.canvas');
    const width = canvasEl?.clientWidth ?? 1000;
    const height = canvasEl?.clientHeight ?? 700;

    const graphWidth = maxX - minX + padding * 2;
    const graphHeight = maxY - minY + padding * 2;

    const zoom = Math.min(1.5, Math.max(0.4, Math.min(width / graphWidth, height / graphHeight)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const vpX = Math.round(width / 2 - centerX * zoom);
    const vpY = Math.round(height / 2 - centerY * zoom);

    dispatch({
      type: 'SET_UI',
      payload: { viewport: { x: vpX, y: vpY, zoom } },
    });
  };

  const handleExport = () => {
    const exported = exportGraph(state.history.present, { name: 'Workflow Export' }, state.ui.viewport);
    const jsonStr = JSON.stringify(exported, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    dispatch({
      type: 'SET_UI',
      payload: {
        toast: { id: `toast-${Date.now()}`, kind: 'info', text: 'Downloaded workflow JSON!' },
      },
    });
  };

  const handleCopyJson = () => {
    const exported = exportGraph(state.history.present, { name: 'Workflow Export' }, state.ui.viewport);
    const jsonStr = JSON.stringify(exported, null, 2);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        dispatch({
          type: 'SET_UI',
          payload: {
            toast: { id: `toast-${Date.now()}`, kind: 'info', text: 'Copied JSON to clipboard!' },
          },
        });
      });
    }
  };

  const handleImportSuccess = (
    importedGraph: Graph,
    meta?: { name: string },
    importedViewport?: { x: number; y: number; zoom: number }
  ) => {
    syncIdCounterWithGraph(importedGraph);
    const label = `Import ${meta?.name ?? 'workflow'}`;
    dispatch({
      type: 'EXECUTE',
      command: new ReplaceGraphCommand(state.history.present, importedGraph, label),
    });

    if (importedViewport) {
      dispatch({
        type: 'SET_UI',
        payload: { viewport: importedViewport },
      });
    } else {
      setTimeout(handleFitToView, 50);
    }

    dispatch({
      type: 'SET_UI',
      payload: {
        toast: { id: `toast-${Date.now()}`, kind: 'info', text: `Successfully imported ${meta?.name ?? 'workflow'}!` },
      },
    });
  };

  return (
    <div className="app-shell">
      <Toolbar
        onExport={handleExport}
        onCopyJson={handleCopyJson}
        onImport={() => setIsImportOpen(true)}
        onLoadExample={handleLoadExample}
        onClear={handleClear}
        onFitToView={handleFitToView}
      />
      <div className="workspace">
        <Palette onAddNode={handleAddNodeFromPalette} />
        <main className="canvas-container">
          <Canvas
            onNodePointerDown={startDrag}
            onNodePointerMove={onDragMove}
            onNodePointerUp={endDrag}
            onAddPort={handleAddPort}
            onRemovePort={handleRemovePort}
            onSelectWire={handleSelectWire}
            onDropNode={handleDropNode}
          />
        </main>
      </div>
      <Toast />
      <ImportDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <StoreProvider initialGraph={sampleInitialGraph}>
      <MainLayout />
    </StoreProvider>
  );
};

export default App;
