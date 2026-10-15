import { Edge, Graph, Port, PortType, WorkflowNode } from './types';
import { canConnect } from './validation';

export interface SerializedPort {
  id: string;
  name: string;
  direction: 'in' | 'out';
  type: PortType;
  maxConnections: number | null; // JSON has no Infinity
}

export interface SerializedNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  ports: SerializedPort[];
}

export interface SerializedEdge {
  id: string;
  source: { nodeId: string; portId: string };
  target: { nodeId: string; portId: string };
}

export interface WorkflowSchema {
  version: 1;
  meta: {
    name: string;
    exportedAt: string;
  };
  nodes: SerializedNode[];
  edges: SerializedEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

// Sorted by id so exporting the same graph twice gives an identical file.
export function exportGraph(
  graph: Graph,
  meta?: { name?: string },
  viewport?: { x: number; y: number; zoom: number }
): WorkflowSchema {
  const sortedNodes = Object.values(graph.nodes)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((node): SerializedNode => ({
      id: node.id,
      type: node.type,
      label: node.label,
      position: { x: node.x, y: node.y },
      ports: node.ports.map((p): SerializedPort => ({
        id: p.id,
        name: p.name,
        direction: p.direction,
        type: p.type,
        maxConnections: p.maxConnections === Infinity ? null : p.maxConnections,
      })),
    }));

  const sortedEdges = Object.values(graph.edges)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((edge): SerializedEdge => ({
      id: edge.id,
      source: { nodeId: edge.source.nodeId, portId: edge.source.portId },
      target: { nodeId: edge.target.nodeId, portId: edge.target.portId },
    }));

  return {
    version: 1,
    meta: {
      name: meta?.name ?? 'Untitled workflow',
      exportedAt: new Date().toISOString(),
    },
    nodes: sortedNodes,
    edges: sortedEdges,
    ...(viewport ? { viewport } : {}),
  };
}

export type ParseResult =
  | {
      ok: true;
      graph: Graph;
      viewport?: { x: number; y: number; zoom: number };
      meta: { name: string; exportedAt: string };
    }
  | { ok: false; errors: string[] };

// Doesn't throw - collects every problem so the import dialog can list them all.
export function parseGraph(input: unknown): ParseResult {
  const errors: string[] = [];

  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: ['Input must be a valid JSON object'] };
  }

  const raw = input as Record<string, unknown>;

  if (raw['version'] !== 1) {
    errors.push(`Unsupported or missing schema version: expected version 1, got ${String(raw['version'])}`);
  }

  const metaObj = raw['meta'];
  const name =
    typeof metaObj === 'object' && metaObj !== null && typeof (metaObj as Record<string, unknown>)['name'] === 'string'
      ? ((metaObj as Record<string, unknown>)['name'] as string)
      : 'Imported workflow';

  const exportedAt =
    typeof metaObj === 'object' && metaObj !== null && typeof (metaObj as Record<string, unknown>)['exportedAt'] === 'string'
      ? ((metaObj as Record<string, unknown>)['exportedAt'] as string)
      : new Date().toISOString();

  // viewport is optional
  let parsedViewport: { x: number; y: number; zoom: number } | undefined = undefined;
  if ('viewport' in raw && raw['viewport'] !== undefined) {
    const vp = raw['viewport'];
    if (typeof vp === 'object' && vp !== null) {
      const vRec = vp as Record<string, unknown>;
      const x = vRec['x'];
      const y = vRec['y'];
      const zoom = vRec['zoom'];
      if (
        typeof x === 'number' && Number.isFinite(x) &&
        typeof y === 'number' && Number.isFinite(y) &&
        typeof zoom === 'number' && Number.isFinite(zoom) && zoom > 0
      ) {
        parsedViewport = { x, y, zoom };
      } else {
        errors.push('Viewport must have finite x, y, and positive zoom numbers');
      }
    } else {
      errors.push('Viewport must be an object');
    }
  }

  const rawNodes = raw['nodes'];
  if (!Array.isArray(rawNodes)) {
    errors.push('Property "nodes" must be an array');
  }

  const rawEdges = raw['edges'];
  if (!Array.isArray(rawEdges)) {
    errors.push('Property "edges" must be an array');
  }

  if (errors.length > 0 && (!Array.isArray(rawNodes) || !Array.isArray(rawEdges))) {
    return { ok: false, errors };
  }

  const validNodesArray = Array.isArray(rawNodes) ? rawNodes : [];
  const validEdgesArray = Array.isArray(rawEdges) ? rawEdges : [];

  const parsedNodes: Record<string, WorkflowNode> = {};
  const seenNodeIds = new Set<string>();
  const seenPortIds = new Set<string>();

  for (let i = 0; i < validNodesArray.length; i++) {
    const n = validNodesArray[i];
    if (typeof n !== 'object' || n === null) {
      errors.push(`Node at index ${i} must be an object`);
      continue;
    }

    const nodeRec = n as Record<string, unknown>;
    const id = nodeRec['id'];
    const type = nodeRec['type'];
    const label = nodeRec['label'];
    const pos = nodeRec['position'];
    const ports = nodeRec['ports'];

    if (typeof id !== 'string' || !id.trim()) {
      errors.push(`Node at index ${i} must have a non-empty string "id"`);
      continue;
    }

    if (seenNodeIds.has(id)) {
      errors.push(`Duplicate node id "${id}" at index ${i}`);
    }
    seenNodeIds.add(id);

    if (typeof type !== 'string' || !type.trim()) {
      errors.push(`Node "${id}" has invalid or missing "type"`);
    }

    const nodeLabel = typeof label === 'string' ? label : id;

    let posX = 0;
    let posY = 0;
    if (typeof pos === 'object' && pos !== null) {
      const pRec = pos as Record<string, unknown>;
      const x = pRec['x'];
      const y = pRec['y'];
      if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
        posX = x;
        posY = y;
      } else {
        errors.push(`Node "${id}" has non-finite coordinates in "position"`);
      }
    } else {
      errors.push(`Node "${id}" is missing a valid "position" object`);
    }

    const parsedPorts: Port[] = [];
    if (Array.isArray(ports)) {
      for (let j = 0; j < ports.length; j++) {
        const p = ports[j];
        if (typeof p !== 'object' || p === null) {
          errors.push(`Port at index ${j} in node "${id}" must be an object`);
          continue;
        }

        const pRec = p as Record<string, unknown>;
        const pId = pRec['id'];
        const pName = pRec['name'];
        const pDir = pRec['direction'];
        const pType = pRec['type'];
        const pMax = pRec['maxConnections'];

        if (typeof pId !== 'string' || !pId.trim()) {
          errors.push(`Port at index ${j} in node "${id}" has invalid "id"`);
          continue;
        }

        if (seenPortIds.has(pId)) {
          errors.push(`Duplicate port id "${pId}" in node "${id}"`);
        }
        seenPortIds.add(pId);

        if (pDir !== 'in' && pDir !== 'out') {
          errors.push(`Port "${pId}" in node "${id}" has invalid direction: must be "in" or "out"`);
        }

        if (pType !== 'trigger' && pType !== 'action' && pType !== 'data') {
          errors.push(`Port "${pId}" in node "${id}" has invalid type "${String(pType)}": must be "trigger", "action", or "data"`);
        }

        let maxConn = Infinity;
        if (pMax === null || pMax === undefined) {
          maxConn = pDir === 'in' ? 1 : Infinity;
        } else if (typeof pMax === 'number' && Number.isFinite(pMax) && pMax >= 1) {
          maxConn = pMax;
        } else {
          errors.push(`Port "${pId}" in node "${id}" has invalid maxConnections: must be a positive integer or null`);
        }

        parsedPorts.push({
          id: pId,
          name: typeof pName === 'string' ? pName : pId,
          direction: pDir === 'in' ? 'in' : 'out',
          type: (pType as PortType) ?? 'action',
          maxConnections: maxConn,
        });
      }
    } else {
      errors.push(`Node "${id}" must have a "ports" array`);
    }

    parsedNodes[id] = {
      id,
      type: typeof type === 'string' ? type : 'action',
      label: nodeLabel,
      x: posX,
      y: posY,
      ports: parsedPorts,
    };
  }

  // build the graph up edge by edge so canConnect() catches limits + cycles
  const scratchGraph: Graph = {
    nodes: parsedNodes,
    edges: {},
  };

  const seenEdgeIds = new Set<string>();

  for (let i = 0; i < validEdgesArray.length; i++) {
    const e = validEdgesArray[i];
    if (typeof e !== 'object' || e === null) {
      errors.push(`Edge at index ${i} must be an object`);
      continue;
    }

    const edgeRec = e as Record<string, unknown>;
    const edgeId = edgeRec['id'];
    const source = edgeRec['source'];
    const target = edgeRec['target'];

    if (typeof edgeId !== 'string' || !edgeId.trim()) {
      errors.push(`Edge at index ${i} must have a non-empty string "id"`);
      continue;
    }

    if (seenEdgeIds.has(edgeId)) {
      errors.push(`Duplicate edge id "${edgeId}" at index ${i}`);
    }
    seenEdgeIds.add(edgeId);

    if (typeof source !== 'object' || source === null) {
      errors.push(`Edge "${edgeId}" must have a "source" object`);
      continue;
    }
    if (typeof target !== 'object' || target === null) {
      errors.push(`Edge "${edgeId}" must have a "target" object`);
      continue;
    }

    const sRec = source as Record<string, unknown>;
    const tRec = target as Record<string, unknown>;

    const sNodeId = sRec['nodeId'];
    const sPortId = sRec['portId'];
    const tNodeId = tRec['nodeId'];
    const tPortId = tRec['portId'];

    if (typeof sNodeId !== 'string' || typeof sPortId !== 'string') {
      errors.push(`Edge "${edgeId}" has invalid source nodeId or portId`);
      continue;
    }
    if (typeof tNodeId !== 'string' || typeof tPortId !== 'string') {
      errors.push(`Edge "${edgeId}" has invalid target nodeId or portId`);
      continue;
    }

    const sourceNode = scratchGraph.nodes[sNodeId];
    if (!sourceNode) {
      errors.push(`Edge "${edgeId}" references non-existent source node "${sNodeId}"`);
      continue;
    }

    const targetNode = scratchGraph.nodes[tNodeId];
    if (!targetNode) {
      errors.push(`Edge "${edgeId}" references non-existent target node "${tNodeId}"`);
      continue;
    }

    const sourcePort = sourceNode.ports.find((p) => p.id === sPortId);
    if (!sourcePort) {
      errors.push(`Edge "${edgeId}" references non-existent source port "${sPortId}" on node "${sNodeId}"`);
      continue;
    }

    const targetPort = targetNode.ports.find((p) => p.id === tPortId);
    if (!targetPort) {
      errors.push(`Edge "${edgeId}" references non-existent target port "${tPortId}" on node "${tNodeId}"`);
      continue;
    }

    if (sourcePort.direction !== 'out') {
      errors.push(`Edge "${edgeId}" source port "${sPortId}" must have direction "out"`);
    }
    if (targetPort.direction !== 'in') {
      errors.push(`Edge "${edgeId}" target port "${tPortId}" must have direction "in"`);
    }

    const check = canConnect(
      scratchGraph,
      { nodeId: sNodeId, portId: sPortId },
      { nodeId: tNodeId, portId: tPortId }
    );

    if (!check.ok) {
      errors.push(`Edge "${edgeId}" fails connection validation: ${check.reason}`);
    } else {
      const validEdge: Edge = {
        id: edgeId,
        source: { nodeId: sNodeId, portId: sPortId },
        target: { nodeId: tNodeId, portId: tPortId },
      };
      scratchGraph.edges[edgeId] = validEdge;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    graph: scratchGraph,
    viewport: parsedViewport,
    meta: { name, exportedAt },
  };
}
