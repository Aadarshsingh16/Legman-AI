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
      expect(res.errors.some((e) => e.includes('version 1'))).toBe(true);
    }
  });

  it('rejects non-object or null input', () => {
    expect(parseGraph(null).ok).toBe(false);
    expect(parseGraph('random string').ok).toBe(false);
    expect(parseGraph(42).ok).toBe(false);
  });

  it('rejects non-finite coordinates', () => {
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
      expect(res.errors.some((e) => e.includes('non-finite'))).toBe(true);
    }
  });

  it('rejects duplicate node IDs', () => {
    const exported = exportGraph(sampleGraph);
    const duplicateNode = { ...exported.nodes[0]! };
    const invalid = {
      ...exported,
      nodes: [...exported.nodes, duplicateNode],
    };
    const res = parseGraph(invalid);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.includes('Duplicate node id'))).toBe(true);
    }
  });

  it('rejects duplicate port IDs', () => {
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
      expect(res.errors.some((e) => e.includes('Duplicate port id'))).toBe(true);
    }
  });

  it('rejects edge referencing non-existent node', () => {
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
      expect(res.errors.some((e) => e.includes('missing-node'))).toBe(true);
    }
  });

  it('rejects edge referencing non-existent port', () => {
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
      expect(res.errors.some((e) => e.includes('non-existent-port'))).toBe(true);
    }
  });

  it('rejects edge that fails port connection compatibility (e.g. data -> action)', () => {
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
      expect(res.errors.some((e) => e.includes("output can't connect to"))).toBe(true);
    }
  });

  it('rejects cyclic edges present in schema', () => {
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
      { id: 'e2', source: { nodeId: 'nB', portId: 'B-out' }, target: { nodeId: 'nA', portId: 'A-in' } }, // cycle!
    ];

    const res = parseGraph({ ...exported, edges: cyclicEdges });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.includes('cycle'))).toBe(true);
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
