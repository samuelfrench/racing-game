import type { RaceResult } from './race-session';
import type { TrackDefinition, TrackPoint } from './track';
import { getTrackLapLength, sampleTrackCenterlineAtDistance } from './track-progress';

export type OpponentState = {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly position: TrackPoint;
  readonly heading: number;
  readonly distanceTraveled: number;
  readonly lap: number;
  readonly speed: number;
  readonly totalLaps: number;
  readonly finishedAtSeconds: number | null;
};

type OpponentConfig = {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly speed: number;
  readonly startDistance: number;
};

const opponentConfigs: readonly OpponentConfig[] = [
  { id: 'opponent-1', name: 'Mara Voss', color: '#ff4d6d', speed: 58, startDistance: 0 },
  { id: 'opponent-2', name: 'Timo Reyes', color: '#49c6ff', speed: 56, startDistance: -8 },
  { id: 'opponent-3', name: 'Juno Park', color: '#f5d547', speed: 54, startDistance: -16 },
];

export function createOpponentGrid(track: TrackDefinition, totalLaps: number): readonly OpponentState[] {
  const laps = Math.max(1, Math.trunc(totalLaps));

  return opponentConfigs.map((config) => {
    const sample = sampleTrackCenterlineAtDistance(track, config.startDistance);

    return {
      id: config.id,
      name: config.name,
      color: config.color,
      position: sample.position,
      heading: sample.heading,
      distanceTraveled: config.startDistance,
      lap: 1,
      speed: config.speed,
      totalLaps: laps,
      finishedAtSeconds: null,
    };
  });
}

export function stepOpponents(
  opponents: readonly OpponentState[],
  track: TrackDefinition,
  deltaSeconds: number,
  racing: boolean,
  elapsedSeconds: number,
): readonly OpponentState[] {
  const delta = Math.max(0, deltaSeconds);
  const lapLength = getTrackLapLength(track);

  return opponents.map((opponent) => {
    if (!racing || delta === 0 || opponent.finishedAtSeconds !== null || lapLength === 0) {
      return cloneOpponent(opponent);
    }

    const finishDistance = opponent.totalLaps * lapLength;
    const nextDistance = opponent.distanceTraveled + opponent.speed * delta;

    if (nextDistance >= finishDistance) {
      const sample = sampleTrackCenterlineAtDistance(track, finishDistance);
      const overshoot = nextDistance - finishDistance;
      const finishedAtSeconds = opponent.speed <= 0 ? elapsedSeconds : elapsedSeconds - overshoot / opponent.speed;

      return {
        ...opponent,
        position: sample.position,
        heading: sample.heading,
        distanceTraveled: finishDistance,
        lap: opponent.totalLaps,
        finishedAtSeconds,
      };
    }

    const sample = sampleTrackCenterlineAtDistance(track, nextDistance);

    return {
      ...opponent,
      position: sample.position,
      heading: sample.heading,
      distanceTraveled: nextDistance,
      lap: getLapForDistance(nextDistance, lapLength, opponent.totalLaps),
    };
  });
}

export function getOpponentResults(opponents: readonly OpponentState[]): readonly RaceResult[] {
  const results: RaceResult[] = [];

  for (const opponent of opponents) {
    if (opponent.finishedAtSeconds === null) {
      continue;
    }

    results.push({
      id: opponent.id,
      name: opponent.name,
      finishSeconds: opponent.finishedAtSeconds,
    });
  }

  return results.sort((a, b) => a.finishSeconds - b.finishSeconds);
}

function cloneOpponent(opponent: OpponentState): OpponentState {
  return {
    ...opponent,
    position: { ...opponent.position },
  };
}

function getLapForDistance(distance: number, lapLength: number, totalLaps: number): number {
  const lap = Math.floor(Math.max(0, distance) / lapLength) + 1;
  return Math.min(totalLaps, lap);
}
