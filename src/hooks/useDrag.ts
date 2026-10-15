import { useRef, useCallback } from 'react';
import { useStore } from '../state/store';
import { MoveNodesCommand, NodeMove } from '../core/commands';
import { GRID_SIZE } from '../core/constants';

interface DragSession {
  pointerId: number;
  startPointer: { x: number; y: number };
  movingNodeIds: string[];
  initialPositions: Record<string, { x: number; y: number }>;
  hasMoved: boolean;
}

export function useDrag() {
  const { state, dispatch } = useStore();
  const sessionRef = useRef<DragSession | null>(null);

  const startDrag = useCallback(
    (e: React.PointerEvent, clickedNodeId: string) => {
      // left button / touch only
      if (e.button !== 0) return;

      const graph = state.history.present;
      const clickedNode = graph.nodes[clickedNodeId];
      if (!clickedNode) return;

      const isShift = e.shiftKey;
      const currentSelection = state.ui.selection.nodeIds;
      let nextSelection = currentSelection;

      if (isShift) {
        nextSelection = currentSelection.includes(clickedNodeId)
          ? currentSelection.filter((id) => id !== clickedNodeId)
          : [...currentSelection, clickedNodeId];

        dispatch({
          type: 'SET_UI',
          payload: {
            selection: {
              ...state.ui.selection,
              nodeIds: nextSelection,
            },
          },
        });
      } else if (!currentSelection.includes(clickedNodeId)) {
        nextSelection = [clickedNodeId];
        dispatch({
          type: 'SET_UI',
          payload: {
            selection: {
              edgeIds: [],
              nodeIds: nextSelection,
            },
          },
        });
      }

      // dragging a selected node drags the whole selection,
      // otherwise just this one
      const movingNodeIds = nextSelection.includes(clickedNodeId)
        ? nextSelection
        : [clickedNodeId];

      const initialPositions: Record<string, { x: number; y: number }> = {};
      for (const id of movingNodeIds) {
        const node = graph.nodes[id];
        if (node) {
          initialPositions[id] = { x: node.x, y: node.y };
        }
      }

      const targetEl = e.currentTarget as HTMLElement;
      try {
        targetEl.setPointerCapture(e.pointerId);
      } catch {
        // can throw on synthetic events, safe to ignore
      }

      sessionRef.current = {
        pointerId: e.pointerId,
        startPointer: { x: e.clientX, y: e.clientY },
        movingNodeIds,
        initialPositions,
        hasMoved: false,
      };
    },
    [state.history.present, state.ui.selection, dispatch]
  );

  const onDragMove = useCallback(
    (e: React.PointerEvent) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;

      const zoom = state.ui.viewport.zoom;
      const rawDx = (e.clientX - session.startPointer.x) / zoom;
      const rawDy = (e.clientY - session.startPointer.y) / zoom;

      if (!session.hasMoved && Math.hypot(rawDx, rawDy) < 3) {
        return;
      }

      session.hasMoved = true;
      const nextDragPositions: Record<string, { x: number; y: number }> = {};

      for (const id of session.movingNodeIds) {
        const initial = session.initialPositions[id];
        if (!initial) continue;

        let curX = initial.x + rawDx;
        let curY = initial.y + rawDy;

        if (state.ui.snap) {
          curX = Math.round(curX / GRID_SIZE) * GRID_SIZE;
          curY = Math.round(curY / GRID_SIZE) * GRID_SIZE;
        }

        nextDragPositions[id] = { x: curX, y: curY };
      }

      dispatch({
        type: 'SET_UI',
        payload: { dragPositions: nextDragPositions },
      });
    },
    [state.ui.viewport.zoom, state.ui.snap, dispatch]
  );

  const endDrag = useCallback(
    (e: React.PointerEvent) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;

      sessionRef.current = null;
      const targetEl = e.currentTarget as HTMLElement;
      try {
        targetEl.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }

      if (session.hasMoved) {
        const moves: NodeMove[] = [];
        const zoom = state.ui.viewport.zoom;
        const rawDx = (e.clientX - session.startPointer.x) / zoom;
        const rawDy = (e.clientY - session.startPointer.y) / zoom;

        for (const id of session.movingNodeIds) {
          const initial = session.initialPositions[id];
          if (!initial) continue;

          let finalX = initial.x + rawDx;
          let finalY = initial.y + rawDy;

          if (state.ui.snap) {
            finalX = Math.round(finalX / GRID_SIZE) * GRID_SIZE;
            finalY = Math.round(finalY / GRID_SIZE) * GRID_SIZE;
          } else {
            finalX = Math.round(finalX);
            finalY = Math.round(finalY);
          }

          if (finalX !== initial.x || finalY !== initial.y) {
            moves.push({
              id,
              from: initial,
              to: { x: finalX, y: finalY },
            });
          }
        }

        dispatch({
          type: 'SET_UI',
          payload: { dragPositions: {} },
        });

        // one history entry per drag, not one per mousemove
        if (moves.length > 0) {
          dispatch({
            type: 'EXECUTE',
            command: new MoveNodesCommand(moves),
          });
        }
      } else {
        dispatch({
          type: 'SET_UI',
          payload: { dragPositions: {} },
        });
      }
    },
    [state.ui.viewport.zoom, state.ui.snap, dispatch]
  );

  return {
    startDrag,
    onDragMove,
    endDrag,
    isDragging: Boolean(sessionRef.current?.hasMoved),
  };
}
