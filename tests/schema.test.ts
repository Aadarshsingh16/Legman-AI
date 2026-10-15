import { describe, it, expect } from 'vitest';
import { exportGraph } from '../src/core/schema';
import { createEmptyGraph } from '../src/core/graph';

describe('Schema', () => {
  it('exportGraph exports empty graph with version 1', () => {
    const exported = exportGraph(createEmptyGraph());
    expect(exported.version).toBe(1);
    expect(exported.nodes).toEqual([]);
    expect(exported.edges).toEqual([]);
  });
});
