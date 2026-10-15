import { Port, WorkflowNode } from './types';
import { newId } from './id';

export interface NodeTemplate {
  type: string;
  label: string;
  category: 'trigger' | 'action';
  defaultPorts: Omit<Port, 'id'>[];
  allowAddOutput?: boolean;
}

export const NODE_TEMPLATES: Record<string, NodeTemplate> = {
  webhook: {
    type: 'webhook',
    label: 'Webhook',
    category: 'trigger',
    defaultPorts: [
      { name: 'Trigger', direction: 'out', type: 'trigger', maxConnections: Infinity },
    ],
  },
  schedule: {
    type: 'schedule',
    label: 'Schedule',
    category: 'trigger',
    defaultPorts: [
      { name: 'Trigger', direction: 'out', type: 'trigger', maxConnections: Infinity },
    ],
  },
  http: {
    type: 'http',
    label: 'HTTP Request',
    category: 'action',
    defaultPorts: [
      { name: 'In', direction: 'in', type: 'action', maxConnections: 1 },
      { name: 'Out', direction: 'out', type: 'action', maxConnections: Infinity },
    ],
  },
  email: {
    type: 'email',
    label: 'Send Email',
    category: 'action',
    defaultPorts: [
      { name: 'In', direction: 'in', type: 'action', maxConnections: 1 },
      { name: 'Out', direction: 'out', type: 'action', maxConnections: Infinity },
    ],
  },
  transform: {
    type: 'transform',
    label: 'Transform',
    category: 'action',
    defaultPorts: [
      { name: 'In', direction: 'in', type: 'action', maxConnections: 1 },
      { name: 'Data In', direction: 'in', type: 'data', maxConnections: 1 },
      { name: 'Data Out', direction: 'out', type: 'data', maxConnections: Infinity },
    ],
    allowAddOutput: true,
  },
  condition: {
    type: 'condition',
    label: 'Condition',
    category: 'action',
    defaultPorts: [
      { name: 'In', direction: 'in', type: 'action', maxConnections: 1 },
      { name: 'True', direction: 'out', type: 'action', maxConnections: Infinity },
      { name: 'False', direction: 'out', type: 'action', maxConnections: Infinity },
    ],
    allowAddOutput: true,
  },
  end: {
    type: 'end',
    label: 'End',
    category: 'action',
    defaultPorts: [
      { name: 'In', direction: 'in', type: 'action', maxConnections: 1 },
    ],
  },
};

export function instantiateNode(templateType: string, x: number, y: number): WorkflowNode {
  const template = NODE_TEMPLATES[templateType];
  if (!template) {
    throw new Error(`Unknown node template type: ${templateType}`);
  }
  const nodeId = newId(template.type);
  const ports: Port[] = template.defaultPorts.map((p, idx) => ({
    ...p,
    id: `${nodeId}-${p.direction}-${idx}`,
  }));

  return {
    id: nodeId,
    type: template.type,
    label: template.label,
    x,
    y,
    ports,
  };
}
