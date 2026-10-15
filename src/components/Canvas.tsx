import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useStore } from '../state/store';
import { Wire } from './Wire';
import { NodeView } from './NodeView';
import { DraftWire } from './DraftWire';
import { Edge, PortRef } from '../core/types';
import { canConnect, validTargets } from '../core/validation';
import { AddEdgeCommand } from '../core/commands';
import { newId } from '../core/id';

export interface CanvasProps {
  onNodePointerDown?: (e: React.PointerEvent, nodeId: string) => void;
  onNodePointerMove?: (e: React.PointerEvent) => void;
  onNodePointerUp?: (e: React.PointerEvent) => void;
  onAddPort?: (nodeId: string) => void;
  onRemovePort?: (nodeId: string, portId: string) => void;
  onSelectWire?: (e: React.MouseEvent, edgeId: string) => void;
  onDropNode?: (templateType: string, worldPos: { x: number; y: number }) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  onNodePointerDown,
  onNodePointerMove,
  onNodePointerUp,
  onAddPort,
  onRemovePort,
  onSelectWire,
  onDropNode,
}) => {
  const { state, dispatch } = useStore();
  const { history, ui } = state;
  const graph = history.present;
  const vp = ui.viewport;

  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ pointerX: number; pointerY: number; vpX: number; vpY: number } | null>(null);

  const draftWireActiveRef = useRef<boolean>(false);
  draftWireActiveRef.current = Boolean(ui.draftWire);

  // ports we could legally drop on, so they can light up while dragging
  const activeValidTargets = useMemo(() => {
    if (!ui.draftWire) return undefined;
    return validTargets(graph, ui.draftWire.from);
  }, [graph, ui.draftWire]);

  // pressing on a port starts a new wire
  const handlePortPointerDown = (e: React.PointerEvent, portRef: PortRef) => {
    e.stopPropagation();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const wx = (e.clientX - rect.left - vp.x) / vp.zoom;
    const wy = (e.clientY - rect.top - vp.y) / vp.zoom;

    try {
      containerRef.current.setPointerCapture(e.pointerId);
    } catch {
      // can throw on synthetic events, safe to ignore
    }

    dispatch({
      type: 'SET_UI',
      payload: {
        draftWire: {
          from: portRef,
          cursor: { x: wx, y: wy },
          hover: undefined,
        },
      },
    });
  };

  // background press = pan + clear selection
  const handlePointerDown = (e: React.PointerEvent) => {
    const isDirectCanvas =
      e.target === containerRef.current ||
      (e.target as HTMLElement).classList.contains('canvas') ||
      (e.target as HTMLElement).classList.contains('world') ||
      (e.target as HTMLElement).classList.contains('wires-svg');

    if (isDirectCanvas || e.button === 1) {
      if (!containerRef.current) return;
      try {
        containerRef.current.setPointerCapture(e.pointerId);
      } catch {
        // can throw on synthetic events, safe to ignore
      }
      setIsPanning(true);
      panStartRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        vpX: vp.x,
        vpY: vp.y,
      };

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
    if (ui.draftWire && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const wx = (e.clientX - rect.left - vp.x) / vp.zoom;
      const wy = (e.clientY - rect.top - vp.y) / vp.zoom;

      // figure out which port (if any) is under the cursor
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const portEl = el?.closest('.port') as HTMLElement | null;

      let hoverInfo = undefined;
      if (portEl) {
        const targetPortId = portEl.getAttribute('data-port-id');
        const targetNodeId = portEl.getAttribute('data-node-id');

        if (
          targetPortId &&
          targetNodeId &&
          !(targetPortId === ui.draftWire.from.portId && targetNodeId === ui.draftWire.from.nodeId)
        ) {
          const candidateRef: PortRef = { nodeId: targetNodeId, portId: targetPortId };
          const check = canConnect(graph, ui.draftWire.from, candidateRef);
          hoverInfo = {
            port: candidateRef,
            ok: check.ok,
            reason: check.ok ? undefined : check.reason,
          };
        }
      }

      dispatch({
        type: 'SET_UI',
        payload: {
          draftWire: {
            ...ui.draftWire,
            cursor: { x: wx, y: wy },
            hover: hoverInfo,
          },
        },
      });
      return;
    }

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
    if (ui.draftWire) {
      try {
        containerRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }

      if (ui.draftWire.hover) {
        if (ui.draftWire.hover.ok) {
          const check = canConnect(graph, ui.draftWire.from, ui.draftWire.hover.port);
          if (check.ok) {
            const newEdge: Edge = {
              id: newId('edge'),
              source: check.source,
              target: check.target,
            };
            dispatch({
              type: 'EXECUTE',
              command: new AddEdgeCommand(newEdge),
            });
          }
        } else if (ui.draftWire.hover.reason) {
          // dropped on a port we can't connect to, tell the user why
          dispatch({
            type: 'SET_UI',
            payload: {
              toast: {
                id: newId('toast'),
                kind: 'error',
                text: ui.draftWire.hover.reason,
              },
            },
          });
        }
      }

      dispatch({
        type: 'SET_UI',
        payload: { draftWire: null },
      });
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      try {
        containerRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
    }
  };

  // React's onWheel is passive, so we can't preventDefault there - attach it manually
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

  let draftWireSourceNode = null;
  let draftWireSourcePort = null;
  if (ui.draftWire) {
    draftWireSourceNode = graph.nodes[ui.draftWire.from.nodeId] ?? null;
    draftWireSourcePort =
      draftWireSourceNode?.ports.find((p) => p.id === ui.draftWire?.from.portId) ?? null;
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const templateType = e.dataTransfer.getData('text/plain');
    if (!templateType || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    let dropX = (e.clientX - rect.left - vp.x) / vp.zoom;
    let dropY = (e.clientY - rect.top - vp.y) / vp.zoom;

    if (ui.snap) {
      dropX = Math.round(dropX / 20) * 20;
      dropY = Math.round(dropY / 20) * 20;
    } else {
      dropX = Math.round(dropX);
      dropY = Math.round(dropY);
    }

    onDropNode?.(templateType, { x: dropX, y: dropY });
  };

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
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className="world"
        style={{
          transform: `translate3d(${vp.x}px, ${vp.y}px, 0) scale(${vp.zoom})`,
        }}
      >
        {/* wires */}
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

        {/* nodes */}
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
                validTargetPortIds={activeValidTargets}
                activeDraftWire={Boolean(ui.draftWire)}
                onNodePointerDown={onNodePointerDown}
                onNodePointerMove={onNodePointerMove}
                onNodePointerUp={onNodePointerUp}
                onPortPointerDown={handlePortPointerDown}
                onAddPort={onAddPort}
                onRemovePort={onRemovePort}
              />
            );
          })}
        </div>
      </div>

      {nodes.length === 0 && (
        <div className="canvas-empty-hint">
          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>Workflow is empty</p>
          <p style={{ fontSize: '13px', maxWidth: '320px', lineHeight: 1.5 }}>
            Drag a node from the left palette to start building, then connect output → input ports.
          </p>
        </div>
      )}

      {/* explains why the hovered port is off-limits */}
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
