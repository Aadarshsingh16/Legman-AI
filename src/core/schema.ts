import { AppError, makeError } from './errors';
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
  | { ok: false; errors: AppError[] };

// Doesn't throw - collects every problem so the import dialog can list them all.
export function parseGraph(input: unknown): ParseResult {
  const errors: AppError[] = [];

  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: [makeError('INVALID_JSON', 'Input must be a valid JSON object')] };
  }

  const raw = input as Record<string, unknown>;

  if (raw['version'] !== 1) {
    errors.push(
      makeError(
        'UNSUPPORTED_VERSION',
        `Unsupported or missing schema version: expected version 1, got ${String(raw['version'])}`,
        { path: 'version', context: { version: raw['version'] } }
      )
    );
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
        errors.push(
          makeError('NON_FINITE', 'Viewport must have finite x, y, and positive zoom numbers', {
            path: 'viewport',
          })
        );
      }
    } else {
      errors.push(makeError('INVALID_SHAPE', 'Viewport must be an object', { path: 'viewport' }));
    }
  }

  const rawNodes = raw['nodes'];
  if (!Array.isArray(rawNodes)) {
    errors.push(makeError('INVALID_SHAPE', 'Property "nodes" must be an array', { path: 'nodes' }));
  }

  const rawEdges = raw['edges'];
  if (!Array.isArray(rawEdges)) {
    errors.push(makeError('INVALID_SHAPE', 'Property "edges" must be an array', { path: 'edges' }));
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
      errors.push(makeError('INVALID_SHAPE', `Node at index ${i} must be an object`, { path: `nodes[${i}]` }));
      continue;
    }

    const nodeRec = n as Record<string, unknown>;
    const id = nodeRec['id'];
    const type = nodeRec['type'];
    const label = nodeRec['label'];
    const pos = nodeRec['position'];
    const ports = nodeRec['ports'];

    if (typeof id !== 'string' || !id.trim()) {
      errors.push(
        makeError('INVALID_SHAPE', `Node at index ${i} must have a non-empty string "id"`, {
          path: `nodes[${i}].id`,
        })
      );
      continue;
    }

    if (seenNodeIds.has(id)) {
      errors.push(
        makeError('DUPLICATE_ID', `Duplicate node id "${id}" at index ${i}`, {
          path: `nodes[${i}].id`,
          context: { id },
        })
      );
    }
    seenNodeIds.add(id);

    if (typeof type !== 'string' || !type.trim()) {
      errors.push(
        makeError('INVALID_SHAPE', `Node "${id}" has invalid or missing "type"`, {
          path: `nodes[${i}].type`,
        })
      );
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
        errors.push(
          makeError('NON_FINITE', `Node "${id}" has non-finite coordinates in "position"`, {
            path: `nodes[${i}].position`,
          })
        );
      }
    } else {
      errors.push(
        makeError('INVALID_SHAPE', `Node "${id}" is missing a valid "position" object`, {
          path: `nodes[${i}].position`,
        })
      );
    }

    const parsedPorts: Port[] = [];
    if (Array.isArray(ports)) {
      for (let j = 0; j < ports.length; j++) {
        const p = ports[j];
        if (typeof p !== 'object' || p === null) {
          errors.push(
            makeError('INVALID_SHAPE', `Port at index ${j} in node "${id}" must be an object`, {
              path: `nodes[${i}].ports[${j}]`,
            })
          );
          continue;
        }

        const pRec = p as Record<string, unknown>;
        const pId = pRec['id'];
        const pName = pRec['name'];
        const pDir = pRec['direction'];
        const pType = pRec['type'];
        const pMax = pRec['maxConnections'];

        if (typeof pId !== 'string' || !pId.trim()) {
          errors.push(
            makeError('INVALID_SHAPE', `Port at index ${j} in node "${id}" has invalid "id"`, {
              path: `nodes[${i}].ports[${j}].id`,
            })
          );
          continue;
        }

        if (seenPortIds.has(pId)) {
          errors.push(
            makeError('DUPLICATE_ID', `Duplicate port id "${pId}" in node "${id}"`, {
              path: `nodes[${i}].ports[${j}].id`,
              context: { portId: pId },
            })
          );
        }
        seenPortIds.add(pId);

        if (pDir !== 'in' && pDir !== 'out') {
          errors.push(
            makeError(
              'BAD_DIRECTION',
              `Port "${pId}" in node "${id}" has invalid direction: must be "in" or "out"`,
              { path: `nodes[${i}].ports[${j}].direction` }
            )
          );
        }

        if (pType !== 'trigger' && pType !== 'action' && pType !== 'data') {
          errors.push(
            makeError(
              'BAD_PORT_TYPE',
              `Port "${pId}" in node "${id}" has invalid type "${String(pType)}": must be "trigger", "action", or "data"`,
              { path: `nodes[${i}].ports[${j}].type` }
            )
          );
        }

        let maxConn = Infinity;
        if (pMax === null || pMax === undefined) {
          maxConn = pDir === 'in' ? 1 : Infinity;
        } else if (typeof pMax === 'number' && Number.isFinite(pMax) && pMax >= 1) {
          maxConn = pMax;
        } else {
          errors.push(
            makeError(
              'INVALID_SHAPE',
              `Port "${pId}" in node "${id}" has invalid maxConnections: must be a positive integer or null`,
              { path: `nodes[${i}].ports[${j}].maxConnections` }
            )
          );
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
      errors.push(
        makeError('INVALID_SHAPE', `Node "${id}" must have a "ports" array`, {
          path: `nodes[${i}].ports`,
        })
      );
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
      errors.push(makeError('INVALID_SHAPE', `Edge at index ${i} must be an object`, { path: `edges[${i}]` }));
      continue;
    }

    const edgeRec = e as Record<string, unknown>;
    const edgeId = edgeRec['id'];
    const source = edgeRec['source'];
    const target = edgeRec['target'];

    if (typeof edgeId !== 'string' || !edgeId.trim()) {
      errors.push(
        makeError('INVALID_SHAPE', `Edge at index ${i} must have a non-empty string "id"`, {
          path: `edges[${i}].id`,
        })
      );
      continue;
    }

    if (seenEdgeIds.has(edgeId)) {
      errors.push(
        makeError('DUPLICATE_ID', `Duplicate edge id "${edgeId}" at index ${i}`, {
          path: `edges[${i}].id`,
          context: { edgeId },
        })
      );
    }
    seenEdgeIds.add(edgeId);

    if (typeof source !== 'object' || source === null) {
      errors.push(makeError('INVALID_SHAPE', `Edge "${edgeId}" must have a "source" object`, { path: `edges[${i}].source` }));
      continue;
    }
    if (typeof target !== 'object' || target === null) {
      errors.push(makeError('INVALID_SHAPE', `Edge "${edgeId}" must have a "target" object`, { path: `edges[${i}].target` }));
      continue;
    }

    const sRec = source as Record<string, unknown>;
    const tRec = target as Record<string, unknown>;

    const sNodeId = sRec['nodeId'];
    const sPortId = sRec['portId'];
    const tNodeId = tRec['nodeId'];
    const tPortId = tRec['portId'];

    if (typeof sNodeId !== 'string' || typeof sPortId !== 'string') {
      errors.push(
        makeError('INVALID_SHAPE', `Edge "${edgeId}" has invalid source nodeId or portId`, {
          path: `edges[${i}].source`,
        })
      );
      continue;
    }
    if (typeof tNodeId !== 'string' || typeof tPortId !== 'string') {
      errors.push(
        makeError('INVALID_SHAPE', `Edge "${edgeId}" has invalid target nodeId or portId`, {
          path: `edges[${i}].target`,
        })
      );
      continue;
    }

    const sourceNode = scratchGraph.nodes[sNodeId];
    if (!sourceNode) {
      errors.push(
        makeError('MISSING_REF', `Edge "${edgeId}" references non-existent source node "${sNodeId}"`, {
          path: `edges[${i}].source.nodeId`,
        })
      );
      continue;
    }

    const targetNode = scratchGraph.nodes[tNodeId];
    if (!targetNode) {
      errors.push(
        makeError('MISSING_REF', `Edge "${edgeId}" references non-existent target node "${tNodeId}"`, {
          path: `edges[${i}].target.nodeId`,
        })
      );
      continue;
    }

    const sourcePort = sourceNode.ports.find((p) => p.id === sPortId);
    if (!sourcePort) {
      errors.push(
        makeError('MISSING_REF', `Edge "${edgeId}" references non-existent source port "${sPortId}" on node "${sNodeId}"`, {
          path: `edges[${i}].source.portId`,
        })
      );
      continue;
    }

    const targetPort = targetNode.ports.find((p) => p.id === tPortId);
    if (!targetPort) {
      errors.push(
        makeError('MISSING_REF', `Edge "${edgeId}" references non-existent target port "${tPortId}" on node "${tNodeId}"`, {
          path: `edges[${i}].target.portId`,
        })
      );
      continue;
    }

    if (sourcePort.direction !== 'out') {
      errors.push(
        makeError('BAD_DIRECTION', `Edge "${edgeId}" source port "${sPortId}" must have direction "out"`, {
          path: `edges[${i}].source.portId`,
        })
      );
    }
    if (targetPort.direction !== 'in') {
      errors.push(
        makeError('BAD_DIRECTION', `Edge "${edgeId}" target port "${tPortId}" must have direction "in"`, {
          path: `edges[${i}].target.portId`,
        })
      );
    }

    const check = canConnect(
      scratchGraph,
      { nodeId: sNodeId, portId: sPortId },
      { nodeId: tNodeId, portId: tPortId }
    );

    if (!check.ok) {
      errors.push(
        makeError(
          'ILLEGAL_EDGE',
          `Edge "${edgeId}" fails connection validation: ${check.reason}`,
          {
            path: `edges[${i}]`,
            context: { cause: check.code },
          }
        )
      );
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
