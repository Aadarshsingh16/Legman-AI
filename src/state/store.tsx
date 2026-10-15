import React, { createContext, useContext, useReducer } from 'react';
import { createHistory, execute, undo, redo, HistoryState } from '../core/history';
import { createEmptyGraph } from '../core/graph';
import { initialUIState, UIState } from './ui';
import { Command } from '../core/commands';

export interface AppState {
  history: HistoryState;
  ui: UIState;
}

export type Action =
  | { type: 'EXECUTE'; command: Command }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_UI'; payload: Partial<UIState> }
  | { type: 'RESET_GRAPH'; graph: import('../core/types').Graph };

function pruneSelection(ui: UIState, graph: import('../core/types').Graph): UIState {
  const validNodeIds = ui.selection.nodeIds.filter((id) => Boolean(graph.nodes[id]));
  const validEdgeIds = ui.selection.edgeIds.filter((id) => Boolean(graph.edges[id]));
  if (
    validNodeIds.length === ui.selection.nodeIds.length &&
    validEdgeIds.length === ui.selection.edgeIds.length
  ) {
    return ui;
  }
  return {
    ...ui,
    selection: {
      nodeIds: validNodeIds,
      edgeIds: validEdgeIds,
    },
  };
}

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'EXECUTE': {
      const nextHistory = execute(state.history, action.command);
      const nextUI = pruneSelection(state.ui, nextHistory.present);
      return {
        ...state,
        history: nextHistory,
        ui: nextUI,
      };
    }
    case 'UNDO': {
      if (state.history.past.length === 0) return state;
      const undoneCmd = state.history.past[state.history.past.length - 1];
      const nextHistory = undo(state.history);
      const nextUI = pruneSelection(state.ui, nextHistory.present);
      return {
        ...state,
        history: nextHistory,
        ui: {
          ...nextUI,
          toast: {
            id: `toast-${Date.now()}`,
            kind: 'info',
            text: `Undid: ${undoneCmd?.label ?? 'Action'}`,
          },
        },
      };
    }
    case 'REDO': {
      if (state.history.future.length === 0) return state;
      const redoneCmd = state.history.future[0];
      const nextHistory = redo(state.history);
      const nextUI = pruneSelection(state.ui, nextHistory.present);
      return {
        ...state,
        history: nextHistory,
        ui: {
          ...nextUI,
          toast: {
            id: `toast-${Date.now()}`,
            kind: 'info',
            text: `Redid: ${redoneCmd?.label ?? 'Action'}`,
          },
        },
      };
    }
    case 'SET_UI': {
      return {
        ...state,
        ui: { ...state.ui, ...action.payload },
      };
    }
    case 'RESET_GRAPH': {
      return {
        history: createHistory(action.graph),
        ui: {
          ...state.ui,
          selection: { nodeIds: [], edgeIds: [] },
          draftWire: null,
          dragPositions: {},
        },
      };
    }
    default:
      return state;
  }
}

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export const StoreProvider: React.FC<{
  children: React.ReactNode;
  initialGraph?: import('../core/types').Graph;
}> = ({ children, initialGraph }) => {
  const [state, dispatch] = useReducer(appReducer, {
    history: createHistory(initialGraph ?? createEmptyGraph()),
    ui: initialUIState,
  });

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return ctx;
}
