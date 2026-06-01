import { describe, expect, test } from 'vitest';
import { computeDriftSmokeEffect } from './drift-smoke';

describe('computeDriftSmokeEffect', () => {
  test('stays hidden when the car is not sliding', () => {
    const effect = computeDriftSmokeEffect({
      speed: 0,
      drift: 0,
      handbrake: false,
      deltaSeconds: 1 / 60,
      previousIntensity: 0,
    });

    expect(effect).toEqual({
      intensity: 0,
      opacity: 0,
      scale: 1,
      visiblePuffs: 0,
    });
  });

  test('ramps visible tire smoke during a handbrake slide at speed', () => {
    const effect = computeDriftSmokeEffect({
      speed: 42,
      drift: 0.38,
      handbrake: true,
      deltaSeconds: 0.2,
      previousIntensity: 0.18,
    });

    expect(effect.intensity).toBeGreaterThan(0.18);
    expect(effect.opacity).toBeGreaterThan(0.28);
    expect(effect.scale).toBeGreaterThan(1.2);
    expect(effect.visiblePuffs).toBe(6);
  });

  test('smoothly decays and clamps bad inputs', () => {
    const effect = computeDriftSmokeEffect({
      speed: Number.POSITIVE_INFINITY,
      drift: Number.NaN,
      handbrake: false,
      deltaSeconds: 99,
      previousIntensity: 3,
    });

    expect(effect.intensity).toBeGreaterThanOrEqual(0);
    expect(effect.intensity).toBeLessThanOrEqual(1);
    expect(effect.opacity).toBeGreaterThanOrEqual(0);
    expect(effect.opacity).toBeLessThanOrEqual(0.5);
    expect(effect.scale).toBeGreaterThanOrEqual(1);
    expect(effect.visiblePuffs).toBeGreaterThanOrEqual(0);
    expect(effect.visiblePuffs).toBeLessThanOrEqual(6);
  });
});
