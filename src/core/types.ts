export type PortType = 'trigger' | 'action' | 'data';
export type Direction = 'in' | 'out';

export interface PortRef {
  nodeId: string;
  portId: string;
}

export interface Port {
  id: string;
  name: string;
  direction: Direction;
  type: PortType;
  maxConnections: number; // inputs default to 1, outputs unlimited
}

export interface WorkflowNode {
  id: string;
  type: string; // template key e.g. 'webhook'
  label: string;
  x: number;
  y: number; // top-left corner, world coords
  ports: Port[];
}

export interface Edge {
  id: string;
  source: PortRef; // must be 'out'
  target: PortRef; // must be 'in'
}

export interface Graph {
  nodes: Record<string, WorkflowNode>;
  edges: Record<string, Edge>;
}
