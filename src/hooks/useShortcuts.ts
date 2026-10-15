import { useEffect } from 'react';
import { useStore } from '../state/store';
import { BatchCommand, RemoveEdgesCommand, RemoveNodesCommand } from '../core/commands';

export function useShortcuts() {
  const { state, dispatch } = useStore();
  const { history, ui } = state;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if typing in an input, textarea, or contentEditable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Undo: Ctrl+Z / Cmd+Z (without Shift)
      if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z / Cmd+Shift+Z
      if (
        (cmdOrCtrl && e.key.toLowerCase() === 'y') ||
        (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
        return;
      }

      // Escape: cancel draft wire or clear selection
      if (e.key === 'Escape') {
        e.preventDefault();
        dispatch({
          type: 'SET_UI',
          payload: {
            draftWire: null,
            selection: { nodeIds: [], edgeIds: [] },
          },
        });
        return;
      }

      // Delete / Backspace: remove selected nodes and edges in ONE atomic command
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const hasSelectedNodes = ui.selection.nodeIds.length > 0;
        const hasSelectedEdges = ui.selection.edgeIds.length > 0;

        if (hasSelectedNodes || hasSelectedEdges) {
          e.preventDefault();

          if (hasSelectedNodes && hasSelectedEdges) {
            // Find edges not connected to any selected node
            const independentEdgeIds = ui.selection.edgeIds.filter((edgeId) => {
              const edge = history.present.edges[edgeId];
              if (!edge) return false;
              return (
                !ui.selection.nodeIds.includes(edge.source.nodeId) &&
                !ui.selection.nodeIds.includes(edge.target.nodeId)
              );
            });

            const commands: import('../core/commands').Command[] = [
              new RemoveNodesCommand(ui.selection.nodeIds),
            ];
            if (independentEdgeIds.length > 0) {
              commands.push(new RemoveEdgesCommand(independentEdgeIds));
            }

            dispatch({
              type: 'EXECUTE',
              command:
                commands.length > 1
                  ? new BatchCommand('Delete selection', commands)
                  : commands[0]!,
            });
          } else if (hasSelectedNodes) {
            dispatch({
              type: 'EXECUTE',
              command: new RemoveNodesCommand(ui.selection.nodeIds),
            });
          } else if (hasSelectedEdges) {
            dispatch({
              type: 'EXECUTE',
              command: new RemoveEdgesCommand(ui.selection.edgeIds),
            });
          }

          dispatch({
            type: 'SET_UI',
            payload: {
              selection: { nodeIds: [], edgeIds: [] },
            },
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [history, ui.selection, dispatch]);
}
