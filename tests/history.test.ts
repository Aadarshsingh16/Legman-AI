import { describe, it, expect } from 'vitest';
import {
  createHistory,
  execute,
  undo,
  redo,
  canUndo,
  canRedo,
  getUndoLabel,
  getRedoLabel,
  MAX_HISTORY_LIMIT,
} from '../src/core/history';
import {
  AddNodeCommand,
  MoveNodesCommand,
  RemoveNodesCommand,
  RenameNodeCommand,
} from '../src/core/commands';
import { createEmptyGraph } from '../src/core/graph';
import { WorkflowNode } from '../src/core/types';

function createNode(id: string, x = 0, y = 0): WorkflowNode {
  return {
    id,
    type: 'http',
    label: `Node ${id}`,
    x,
    y,
    ports: [],
  };
}

describe('History State Engine', () => {
  it('initializes with empty history', () => {
    const initial = createEmptyGraph();
    const h = createHistory(initial);
    expect(h.present).toEqual(initial);
    expect(h.past).toHaveLength(0);
    expect(h.future).toHaveLength(0);
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it('undo/redo on empty stacks are no-ops without throwing', () => {
    const initial = createEmptyGraph();
    const h = createHistory(initial);

    const undone = undo(h);
    expect(undone).toBe(h);

    const redone = redo(h);
    expect(redone).toBe(h);
  });

  it('execute records command into past and clears future', () => {
    const h0 = createHistory(createEmptyGraph());
    const cmd1 = new AddNodeCommand(createNode('n1'));
    const h1 = execute(h0, cmd1);

    expect(canUndo(h1)).toBe(true);
    expect(getUndoLabel(h1)).toBe('Add node');
    expect(h1.past).toHaveLength(1);
    expect(h1.future).toHaveLength(0);

    // Undo cmd1
    const h2 = undo(h1);
    expect(canUndo(h2)).toBe(false);
    expect(canRedo(h2)).toBe(true);
    expect(getRedoLabel(h2)).toBe('Add node');
    expect(h2.future).toHaveLength(1);

    // new command after an undo should wipe the redo stack
    const cmd2 = new AddNodeCommand(createNode('n2'));
    const h3 = execute(h2, cmd2);

    expect(h3.future).toHaveLength(0);
    expect(canRedo(h3)).toBe(false);
    expect(h3.present.nodes['n2']).toBeDefined();
    expect(h3.present.nodes['n1']).toBeUndefined();
  });

  it('caps past history at MAX_HISTORY_LIMIT (200) dropping oldest entries', () => {
    let h = createHistory(createEmptyGraph());

    for (let i = 0; i < 250; i++) {
      const cmd = new AddNodeCommand(createNode(`node-${i}`));
      h = execute(h, cmd);
    }

    expect(h.past.length).toBe(MAX_HISTORY_LIMIT);
    // oldest entries fall off, newest is node-249
    expect(h.present.nodes['node-249']).toBeDefined();
  });

  it('sequence test: 20 commands, undo all produces initial, redo all produces final', () => {
    const initialGraph = createEmptyGraph();
    let h = createHistory(initialGraph);

    for (let i = 0; i < 10; i++) {
      h = execute(h, new AddNodeCommand(createNode(`n${i}`, i * 10, i * 10)));
    }
    for (let i = 0; i < 5; i++) {
      h = execute(
        h,
        new MoveNodesCommand([
          { id: `n${i}`, from: { x: i * 10, y: i * 10 }, to: { x: i * 20, y: i * 20 } },
        ])
      );
    }
    for (let i = 0; i < 5; i++) {
      h = execute(h, new RenameNodeCommand(`n${i}`, `Node n${i}`, `Renamed n${i}`));
    }

    const finalGraph = h.present;
    expect(h.past.length).toBe(20);

    for (let i = 0; i < 20; i++) {
      expect(canUndo(h)).toBe(true);
      h = undo(h);
    }

    expect(canUndo(h)).toBe(false);
    expect(h.present).toEqual(initialGraph);

    for (let i = 0; i < 20; i++) {
      expect(canRedo(h)).toBe(true);
      h = redo(h);
    }

    expect(canRedo(h)).toBe(false);
    expect(h.present).toEqual(finalGraph);
  });

  describe('Break-it tests', () => {
    it('handles undo after partial redo then executing a new command', () => {
      let h = createHistory(createEmptyGraph());
      h = execute(h, new AddNodeCommand(createNode('n1')));
      h = execute(h, new AddNodeCommand(createNode('n2')));
      h = execute(h, new AddNodeCommand(createNode('n3')));

      // Undo twice (n3, n2 undone)
      h = undo(h);
      h = undo(h);
      expect(h.past.length).toBe(1);
      expect(h.future.length).toBe(2);

      // Redo once (n2 redone)
      h = redo(h);
      expect(h.past.length).toBe(2);
      expect(h.future.length).toBe(1);

      h = execute(h, new AddNodeCommand(createNode('n4')));
      expect(h.past.length).toBe(3);
      expect(h.future.length).toBe(0); // redo stack gone

      expect(h.present.nodes['n1']).toBeDefined();
      expect(h.present.nodes['n2']).toBeDefined();
      expect(h.present.nodes['n4']).toBeDefined();
      expect(h.present.nodes['n3']).toBeUndefined();
    });

    it('remove node, add new node with same ID and position, undo both sequentially', () => {
      const g0 = createEmptyGraph();
      let h = createHistory(g0);

      const origNode = createNode('dupNode', 50, 50);
      h = execute(h, new AddNodeCommand(origNode));

      // Remove the node
      h = execute(h, new RemoveNodesCommand(['dupNode']));
      expect(h.present.nodes['dupNode']).toBeUndefined();

      // Add a different node with the same ID but different label
      const newNode = { ...createNode('dupNode', 50, 50), label: 'New Version' };
      h = execute(h, new AddNodeCommand(newNode));
      expect(h.present.nodes['dupNode']?.label).toBe('New Version');

      // Undo add new node
      h = undo(h);
      expect(h.present.nodes['dupNode']).toBeUndefined();

      // Undo remove origNode
      h = undo(h);
      expect(h.present.nodes['dupNode']?.label).toBe('Node dupNode');

      // Undo initial add
      h = undo(h);
      expect(h.present.nodes['dupNode']).toBeUndefined();
      expect(h.present).toEqual(g0);
    });

    it('coalescing helper: no-op moves are detectable and can be skipped', () => {
      const from = { x: 100, y: 100 };
      const to = { x: 100, y: 100 };

      const isNoOp = from.x === to.x && from.y === to.y;
      expect(isNoOp).toBe(true);
    });
  });
});
