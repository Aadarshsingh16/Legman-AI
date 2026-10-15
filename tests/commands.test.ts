import { describe, it, expect } from 'vitest';
import {
  AddNodeCommand,
  RemoveNodesCommand,
  MoveNodesCommand,
  AddEdgeCommand,
  RemoveEdgesCommand,
  AddPortCommand,
  RemovePortCommand,
  RenameNodeCommand,
  ReplaceGraphCommand,
  BatchCommand,
} from '../src/core/commands';
import { Graph, WorkflowNode, Edge, Port } from '../src/core/types';
import { createEmptyGraph } from '../src/core/graph';

// Helper to deeply freeze an object and assert immutability
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj as object)) {
    const val = (obj as Record<string, unknown>)[key];
    if (typeof val === 'object' && val !== null && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

function createSampleNode(id: string, x = 100, y = 100): WorkflowNode {
  return {
    id,
    type: 'http',
    label: `Node ${id}`,
    x,
    y,
    ports: [
      { id: `${id}-in`, name: 'In', direction: 'in', type: 'action', maxConnections: 1 },
      { id: `${id}-out`, name: 'Out', direction: 'out', type: 'action', maxConnections: Infinity },
    ],
  };
}

describe('Commands Core', () => {
  it('AddNodeCommand: adds node, undo removes it, preserves immutability', () => {
    const initialGraph = deepFreeze(createEmptyGraph());
    const node = createSampleNode('n1');
    const cmd = new AddNodeCommand(node);

    expect(cmd.label).toBe('Add node');

    const doneGraph = cmd.do(initialGraph);
    expect(doneGraph.nodes['n1']).toEqual(node);
    expect(initialGraph.nodes['n1']).toBeUndefined();

    const undoneGraph = cmd.undo(doneGraph);
    expect(undoneGraph).toEqual(initialGraph);
  });

  it('RemoveNodesCommand: restores removed nodes and all attached edges', () => {
    const n1 = createSampleNode('n1', 10, 10);
    const n2 = createSampleNode('n2', 200, 10);
    const n3 = createSampleNode('n3', 400, 10);

    const e12: Edge = { id: 'e12', source: { nodeId: 'n1', portId: 'n1-out' }, target: { nodeId: 'n2', portId: 'n2-in' } };
    const e23: Edge = { id: 'e23', source: { nodeId: 'n2', portId: 'n2-out' }, target: { nodeId: 'n3', portId: 'n3-in' } };

    const graph: Graph = deepFreeze({
      nodes: { n1, n2, n3 },
      edges: { e12, e23 },
    });

    // Remove middle node n2 (should remove both e12 and e23)
    const cmd = new RemoveNodesCommand(['n2']);
    const doneGraph = cmd.do(graph);

    expect(doneGraph.nodes['n2']).toBeUndefined();
    expect(doneGraph.nodes['n1']).toBeDefined();
    expect(doneGraph.nodes['n3']).toBeDefined();
    expect(doneGraph.edges['e12']).toBeUndefined();
    expect(doneGraph.edges['e23']).toBeUndefined();

    // Undo should restore n2 AND both e12 and e23
    const undoneGraph = cmd.undo(doneGraph);
    expect(undoneGraph).toEqual(graph);
  });

  it('RemoveNodesCommand: removes multiple nodes and edges between removed nodes', () => {
    const n1 = createSampleNode('n1');
    const n2 = createSampleNode('n2');
    const e12: Edge = { id: 'e12', source: { nodeId: 'n1', portId: 'n1-out' }, target: { nodeId: 'n2', portId: 'n2-in' } };

    const graph: Graph = deepFreeze({
      nodes: { n1, n2 },
      edges: { e12 },
    });

    const cmd = new RemoveNodesCommand(['n1', 'n2']);
    expect(cmd.label).toBe('Delete nodes');

    const doneGraph = cmd.do(graph);
    expect(doneGraph.nodes).toEqual({});
    expect(doneGraph.edges).toEqual({});

    const undoneGraph = cmd.undo(doneGraph);
    expect(undoneGraph).toEqual(graph);
  });

  it('MoveNodesCommand: updates positions, undo restores original positions', () => {
    const n1 = createSampleNode('n1', 10, 20);
    const n2 = createSampleNode('n2', 50, 60);
    const graph: Graph = deepFreeze({
      nodes: { n1, n2 },
      edges: {},
    });

    const cmd = new MoveNodesCommand([
      { id: 'n1', from: { x: 10, y: 20 }, to: { x: 100, y: 200 } },
      { id: 'n2', from: { x: 50, y: 60 }, to: { x: 150, y: 260 } },
    ]);

    const done = cmd.do(graph);
    expect(done.nodes['n1']?.x).toBe(100);
    expect(done.nodes['n1']?.y).toBe(200);
    expect(done.nodes['n2']?.x).toBe(150);
    expect(done.nodes['n2']?.y).toBe(260);

    const undone = cmd.undo(done);
    expect(undone).toEqual(graph);
  });

  it('AddEdgeCommand and RemoveEdgesCommand: do/undo identity', () => {
    const n1 = createSampleNode('n1');
    const n2 = createSampleNode('n2');
    const graph: Graph = deepFreeze({
      nodes: { n1, n2 },
      edges: {},
    });

    const edge: Edge = { id: 'e1', source: { nodeId: 'n1', portId: 'n1-out' }, target: { nodeId: 'n2', portId: 'n2-in' } };
    const addCmd = new AddEdgeCommand(edge);

    const withEdge = addCmd.do(graph);
    expect(withEdge.edges['e1']).toEqual(edge);
    expect(addCmd.undo(withEdge)).toEqual(graph);

    // Now test RemoveEdgesCommand
    deepFreeze(withEdge);
    const removeCmd = new RemoveEdgesCommand(['e1']);
    const withoutEdge = removeCmd.do(withEdge);
    expect(withoutEdge.edges['e1']).toBeUndefined();
    expect(removeCmd.undo(withoutEdge)).toEqual(withEdge);
  });

  it('AddPortCommand: adds port to node and undo removes it', () => {
    const n1 = createSampleNode('n1');
    const graph: Graph = deepFreeze({
      nodes: { n1 },
      edges: {},
    });

    const newPort: Port = { id: 'n1-out-2', name: 'Extra', direction: 'out', type: 'action', maxConnections: Infinity };
    const cmd = new AddPortCommand('n1', newPort);

    const done = cmd.do(graph);
    expect(done.nodes['n1']?.ports).toHaveLength(3);
    expect(done.nodes['n1']?.ports[2]).toEqual(newPort);

    const undone = cmd.undo(done);
    expect(undone).toEqual(graph);
  });

  it('RemovePortCommand: restores port at EXACT original index along with attached edges', () => {
    const portA: Port = { id: 'pA', name: 'Port A', direction: 'in', type: 'action', maxConnections: 1 };
    const portB: Port = { id: 'pB', name: 'Port B', direction: 'out', type: 'action', maxConnections: Infinity };
    const portC: Port = { id: 'pC', name: 'Port C', direction: 'out', type: 'action', maxConnections: Infinity };

    const node1: WorkflowNode = {
      id: 'n1',
      type: 'condition',
      label: 'Condition',
      x: 0,
      y: 0,
      ports: [portA, portB, portC], // portB is index 1
    };

    const node2 = createSampleNode('n2', 200, 0);

    const edge: Edge = {
      id: 'e1',
      source: { nodeId: 'n1', portId: 'pB' },
      target: { nodeId: 'n2', portId: 'n2-in' },
    };

    const graph: Graph = deepFreeze({
      nodes: { n1: node1, n2: node2 },
      edges: { e1: edge },
    });

    const cmd = new RemovePortCommand('n1', 'pB');
    const done = cmd.do(graph);

    expect(done.nodes['n1']?.ports).toHaveLength(2);
    expect(done.nodes['n1']?.ports.map((p) => p.id)).toEqual(['pA', 'pC']);
    expect(done.edges['e1']).toBeUndefined();

    // Undo must restore pB at index 1 and restore edge e1
    const undone = cmd.undo(done);
    expect(undone.nodes['n1']?.ports).toHaveLength(3);
    expect(undone.nodes['n1']?.ports[1]?.id).toBe('pB');
    expect(undone.edges['e1']).toEqual(edge);
    expect(undone).toEqual(graph);
  });

  it('RenameNodeCommand: changes label and undo restores previous label', () => {
    const n1 = createSampleNode('n1');
    const graph: Graph = deepFreeze({
      nodes: { n1 },
      edges: {},
    });

    const cmd = new RenameNodeCommand('n1', n1.label, 'Renamed Node');
    const done = cmd.do(graph);
    expect(done.nodes['n1']?.label).toBe('Renamed Node');

    const undone = cmd.undo(done);
    expect(undone).toEqual(graph);
  });

  it('ReplaceGraphCommand: replaces graph and restores previous graph on undo', () => {
    const g1 = deepFreeze(createEmptyGraph());
    const g2: Graph = deepFreeze({
      nodes: { n1: createSampleNode('n1') },
      edges: {},
    });

    const cmd = new ReplaceGraphCommand(g1, g2);
    expect(cmd.do(g1)).toBe(g2);
    expect(cmd.undo(g2)).toBe(g1);
  });

  it('BatchCommand: executes forward and undoes in reverse order', () => {
    const initial = deepFreeze(createEmptyGraph());
    const n1 = createSampleNode('n1');
    const n2 = createSampleNode('n2');
    const edge: Edge = { id: 'e1', source: { nodeId: 'n1', portId: 'n1-out' }, target: { nodeId: 'n2', portId: 'n2-in' } };

    const cmd1 = new AddNodeCommand(n1);
    const cmd2 = new AddNodeCommand(n2);
    const cmd3 = new AddEdgeCommand(edge);

    const batch = new BatchCommand('Create 2 nodes and connection', [cmd1, cmd2, cmd3]);
    const done = batch.do(initial);

    expect(Object.keys(done.nodes)).toHaveLength(2);
    expect(Object.keys(done.edges)).toHaveLength(1);

    const undone = batch.undo(done);
    expect(undone).toEqual(initial);
  });
});
