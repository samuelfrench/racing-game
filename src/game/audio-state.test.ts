import { describe, expect, test } from 'vitest';
import {
  collectRaceAudioCues,
  computeRaceAudioMix,
  createRaceAudioSnapshot,
  writeRaceAudioMix,
  writeRaceAudioSnapshot,
  type RaceAudioMix,
  type RaceAudioSnapshot,
} from './audio-state';

describe('computeRaceAudioMix', () => {
  test('keeps idle race audio quiet', () => {
    const mix = computeRaceAudioMix({
      phase: 'idle',
      speed: 0,
      drift: 0,
      boostActive: false,
    });

    expect(mix.engineFrequency).toBe(72);
    expect(mix.engineGain).toBe(0);
    expect(mix.skidGain).toBe(0);
    expect(mix.boostGain).toBe(0);
  });

  test('raises engine pitch and boost bed while racing fast', () => {
    const mix = computeRaceAudioMix({
      phase: 'racing',
      speed: 58,
      drift: 0.03,
      boostActive: true,
    });

    expect(mix.engineFrequency).toBeGreaterThan(300);
    expect(mix.engineGain).toBeGreaterThan(0.08);
    expect(mix.boostGain).toBeGreaterThan(0.08);
    expect(mix.masterGain).toBeGreaterThan(0.35);
  });

  test('adds skid noise from drift and clamps bad inputs', () => {
    const mix = computeRaceAudioMix({
      phase: 'racing',
      speed: Number.POSITIVE_INFINITY,
      drift: 9,
      boostActive: false,
    });

    expect(mix.engineFrequency).toBeLessThanOrEqual(520);
    expect(mix.skidGain).toBeGreaterThan(0.15);
    expect(mix.skidGain).toBeLessThanOrEqual(0.34);
    expect(mix.boostGain).toBe(0);
  });

  test('uses minimum-safe audio values for NaN speed and drift', () => {
    const mix = computeRaceAudioMix({
      phase: 'racing',
      speed: Number.NaN,
      drift: Number.NaN,
      boostActive: false,
    });

    expect(mix.engineFrequency).toBe(72);
    expect(mix.engineGain).toBe(0.045);
    expect(mix.skidGain).toBe(0);
    expect(mix.boostGain).toBe(0);
  });

  test('uses minimum-safe engine values for infinite speed', () => {
    for (const speed of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const mix = computeRaceAudioMix({
        phase: 'racing',
        speed,
        drift: 0,
        boostActive: false,
      });

      expect(mix.engineFrequency).toBe(72);
      expect(mix.engineGain).toBe(0.045);
      expect(mix.skidGain).toBe(0);
      expect(mix.boostGain).toBe(0);
    }
  });

  test('uses minimum-safe skid values for infinite drift', () => {
    for (const drift of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const mix = computeRaceAudioMix({
        phase: 'racing',
        speed: 0,
        drift,
        boostActive: false,
      });

      expect(mix.engineFrequency).toBe(72);
      expect(mix.engineGain).toBe(0.045);
      expect(mix.skidGain).toBe(0);
      expect(mix.boostGain).toBe(0);
    }
  });

  test('writes mix values into the provided object', () => {
    const target: RaceAudioMix = {
      masterGain: 0,
      engineFrequency: 0,
      engineGain: 0,
      skidGain: 0,
      boostGain: 0,
    };

    const result = writeRaceAudioMix(target, {
      phase: 'racing',
      speed: 36,
      drift: 0.08,
      boostActive: true,
    });

    expect(result).toBe(target);
    expect(target).toEqual(computeRaceAudioMix({
      phase: 'racing',
      speed: 36,
      drift: 0.08,
      boostActive: true,
    }));
  });
});

describe('createRaceAudioSnapshot', () => {
  test('normalizes NaN and non-finite laps to lap 1', () => {
    expect(createRaceAudioSnapshot({ phase: 'racing', lap: Number.NaN, checkpoint: 'start' }).lap).toBe(1);
    expect(createRaceAudioSnapshot({ phase: 'racing', lap: Number.POSITIVE_INFINITY, checkpoint: 'start' }).lap).toBe(1);
    expect(createRaceAudioSnapshot({ phase: 'racing', lap: Number.NEGATIVE_INFINITY, checkpoint: 'start' }).lap).toBe(1);
  });

  test('writes normalized snapshot values into the provided object', () => {
    const target: RaceAudioSnapshot = {
      phase: 'idle',
      lap: 3,
      checkpoint: 'old',
    };

    const result = writeRaceAudioSnapshot(target, {
      phase: 'racing',
      lap: Number.NaN,
      checkpoint: 'harbor',
    });

    expect(result).toBe(target);
    expect(target).toEqual({
      phase: 'racing',
      lap: 1,
      checkpoint: 'harbor',
    });
  });
});

describe('collectRaceAudioCues', () => {
  test('emits start, checkpoint, lap, and finish transition cues', () => {
    const idle = createRaceAudioSnapshot({ phase: 'idle', lap: 1, checkpoint: 'start' });
    const racing = createRaceAudioSnapshot({ phase: 'racing', lap: 1, checkpoint: 'start' });
    const harbor = createRaceAudioSnapshot({ phase: 'racing', lap: 1, checkpoint: 'harbor' });
    const nextLap = createRaceAudioSnapshot({ phase: 'racing', lap: 2, checkpoint: 'start' });
    const finished = createRaceAudioSnapshot({ phase: 'finished', lap: 3, checkpoint: 'finish' });

    expect(collectRaceAudioCues(idle, racing)).toEqual(['start']);
    expect(collectRaceAudioCues(racing, harbor)).toEqual(['checkpoint']);
    expect(collectRaceAudioCues(harbor, nextLap)).toEqual(['lap']);
    expect(collectRaceAudioCues(nextLap, finished)).toEqual(['finish']);
  });

  test('returns a stable empty cue list when there is no transition', () => {
    const previous = createRaceAudioSnapshot({ phase: 'racing', lap: 1, checkpoint: 'start' });
    const current = createRaceAudioSnapshot({ phase: 'racing', lap: 1, checkpoint: 'start' });

    expect(collectRaceAudioCues(previous, current)).toBe(collectRaceAudioCues(previous, current));
  });
});
