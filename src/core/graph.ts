import { Edge, Graph, Port, PortRef, WorkflowNode } from './types';

export function getNode(graph: Graph, nodeId: string): WorkflowNode | undefined {
  return graph.nodes[nodeId];
}

export function getPort(graph: Graph, ref: PortRef): Port | undefined {
  const node = graph.nodes[ref.nodeId];
  if (!node) return undefined;
  return node.ports.find((p) => p.id === ref.portId);
}

export function edgesOfNode(graph: Graph, nodeId: string): Edge[] {
  return Object.values(graph.edges).filter(
    (e) => e.source.nodeId === nodeId || e.target.nodeId === nodeId
  );
}

export function edgesOfPort(graph: Graph, ref: PortRef): Edge[] {
  return Object.values(graph.edges).filter(
    (e) =>
      (e.source.nodeId === ref.nodeId && e.source.portId === ref.portId) ||
      (e.target.nodeId === ref.nodeId && e.target.portId === ref.portId)
  );
}

export function createEmptyGraph(): Graph {
  return {
    nodes: {},
    edges: {},
  };
}
