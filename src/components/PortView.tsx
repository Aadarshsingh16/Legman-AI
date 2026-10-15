import React from 'react';
import { Port, WorkflowNode } from '../core/types';

export interface PortViewProps {
  node: WorkflowNode;
  port: Port;
}

export const PortView: React.FC<PortViewProps> = ({ port }) => {
  return (
    <div className={`port port-${port.direction}`} data-port-id={port.id}>
      <span className="port-dot" />
      <span className="port-label">{port.name}</span>
    </div>
  );
};
