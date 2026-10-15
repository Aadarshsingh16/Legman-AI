import { Port, WorkflowNode } from './types';
import { HEADER_H, NODE_W, ROW_H } from './constants';

export interface Point {
  x: number;
  y: number;
}

/**
 * Calculates world coordinates of a port on a given node.
 * Guaranteed to be purely mathematical based on state; no DOM measurements used.
 */
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

/**
 * Computes cubic bezier curve SVG path string from source output to target input.
 * Handles target positioned left of source smoothly with an S-loop.
 */
export function bezierPath(p1: Point, p2: Point): string {
  const dx = Math.max(50, Math.abs(p2.x - p1.x) * 0.5);
  return `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
}

/**
 * Converts a sequence of points into an SVG path with quadratic rounded corners.
 * Clamps radius to at most half of the adjacent segment lengths.
 */
export function roundedPolyline(points: Point[], radius = 8): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  if (points.length === 2) {
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  }

  let path = `M ${points[0]!.x} ${points[0]!.y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = points[i + 1]!;

    const d1x = curr.x - prev.x;
    const d1y = curr.y - prev.y;
    const len1 = Math.hypot(d1x, d1y);

    const d2x = next.x - curr.x;
    const d2y = next.y - curr.y;
    const len2 = Math.hypot(d2x, d2y);

    if (len1 === 0 || len2 === 0) {
      path += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    const effectiveR = Math.min(radius, len1 / 2, len2 / 2);
    if (effectiveR <= 0.001) {
      path += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    const u1x = d1x / len1;
    const u1y = d1y / len1;
    const u2x = d2x / len2;
    const u2y = d2y / len2;

    const startX = curr.x - u1x * effectiveR;
    const startY = curr.y - u1y * effectiveR;
    const endX = curr.x + u2x * effectiveR;
    const endY = curr.y + u2y * effectiveR;

    path += ` L ${startX} ${startY} Q ${curr.x} ${curr.y}, ${endX} ${endY}`;
  }

  const last = points[points.length - 1]!;
  path += ` L ${last.x} ${last.y}`;

  return path;
}

/**
 * Computes orthogonal SVG path connecting output port p1 (facing right)
 * to input port p2 (facing left).
 */
export function orthogonalPath(p1: Point, p2: Point, stub = 24, radius = 8): string {
  let points: Point[];

  if (p2.x - stub >= p1.x + stub) {
    // Forward branch: target is safely to the right
    const mx = (p1.x + p2.x) / 2;
    points = [
      p1,
      { x: mx, y: p1.y },
      { x: mx, y: p2.y },
      p2,
    ];
  } else {
    // Backward or overlapping branch: route around with stubs
    const my = (p1.y + p2.y) / 2;
    points = [
      p1,
      { x: p1.x + stub, y: p1.y },
      { x: p1.x + stub, y: my },
      { x: p2.x - stub, y: my },
      { x: p2.x - stub, y: p2.y },
      p2,
    ];
  }

  return roundedPolyline(points, radius);
}
