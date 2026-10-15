import { Graph } from './types';
import { Command } from './commands';

export interface HistoryState {
  present: Graph;
  past: Command[];
  future: Command[];
}

export function createHistory(initialGraph: Graph): HistoryState {
  return {
    present: initialGraph,
    past: [],
    future: [],
  };
}

export function execute(h: HistoryState, cmd: Command): HistoryState {
  return {
    present: cmd.do(h.present),
    past: [...h.past.slice(-199), cmd],
    future: [],
  };
}

export function undo(h: HistoryState): HistoryState {
  if (h.past.length === 0) return h;
  const cmd = h.past[h.past.length - 1];
  if (!cmd) return h;
  const newPast = h.past.slice(0, -1);
  return {
    present: cmd.undo(h.present),
    past: newPast,
    future: [cmd, ...h.future],
  };
}

export function redo(h: HistoryState): HistoryState {
  if (h.future.length === 0) return h;
  const cmd = h.future[0];
  if (!cmd) return h;
  const newFuture = h.future.slice(1);
  return {
    present: cmd.do(h.present),
    past: [...h.past.slice(-199), cmd],
    future: newFuture,
  };
}
