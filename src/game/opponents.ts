import type { RaceResult } from './race-session';
import type { TrackDefinition, TrackPoint } from './track';

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

type TrackSegment = {
  readonly start: TrackPoint;
  readonly end: TrackPoint;
  readonly length: number;
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
    const sample = sampleCenterlineAtDistance(track, config.startDistance);

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
  const lapLength = getLapLength(track);

  return opponents.map((opponent) => {
    if (!racing || delta === 0 || opponent.finishedAtSeconds !== null || lapLength === 0) {
      return cloneOpponent(opponent);
    }

    const finishDistance = opponent.totalLaps * lapLength;
    const nextDistance = opponent.distanceTraveled + opponent.speed * delta;

    if (nextDistance >= finishDistance) {
      const sample = sampleCenterlineAtDistance(track, finishDistance);
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

    const sample = sampleCenterlineAtDistance(track, nextDistance);

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

function sampleCenterlineAtDistance(
  track: TrackDefinition,
  distance: number,
): { readonly position: TrackPoint; readonly heading: number } {
  const segments = createTrackSegments(track.centerline);
  const lapLength = getSegmentsLength(segments);

  if (segments.length === 0 || lapLength === 0) {
    const fallback = track.centerline[0] ?? { x: 0, z: 0 };
    return { position: { ...fallback }, heading: 0 };
  }

  const lapDistance = positiveModulo(distance, lapLength);
  const segment = segments.find((candidate) => lapDistance <= candidate.startDistance + candidate.length) ?? segments[0];
  const segmentDistance = lapDistance - segment.startDistance;
  const t = segment.length === 0 ? 0 : clamp(segmentDistance / segment.length, 0, 1);
  const x = lerp(segment.start.x, segment.end.x, t);
  const z = lerp(segment.start.z, segment.end.z, t);

  return {
    position: { x, z },
    heading: Math.atan2(segment.end.x - segment.start.x, segment.end.z - segment.start.z),
  };
}

function getLapLength(track: TrackDefinition): number {
  return getSegmentsLength(createTrackSegments(track.centerline));
}

function createTrackSegments(points: readonly TrackPoint[]): readonly TrackSegment[] {
  if (points.length < 2) {
    return [];
  }

  const segments: TrackSegment[] = [];
  let startDistance = 0;

  for (let i = 0; i < points.length; i += 1) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    const length = Math.hypot(end.x - start.x, end.z - start.z);

    segments.push({ start, end, length, startDistance });
    startDistance += length;
  }

  return segments;
}

function getSegmentsLength(segments: readonly TrackSegment[]): number {
  return segments.reduce((sum, segment) => sum + segment.length, 0);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
