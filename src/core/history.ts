import { Graph } from './types';
import { Command } from './commands';

export interface HistoryState {
  present: Graph;
  past: Command[];
  future: Command[];
}

export const MAX_HISTORY_LIMIT = 200;

export function createHistory(initialGraph: Graph): HistoryState {
  return {
    present: initialGraph,
    past: [],
    future: [],
  };
}

// past is capped at 200 so long sessions don't grow memory forever
export function execute(h: HistoryState, cmd: Command): HistoryState {
  const nextPresent = cmd.do(h.present);
  const nextPast = [...h.past.slice(-(MAX_HISTORY_LIMIT - 1)), cmd];
  return {
    present: nextPresent,
    past: nextPast,
    future: [], // a new edit kills the redo branch
  };
}

export function undo(h: HistoryState): HistoryState {
  if (h.past.length === 0) {
    return h;
  }
  const cmd = h.past[h.past.length - 1];
  if (!cmd) return h;

  const nextPresent = cmd.undo(h.present);
  const nextPast = h.past.slice(0, -1);
  return {
    present: nextPresent,
    past: nextPast,
    future: [cmd, ...h.future],
  };
}

export function redo(h: HistoryState): HistoryState {
  if (h.future.length === 0) {
    return h;
  }
  const cmd = h.future[0];
  if (!cmd) return h;

  const nextPresent = cmd.do(h.present);
  const nextFuture = h.future.slice(1);
  const nextPast = [...h.past.slice(-(MAX_HISTORY_LIMIT - 1)), cmd];

  return {
    present: nextPresent,
    past: nextPast,
    future: nextFuture,
  };
}

export function canUndo(h: HistoryState): boolean {
  return h.past.length > 0;
}

export function canRedo(h: HistoryState): boolean {
  return h.future.length > 0;
}

export function getUndoLabel(h: HistoryState): string | undefined {
  if (h.past.length === 0) return undefined;
  return h.past[h.past.length - 1]?.label;
}

export function getRedoLabel(h: HistoryState): string | undefined {
  if (h.future.length === 0) return undefined;
  return h.future[0]?.label;
}
