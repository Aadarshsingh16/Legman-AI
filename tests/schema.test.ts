import { describe, it, expect } from 'vitest';
import { exportGraph, parseGraph } from '../src/core/schema';
import { Graph } from '../src/core/types';

describe('Schema Serialization & Validation (exportGraph & parseGraph)', () => {
  const sampleGraph: Graph = {
    nodes: {
      'node-b': {
        id: 'node-b',
        type: 'http',
        label: 'HTTP Request',
        x: 300,
        y: 100,
        ports: [
          { id: 'b-in', name: 'In', direction: 'in', type: 'action', maxConnections: 1 },
          { id: 'b-out', name: 'Out', direction: 'out', type: 'action', maxConnections: Infinity },
        ],
      },
      'node-a': {
        id: 'node-a',
        type: 'webhook',
        label: 'Webhook',
        x: 100,
        y: 100,
        ports: [
          { id: 'a-out', name: 'Trigger', direction: 'out', type: 'trigger', maxConnections: Infinity },
        ],
      },
    },
    edges: {
      'edge-2': {
        id: 'edge-2',
        source: { nodeId: 'node-a', portId: 'a-out' },
        target: { nodeId: 'node-b', portId: 'b-in' },
      },
    },
  };

  it('exportGraph: sorts nodes and edges by id for stable diffs', () => {
    const exported = exportGraph(sampleGraph);
    expect(exported.nodes.map((n) => n.id)).toEqual(['node-a', 'node-b']);
    expect(exported.edges.map((e) => e.id)).toEqual(['edge-2']);
  });

  it('exportGraph: maps maxConnections Infinity to null', () => {
    const exported = exportGraph(sampleGraph);
    const nodeA = exported.nodes.find((n) => n.id === 'node-a')!;
    expect(nodeA.ports[0]?.maxConnections).toBeNull();
  });

  it('round-trip test: parseGraph(exportGraph(g)) deep-equals g', () => {
    const exported = exportGraph(sampleGraph);
    const parsed = parseGraph(exported);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.graph).toEqual(sampleGraph);
    }
  });

  it('rejects unsupported schema version', () => {
    const exported = exportGraph(sampleGraph);
    const invalid = { ...exported, version: 2 };
    const res = parseGraph(invalid);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.code === 'UNSUPPORTED_VERSION' && e.path === 'version')).toBe(true);
    }
  });

  it('rejects version provided as string "1"', () => {
    const exported = exportGraph(sampleGraph);
    const invalid = { ...exported, version: '1' };
    const res = parseGraph(invalid);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.code === 'UNSUPPORTED_VERSION' && e.path === 'version')).toBe(true);
    }
  });

  it('rejects non-object or null input with INVALID_JSON', () => {
    const r1 = parseGraph(null);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.errors[0]?.code).toBe('INVALID_JSON');

    const r2 = parseGraph('random string');
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errors[0]?.code).toBe('INVALID_JSON');

    const r3 = parseGraph(42);
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.errors[0]?.code).toBe('INVALID_JSON');
  });

  it('rejects non-finite coordinates with NON_FINITE', () => {
    const exported = exportGraph(sampleGraph);
    const invalid = {
      ...exported,
      nodes: [
        {
          ...exported.nodes[0]!,
          position: { x: NaN, y: Infinity },
        },
      ],
    };
    const res = parseGraph(invalid);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.code === 'NON_FINITE' && e.path === 'nodes[0].position')).toBe(true);
    }
  });

  it('rejects duplicate node IDs with DUPLICATE_ID', () => {
    const exported = exportGraph(sampleGraph);
    const duplicateNode = { ...exported.nodes[0]! };
    const invalid = {
      ...exported,
      nodes: [...exported.nodes, duplicateNode],
    };
    const res = parseGraph(invalid);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.code === 'DUPLICATE_ID' && e.path === 'nodes[2].id')).toBe(true);
    }
  });

  it('rejects duplicate port IDs with DUPLICATE_ID', () => {
    const exported = exportGraph(sampleGraph);
    const invalid = {
      ...exported,
      nodes: [
        {
          ...exported.nodes[0]!,
          ports: [
            exported.nodes[0]!.ports[0]!,
            exported.nodes[0]!.ports[0]!, // duplicate port id
          ],
        },
      ],
    };
    const res = parseGraph(invalid);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.code === 'DUPLICATE_ID' && e.path === 'nodes[0].ports[1].id')).toBe(true);
    }
  });

  it('rejects bad port direction and type with BAD_DIRECTION and BAD_PORT_TYPE', () => {
    const exported = exportGraph(sampleGraph);
    const invalid = {
      ...exported,
      nodes: [
        {
          ...exported.nodes[0]!,
          ports: [
            {
              id: 'bad-port',
              name: 'Bad',
              direction: 'sideways',
              type: 'unknown-type',
              maxConnections: 1,
            },
          ],
        },
      ],
    };
    const res = parseGraph(invalid);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.code === 'BAD_DIRECTION' && e.path === 'nodes[0].ports[0].direction')).toBe(true);
      expect(res.errors.some((e) => e.code === 'BAD_PORT_TYPE' && e.path === 'nodes[0].ports[0].type')).toBe(true);
    }
  });

  it('rejects edge referencing non-existent node with MISSING_REF', () => {
    const exported = exportGraph(sampleGraph);
    const invalid = {
      ...exported,
      edges: [
        {
          id: 'bad-edge',
          source: { nodeId: 'missing-node', portId: 'out' },
          target: { nodeId: 'node-b', portId: 'b-in' },
        },
      ],
    };
    const res = parseGraph(invalid);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.code === 'MISSING_REF' && e.path === 'edges[0].source.nodeId')).toBe(true);
    }
  });

  it('rejects edge referencing non-existent port with MISSING_REF', () => {
    const exported = exportGraph(sampleGraph);
    const invalid = {
      ...exported,
      edges: [
        {
          id: 'bad-edge',
          source: { nodeId: 'node-a', portId: 'non-existent-port' },
          target: { nodeId: 'node-b', portId: 'b-in' },
        },
      ],
    };
    const res = parseGraph(invalid);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.code === 'MISSING_REF' && e.path === 'edges[0].source.portId')).toBe(true);
    }
  });

  it('break-it: edge pointing to a deleted port in imported JSON', () => {
    const exported = exportGraph(sampleGraph);
    const invalid = {
      ...exported,
      edges: [
        {
          id: 'edge-deleted-target',
          source: { nodeId: 'node-a', portId: 'a-out' },
          target: { nodeId: 'node-b', portId: 'deleted-port' },
        },
      ],
    };
    const res = parseGraph(invalid);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.code === 'MISSING_REF' && e.path === 'edges[0].target.portId')).toBe(true);
    }
  });

  it('break-it: two errors in the same edge (wrong source and target directions)', () => {
    const exported = exportGraph(sampleGraph);
    // Node-a's a-out is 'out', node-b's b-out is 'out'
    // If edge has source = b-in ('in') and target = a-out ('out')
    const invalid = {
      ...exported,
      edges: [
        {
          id: 'bad-dir-edge',
          source: { nodeId: 'node-b', portId: 'b-in' }, // direction is 'in' but source must be 'out'
          target: { nodeId: 'node-a', portId: 'a-out' }, // direction is 'out' but target must be 'in'
        },
      ],
    };
    const res = parseGraph(invalid);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const dirErrors = res.errors.filter((e) => e.code === 'BAD_DIRECTION' && e.path?.startsWith('edges[0]'));
      expect(dirErrors.length).toBe(2);
    }
  });

  it('rejects edge that fails connection compatibility with ILLEGAL_EDGE and context.cause', () => {
    const graphWithData: Graph = {
      nodes: {
        'n-data': {
          id: 'n-data',
          type: 'transform',
          label: 'Data Node',
          x: 0,
          y: 0,
          ports: [{ id: 'd-out', name: 'Data Out', direction: 'out', type: 'data', maxConnections: Infinity }],
        },
        'n-action': {
          id: 'n-action',
          type: 'http',
          label: 'Action Node',
          x: 200,
          y: 0,
          ports: [{ id: 'a-in', name: 'Action In', direction: 'in', type: 'action', maxConnections: 1 }],
        },
      },
      edges: {},
    };

    const exported = exportGraph(graphWithData);
    const invalid = {
      ...exported,
      edges: [
        {
          id: 'illegal-edge',
          source: { nodeId: 'n-data', portId: 'd-out' },
          target: { nodeId: 'n-action', portId: 'a-in' },
        },
      ],
    };

    const res = parseGraph(invalid);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const err = res.errors.find((e) => e.code === 'ILLEGAL_EDGE');
      expect(err).toBeDefined();
      expect(err?.path).toBe('edges[0]');
      expect(err?.context?.cause).toBe('TYPE_MISMATCH');
    }
  });

  it('rejects cyclic edges present in schema with ILLEGAL_EDGE and cause CYCLE', () => {
    const graph: Graph = {
      nodes: {
        nA: {
          id: 'nA',
          type: 'http',
          label: 'A',
          x: 0,
          y: 0,
          ports: [
            { id: 'A-in', name: 'In', direction: 'in', type: 'action', maxConnections: 1 },
            { id: 'A-out', name: 'Out', direction: 'out', type: 'action', maxConnections: Infinity },
          ],
        },
        nB: {
          id: 'nB',
          type: 'http',
          label: 'B',
          x: 200,
          y: 0,
          ports: [
            { id: 'B-in', name: 'In', direction: 'in', type: 'action', maxConnections: 1 },
            { id: 'B-out', name: 'Out', direction: 'out', type: 'action', maxConnections: Infinity },
          ],
        },
      },
      edges: {},
    };

    const exported = exportGraph(graph);
    const cyclicEdges = [
      { id: 'e1', source: { nodeId: 'nA', portId: 'A-out' }, target: { nodeId: 'nB', portId: 'B-in' } },
      { id: 'e2', source: { nodeId: 'nB', portId: 'B-out' }, target: { nodeId: 'nA', portId: 'A-in' } }, // closes a cycle
    ];

    const res = parseGraph({ ...exported, edges: cyclicEdges });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const cycleErr = res.errors.find((e) => e.code === 'ILLEGAL_EDGE' && e.context?.cause === 'CYCLE');
      expect(cycleErr).toBeDefined();
    }
  });

  it('collects MULTIPLE errors simultaneously without early abort', () => {
    const invalidSchema = {
      version: 99, // error 1
      nodes: 'not-an-array', // error 2
      edges: 'not-an-array', // error 3
    };

    const res = parseGraph(invalidSchema);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.length).toBeGreaterThanOrEqual(3);
    }
  });
});
