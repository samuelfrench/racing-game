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

export type RaceAudioMixTarget = {
  masterGain: number;
  engineFrequency: number;
  engineGain: number;
  skidGain: number;
  boostGain: number;
};

export type RaceAudioSnapshot = {
  readonly phase: RacePhase;
  readonly lap: number;
  readonly checkpoint: string;
};

export type RaceAudioSnapshotTarget = {
  phase: RacePhase;
  lap: number;
  checkpoint: string;
};

const noCues = [] as const satisfies readonly RaceAudioCue[];
const startCue = ['start'] as const satisfies readonly RaceAudioCue[];
const checkpointCue = ['checkpoint'] as const satisfies readonly RaceAudioCue[];
const lapCue = ['lap'] as const satisfies readonly RaceAudioCue[];
const finishCue = ['finish'] as const satisfies readonly RaceAudioCue[];

export function computeRaceAudioMix(input: RaceAudioMixInput): RaceAudioMix {
  return writeRaceAudioMix({
    masterGain: 0,
    engineFrequency: 0,
    engineGain: 0,
    skidGain: 0,
    boostGain: 0,
  }, input);
}

export function writeRaceAudioMix(target: RaceAudioMixTarget, input: RaceAudioMixInput): RaceAudioMixTarget {
  const speed = Number.isFinite(input.speed) ? input.speed : 0;
  const drift = Number.isFinite(input.drift) ? input.drift : 0;
  const speedT = clamp(Math.abs(speed) / 72, 0, 1);
  const driftT = clamp(drift * 2.8, 0, 1);
  const active = input.phase === 'racing' || input.phase === 'finished';
  const masterGain = active ? 0.42 : 0.16;
  const engineGain = input.phase === 'racing' ? lerp(0.045, 0.16, speedT) : 0;
  const boostGain = input.phase === 'racing' && input.boostActive ? lerp(0.08, 0.16, speedT) : 0;

  target.masterGain = round(masterGain, 3);
  target.engineFrequency = round(clamp(lerp(72, 520, speedT) + (input.boostActive ? 34 : 0), 72, 520), 2);
  target.engineGain = round(engineGain, 3);
  target.skidGain = round(input.phase === 'racing' ? lerp(0, 0.34, driftT) : 0, 3);
  target.boostGain = round(boostGain, 3);

  return target;
}

export function createRaceAudioSnapshot(input: RaceAudioSnapshot): RaceAudioSnapshot {
  return writeRaceAudioSnapshot({
    phase: input.phase,
    lap: 1,
    checkpoint: input.checkpoint,
  }, input);
}

export function writeRaceAudioSnapshot(
  target: RaceAudioSnapshotTarget,
  input: RaceAudioSnapshot,
): RaceAudioSnapshotTarget {
  const lap = Number.isFinite(input.lap) ? Math.max(1, Math.trunc(input.lap)) : 1;

  target.phase = input.phase;
  target.lap = lap;
  target.checkpoint = input.checkpoint;

  return target;
}

export function collectRaceAudioCues(
  previous: RaceAudioSnapshot,
  current: RaceAudioSnapshot,
): readonly RaceAudioCue[] {
  if (previous.phase !== 'finished' && current.phase === 'finished') {
    return finishCue;
  }

  if (previous.phase !== 'racing' && current.phase === 'racing') {
    return startCue;
  }

  if (current.phase !== 'racing') {
    return noCues;
  }

  if (current.lap > previous.lap) {
    return lapCue;
  }

  if (current.checkpoint !== previous.checkpoint) {
    return checkpointCue;
  }

  return noCues;
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
