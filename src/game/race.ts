export type RacePoint = {
  readonly x: number;
  readonly z: number;
};

export type RaceCheckpoint = RacePoint & {
  readonly id: string;
  readonly radius: number;
};

export type RaceProgress = {
  readonly totalLaps: number;
  readonly currentLap: number;
  readonly nextCheckpointIndex: number;
  readonly lapStartedAtSeconds: number | null;
  readonly lastLapSeconds: number | null;
  readonly bestLapSeconds: number | null;
  readonly finished: boolean;
};

export function createRaceProgress(checkpoints: readonly RaceCheckpoint[], totalLaps: number): RaceProgress {
  return {
    totalLaps: Math.max(1, Math.trunc(totalLaps)),
    currentLap: 1,
    nextCheckpointIndex: checkpoints.length === 0 ? -1 : 0,
    lapStartedAtSeconds: null,
    lastLapSeconds: null,
    bestLapSeconds: null,
    finished: checkpoints.length === 0,
  };
}

export function updateRaceProgress(
  progress: RaceProgress,
  checkpoints: readonly RaceCheckpoint[],
  position: RacePoint,
  elapsedSeconds: number,
): RaceProgress {
  if (progress.finished || checkpoints.length === 0 || progress.nextCheckpointIndex < 0) {
    return progress;
  }

  const checkpoint = checkpoints[progress.nextCheckpointIndex];
  if (!isInsideCheckpoint(position, checkpoint)) {
    return progress;
  }

  const nextCheckpointIndex = (progress.nextCheckpointIndex + 1) % checkpoints.length;

  if (progress.nextCheckpointIndex !== 0) {
    return {
      ...progress,
      nextCheckpointIndex,
    };
  }

  if (progress.lapStartedAtSeconds === null) {
    return {
      ...progress,
      nextCheckpointIndex,
      lapStartedAtSeconds: elapsedSeconds,
    };
  }

  const lapSeconds = elapsedSeconds - progress.lapStartedAtSeconds;
  const bestLapSeconds =
    progress.bestLapSeconds === null ? lapSeconds : Math.min(progress.bestLapSeconds, lapSeconds);
  const finished = progress.currentLap >= progress.totalLaps;

  return {
    ...progress,
    currentLap: finished ? progress.currentLap : progress.currentLap + 1,
    nextCheckpointIndex: finished ? -1 : nextCheckpointIndex,
    lapStartedAtSeconds: elapsedSeconds,
    lastLapSeconds: lapSeconds,
    bestLapSeconds,
    finished,
  };
}

function isInsideCheckpoint(position: RacePoint, checkpoint: RaceCheckpoint): boolean {
  return Math.hypot(position.x - checkpoint.x, position.z - checkpoint.z) <= checkpoint.radius;
}
