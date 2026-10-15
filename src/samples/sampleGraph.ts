import { Graph } from '../core/types';

export const sampleInitialGraph: Graph = {
  nodes: {
    'node-webhook': {
      id: 'node-webhook',
      type: 'webhook',
      label: 'Webhook Trigger',
      x: 80,
      y: 140,
      ports: [
        { id: 'wh-out', name: 'Trigger', direction: 'out', type: 'trigger', maxConnections: Infinity },
      ],
    },
    'node-http': {
      id: 'node-http',
      type: 'http',
      label: 'Fetch User',
      x: 360,
      y: 140,
      ports: [
        { id: 'http-in', name: 'In', direction: 'in', type: 'action', maxConnections: 1 },
        { id: 'http-out', name: 'Out', direction: 'out', type: 'action', maxConnections: Infinity },
      ],
    },
    'node-condition': {
      id: 'node-condition',
      type: 'condition',
      label: 'Check Status',
      x: 640,
      y: 120,
      ports: [
        { id: 'cond-in', name: 'In', direction: 'in', type: 'action', maxConnections: 1 },
        { id: 'cond-true', name: 'True', direction: 'out', type: 'action', maxConnections: Infinity },
        { id: 'cond-false', name: 'False', direction: 'out', type: 'action', maxConnections: Infinity },
      ],
    },
    'node-email': {
      id: 'node-email',
      type: 'email',
      label: 'Send Email',
      x: 920,
      y: 60,
      ports: [
        { id: 'email-in', name: 'In', direction: 'in', type: 'action', maxConnections: 1 },
        { id: 'email-out', name: 'Out', direction: 'out', type: 'action', maxConnections: Infinity },
      ],
    },
    'node-end': {
      id: 'node-end',
      type: 'end',
      label: 'End Flow',
      x: 920,
      y: 220,
      ports: [
        { id: 'end-in', name: 'In', direction: 'in', type: 'action', maxConnections: 1 },
      ],
    },
  },
  edges: {
    'edge-1': {
      id: 'edge-1',
      source: { nodeId: 'node-webhook', portId: 'wh-out' },
      target: { nodeId: 'node-http', portId: 'http-in' },
    },
    'edge-2': {
      id: 'edge-2',
      source: { nodeId: 'node-http', portId: 'http-out' },
      target: { nodeId: 'node-condition', portId: 'cond-in' },
    },
    'edge-3': {
      id: 'edge-3',
      source: { nodeId: 'node-condition', portId: 'cond-true' },
      target: { nodeId: 'node-email', portId: 'email-in' },
    },
    'edge-4': {
      id: 'edge-4',
      source: { nodeId: 'node-condition', portId: 'cond-false' },
      target: { nodeId: 'node-end', portId: 'end-in' },
    },
  },
};
