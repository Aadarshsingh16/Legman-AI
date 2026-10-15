import { describe, it, expect } from 'vitest';
import { createHistory } from '../src/core/history';
import { createEmptyGraph } from '../src/core/graph';

describe('History', () => {
  it('creates history with empty graph', () => {
    const h = createHistory(createEmptyGraph());
    expect(h.present).toBeDefined();
    expect(h.past).toHaveLength(0);
    expect(h.future).toHaveLength(0);
  });
});
