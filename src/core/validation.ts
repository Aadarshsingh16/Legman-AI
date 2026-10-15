import { Graph, PortRef } from './types';

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function canConnect(
  _graph: Graph,
  _a: PortRef,
  _b: PortRef
): ValidationResult {
  return { ok: true };
}

export function wouldCreateCycle(_graph: Graph, _sourceNodeId: string, _targetNodeId: string): boolean {
  return false;
}

export function validTargets(_graph: Graph, _fromPortRef: PortRef): Set<string> {
  return new Set<string>();
}
