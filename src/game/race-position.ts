import type { RaceProgress } from './race';
import type { TrackDefinition, TrackPoint } from './track';
import { getTrackLapLength, projectPointOntoTrack } from './track-progress';

export type RaceParticipantProgress = {
  readonly id: string;
  readonly name: string;
  readonly distance: number;
  readonly finishedAtSeconds: number | null;
};

export type RacePositionState = {
  readonly position: number;
  readonly total: number;
  readonly participants: readonly RaceParticipantProgress[];
};

export function getPlayerRaceDistance(input: {
  readonly progress: RaceProgress;
  readonly track: TrackDefinition;
  readonly position: TrackPoint;
}): number {
  const lapLength = getTrackLapLength(input.track);

  if (input.progress.finished) {
    return sanitizeDistance(input.progress.totalLaps * lapLength);
  }

  const completedLaps = Math.max(0, input.progress.currentLap - 1);
  const projection = projectPointOntoTrack(input.track, input.position);
  const startCheckpointRadius = input.track.checkpoints[0]?.radius ?? 0;
  const lapDistance =
    lapLength > 0 &&
    input.progress.nextCheckpointIndex === 1 &&
    projection.distanceAlongLap > lapLength - startCheckpointRadius
      ? 0
      : projection.distanceAlongLap;

  return sanitizeDistance(completedLaps * lapLength + lapDistance);
}

export function rankRaceParticipants(
  participants: readonly RaceParticipantProgress[],
  playerId = 'player',
): RacePositionState {
  const sorted = [...participants].sort((a, b) => compareParticipants(a, b, playerId));
  const playerIndex = sorted.findIndex((participant) => participant.id === playerId);

  return {
    position: playerIndex >= 0 ? playerIndex + 1 : sorted.length,
    total: sorted.length,
    participants: sorted,
  };
}

function compareParticipants(a: RaceParticipantProgress, b: RaceParticipantProgress, playerId: string): number {
  const aFinished = a.finishedAtSeconds !== null;
  const bFinished = b.finishedAtSeconds !== null;

  if (aFinished && !bFinished) {
    return -1;
  }

  if (!aFinished && bFinished) {
    return 1;
  }

  if (aFinished && bFinished) {
    const finishDifference = (a.finishedAtSeconds ?? 0) - (b.finishedAtSeconds ?? 0);
    if (finishDifference !== 0) {
      return finishDifference;
    }

    return compareTiedParticipants(a.id, b.id, playerId);
  }

  const distanceDifference = sanitizeDistance(b.distance) - sanitizeDistance(a.distance);
  if (distanceDifference !== 0) {
    return distanceDifference;
  }

  return compareTiedParticipants(a.id, b.id, playerId);
}

function compareTiedParticipants(aId: string, bId: string, playerId: string): number {
  if (aId === playerId && bId !== playerId) {
    return -1;
  }

  if (bId === playerId && aId !== playerId) {
    return 1;
  }

  return aId.localeCompare(bId);
}

function sanitizeDistance(distance: number): number {
  return Number.isFinite(distance) ? Math.max(0, distance) : 0;
}
