import type { TrackDefinition, TrackPoint } from './track';

export type TrackProjection = {
  readonly distanceAlongLap: number;
  readonly distanceFromCenter: number;
  readonly segmentIndex: number;
  readonly t: number;
};

export type TrackSample = {
  readonly position: TrackPoint;
  readonly heading: number;
};

type TrackSegment = {
  readonly start: TrackPoint;
  readonly end: TrackPoint;
  readonly length: number;
  readonly startDistance: number;
};

export function getTrackLapLength(track: TrackDefinition): number {
  return getSegmentsLength(createTrackSegments(track.centerline));
}

export function projectPointOntoTrack(track: TrackDefinition, point: TrackPoint): TrackProjection {
  const segments = createTrackSegments(track.centerline);

  if (segments.length === 0) {
    return {
      distanceAlongLap: 0,
      distanceFromCenter: Number.POSITIVE_INFINITY,
      segmentIndex: -1,
      t: 0,
    };
  }

  let closest: TrackProjection | null = null;

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const segmentX = segment.end.x - segment.start.x;
    const segmentZ = segment.end.z - segment.start.z;
    const lengthSq = segmentX * segmentX + segmentZ * segmentZ;
    const t =
      lengthSq === 0
        ? 0
        : clamp(((point.x - segment.start.x) * segmentX + (point.z - segment.start.z) * segmentZ) / lengthSq, 0, 1);
    const projectedX = segment.start.x + segmentX * t;
    const projectedZ = segment.start.z + segmentZ * t;
    const distanceFromCenter = Math.hypot(point.x - projectedX, point.z - projectedZ);
    const projection = {
      distanceAlongLap: segment.startDistance + segment.length * t,
      distanceFromCenter,
      segmentIndex: i,
      t,
    };

    if (closest === null || projection.distanceFromCenter < closest.distanceFromCenter) {
      closest = projection;
    }
  }

  return closest ?? {
    distanceAlongLap: 0,
    distanceFromCenter: Number.POSITIVE_INFINITY,
    segmentIndex: -1,
    t: 0,
  };
}

export function sampleTrackCenterlineAtDistance(track: TrackDefinition, distance: number): TrackSample {
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

  return {
    position: {
      x: lerp(segment.start.x, segment.end.x, t),
      z: lerp(segment.start.z, segment.end.z, t),
    },
    heading: Math.atan2(segment.end.x - segment.start.x, segment.end.z - segment.start.z),
  };
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
