import { Graph } from './types';

export interface WorkflowSchema {
  version: 1;
  meta: {
    name: string;
    exportedAt: string;
  };
  nodes: unknown[];
  edges: unknown[];
  viewport?: { x: number; y: number; zoom: number };
}

export function exportGraph(
  graph: Graph,
  meta?: { name?: string },
  viewport?: { x: number; y: number; zoom: number }
): WorkflowSchema {
  return {
    version: 1,
    meta: {
      name: meta?.name ?? 'Untitled workflow',
      exportedAt: new Date().toISOString(),
    },
    nodes: Object.values(graph.nodes),
    edges: Object.values(graph.edges),
    ...(viewport ? { viewport } : {}),
  };
}

export function parseGraph(
  _input: unknown
): { ok: true; graph: Graph; viewport?: { x: number; y: number; zoom: number } } | { ok: false; errors: string[] } {
  return {
    ok: true,
    graph: { nodes: {}, edges: {} },
  };
}
