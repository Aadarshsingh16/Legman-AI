import { Port, WorkflowNode } from './types';
import { HEADER_H, NODE_W, ROW_H } from './constants';

export interface Point {
  x: number;
  y: number;
}

export function portPosition(node: WorkflowNode, port: Port): Point {
  const isOut = port.direction === 'out';
  const sameDirPorts = node.ports.filter((p) => p.direction === port.direction);
  const index = sameDirPorts.findIndex((p) => p.id === port.id);
  const safeIndex = index >= 0 ? index : 0;

  return {
    x: node.x + (isOut ? NODE_W : 0),
    y: node.y + HEADER_H + ROW_H * (safeIndex + 0.5),
  };
}

export function bezierPath(p1: Point, p2: Point): string {
  const dx = Math.max(50, Math.abs(p2.x - p1.x) * 0.5);
  return `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
}

export function orthogonalPath(p1: Point, p2: Point, stub = 24, _radius = 8): string {
  // Simple stub for Phase 0
  const mx = (p1.x + p2.x) / 2;
  if (p2.x - stub >= p1.x + stub) {
    return `M ${p1.x} ${p1.y} L ${mx} ${p1.y} L ${mx} ${p2.y} L ${p2.x} ${p2.y}`;
  }
  const my = (p1.y + p2.y) / 2;
  return `M ${p1.x} ${p1.y} L ${p1.x + stub} ${p1.y} L ${p1.x + stub} ${my} L ${p2.x - stub} ${my} L ${p2.x - stub} ${p2.y} L ${p2.x} ${p2.y}`;
}
