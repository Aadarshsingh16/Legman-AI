import React from 'react';
import { PortRef, WorkflowNode } from '../core/types';
import { NODE_TEMPLATES } from '../core/nodeTemplates';
import { NODE_W, ROW_H } from '../core/constants';
import { PortView } from './PortView';

export interface NodeViewProps {
  node: WorkflowNode;
  position?: { x: number; y: number };
  isSelected?: boolean;
  isDragging?: boolean;
  validTargetPortIds?: Set<string>;
  activeDraftWire?: boolean;
  onNodePointerDown?: (e: React.PointerEvent, nodeId: string) => void;
  onNodePointerMove?: (e: React.PointerEvent) => void;
  onNodePointerUp?: (e: React.PointerEvent) => void;
  onPortPointerDown?: (e: React.PointerEvent, portRef: PortRef) => void;
  onPortPointerEnter?: (portRef: PortRef) => void;
  onPortPointerLeave?: (portRef: PortRef) => void;
  onAddPort?: (nodeId: string) => void;
  onRemovePort?: (nodeId: string, portId: string) => void;
}

export const NodeView: React.FC<NodeViewProps> = ({
  node,
  position,
  isSelected = false,
  isDragging = false,
  validTargetPortIds,
  activeDraftWire = false,
  onNodePointerDown,
  onNodePointerMove,
  onNodePointerUp,
  onPortPointerDown,
  onPortPointerEnter,
  onPortPointerLeave,
  onAddPort,
  onRemovePort,
}) => {
  const template = NODE_TEMPLATES[node.type];
  const category = template?.category ?? 'action';
  const allowAddOutput = template?.allowAddOutput ?? false;

  const posX = position ? position.x : node.x;
  const posY = position ? position.y : node.y;

  const inPorts = node.ports.filter((p) => p.direction === 'in');
  const outPorts = node.ports.filter((p) => p.direction === 'out');
  const rowCount = Math.max(inPorts.length, outPorts.length);

  // template ports can't be removed, only ones the user added
  const defaultPortCount = template?.defaultPorts.length ?? 0;

  const handleHeaderPointerDown = (e: React.PointerEvent) => {
    onNodePointerDown?.(e, node.id);
  };

  const handleAddPortClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddPort?.(node.id);
  };

  return (
    <div
      className={`workflow-node ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{
        width: `${NODE_W}px`,
        transform: `translate3d(${posX}px, ${posY}px, 0)`,
      }}
      data-node-id={node.id}
      onPointerDown={(e) => {
        const target = e.target as HTMLElement;
        if (
          !target.closest('.port') &&
          !target.closest('.add-port-btn') &&
          !target.closest('.remove-port-btn')
        ) {
          handleHeaderPointerDown(e);
        }
      }}
      onPointerMove={onNodePointerMove}
      onPointerUp={onNodePointerUp}
    >
      <div className="node-header">
        <div className={`node-stripe ${category}`} />
        <span className="node-title">{node.label}</span>
      </div>

      <div className="node-body">
        {Array.from({ length: rowCount }).map((_, rowIndex) => {
          const inPort = inPorts[rowIndex];
          const outPort = outPorts[rowIndex];

          const isUserAdded = outPort ? node.ports.indexOf(outPort) >= defaultPortCount : false;

          return (
            <div key={`row-${rowIndex}`} className="node-row" style={{ height: `${ROW_H}px` }}>
              {inPort && (
                <PortView
                  node={node}
                  port={inPort}
                  isTarget={Boolean(validTargetPortIds?.has(inPort.id))}
                  isDimmed={Boolean(activeDraftWire && !validTargetPortIds?.has(inPort.id))}
                  onPortPointerDown={onPortPointerDown}
                  onPortPointerEnter={onPortPointerEnter}
                  onPortPointerLeave={onPortPointerLeave}
                  onRemovePort={onRemovePort}
                />
              )}
              {outPort && (
                <PortView
                  node={node}
                  port={outPort}
                  isTarget={Boolean(validTargetPortIds?.has(outPort.id))}
                  isDimmed={Boolean(activeDraftWire && !validTargetPortIds?.has(outPort.id))}
                  isUserAdded={isUserAdded}
                  onPortPointerDown={onPortPointerDown}
                  onPortPointerEnter={onPortPointerEnter}
                  onPortPointerLeave={onPortPointerLeave}
                  onRemovePort={onRemovePort}
                />
              )}
            </div>
          );
        })}

        {allowAddOutput && (
          <button
            type="button"
            className="add-port-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleAddPortClick}
          >
            + Add output
          </button>
        )}
      </div>
    </div>
  );
};
