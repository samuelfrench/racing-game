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
  readonly targetSpeed: number;
  readonly pressureBonus: number;
  readonly peakPressureBonus: number;
  readonly acceleration: number;
  readonly totalLaps: number;
  readonly finishedAtSeconds: number | null;
};

export type OpponentStepContext = {
  readonly playerDistance?: number;
};

type OpponentConfig = {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly targetSpeed: number;
  readonly acceleration: number;
  readonly startDistance: number;
};

const opponentConfigs: readonly OpponentConfig[] = [
  { id: 'opponent-1', name: 'Mara Voss', color: '#ff4d6d', targetSpeed: 56, acceleration: 18, startDistance: 0 },
  { id: 'opponent-2', name: 'Timo Reyes', color: '#49c6ff', targetSpeed: 54, acceleration: 17, startDistance: -8 },
  { id: 'opponent-3', name: 'Juno Park', color: '#f5d547', targetSpeed: 52, acceleration: 16, startDistance: -16 },
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
      speed: 0,
      targetSpeed: config.targetSpeed,
      pressureBonus: 0,
      peakPressureBonus: 0,
      acceleration: config.acceleration,
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
  context: OpponentStepContext = {},
): readonly OpponentState[] {
  const delta = Math.max(0, deltaSeconds);
  const lapLength = getTrackLapLength(track);

  return opponents.map((opponent) => {
    if (!racing || delta === 0 || opponent.finishedAtSeconds !== null || lapLength === 0) {
      return cloneOpponent(opponent);
    }

    const finishDistance = opponent.totalLaps * lapLength;
    const pressureBonus = computePressureBonus(opponent, context.playerDistance);
    const peakPressureBonus = Math.max(opponent.peakPressureBonus, pressureBonus);
    const pressureTargetSpeed = opponent.targetSpeed + pressureBonus;
    const nextSpeed = approach(opponent.speed, pressureTargetSpeed, opponent.acceleration * delta);
    const nextDistance = opponent.distanceTraveled + nextSpeed * delta;

    if (nextDistance >= finishDistance) {
      const sample = sampleTrackCenterlineAtDistance(track, finishDistance);
      const overshoot = nextDistance - finishDistance;
      const finishedAtSeconds = nextSpeed <= 0 ? elapsedSeconds : elapsedSeconds - overshoot / nextSpeed;

      return {
        ...opponent,
        position: sample.position,
        heading: sample.heading,
        distanceTraveled: finishDistance,
        lap: opponent.totalLaps,
        speed: nextSpeed,
        pressureBonus,
        peakPressureBonus,
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
      speed: nextSpeed,
      pressureBonus,
      peakPressureBonus,
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

function computePressureBonus(opponent: OpponentState, playerDistance: number | undefined): number {
  if (!Number.isFinite(playerDistance)) {
    return 0;
  }

  const gapToPlayer = Math.max(0, (playerDistance ?? 0) - opponent.distanceTraveled);
  const pressureStartGap = 48;
  const pressureFullGap = 140;
  const maxPressureBonus = 7;
  const pressureT = clamp((gapToPlayer - pressureStartGap) / (pressureFullGap - pressureStartGap), 0, 1);
  return Math.round(pressureT * maxPressureBonus * 100) / 100;
}

function approach(current: number, target: number, maximumStep: number): number {
  if (current < target) {
    return Math.min(target, current + maximumStep);
  }

  if (current > target) {
    return Math.max(target, current - maximumStep);
  }

  return target;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
