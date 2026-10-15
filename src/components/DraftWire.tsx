import React from 'react';
import { Port, WorkflowNode } from '../core/types';
import { bezierPath, orthogonalPath, Point, portPosition } from '../core/geometry';

export interface DraftWireProps {
  fromNode: WorkflowNode;
  fromPort: Port;
  cursor: Point;
  connectorMode: 'bezier' | 'orthogonal';
  hoverStatus?: {
    ok: boolean;
    reason?: string;
  };
}

export const DraftWire: React.FC<DraftWireProps> = ({
  fromNode,
  fromPort,
  cursor,
  connectorMode,
  hoverStatus,
}) => {
  const isOut = fromPort.direction === 'out';
  const fixedPos = portPosition(fromNode, fromPort);

  // If dragging from out port, cursor is the target (p2)
  // If dragging from in port, swap so cursor is source (p1) to maintain left-to-right flow
  const p1 = isOut ? fixedPos : cursor;
  const p2 = isOut ? cursor : fixedPos;

  const pathD =
    connectorMode === 'orthogonal'
      ? orthogonalPath(p1, p2)
      : bezierPath(p1, p2);

  let strokeColor =
    fromPort.type === 'trigger'
      ? 'var(--trigger)'
      : fromPort.type === 'data'
      ? 'var(--data)'
      : 'var(--action)';

  if (hoverStatus) {
    strokeColor = hoverStatus.ok ? 'var(--ok)' : 'var(--bad)';
  }

  return (
    <g className="draft-wire">
      <path
        d={pathD}
        className="draft-wire-path"
        style={{ stroke: strokeColor }}
      />
    </g>
  );
};
