import { describe, expect, it } from 'vitest';
import { resolveRuntimeMode } from './runtime';

describe('runtime mode resolution', () => {
  it.each([
    [undefined, undefined, true, false],
    [undefined, 'true', false, true],
    ['true', undefined, true, false],
    ['true', 'true', true, false],
    ['false', 'true', false, true],
    ['false', 'false', true, false],
  ])('resolves demo=%s backend=%s', (demo, backend, demoMode, backendEnabled) => {
    expect(resolveRuntimeMode(demo, backend)).toEqual({ demoMode, backendEnabled });
  });
});
