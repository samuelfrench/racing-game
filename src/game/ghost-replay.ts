export type GhostReplayPose = {
  readonly x: number;
  readonly z: number;
  readonly headingRadians: number;
};

export type GhostReplayPoseSample = GhostReplayPose & {
  readonly lapSeconds: number;
};

export type GhostReplayBestLap = {
  readonly durationSeconds: number;
  readonly samples: readonly GhostReplayPoseSample[];
};

export type GhostReplayState = {
  readonly currentSamples: readonly GhostReplayPoseSample[];
  readonly bestLap: GhostReplayBestLap | null;
};

export type GhostReplayStatusMode = 'empty' | 'recording' | 'best-ready' | 'replaying';

export type GhostReplayStatusState = {
  readonly mode: GhostReplayStatusMode;
  readonly label: string;
  readonly currentSampleCount: number;
  readonly bestSampleCount: number;
  readonly bestLapSeconds: number | null;
};

export function createGhostReplayState(): GhostReplayState {
  return {
    currentSamples: [],
    bestLap: null,
  };
}

export function resetGhostReplayState(): GhostReplayState {
  return createGhostReplayState();
}

export function recordGhostReplaySample(
  state: GhostReplayState,
  sample: GhostReplayPoseSample,
): GhostReplayState {
  const sanitized = sanitizeSample(sample);
  if (sanitized === null) {
    return state;
  }

  return {
    ...state,
    currentSamples: [...state.currentSamples, sanitized],
  };
}

export function completeGhostReplayLap(
  state: GhostReplayState,
  completedLapSeconds: number,
  isPersonalBest: boolean,
): GhostReplayState {
  const bestLap = isPersonalBest
    ? createUsableBestLap(completedLapSeconds, state.currentSamples) ?? state.bestLap
    : state.bestLap;

  return {
    currentSamples: [],
    bestLap,
  };
}

export function sampleGhostReplay(
  state: GhostReplayState,
  currentLapSeconds: number,
): GhostReplayPose | null {
  if (state.bestLap === null || state.bestLap.samples.length === 0) {
    return null;
  }

  const samples = state.bestLap.samples;
  const lapSeconds = Number.isFinite(currentLapSeconds) ? currentLapSeconds : 0;
  const clampedLapSeconds = clamp(lapSeconds, 0, state.bestLap.durationSeconds);

  if (samples.length === 1 || clampedLapSeconds <= samples[0].lapSeconds) {
    return toPose(samples[0]);
  }

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const next = samples[index];

    if (clampedLapSeconds <= next.lapSeconds) {
      const spanSeconds = next.lapSeconds - previous.lapSeconds;
      if (spanSeconds <= 0) {
        return toPose(next);
      }

      const t = (clampedLapSeconds - previous.lapSeconds) / spanSeconds;
      return {
        x: lerp(previous.x, next.x, t),
        z: lerp(previous.z, next.z, t),
        headingRadians: lerp(previous.headingRadians, next.headingRadians, t),
      };
    }
  }

  return toPose(samples[samples.length - 1]);
}

export function createGhostReplayStatus(state: GhostReplayState): GhostReplayStatusState {
  const currentSampleCount = state.currentSamples.length;
  const bestSampleCount = state.bestLap?.samples.length ?? 0;
  const bestLapSeconds = state.bestLap?.durationSeconds ?? null;

  if (state.bestLap !== null && currentSampleCount > 0) {
    return {
      mode: 'replaying',
      label: 'Replaying best ghost',
      currentSampleCount,
      bestSampleCount,
      bestLapSeconds,
    };
  }

  if (currentSampleCount > 0) {
    return {
      mode: 'recording',
      label: 'Recording ghost',
      currentSampleCount,
      bestSampleCount,
      bestLapSeconds,
    };
  }

  if (state.bestLap !== null) {
    return {
      mode: 'best-ready',
      label: 'Best ghost ready',
      currentSampleCount,
      bestSampleCount,
      bestLapSeconds,
    };
  }

  return {
    mode: 'empty',
    label: 'No ghost',
    currentSampleCount,
    bestSampleCount,
    bestLapSeconds,
  };
}

function createUsableBestLap(
  completedLapSeconds: number,
  samples: readonly GhostReplayPoseSample[],
): GhostReplayBestLap | null {
  if (!Number.isFinite(completedLapSeconds) || completedLapSeconds <= 0) {
    return null;
  }

  const usableSamples: GhostReplayPoseSample[] = [];
  for (const sample of samples) {
    const sanitized = sanitizeSample(sample);
    if (sanitized !== null && sanitized.lapSeconds <= completedLapSeconds) {
      usableSamples.push(sanitized);
    }
  }

  if (usableSamples.length === 0) {
    return null;
  }

  usableSamples.sort((left, right) => left.lapSeconds - right.lapSeconds);

  return {
    durationSeconds: completedLapSeconds,
    samples: usableSamples,
  };
}

function sanitizeSample(sample: GhostReplayPoseSample): GhostReplayPoseSample | null {
  if (
    !Number.isFinite(sample.lapSeconds) ||
    sample.lapSeconds < 0 ||
    !Number.isFinite(sample.x) ||
    !Number.isFinite(sample.z) ||
    !Number.isFinite(sample.headingRadians)
  ) {
    return null;
  }

  return {
    lapSeconds: sample.lapSeconds,
    x: sample.x,
    z: sample.z,
    headingRadians: sample.headingRadians,
  };
}

function toPose(sample: GhostReplayPoseSample): GhostReplayPose {
  return {
    x: sample.x,
    z: sample.z,
    headingRadians: sample.headingRadians,
  };
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
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
