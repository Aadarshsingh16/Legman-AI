import React from 'react';
import { WorkflowNode } from '../core/types';
import { PortView } from './PortView';

export interface NodeViewProps {
  node: WorkflowNode;
}

export const NodeView: React.FC<NodeViewProps> = ({ node }) => {
  return (
    <div
      className="workflow-node"
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
      }}
    >
      <div className="node-header">{node.label}</div>
      <div className="node-ports">
        {node.ports.map((p) => (
          <PortView key={p.id} node={node} port={p} />
        ))}
      </div>
    </div>
  );
};
