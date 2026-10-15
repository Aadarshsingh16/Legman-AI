import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { Wire } from './Wire';
import { NodeView } from './NodeView';
import { DraftWire } from './DraftWire';
import { PortRef } from '../core/types';

export interface CanvasProps {
  onNodePointerDown?: (e: React.PointerEvent, nodeId: string) => void;
  onNodePointerMove?: (e: React.PointerEvent) => void;
  onNodePointerUp?: (e: React.PointerEvent) => void;
  onPortPointerDown?: (e: React.PointerEvent, portRef: PortRef) => void;
  onPortPointerEnter?: (portRef: PortRef) => void;
  onPortPointerLeave?: (portRef: PortRef) => void;
  onAddPort?: (nodeId: string) => void;
  onRemovePort?: (nodeId: string, portId: string) => void;
  onSelectWire?: (e: React.MouseEvent, edgeId: string) => void;
  validTargetPortIds?: Set<string>;
}

export const Canvas: React.FC<CanvasProps> = ({
  onNodePointerDown,
  onNodePointerMove,
  onNodePointerUp,
  onPortPointerDown,
  onPortPointerEnter,
  onPortPointerLeave,
  onAddPort,
  onRemovePort,
  onSelectWire,
  validTargetPortIds,
}) => {
  const { state, dispatch } = useStore();
  const { history, ui } = state;
  const graph = history.present;
  const vp = ui.viewport;

  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ pointerX: number; pointerY: number; vpX: number; vpY: number } | null>(null);

  // Pan interactions
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only pan if clicking canvas background directly or middle click
    const isDirectCanvas =
      e.target === containerRef.current ||
      (e.target as HTMLElement).classList.contains('canvas') ||
      (e.target as HTMLElement).classList.contains('world') ||
      (e.target as HTMLElement).classList.contains('wires-svg');

    if (isDirectCanvas || e.button === 1) {
      if (!containerRef.current) return;
      containerRef.current.setPointerCapture(e.pointerId);
      setIsPanning(true);
      panStartRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        vpX: vp.x,
        vpY: vp.y,
      };

      // Deselect all on background click
      if (isDirectCanvas && !e.shiftKey) {
        dispatch({
          type: 'SET_UI',
          payload: {
            selection: { nodeIds: [], edgeIds: [] },
          },
        });
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.pointerX;
      const dy = e.clientY - panStartRef.current.pointerY;
      dispatch({
        type: 'SET_UI',
        payload: {
          viewport: {
            ...vp,
            x: Math.round(panStartRef.current.vpX + dx),
            y: Math.round(panStartRef.current.vpY + dy),
          },
        },
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      try {
        containerRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // ignore if already lost
      }
    }
  };

  // Attach non-passive wheel listener to allow e.preventDefault()
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const curZoom = ui.viewport.zoom;
      const newZoom = Math.min(2.0, Math.max(0.25, curZoom * zoomFactor));

      const newX = mouseX - (mouseX - ui.viewport.x) * (newZoom / curZoom);
      const newY = mouseY - (mouseY - ui.viewport.y) * (newZoom / curZoom);

      dispatch({
        type: 'SET_UI',
        payload: {
          viewport: {
            x: Math.round(newX),
            y: Math.round(newY),
            zoom: newZoom,
          },
        },
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, [ui.viewport, dispatch]);

  const nodes = Object.values(graph.nodes);
  const edges = Object.values(graph.edges);

  // Compute draft wire source node and port if drawing
  let draftWireSourceNode = null;
  let draftWireSourcePort = null;
  if (ui.draftWire) {
    draftWireSourceNode = graph.nodes[ui.draftWire.from.nodeId] ?? null;
    draftWireSourcePort =
      draftWireSourceNode?.ports.find((p) => p.id === ui.draftWire?.from.portId) ?? null;
  }

  return (
    <div
      ref={containerRef}
      className={`canvas ${isPanning ? 'panning' : ''}`}
      style={{
        backgroundImage: 'radial-gradient(var(--grid-dot) 1.2px, transparent 1.2px)',
        backgroundSize: `${20 * vp.zoom}px ${20 * vp.zoom}px`,
        backgroundPosition: `${vp.x}px ${vp.y}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className="world"
        style={{
          transform: `translate3d(${vp.x}px, ${vp.y}px, 0) scale(${vp.zoom})`,
        }}
      >
        {/* SVG Wires Layer */}
        <svg className="wires-svg" style={{ width: 1, height: 1 }}>
          {edges.map((edge) => {
            const sourceNode = graph.nodes[edge.source.nodeId];
            const targetNode = graph.nodes[edge.target.nodeId];
            if (!sourceNode || !targetNode) return null;

            const sourcePort = sourceNode.ports.find((p) => p.id === edge.source.portId);
            const targetPort = targetNode.ports.find((p) => p.id === edge.target.portId);
            if (!sourcePort || !targetPort) return null;

            const isSelected = ui.selection.edgeIds.includes(edge.id);

            return (
              <Wire
                key={edge.id}
                edge={edge}
                sourceNode={sourceNode}
                targetNode={targetNode}
                sourcePort={sourcePort}
                targetPort={targetPort}
                sourceOverridePos={ui.dragPositions[sourceNode.id]}
                targetOverridePos={ui.dragPositions[targetNode.id]}
                connectorMode={ui.connectorMode}
                isSelected={isSelected}
                onSelect={onSelectWire}
              />
            );
          })}

          {/* Draft Wire in progress */}
          {ui.draftWire && draftWireSourceNode && draftWireSourcePort && (
            <DraftWire
              fromNode={draftWireSourceNode}
              fromPort={draftWireSourcePort}
              cursor={ui.draftWire.cursor}
              connectorMode={ui.connectorMode}
              hoverStatus={ui.draftWire.hover}
            />
          )}
        </svg>

        {/* Nodes Layer */}
        <div className="nodes-layer">
          {nodes.map((node) => {
            const isSelected = ui.selection.nodeIds.includes(node.id);
            const isDragging = Boolean(ui.dragPositions[node.id]);

            return (
              <NodeView
                key={node.id}
                node={node}
                position={ui.dragPositions[node.id]}
                isSelected={isSelected}
                isDragging={isDragging}
                validTargetPortIds={validTargetPortIds}
                activeDraftWire={Boolean(ui.draftWire)}
                onNodePointerDown={onNodePointerDown}
                onNodePointerMove={onNodePointerMove}
                onNodePointerUp={onNodePointerUp}
                onPortPointerDown={onPortPointerDown}
                onPortPointerEnter={onPortPointerEnter}
                onPortPointerLeave={onPortPointerLeave}
                onAddPort={onAddPort}
                onRemovePort={onRemovePort}
              />
            );
          })}
        </div>
      </div>

      {/* Empty State Hint */}
      {nodes.length === 0 && (
        <div className="canvas-empty-hint">
          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>Workflow is empty</p>
          <p style={{ fontSize: '13px', maxWidth: '320px', lineHeight: 1.5 }}>
            Drag a node from the left palette to start building, then connect output → input ports.
          </p>
        </div>
      )}

      {/* Screen coordinate hover tooltip for invalid connection reason */}
      {ui.draftWire?.hover && !ui.draftWire.hover.ok && ui.draftWire.hover.reason && (
        <div
          className="cursor-tooltip"
          style={{
            left: `${ui.draftWire.cursor.x * vp.zoom + vp.x}px`,
            top: `${ui.draftWire.cursor.y * vp.zoom + vp.y}px`,
          }}
        >
          {ui.draftWire.hover.reason}
        </div>
      )}
    </div>
  );
};
