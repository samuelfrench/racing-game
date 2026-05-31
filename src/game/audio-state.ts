import type { RacePhase } from './race-session';

export type RaceAudioCue = 'start' | 'checkpoint' | 'lap' | 'finish';

export type RaceAudioMixInput = {
  readonly phase: RacePhase;
  readonly speed: number;
  readonly drift: number;
  readonly boostActive: boolean;
};

export type RaceAudioMix = {
  readonly masterGain: number;
  readonly engineFrequency: number;
  readonly engineGain: number;
  readonly skidGain: number;
  readonly boostGain: number;
};

export type RaceAudioSnapshot = {
  readonly phase: RacePhase;
  readonly lap: number;
  readonly checkpoint: string;
};

export function computeRaceAudioMix(input: RaceAudioMixInput): RaceAudioMix {
  const speedT = clamp(Math.abs(input.speed) / 72, 0, 1);
  const driftT = clamp(input.drift * 2.8, 0, 1);
  const active = input.phase === 'racing' || input.phase === 'finished';
  const masterGain = active ? 0.42 : 0.16;
  const engineGain = input.phase === 'racing' ? lerp(0.045, 0.16, speedT) : 0;
  const boostGain = input.phase === 'racing' && input.boostActive ? lerp(0.08, 0.16, speedT) : 0;

  return {
    masterGain: round(masterGain, 3),
    engineFrequency: round(clamp(lerp(72, 520, speedT) + (input.boostActive ? 34 : 0), 72, 520), 2),
    engineGain: round(engineGain, 3),
    skidGain: round(input.phase === 'racing' ? lerp(0, 0.34, driftT) : 0, 3),
    boostGain: round(boostGain, 3),
  };
}

export function createRaceAudioSnapshot(input: RaceAudioSnapshot): RaceAudioSnapshot {
  const lap = Number.isFinite(input.lap) ? Math.max(1, Math.trunc(input.lap)) : 1;

  return {
    phase: input.phase,
    lap,
    checkpoint: input.checkpoint,
  };
}

export function collectRaceAudioCues(
  previous: RaceAudioSnapshot,
  current: RaceAudioSnapshot,
): readonly RaceAudioCue[] {
  if (previous.phase !== 'finished' && current.phase === 'finished') {
    return ['finish'];
  }

  if (previous.phase !== 'racing' && current.phase === 'racing') {
    return ['start'];
  }

  if (current.phase !== 'racing') {
    return [];
  }

  if (current.lap > previous.lap) {
    return ['lap'];
  }

  if (current.checkpoint !== previous.checkpoint) {
    return ['checkpoint'];
  }

  return [];
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  if (value === Number.POSITIVE_INFINITY) {
    return max;
  }
  if (value === Number.NEGATIVE_INFINITY) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
