import { describe, expect, test } from 'vitest';
import { computeSpeedEffects } from './speed-effects';

describe('computeSpeedEffects', () => {
  test('keeps idle camera and overlay effects restrained', () => {
    const effects = computeSpeedEffects({
      speed: 0,
      drift: 0,
      boostActive: false,
      deltaSeconds: 1 / 60,
      previousIntensity: 0,
    });

    expect(effects.intensity).toBeCloseTo(0, 3);
    expect(effects.cameraFov).toBe(62);
    expect(effects.vignetteOpacity).toBe(0);
    expect(effects.streakOpacity).toBe(0);
  });

  test('ramps camera, vignette, and streak opacity at racing speed', () => {
    const effects = computeSpeedEffects({
      speed: 58,
      drift: 0.08,
      boostActive: true,
      deltaSeconds: 0.2,
      previousIntensity: 0.42,
    });

    expect(effects.intensity).toBeGreaterThan(0.42);
    expect(effects.intensity).toBeLessThanOrEqual(1);
    expect(effects.cameraFov).toBeGreaterThan(66);
    expect(effects.vignetteOpacity).toBeGreaterThan(0.15);
    expect(effects.streakOpacity).toBeGreaterThan(0.25);
    expect(effects.roadPulse).toBeGreaterThan(0.2);
  });

  test('smooths and clamps bad inputs', () => {
    const effects = computeSpeedEffects({
      speed: -999,
      drift: 4,
      boostActive: true,
      deltaSeconds: 4,
      previousIntensity: 9,
    });

    expect(effects.intensity).toBeGreaterThanOrEqual(0);
    expect(effects.intensity).toBeLessThanOrEqual(1);
    expect(effects.cameraFov).toBeLessThanOrEqual(72);
    expect(effects.vignetteOpacity).toBeLessThanOrEqual(0.38);
    expect(effects.streakOpacity).toBeLessThanOrEqual(0.78);
  });
});
