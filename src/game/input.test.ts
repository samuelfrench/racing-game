import { describe, expect, it } from 'vitest';
import { resolveInputFromKeys } from './input';

describe('input mapping', () => {
  it('maps left controls to negative steer and right controls to positive steer', () => {
    expect(resolveInputFromKeys(new Set(['arrowleft'])).steer).toBe(-1);
    expect(resolveInputFromKeys(new Set(['a'])).steer).toBe(-1);
    expect(resolveInputFromKeys(new Set(['arrowright'])).steer).toBe(1);
    expect(resolveInputFromKeys(new Set(['d'])).steer).toBe(1);
  });

  it('maps jump to a separate obstacle-clearing input', () => {
    expect(resolveInputFromKeys(new Set(['j'])).jump).toBe(true);
    expect(resolveInputFromKeys(new Set([' '])).jump).toBe(false);
  });
});
