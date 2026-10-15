import { PortRef } from '../core/types';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface Selection {
  nodeIds: string[];
  edgeIds: string[];
}

export interface DraftWire {
  from: PortRef;
  cursor: { x: number; y: number };
  hover?: {
    port: PortRef;
    ok: boolean;
    reason?: string;
  };
}

export interface ToastMessage {
  id: string;
  kind: 'error' | 'info';
  text: string;
}

export interface UIState {
  viewport: Viewport;
  selection: Selection;
  draftWire: DraftWire | null;
  dragPositions: Record<string, { x: number; y: number }>;
  connectorMode: 'bezier' | 'orthogonal';
  snap: boolean;
  toast: ToastMessage | null;
}

export const initialUIState: UIState = {
  viewport: { x: 0, y: 0, zoom: 1 },
  selection: { nodeIds: [], edgeIds: [] },
  draftWire: null,
  dragPositions: {},
  connectorMode: 'bezier',
  snap: true,
  toast: null,
};
