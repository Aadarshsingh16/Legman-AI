import { describe, it, expect } from 'vitest';
import {
  portPosition,
  bezierPath,
  orthogonalPath,
  roundedPolyline,
  Point,
} from '../src/core/geometry';
import { WorkflowNode } from '../src/core/types';
import { HEADER_H, NODE_W, ROW_H } from '../src/core/constants';

describe('Geometry Engine', () => {
  const node: WorkflowNode = {
    id: 'test-node',
    type: 'condition',
    label: 'Test Node',
    x: 100,
    y: 150,
    ports: [
      { id: 'in-0', name: 'In 0', direction: 'in', type: 'action', maxConnections: 1 },
      { id: 'in-1', name: 'In 1', direction: 'in', type: 'action', maxConnections: 1 },
      { id: 'out-0', name: 'Out 0', direction: 'out', type: 'action', maxConnections: Infinity },
      { id: 'out-1', name: 'Out 1', direction: 'out', type: 'action', maxConnections: Infinity },
    ],
  };

  it('portPosition: calculates exact world coordinates based on index and direction', () => {
    const in0 = node.ports[0]!;
    const in1 = node.ports[1]!;
    const out0 = node.ports[2]!;
    const out1 = node.ports[3]!;

    const posIn0 = portPosition(node, in0);
    const posIn1 = portPosition(node, in1);
    const posOut0 = portPosition(node, out0);
    const posOut1 = portPosition(node, out1);

    // Inputs on left edge (x = node.x)
    expect(posIn0.x).toBe(100);
    expect(posIn0.y).toBe(150 + HEADER_H + ROW_H * 0.5);

    expect(posIn1.x).toBe(100);
    expect(posIn1.y).toBe(150 + HEADER_H + ROW_H * 1.5);

    // Outputs on right edge (x = node.x + NODE_W)
    expect(posOut0.x).toBe(100 + NODE_W);
    expect(posOut0.y).toBe(150 + HEADER_H + ROW_H * 0.5);

    expect(posOut1.x).toBe(100 + NODE_W);
    expect(posOut1.y).toBe(150 + HEADER_H + ROW_H * 1.5);
  });

  describe('bezierPath', () => {
    it('uses control offset with minimum of 50', () => {
      const p1: Point = { x: 100, y: 100 };
      const p2: Point = { x: 110, y: 100 }; // dx = 10 * 0.5 = 5 < 50, so should use 50
      const path = bezierPath(p1, p2);

      expect(path).toBe('M 100 100 C 150 100, 60 100, 110 100');
    });

    it('smoothly routes when target is to the left of source without producing NaN', () => {
      const p1: Point = { x: 300, y: 100 };
      const p2: Point = { x: 100, y: 200 }; // Target is 200px to the left
      const path = bezierPath(p1, p2);

      expect(path).not.toContain('NaN');
      expect(path.startsWith('M 300 100 C')).toBe(true);
      expect(path.endsWith('100 200')).toBe(true);
    });

    it('handles overlapping or identical points without crashing or producing NaN', () => {
      const p1: Point = { x: 50, y: 50 };
      const p2: Point = { x: 50, y: 50 };
      const path = bezierPath(p1, p2);

      expect(path).not.toContain('NaN');
      expect(path).toBe('M 50 50 C 100 50, 0 50, 50 50');
    });
  });

  describe('orthogonalPath', () => {
    it('generates forward branch when target is sufficiently to the right', () => {
      const p1: Point = { x: 100, y: 100 };
      const p2: Point = { x: 300, y: 200 };
      const path = orthogonalPath(p1, p2);

      expect(path).not.toContain('NaN');
      expect(path.startsWith('M 100 100')).toBe(true);
      expect(path.endsWith('300 200')).toBe(true);
      expect(path).toContain('Q'); // Corner rounding
    });

    it('generates backward branch when target is to the left of source', () => {
      const p1: Point = { x: 300, y: 100 };
      const p2: Point = { x: 100, y: 200 };
      const path = orthogonalPath(p1, p2);

      expect(path).not.toContain('NaN');
      expect(path.startsWith('M 300 100')).toBe(true);
      expect(path.endsWith('100 200')).toBe(true);
      expect(path).toContain('Q');
    });

    it('handles vertically aligned ports (x1 == x2)', () => {
      const p1: Point = { x: 200, y: 100 };
      const p2: Point = { x: 200, y: 300 };
      const path = orthogonalPath(p1, p2);

      expect(path).not.toContain('NaN');
      expect(path).toContain('Q');
    });
  });

  describe('roundedPolyline', () => {
    it('clamps radius to half segment length on short segments to avoid overshoot', () => {
      // 4px segment followed by 4px segment with radius=10 -> must clamp to 2
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
      ];
      const path = roundedPolyline(points, 10);

      expect(path).not.toContain('NaN');
      // start at (0,0), corner at (4,0) with clamped radius 2 -> L (2,0) Q 4 0, 4 2 L (4,4)
      expect(path).toBe('M 0 0 L 2 0 Q 4 0, 4 2 L 4 4');
    });

    it('handles empty or 1-2 points safely', () => {
      expect(roundedPolyline([])).toBe('');
      expect(roundedPolyline([{ x: 1, y: 2 }])).toBe('M 1 2');
      expect(roundedPolyline([{ x: 1, y: 2 }, { x: 3, y: 4 }])).toBe('M 1 2 L 3 4');
    });
  });
});
