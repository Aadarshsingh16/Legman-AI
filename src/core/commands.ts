import { Edge, Graph, Port, WorkflowNode } from './types';

export interface Command {
  readonly label: string;
  do(g: Graph): Graph;
  undo(g: Graph): Graph;
}

export class AddNodeCommand implements Command {
  readonly label = 'Add node';

  constructor(public readonly node: WorkflowNode) {}

  do(g: Graph): Graph {
    return {
      nodes: {
        ...g.nodes,
        [this.node.id]: this.node,
      },
      edges: g.edges,
    };
  }

  undo(g: Graph): Graph {
    const nextNodes = { ...g.nodes };
    delete nextNodes[this.node.id];
    return {
      nodes: nextNodes,
      edges: g.edges,
    };
  }
}

export class RemoveNodesCommand implements Command {
  readonly label: string;
  private removedNodes: WorkflowNode[] = [];
  private removedEdges: Edge[] = [];
  private initialized = false;

  constructor(public readonly nodeIds: string[]) {
    this.label = nodeIds.length > 1 ? 'Delete nodes' : 'Delete node';
  }

  do(g: Graph): Graph {
    if (!this.initialized) {
      this.removedNodes = this.nodeIds
        .map((id) => g.nodes[id])
        .filter((n): n is WorkflowNode => Boolean(n));

      this.removedEdges = Object.values(g.edges).filter(
        (e) =>
          this.nodeIds.includes(e.source.nodeId) ||
          this.nodeIds.includes(e.target.nodeId)
      );
      this.initialized = true;
    }

    const nextNodes = { ...g.nodes };
    for (const id of this.nodeIds) {
      delete nextNodes[id];
    }

    const nextEdges: Record<string, Edge> = {};
    for (const [edgeId, edge] of Object.entries(g.edges)) {
      if (
        !this.nodeIds.includes(edge.source.nodeId) &&
        !this.nodeIds.includes(edge.target.nodeId)
      ) {
        nextEdges[edgeId] = edge;
      }
    }

    return {
      nodes: nextNodes,
      edges: nextEdges,
    };
  }

  undo(g: Graph): Graph {
    const nextNodes = { ...g.nodes };
    for (const node of this.removedNodes) {
      nextNodes[node.id] = node;
    }

    const nextEdges = { ...g.edges };
    for (const edge of this.removedEdges) {
      nextEdges[edge.id] = edge;
    }

    return {
      nodes: nextNodes,
      edges: nextEdges,
    };
  }
}

export interface NodeMove {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export class MoveNodesCommand implements Command {
  readonly label: string;

  constructor(public readonly moves: NodeMove[]) {
    this.label = moves.length > 1 ? 'Move nodes' : 'Move node';
  }

  do(g: Graph): Graph {
    const nextNodes = { ...g.nodes };
    for (const move of this.moves) {
      const existing = nextNodes[move.id];
      if (existing) {
        nextNodes[move.id] = {
          ...existing,
          x: move.to.x,
          y: move.to.y,
        };
      }
    }
    return {
      nodes: nextNodes,
      edges: g.edges,
    };
  }

  undo(g: Graph): Graph {
    const nextNodes = { ...g.nodes };
    for (const move of this.moves) {
      const existing = nextNodes[move.id];
      if (existing) {
        nextNodes[move.id] = {
          ...existing,
          x: move.from.x,
          y: move.from.y,
        };
      }
    }
    return {
      nodes: nextNodes,
      edges: g.edges,
    };
  }
}

export class AddEdgeCommand implements Command {
  readonly label = 'Add edge';

  constructor(public readonly edge: Edge) {}

  do(g: Graph): Graph {
    return {
      nodes: g.nodes,
      edges: {
        ...g.edges,
        [this.edge.id]: this.edge,
      },
    };
  }

  undo(g: Graph): Graph {
    const nextEdges = { ...g.edges };
    delete nextEdges[this.edge.id];
    return {
      nodes: g.nodes,
      edges: nextEdges,
    };
  }
}

export class RemoveEdgesCommand implements Command {
  readonly label: string;
  private removedEdges: Edge[] = [];
  private initialized = false;

  constructor(public readonly edgeIds: string[]) {
    this.label = edgeIds.length > 1 ? 'Delete edges' : 'Delete edge';
  }

  do(g: Graph): Graph {
    if (!this.initialized) {
      this.removedEdges = this.edgeIds
        .map((id) => g.edges[id])
        .filter((e): e is Edge => Boolean(e));
      this.initialized = true;
    }

    const nextEdges = { ...g.edges };
    for (const id of this.edgeIds) {
      delete nextEdges[id];
    }

    return {
      nodes: g.nodes,
      edges: nextEdges,
    };
  }

  undo(g: Graph): Graph {
    const nextEdges = { ...g.edges };
    for (const edge of this.removedEdges) {
      nextEdges[edge.id] = edge;
    }

    return {
      nodes: g.nodes,
      edges: nextEdges,
    };
  }
}

export class AddPortCommand implements Command {
  readonly label = 'Add port';

  constructor(
    public readonly nodeId: string,
    public readonly port: Port
  ) {}

  do(g: Graph): Graph {
    const node = g.nodes[this.nodeId];
    if (!node) return g;

    return {
      nodes: {
        ...g.nodes,
        [this.nodeId]: {
          ...node,
          ports: [...node.ports, this.port],
        },
      },
      edges: g.edges,
    };
  }

  undo(g: Graph): Graph {
    const node = g.nodes[this.nodeId];
    if (!node) return g;

    return {
      nodes: {
        ...g.nodes,
        [this.nodeId]: {
          ...node,
          ports: node.ports.filter((p) => p.id !== this.port.id),
        },
      },
      edges: g.edges,
    };
  }
}

export class RemovePortCommand implements Command {
  readonly label = 'Remove port';
  private removedPort: Port | null = null;
  private index = -1;
  private removedEdges: Edge[] = [];
  private initialized = false;

  constructor(
    public readonly nodeId: string,
    public readonly portId: string
  ) {}

  do(g: Graph): Graph {
    const node = g.nodes[this.nodeId];
    if (!node) return g;

    if (!this.initialized) {
      this.index = node.ports.findIndex((p) => p.id === this.portId);
      this.removedPort = this.index >= 0 ? node.ports[this.index] ?? null : null;
      this.removedEdges = Object.values(g.edges).filter(
        (e) =>
          (e.source.nodeId === this.nodeId && e.source.portId === this.portId) ||
          (e.target.nodeId === this.nodeId && e.target.portId === this.portId)
      );
      this.initialized = true;
    }

    if (!this.removedPort || this.index < 0) return g;

    const nextPorts = node.ports.filter((p) => p.id !== this.portId);
    const nextEdges = { ...g.edges };
    for (const edge of this.removedEdges) {
      delete nextEdges[edge.id];
    }

    return {
      nodes: {
        ...g.nodes,
        [this.nodeId]: {
          ...node,
          ports: nextPorts,
        },
      },
      edges: nextEdges,
    };
  }

  undo(g: Graph): Graph {
    const node = g.nodes[this.nodeId];
    if (!node || !this.removedPort || this.index < 0) return g;

    // same index as before so the node layout doesn't shift
    const ports = [...node.ports];
    ports.splice(this.index, 0, this.removedPort);

    const nextEdges = { ...g.edges };
    for (const edge of this.removedEdges) {
      nextEdges[edge.id] = edge;
    }

    return {
      nodes: {
        ...g.nodes,
        [this.nodeId]: {
          ...node,
          ports,
        },
      },
      edges: nextEdges,
    };
  }
}

export class RenameNodeCommand implements Command {
  readonly label = 'Rename node';

  constructor(
    public readonly nodeId: string,
    public readonly fromLabel: string,
    public readonly toLabel: string
  ) {}

  do(g: Graph): Graph {
    const node = g.nodes[this.nodeId];
    if (!node) return g;

    return {
      nodes: {
        ...g.nodes,
        [this.nodeId]: {
          ...node,
          label: this.toLabel,
        },
      },
      edges: g.edges,
    };
  }

  undo(g: Graph): Graph {
    const node = g.nodes[this.nodeId];
    if (!node) return g;

    return {
      nodes: {
        ...g.nodes,
        [this.nodeId]: {
          ...node,
          label: this.fromLabel,
        },
      },
      edges: g.edges,
    };
  }
}

export class ReplaceGraphCommand implements Command {
  readonly label: string;

  constructor(
    public readonly prevGraph: Graph,
    public readonly nextGraph: Graph,
    label = 'Replace graph'
  ) {
    this.label = label;
  }

  do(_g: Graph): Graph {
    return this.nextGraph;
  }

  undo(_g: Graph): Graph {
    return this.prevGraph;
  }
}

export class BatchCommand implements Command {
  constructor(
    public readonly label: string,
    public readonly commands: Command[]
  ) {}

  do(g: Graph): Graph {
    return this.commands.reduce((acc, cmd) => cmd.do(acc), g);
  }

  undo(g: Graph): Graph {
    return this.commands.reduceRight((acc, cmd) => cmd.undo(acc), g);
  }
}
