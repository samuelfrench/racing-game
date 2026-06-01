import { describe, expect, it } from 'vitest';
import {
  completeGhostReplayLap,
  createGhostReplayState,
  createGhostReplayStatus,
  recordGhostReplaySample,
  resetGhostReplayState,
  sampleGhostReplay,
  type GhostReplayPoseSample,
} from './ghost-replay';

describe('ghost replay', () => {
  it('starts and resets to a compact empty status', () => {
    const initial = createGhostReplayState();

    expect(initial.currentSamples).toEqual([]);
    expect(initial.bestLap).toBeNull();
    expect(createGhostReplayStatus(initial)).toEqual({
      mode: 'empty',
      label: 'No ghost',
      currentSampleCount: 0,
      bestSampleCount: 0,
      bestLapSeconds: null,
    });

    const recording = recordGhostReplaySample(initial, sample(1, 4, 8, 0.25));
    const reset = resetGhostReplayState();

    expect(recording.currentSamples).toHaveLength(1);
    expect(reset).toEqual(initial);
    expect(reset).not.toBe(initial);
  });

  it('records finite current-lap samples without mutating earlier state', () => {
    const initial = createGhostReplayState();
    const input = sample(1, 10, 20, 0.5);

    const first = recordGhostReplaySample(initial, input);
    const invalid = recordGhostReplaySample(first, sample(Number.NaN, 1, 2, 3));
    const second = recordGhostReplaySample(first, sample(2, 14, 28, 0.9));
    (input as { x: number }).x = 99;

    expect(initial.currentSamples).toEqual([]);
    expect(first.currentSamples).toEqual([sample(1, 10, 20, 0.5)]);
    expect(invalid).toBe(first);
    expect(second.currentSamples).toEqual([sample(1, 10, 20, 0.5), sample(2, 14, 28, 0.9)]);
    expect(createGhostReplayStatus(second)).toMatchObject({
      mode: 'recording',
      label: 'Recording ghost',
      currentSampleCount: 2,
    });
  });

  it('stores current recording as best only for personal-best laps with usable data', () => {
    let state = createGhostReplayState();
    state = recordGhostReplaySample(state, sample(0, 0, 0, 0));
    state = recordGhostReplaySample(state, sample(12, 120, 10, 1.2));

    const best = completeGhostReplayLap(state, 12, true);

    expect(best.currentSamples).toEqual([]);
    expect(best.bestLap).toEqual({
      durationSeconds: 12,
      samples: [sample(0, 0, 0, 0), sample(12, 120, 10, 1.2)],
    });
    expect(createGhostReplayStatus(best)).toMatchObject({
      mode: 'best-ready',
      label: 'Best ghost ready',
      bestSampleCount: 2,
      bestLapSeconds: 12,
    });

    const nextRecording = recordGhostReplaySample(best, sample(1, 5, 5, 0.2));
    const nonBest = completeGhostReplayLap(nextRecording, 14, false);

    expect(createGhostReplayStatus(nextRecording)).toMatchObject({
      mode: 'replaying',
      label: 'Replaying best ghost',
    });
    expect(nonBest.currentSamples).toEqual([]);
    expect(nonBest.bestLap).toBe(best.bestLap);
  });

  it('clears unusable completed laps without poisoning the previous best', () => {
    const previousBest = completeGhostReplayLap(
      recordGhostReplaySample(createGhostReplayState(), sample(1, 10, 0, 0.1)),
      9,
      true,
    );
    const invalidDurationRecording = recordGhostReplaySample(previousBest, sample(2, 20, 0, 0.2));
    const invalidDuration = completeGhostReplayLap(
      invalidDurationRecording,
      Number.POSITIVE_INFINITY,
      true,
    );
    const noSamples = completeGhostReplayLap(createGhostReplayState(), 8, true);

    expect(invalidDuration.currentSamples).toEqual([]);
    expect(invalidDuration.bestLap).toBe(previousBest.bestLap);
    expect(noSamples.bestLap).toBeNull();
  });

  it('samples null without a best replay and clamps or interpolates best-lap poses', () => {
    let state = createGhostReplayState();
    state = recordGhostReplaySample(state, sample(0, 0, 0, 0));
    state = recordGhostReplaySample(state, sample(5, 10, 20, 1));
    state = recordGhostReplaySample(state, sample(10, 20, 10, 2));
    const best = completeGhostReplayLap(state, 10, true);

    expect(sampleGhostReplay(createGhostReplayState(), 2)).toBeNull();
    expect(sampleGhostReplay(best, -1)).toEqual({ x: 0, z: 0, headingRadians: 0 });
    expect(sampleGhostReplay(best, 20)).toEqual({ x: 20, z: 10, headingRadians: 2 });
    expect(sampleGhostReplay(best, 2.5)).toEqual({ x: 5, z: 10, headingRadians: 0.5 });
    expect(sampleGhostReplay(best, 7.5)).toEqual({ x: 15, z: 15, headingRadians: 1.5 });
    expect(sampleGhostReplay(best, Number.NaN)).toEqual({ x: 0, z: 0, headingRadians: 0 });
  });
});

function sample(
  lapSeconds: number,
  x: number,
  z: number,
  headingRadians: number,
): GhostReplayPoseSample {
  return { lapSeconds, x, z, headingRadians };
}
