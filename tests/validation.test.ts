import { describe, it, expect, beforeEach } from 'vitest';
import { canConnect, wouldCreateCycle, validTargets } from '../src/core/validation';
import { Graph, WorkflowNode, Edge } from '../src/core/types';
import { createEmptyGraph } from '../src/core/graph';

function makeNode(
  id: string,
  ports: Array<{ id: string; name: string; direction: 'in' | 'out'; type: 'trigger' | 'action' | 'data'; maxConnections?: number }>
): WorkflowNode {
  return {
    id,
    type: 'test-node',
    label: id,
    x: 0,
    y: 0,
    ports: ports.map((p) => ({
      id: p.id,
      name: p.name,
      direction: p.direction,
      type: p.type,
      maxConnections: p.maxConnections ?? (p.direction === 'in' ? 1 : Infinity),
    })),
  };
}

describe('Validation Core (canConnect, cycle detection, validTargets)', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = createEmptyGraph();

    // Node A: Trigger node (output: trigger)
    graph.nodes['nodeA'] = makeNode('nodeA', [
      { id: 'pA-out', name: 'Trigger Out', direction: 'out', type: 'trigger' },
    ]);

    // Node B: Action node (input: action, output: action)
    graph.nodes['nodeB'] = makeNode('nodeB', [
      { id: 'pB-in', name: 'Action In', direction: 'in', type: 'action', maxConnections: 1 },
      { id: 'pB-out', name: 'Action Out', direction: 'out', type: 'action' },
    ]);

    // Node C: Action node (input: action, output: action)
    graph.nodes['nodeC'] = makeNode('nodeC', [
      { id: 'pC-in', name: 'Action In', direction: 'in', type: 'action', maxConnections: 1 },
      { id: 'pC-out', name: 'Action Out', direction: 'out', type: 'action' },
    ]);

    // Node D: Data node (input: data, output: data)
    graph.nodes['nodeD'] = makeNode('nodeD', [
      { id: 'pD-in', name: 'Data In', direction: 'in', type: 'data', maxConnections: 1 },
      { id: 'pD-out', name: 'Data Out', direction: 'out', type: 'data' },
    ]);
  });

  it('allows valid trigger -> action connection', () => {
    const res = canConnect(
      graph,
      { nodeId: 'nodeA', portId: 'pA-out' },
      { nodeId: 'nodeB', portId: 'pB-in' }
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.source.portId).toBe('pA-out');
      expect(res.target.portId).toBe('pB-in');
    }
  });

  it('allows valid action -> action connection', () => {
    const res = canConnect(
      graph,
      { nodeId: 'nodeB', portId: 'pB-out' },
      { nodeId: 'nodeC', portId: 'pC-in' }
    );
    expect(res.ok).toBe(true);
  });

  it('allows valid data -> data connection', () => {
    // Add another data node
    graph.nodes['nodeD2'] = makeNode('nodeD2', [
      { id: 'pD2-in', name: 'Data In', direction: 'in', type: 'data', maxConnections: 1 },
    ]);
    const res = canConnect(
      graph,
      { nodeId: 'nodeD', portId: 'pD-out' },
      { nodeId: 'nodeD2', portId: 'pD2-in' }
    );
    expect(res.ok).toBe(true);
  });

  it('rejects data -> action connection', () => {
    const res = canConnect(
      graph,
      { nodeId: 'nodeD', portId: 'pD-out' },
      { nodeId: 'nodeB', portId: 'pB-in' }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("'data' output can't connect to 'action' input");
    }
  });

  it('rejects trigger -> trigger connection', () => {
    graph.nodes['nodeA2'] = makeNode('nodeA2', [
      { id: 'pA2-in', name: 'Trigger In', direction: 'in', type: 'trigger', maxConnections: 1 },
    ]);
    const res = canConnect(
      graph,
      { nodeId: 'nodeA', portId: 'pA-out' },
      { nodeId: 'nodeA2', portId: 'pA2-in' }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("'trigger' output can't connect to 'trigger' input");
    }
  });

  it('rejects out -> out connection', () => {
    const res = canConnect(
      graph,
      { nodeId: 'nodeA', portId: 'pA-out' },
      { nodeId: 'nodeB', portId: 'pB-out' }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('Connect an output to an input');
    }
  });

  it('rejects in -> in connection', () => {
    const res = canConnect(
      graph,
      { nodeId: 'nodeB', portId: 'pB-in' },
      { nodeId: 'nodeC', portId: 'pC-in' }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('Connect an output to an input');
    }
  });

  it('rejects self-loops (connecting ports on the same node)', () => {
    const res = canConnect(
      graph,
      { nodeId: 'nodeB', portId: 'pB-out' },
      { nodeId: 'nodeB', portId: 'pB-in' }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("Can't connect a node to itself");
    }
  });

  it('rejects duplicate edges between the same source and target', () => {
    const edge: Edge = {
      id: 'e1',
      source: { nodeId: 'nodeA', portId: 'pA-out' },
      target: { nodeId: 'nodeB', portId: 'pB-in' },
    };
    graph.edges['e1'] = edge;

    const res = canConnect(
      graph,
      { nodeId: 'nodeA', portId: 'pA-out' },
      { nodeId: 'nodeB', portId: 'pB-in' }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('Connection already exists');
    }
  });

  it('rejects second edge into a single-input port (maxConnections exceeded)', () => {
    // Connect nodeB -> nodeC
    graph.edges['e1'] = {
      id: 'e1',
      source: { nodeId: 'nodeB', portId: 'pB-out' },
      target: { nodeId: 'nodeC', portId: 'pC-in' },
    };

    // Another node tries to connect to nodeC's in port
    graph.nodes['nodeOther'] = makeNode('nodeOther', [
      { id: 'pOther-out', name: 'Other Out', direction: 'out', type: 'action' },
    ]);

    const res = canConnect(
      graph,
      { nodeId: 'nodeOther', portId: 'pOther-out' },
      { nodeId: 'nodeC', portId: 'pC-in' }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('Input already connected');
    }
  });

  it('normalizes reverse-start (in -> out is identical to out -> in)', () => {
    const res = canConnect(
      graph,
      { nodeId: 'nodeB', portId: 'pB-in' }, // input first
      { nodeId: 'nodeA', portId: 'pA-out' }  // output second
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.source.portId).toBe('pA-out');
      expect(res.target.portId).toBe('pB-in');
    }
  });

  describe('Cycle detection', () => {
    it('detects direct 2-node cycle (A -> B, then trying B -> A)', () => {
      // Connect B -> C
      graph.edges['e1'] = {
        id: 'e1',
        source: { nodeId: 'nodeB', portId: 'pB-out' },
        target: { nodeId: 'nodeC', portId: 'pC-in' },
      };

      // Add input to B to test C -> B
      const nodeB = graph.nodes['nodeB']!;
      nodeB.ports.push({
        id: 'pB-in2',
        name: 'Action In 2',
        direction: 'in',
        type: 'action',
        maxConnections: 1,
      });

      const res = canConnect(
        graph,
        { nodeId: 'nodeC', portId: 'pC-out' },
        { nodeId: 'nodeB', portId: 'pB-in2' }
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('Would create a cycle');
      }
    });

    it('detects long chain cycle (A -> B -> C -> D -> A)', () => {
      // A(action) -> B(action) -> C(action) -> D(action)
      graph.nodes['nodeA'] = makeNode('nodeA', [
        { id: 'pA-in', name: 'In', direction: 'in', type: 'action', maxConnections: 1 },
        { id: 'pA-out', name: 'Out', direction: 'out', type: 'action' },
      ]);
      graph.nodes['nodeD'] = makeNode('nodeD', [
        { id: 'pD-in', name: 'In', direction: 'in', type: 'action', maxConnections: 1 },
        { id: 'pD-out', name: 'Out', direction: 'out', type: 'action' },
      ]);

      graph.edges['e1'] = { id: 'e1', source: { nodeId: 'nodeA', portId: 'pA-out' }, target: { nodeId: 'nodeB', portId: 'pB-in' } };
      graph.edges['e2'] = { id: 'e2', source: { nodeId: 'nodeB', portId: 'pB-out' }, target: { nodeId: 'nodeC', portId: 'pC-in' } };
      graph.edges['e3'] = { id: 'e3', source: { nodeId: 'nodeC', portId: 'pC-out' }, target: { nodeId: 'nodeD', portId: 'pD-in' } };

      // Trying D -> A
      const res = canConnect(
        graph,
        { nodeId: 'nodeD', portId: 'pD-out' },
        { nodeId: 'nodeA', portId: 'pA-in' }
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('Would create a cycle');
      }
    });

    it('does NOT false-positive on diamond shapes (A->B, A->C, B->D, C->D)', () => {
      // Create multi-input/output nodes for diamond
      graph.nodes['nA'] = makeNode('nA', [
        { id: 'pA-out1', name: 'Out 1', direction: 'out', type: 'action' },
        { id: 'pA-out2', name: 'Out 2', direction: 'out', type: 'action' },
      ]);
      graph.nodes['nB'] = makeNode('nB', [
        { id: 'pB-in', name: 'In', direction: 'in', type: 'action', maxConnections: 1 },
        { id: 'pB-out', name: 'Out', direction: 'out', type: 'action' },
      ]);
      graph.nodes['nC'] = makeNode('nC', [
        { id: 'pC-in', name: 'In', direction: 'in', type: 'action', maxConnections: 1 },
        { id: 'pC-out', name: 'Out', direction: 'out', type: 'action' },
      ]);
      graph.nodes['nD'] = makeNode('nD', [
        { id: 'pD-in1', name: 'In 1', direction: 'in', type: 'action', maxConnections: 1 },
        { id: 'pD-in2', name: 'In 2', direction: 'in', type: 'action', maxConnections: 1 },
      ]);

      // Connect A -> B, A -> C, B -> D
      graph.edges['e1'] = { id: 'e1', source: { nodeId: 'nA', portId: 'pA-out1' }, target: { nodeId: 'nB', portId: 'pB-in' } };
      graph.edges['e2'] = { id: 'e2', source: { nodeId: 'nA', portId: 'pA-out2' }, target: { nodeId: 'nC', portId: 'pC-in' } };
      graph.edges['e3'] = { id: 'e3', source: { nodeId: 'nB', portId: 'pB-out' }, target: { nodeId: 'nD', portId: 'pD-in1' } };

      // Now connect C -> D (closing the diamond) - should be valid!
      const res = canConnect(
        graph,
        { nodeId: 'nC', portId: 'pC-out' },
        { nodeId: 'nD', portId: 'pD-in2' }
      );
      expect(res.ok).toBe(true);
      expect(wouldCreateCycle(graph, 'nC', 'nD')).toBe(false);
    });
  });

  describe('validTargets', () => {
    it('agrees with canConnect for every port in the graph', () => {
      const fromRef = { nodeId: 'nodeA', portId: 'pA-out' };
      const targets = validTargets(graph, fromRef);

      // Check every port across all nodes
      for (const node of Object.values(graph.nodes)) {
        for (const port of node.ports) {
          const check = canConnect(graph, fromRef, { nodeId: node.id, portId: port.id });
          if (check.ok) {
            expect(targets.has(port.id)).toBe(true);
          } else {
            expect(targets.has(port.id)).toBe(false);
          }
        }
      }
    });
  });

  describe('Break-it edge cases', () => {
    it('returns error when referencing a non-existent/deleted node', () => {
      const res = canConnect(
        graph,
        { nodeId: 'deletedNode', portId: 'p1' },
        { nodeId: 'nodeB', portId: 'pB-in' }
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('Port does not exist');
      }
    });

    it('rejects connection on same node even if directions match in and out', () => {
      const res = canConnect(
        graph,
        { nodeId: 'nodeB', portId: 'pB-in' },
        { nodeId: 'nodeB', portId: 'pB-out' }
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("Can't connect a node to itself");
      }
    });

    it('rejects two edges from different nodes to the same single input', () => {
      // Connect nodeA -> nodeB (trigger -> action)
      graph.edges['e1'] = {
        id: 'e1',
        source: { nodeId: 'nodeA', portId: 'pA-out' },
        target: { nodeId: 'nodeB', portId: 'pB-in' },
      };

      // Create another trigger node
      graph.nodes['nodeA2'] = makeNode('nodeA2', [
        { id: 'pA2-out', name: 'Trigger Out', direction: 'out', type: 'trigger' },
      ]);

      const res = canConnect(
        graph,
        { nodeId: 'nodeA2', portId: 'pA2-out' },
        { nodeId: 'nodeB', portId: 'pB-in' }
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('Input already connected');
      }
    });
  });
});
