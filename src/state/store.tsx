import React, { createContext, useContext, useReducer } from 'react';
import { createHistory, HistoryState } from '../core/history';
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
  | { type: 'SET_UI'; payload: Partial<UIState> };

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_UI':
      return {
        ...state,
        ui: { ...state.ui, ...action.payload },
      };
    default:
      return state;
  }
}

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, {
    history: createHistory(createEmptyGraph()),
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
