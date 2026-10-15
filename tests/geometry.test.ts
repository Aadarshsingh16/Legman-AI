import { describe, it, expect } from 'vitest';
import { bezierPath } from '../src/core/geometry';

describe('Geometry', () => {
  it('bezierPath returns SVG path string', () => {
    const path = bezierPath({ x: 0, y: 0 }, { x: 100, y: 100 });
    expect(path).toContain('M 0 0 C');
  });
});
