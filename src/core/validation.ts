import { COMPATIBLE } from './constants';
import { getPort } from './graph';
import { Graph, Port, PortRef, PortType } from './types';

export type ValidationResult =
  | { ok: true; source: PortRef; target: PortRef }
  | { ok: false; reason: string };

/**
 * Checks if a directed edge can be formed between two ports (in either order).
 * If valid, returns { ok: true, source, target } with normalized direction (source is 'out', target is 'in').
 * If invalid, returns { ok: false, reason } with the first failure encountered.
 */
export function canConnect(
  graph: Graph,
  a: PortRef,
  b: PortRef
): ValidationResult {
  // 1. Both ports exist
  const portA = getPort(graph, a);
  const portB = getPort(graph, b);

  if (!portA || !portB) {
    return { ok: false, reason: 'Port does not exist' };
  }

  // 2. One 'out' and one 'in'
  if (portA.direction === portB.direction) {
    return { ok: false, reason: 'Connect an output to an input' };
  }

  // Normalize so source is 'out' and target is 'in'
  let sourceRef: PortRef;
  let targetRef: PortRef;
  let sourcePort: Port;
  let targetPort: Port;

  if (portA.direction === 'out') {
    sourceRef = a;
    targetRef = b;
    sourcePort = portA;
    targetPort = portB;
  } else {
    sourceRef = b;
    targetRef = a;
    sourcePort = portB;
    targetPort = portA;
  }

  // 3. Different nodes
  if (sourceRef.nodeId === targetRef.nodeId) {
    return { ok: false, reason: "Can't connect a node to itself" };
  }

  // 4. Type compatibility via COMPATIBLE
  const allowedTargets = COMPATIBLE[sourcePort.type as PortType] ?? [];
  if (!allowedTargets.includes(targetPort.type)) {
    return {
      ok: false,
      reason: `'${sourcePort.type}' output can't connect to '${targetPort.type}' input`,
    };
  }

  // 5. No duplicate edge (same source + target)
  const isDuplicate = Object.values(graph.edges).some(
    (e) =>
      e.source.nodeId === sourceRef.nodeId &&
      e.source.portId === sourceRef.portId &&
      e.target.nodeId === targetRef.nodeId &&
      e.target.portId === targetRef.portId
  );
  if (isDuplicate) {
    return { ok: false, reason: 'Connection already exists' };
  }

  // 6. Target maxConnections not exceeded
  const currentTargetConnections = Object.values(graph.edges).filter(
    (e) =>
      e.target.nodeId === targetRef.nodeId &&
      e.target.portId === targetRef.portId
  ).length;

  if (currentTargetConnections >= targetPort.maxConnections) {
    return { ok: false, reason: 'Input already connected' };
  }

  // 7. No cycle: DFS from target node to see if source node is reachable
  if (wouldCreateCycle(graph, sourceRef.nodeId, targetRef.nodeId)) {
    return { ok: false, reason: 'Would create a cycle' };
  }

  return {
    ok: true,
    source: sourceRef,
    target: targetRef,
  };
}

/**
 * Checks if adding an edge from sourceNodeId to targetNodeId would introduce a cycle.
 * Traverses forward starting from targetNodeId; if sourceNodeId is reachable, adding the edge would form a cycle.
 */
export function wouldCreateCycle(
  graph: Graph,
  sourceNodeId: string,
  targetNodeId: string
): boolean {
  if (sourceNodeId === targetNodeId) {
    return true;
  }

  const visited = new Set<string>();
  const stack = [targetNodeId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === sourceNodeId) {
      return true;
    }

    if (!visited.has(current)) {
      visited.add(current);
      // Follow all outgoing edges from current node
      for (const edge of Object.values(graph.edges)) {
        if (edge.source.nodeId === current && !visited.has(edge.target.nodeId)) {
          stack.push(edge.target.nodeId);
        }
      }
    }
  }

  return false;
}

/**
 * Finds all valid target port IDs that can connect with fromPortRef in the current graph.
 */
export function validTargets(graph: Graph, fromPortRef: PortRef): Set<string> {
  const result = new Set<string>();
  const fromPort = getPort(graph, fromPortRef);
  if (!fromPort) return result;

  for (const node of Object.values(graph.nodes)) {
    for (const port of node.ports) {
      const candidateRef: PortRef = { nodeId: node.id, portId: port.id };
      const check = canConnect(graph, fromPortRef, candidateRef);
      if (check.ok) {
        result.add(port.id);
      }
    }
  }

  return result;
}
