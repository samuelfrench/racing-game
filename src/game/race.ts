export type RacePoint = {
  readonly x: number;
  readonly z: number;
};

export type RaceCheckpoint = RacePoint & {
  readonly id: string;
  readonly radius: number;
};

export type CompletedSectorSplit = {
  readonly lapNumber: number;
  readonly sectorNumber: number;
  readonly checkpointId: string;
  readonly seconds: number;
  readonly deltaSeconds: number | null;
  readonly personalBest: boolean;
};

export type RaceProgress = {
  readonly totalLaps: number;
  readonly currentLap: number;
  readonly nextCheckpointIndex: number;
  readonly lapStartedAtSeconds: number | null;
  readonly lastLapSeconds: number | null;
  readonly bestLapSeconds: number | null;
  readonly sectorStartedAtSeconds: number | null;
  readonly lastSectorNumber: number | null;
  readonly lastSectorCheckpointId: string | null;
  readonly lastSectorSeconds: number | null;
  readonly lastSectorDeltaSeconds: number | null;
  readonly lastSectorPersonalBest: boolean;
  readonly bestSectorSeconds: readonly (number | null)[];
  readonly completedLapSeconds: readonly number[];
  readonly completedSectorSplits: readonly CompletedSectorSplit[];
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
    sectorStartedAtSeconds: null,
    lastSectorNumber: null,
    lastSectorCheckpointId: null,
    lastSectorSeconds: null,
    lastSectorDeltaSeconds: null,
    lastSectorPersonalBest: false,
    bestSectorSeconds: checkpoints.map(() => null),
    completedLapSeconds: [],
    completedSectorSplits: [],
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
    const sectorProgress = recordCompletedSector(
      progress,
      progress.nextCheckpointIndex,
      checkpoint.id,
      elapsedSeconds,
    );

    return {
      ...sectorProgress,
      nextCheckpointIndex,
      sectorStartedAtSeconds: elapsedSeconds,
    };
  }

  if (progress.lapStartedAtSeconds === null) {
    return {
      ...progress,
      nextCheckpointIndex,
      lapStartedAtSeconds: elapsedSeconds,
      sectorStartedAtSeconds: elapsedSeconds,
    };
  }

  const sectorProgress = recordCompletedSector(progress, checkpoints.length, checkpoint.id, elapsedSeconds);
  const lapSeconds = elapsedSeconds - progress.lapStartedAtSeconds;
  const bestLapSeconds =
    progress.bestLapSeconds === null ? lapSeconds : Math.min(progress.bestLapSeconds, lapSeconds);
  const finished = progress.currentLap >= progress.totalLaps;

  return {
    ...sectorProgress,
    currentLap: finished ? progress.currentLap : progress.currentLap + 1,
    nextCheckpointIndex: finished ? -1 : nextCheckpointIndex,
    lapStartedAtSeconds: finished ? progress.lapStartedAtSeconds : elapsedSeconds,
    lastLapSeconds: lapSeconds,
    bestLapSeconds,
    completedLapSeconds: [...sectorProgress.completedLapSeconds, lapSeconds],
    sectorStartedAtSeconds: finished ? null : elapsedSeconds,
    finished,
  };
}

function recordCompletedSector(
  progress: RaceProgress,
  sectorNumber: number,
  checkpointId: string,
  elapsedSeconds: number,
): RaceProgress {
  const sectorStartedAtSeconds = progress.sectorStartedAtSeconds ?? elapsedSeconds;
  const sectorSeconds = elapsedSeconds - sectorStartedAtSeconds;
  const sectorIndex = sectorNumber - 1;
  const previousBestSeconds = progress.bestSectorSeconds[sectorIndex] ?? null;
  const sectorDeltaSeconds = previousBestSeconds === null ? null : sectorSeconds - previousBestSeconds;
  const personalBest = previousBestSeconds === null || sectorSeconds < previousBestSeconds;
  const bestSectorSeconds = progress.bestSectorSeconds.map((bestSeconds, index) => {
    if (index !== sectorIndex) {
      return bestSeconds;
    }

    return bestSeconds === null ? sectorSeconds : Math.min(bestSeconds, sectorSeconds);
  });

  return {
    ...progress,
    lastSectorNumber: sectorNumber,
    lastSectorCheckpointId: checkpointId,
    lastSectorSeconds: sectorSeconds,
    lastSectorDeltaSeconds: sectorDeltaSeconds,
    lastSectorPersonalBest: personalBest,
    bestSectorSeconds,
    completedSectorSplits: [
      ...progress.completedSectorSplits,
      {
        lapNumber: progress.currentLap,
        sectorNumber,
        checkpointId,
        seconds: sectorSeconds,
        deltaSeconds: sectorDeltaSeconds,
        personalBest,
      },
    ],
  };
}

function isInsideCheckpoint(position: RacePoint, checkpoint: RaceCheckpoint): boolean {
  return Math.hypot(position.x - checkpoint.x, position.z - checkpoint.z) <= checkpoint.radius;
}
