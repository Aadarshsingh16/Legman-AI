import React from 'react';
import { Edge } from '../core/types';

export interface WireProps {
  edge: Edge;
}

export const Wire: React.FC<WireProps> = () => {
  return <g className="wire" />;
};
