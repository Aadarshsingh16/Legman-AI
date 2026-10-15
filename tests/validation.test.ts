import { describe, it, expect } from 'vitest';
import { canConnect } from '../src/core/validation';

describe('Validation', () => {
  it('stub test passes', () => {
    expect(canConnect).toBeDefined();
  });
});
