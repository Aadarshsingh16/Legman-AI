import React from 'react';
import { Port, PortRef, WorkflowNode } from '../core/types';

export interface PortViewProps {
  node: WorkflowNode;
  port: Port;
  isTarget?: boolean;
  isDimmed?: boolean;
  isUserAdded?: boolean;
  onPortPointerDown?: (e: React.PointerEvent, portRef: PortRef) => void;
  onPortPointerEnter?: (portRef: PortRef) => void;
  onPortPointerLeave?: (portRef: PortRef) => void;
  onRemovePort?: (nodeId: string, portId: string) => void;
}

export const PortView: React.FC<PortViewProps> = ({
  node,
  port,
  isTarget = false,
  isDimmed = false,
  isUserAdded = false,
  onPortPointerDown,
  onPortPointerEnter,
  onPortPointerLeave,
  onRemovePort,
}) => {
  const isOut = port.direction === 'out';
  const portRef: PortRef = { nodeId: node.id, portId: port.id };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onPortPointerDown?.(e, portRef);
  };

  const handlePointerEnter = () => {
    onPortPointerEnter?.(portRef);
  };

  const handlePointerLeave = () => {
    onPortPointerLeave?.(portRef);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemovePort?.(node.id, port.id);
  };

  return (
    <div
      className={`port port-${port.direction} ${isTarget ? 'valid-target' : ''} ${isDimmed ? 'invalid-target' : ''}`}
      data-port-id={port.id}
      data-node-id={node.id}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <div className={`port-dot type-${port.type}`} />
      <span className="port-label">{port.name}</span>
      {isUserAdded && isOut && (
        <button
          type="button"
          className="remove-port-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleRemove}
          title="Remove port"
          aria-label={`Remove port ${port.name}`}
        >
          ×
        </button>
      )}
    </div>
  );
};
