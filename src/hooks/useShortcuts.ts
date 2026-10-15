import { useEffect } from 'react';
import { useStore } from '../state/store';
import { BatchCommand, RemoveEdgesCommand, RemoveNodesCommand } from '../core/commands';

export function useShortcuts() {
  const { state, dispatch } = useStore();
  const { history, ui } = state;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // don't hijack Backspace / Ctrl+Z while the user is typing
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

      // undo
      if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        return;
      }

      // redo - Ctrl+Y, or Ctrl+Shift+Z for mac habits
      if (
        (cmdOrCtrl && e.key.toLowerCase() === 'y') ||
        (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
        return;
      }

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

      // delete everything selected as a single undo step
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const hasSelectedNodes = ui.selection.nodeIds.length > 0;
        const hasSelectedEdges = ui.selection.edgeIds.length > 0;

        if (hasSelectedNodes || hasSelectedEdges) {
          e.preventDefault();

          if (hasSelectedNodes && hasSelectedEdges) {
            // edges on deleted nodes go away with the node anyway
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
