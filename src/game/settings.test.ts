import { describe, expect, test } from 'vitest';
import {
  applyMotionSettings,
  DEFAULT_GAME_SETTINGS,
  GAME_SETTINGS_STORAGE_KEY,
  readStoredGameSettings,
  resolveCameraProfile,
  resolveGraphicsProfile,
  sanitizeGameSettings,
  writeStoredGameSettings,
  type GameSettings,
  type SettingsStorage,
} from './settings';
import type { SpeedEffectState } from './speed-effects';

class MemorySettingsStorage implements SettingsStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const throwingStorage: SettingsStorage = {
  getItem() {
    throw new Error('get failed');
  },
  setItem() {
    throw new Error('set failed');
  },
};

describe('settings state', () => {
  test('provides immutable default game settings', () => {
    expect(DEFAULT_GAME_SETTINGS).toEqual({
      graphicsQuality: 'high',
      cameraMode: 'chase',
      masterVolume: 0.82,
      muted: false,
      reducedMotion: false,
      highContrast: false,
      showControlHints: true,
      touchControlsMode: 'auto',
    });
  });

  test('sanitizes valid partial overrides over defaults', () => {
    expect(
      sanitizeGameSettings({
        graphicsQuality: 'balanced',
        cameraMode: 'hood',
        masterVolume: 0.35,
        muted: true,
        reducedMotion: true,
        touchControlsMode: 'on',
      }),
    ).toEqual({
      ...DEFAULT_GAME_SETTINGS,
      graphicsQuality: 'balanced',
      cameraMode: 'hood',
      masterVolume: 0.35,
      muted: true,
      reducedMotion: true,
      touchControlsMode: 'on',
    });
  });

  test('falls back to defaults for invalid enum, boolean, and nonfinite volume values', () => {
    expect(
      sanitizeGameSettings({
        graphicsQuality: 'ultra',
        cameraMode: 'orbit',
        masterVolume: Number.POSITIVE_INFINITY,
        muted: 'yes',
        reducedMotion: 1,
        highContrast: null,
        showControlHints: 'false',
        touchControlsMode: 'sometimes',
      }),
    ).toEqual(DEFAULT_GAME_SETTINGS);
  });

  test('preserves every supported touch controls mode from stored settings', () => {
    for (const mode of ['auto', 'on', 'off'] as const) {
      expect(sanitizeGameSettings({ touchControlsMode: mode })).toMatchObject({
        touchControlsMode: mode,
      });
    }
  });

  test('clamps finite volume values into the supported range', () => {
    expect(sanitizeGameSettings({ masterVolume: 1.4 }).masterVolume).toBe(1);
    expect(sanitizeGameSettings({ masterVolume: -0.2 }).masterVolume).toBe(0);
  });

  test('reads sanitized settings from injected storage', () => {
    const storage = new MemorySettingsStorage();
    storage.setItem(
      GAME_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        graphicsQuality: 'low',
        cameraMode: 'far',
        masterVolume: 0.5,
        muted: true,
        reducedMotion: true,
        highContrast: true,
        showControlHints: false,
        touchControlsMode: 'off',
      }),
    );

    expect(readStoredGameSettings(storage)).toEqual({
      graphicsQuality: 'low',
      cameraMode: 'far',
      masterVolume: 0.5,
      muted: true,
      reducedMotion: true,
      highContrast: true,
      showControlHints: false,
      touchControlsMode: 'off',
    });
  });

  test('returns defaults for missing, invalid JSON, null, and throwing storage reads', () => {
    const invalidJsonStorage = new MemorySettingsStorage();
    invalidJsonStorage.setItem(GAME_SETTINGS_STORAGE_KEY, '{not json');

    expect(readStoredGameSettings(null)).toEqual(DEFAULT_GAME_SETTINGS);
    expect(readStoredGameSettings(undefined)).toEqual(DEFAULT_GAME_SETTINGS);
    expect(readStoredGameSettings(new MemorySettingsStorage())).toEqual(DEFAULT_GAME_SETTINGS);
    expect(readStoredGameSettings(invalidJsonStorage)).toEqual(DEFAULT_GAME_SETTINGS);
    expect(readStoredGameSettings(throwingStorage)).toEqual(DEFAULT_GAME_SETTINGS);
  });

  test('writes sanitized settings to injected storage and ignores write failures', () => {
    const storage = new MemorySettingsStorage();

    writeStoredGameSettings(storage, {
      ...DEFAULT_GAME_SETTINGS,
      graphicsQuality: 'low',
      cameraMode: 'far',
      masterVolume: 2,
      muted: true,
      touchControlsMode: 'bogus',
    } as unknown as GameSettings);

    expect(JSON.parse(storage.getItem(GAME_SETTINGS_STORAGE_KEY) ?? '')).toEqual({
      ...DEFAULT_GAME_SETTINGS,
      graphicsQuality: 'low',
      cameraMode: 'far',
      masterVolume: 1,
      muted: true,
      touchControlsMode: 'auto',
    });
    expect(() => writeStoredGameSettings(null, DEFAULT_GAME_SETTINGS)).not.toThrow();
    expect(() => writeStoredGameSettings(undefined, DEFAULT_GAME_SETTINGS)).not.toThrow();
    expect(() => writeStoredGameSettings(throwingStorage, DEFAULT_GAME_SETTINGS)).not.toThrow();
  });

  test('resolves graphics quality profiles', () => {
    expect(resolveGraphicsProfile({ graphicsQuality: 'high' })).toEqual({
      quality: 'high',
      pixelRatioCap: 2,
      speedStreaksVisible: 12,
    });
    expect(resolveGraphicsProfile({ graphicsQuality: 'balanced' })).toEqual({
      quality: 'balanced',
      pixelRatioCap: 1.5,
      speedStreaksVisible: 8,
    });
    expect(resolveGraphicsProfile({ graphicsQuality: 'low' })).toEqual({
      quality: 'low',
      pixelRatioCap: 1,
      speedStreaksVisible: 4,
    });
  });

  test('resolves camera mode profiles', () => {
    expect(resolveCameraProfile({ cameraMode: 'chase' })).toEqual({
      mode: 'chase',
      chaseDistance: 58,
      chaseHeight: 28,
      lookAhead: 30,
      targetHeight: 3.6,
      lerpSpeed: 5.5,
      targetLerpSpeed: 7,
      fovOffset: 0,
    });
    expect(resolveCameraProfile({ cameraMode: 'far' })).toEqual({
      mode: 'far',
      chaseDistance: 84,
      chaseHeight: 42,
      lookAhead: 42,
      targetHeight: 4.6,
      lerpSpeed: 4.6,
      targetLerpSpeed: 5.8,
      fovOffset: -1,
    });
    expect(resolveCameraProfile({ cameraMode: 'hood' })).toEqual({
      mode: 'hood',
      chaseDistance: -3.5,
      chaseHeight: 4.2,
      lookAhead: 72,
      targetHeight: 3.1,
      lerpSpeed: 9,
      targetLerpSpeed: 10,
      fovOffset: 6,
    });
  });

  test('leaves speed effects unchanged when reduced motion is disabled', () => {
    const effects: SpeedEffectState = {
      intensity: 0.8,
      cameraFov: 70,
      vignetteOpacity: 0.5,
      streakOpacity: 0.7,
      roadPulse: 0.9,
    };

    expect(applyMotionSettings({ reducedMotion: false }, effects)).toBe(effects);
  });

  test('damps speed effects when reduced motion is enabled', () => {
    const effects: SpeedEffectState = {
      intensity: 0.8,
      cameraFov: 70,
      vignetteOpacity: 0.5,
      streakOpacity: 0.7,
      roadPulse: 0.9,
    };

    const reduced = applyMotionSettings({ reducedMotion: true }, effects);

    expect(reduced).not.toBe(effects);
    expect(reduced.intensity).toBeLessThanOrEqual(0.32);
    expect(reduced.cameraFov).toBeCloseTo(68, 5);
    expect(reduced.vignetteOpacity).toBeLessThanOrEqual(0.225);
    expect(reduced.streakOpacity).toBe(0);
    expect(reduced.roadPulse).toBe(0);
  });
});
