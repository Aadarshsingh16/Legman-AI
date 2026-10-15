import React from 'react';
import { Edge, Port, WorkflowNode } from '../core/types';
import { bezierPath, orthogonalPath, Point, portPosition } from '../core/geometry';

export interface WireProps {
  edge: Edge;
  sourceNode: WorkflowNode;
  targetNode: WorkflowNode;
  sourcePort: Port;
  targetPort: Port;
  sourceOverridePos?: Point;
  targetOverridePos?: Point;
  connectorMode: 'bezier' | 'orthogonal';
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent, edgeId: string) => void;
}

export const Wire: React.FC<WireProps> = React.memo(
  ({
    edge,
    sourceNode,
    targetNode,
    sourcePort,
    targetPort,
    sourceOverridePos,
    targetOverridePos,
    connectorMode,
    isSelected = false,
    onSelect,
  }) => {
    // mid-drag, the live position is in ui.dragPositions, not the graph
    const effectiveSourceNode: WorkflowNode = sourceOverridePos
      ? { ...sourceNode, x: sourceOverridePos.x, y: sourceOverridePos.y }
      : sourceNode;

    const effectiveTargetNode: WorkflowNode = targetOverridePos
      ? { ...targetNode, x: targetOverridePos.x, y: targetOverridePos.y }
      : targetNode;

    const p1 = portPosition(effectiveSourceNode, sourcePort);
    const p2 = portPosition(effectiveTargetNode, targetPort);

    const pathD =
      connectorMode === 'orthogonal'
        ? orthogonalPath(p1, p2)
        : bezierPath(p1, p2);

    const strokeColor =
      sourcePort.type === 'trigger'
        ? 'var(--trigger)'
        : sourcePort.type === 'data'
        ? 'var(--data)'
        : 'var(--action)';

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect?.(e, edge.id);
    };

    return (
      <g
        className={`wire ${isSelected ? 'selected' : ''}`}
        onClick={handleClick}
        data-edge-id={edge.id}
      >
        {/* fat invisible path so thin wires are still easy to click */}
        <path d={pathD} className="wire-hit-path" />
        <path
          d={pathD}
          className="wire-visible-path"
          style={{ stroke: isSelected ? 'var(--select)' : strokeColor }}
        />
      </g>
    );
  }
);
