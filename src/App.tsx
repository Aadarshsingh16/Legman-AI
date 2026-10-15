import React from 'react';
import { StoreProvider, useStore } from './state/store';
import { Toolbar } from './components/Toolbar';
import { Palette } from './components/Palette';
import { Canvas } from './components/Canvas';
import { sampleInitialGraph } from './samples/sampleGraph';
import { instantiateNode } from './core/nodeTemplates';
import { AddNodeCommand, AddPortCommand, RemovePortCommand } from './core/commands';
import { newId } from './core/id';
import { Port } from './core/types';
import { useDrag } from './hooks/useDrag';
import { useShortcuts } from './hooks/useShortcuts';
import { Toast } from './components/Toast';

const MainLayout: React.FC = () => {
  const { state, dispatch } = useStore();
  const { startDrag, onDragMove, endDrag } = useDrag();
  useShortcuts();

  const handleAddNodeFromPalette = (type: string) => {
    // Add near center of current viewport
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
    dispatch({
      type: 'RESET_GRAPH',
      graph: sampleInitialGraph,
    });
  };

  const handleClear = () => {
    dispatch({
      type: 'RESET_GRAPH',
      graph: { nodes: {}, edges: {} },
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

  return (
    <div className="app-shell">
      <Toolbar
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
