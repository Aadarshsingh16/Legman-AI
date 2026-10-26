import { COMPATIBLE } from './constants';
import { ErrorCode } from './errors';
import { getPort } from './graph';
import { Graph, Port, PortRef, PortType } from './types';

export type ValidationResult =
  | { ok: true; source: PortRef; target: PortRef }
  | { ok: false; code: ErrorCode; reason: string };

// Ports can come in either order. On success we hand back the edge direction
// (out -> in); on failure, a reason string that gets shown in the UI.
export function canConnect(
  graph: Graph,
  a: PortRef,
  b: PortRef
): ValidationResult {
  const portA = getPort(graph, a);
  const portB = getPort(graph, b);

  if (!portA || !portB) {
    return { ok: false, code: 'PORT_NOT_FOUND', reason: 'Port does not exist' };
  }

  if (portA.direction === portB.direction) {
    return { ok: false, code: 'DIRECTION_MISMATCH', reason: 'Connect an output to an input' };
  }

  // user can drag either way, so normalise to out -> in
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

  if (sourceRef.nodeId === targetRef.nodeId) {
    return { ok: false, code: 'SELF_LOOP', reason: "Can't connect a node to itself" };
  }

  const allowedTargets = COMPATIBLE[sourcePort.type as PortType] ?? [];
  if (!allowedTargets.includes(targetPort.type)) {
    return {
      ok: false,
      code: 'TYPE_MISMATCH',
      reason: `'${sourcePort.type}' output can't connect to '${targetPort.type}' input`,
    };
  }

  const isDuplicate = Object.values(graph.edges).some(
    (e) =>
      e.source.nodeId === sourceRef.nodeId &&
      e.source.portId === sourceRef.portId &&
      e.target.nodeId === targetRef.nodeId &&
      e.target.portId === targetRef.portId
  );
  if (isDuplicate) {
    return { ok: false, code: 'DUPLICATE_EDGE', reason: 'Connection already exists' };
  }

  const currentTargetConnections = Object.values(graph.edges).filter(
    (e) =>
      e.target.nodeId === targetRef.nodeId &&
      e.target.portId === targetRef.portId
  ).length;

  if (currentTargetConnections >= targetPort.maxConnections) {
    return { ok: false, code: 'CAPACITY_EXCEEDED', reason: 'Input already connected' };
  }

  if (wouldCreateCycle(graph, sourceRef.nodeId, targetRef.nodeId)) {
    return { ok: false, code: 'CYCLE', reason: 'Would create a cycle' };
  }

  return {
    ok: true,
    source: sourceRef,
    target: targetRef,
  };
}

// If we can already walk from target to source, adding source -> target closes a loop.
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
      for (const edge of Object.values(graph.edges)) {
        if (edge.source.nodeId === current && !visited.has(edge.target.nodeId)) {
          stack.push(edge.target.nodeId);
        }
      }
    }
  }

  return false;
}

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
