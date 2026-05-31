export type TrackPoint = {
  readonly x: number;
  readonly z: number;
};

export type TrackCheckpoint = TrackPoint & {
  readonly id: string;
  readonly radius: number;
};

export type TrackDefinition = {
  readonly name: string;
  readonly roadWidth: number;
  readonly shoulderWidth: number;
  readonly centerline: readonly TrackPoint[];
  readonly checkpoints: readonly TrackCheckpoint[];
};

export type TrackSurfaceSample = {
  readonly distanceFromCenter: number;
  readonly onRoad: boolean;
  readonly grip: number;
};

const centerline: readonly TrackPoint[] = [
  { x: 0, z: 118 },
  { x: 98, z: 92 },
  { x: 148, z: 18 },
  { x: 118, z: -72 },
  { x: 34, z: -116 },
  { x: -70, z: -104 },
  { x: -138, z: -38 },
  { x: -124, z: 58 },
  { x: -54, z: 116 },
];

export function createDefaultTrack(): TrackDefinition {
  const roadWidth = 22;
  const checkpointRadius = roadWidth * 0.75;

  return {
    name: 'Neon Harbor GP',
    roadWidth,
    shoulderWidth: 8,
    centerline,
    checkpoints: [
      { id: 'start', ...centerline[0], radius: checkpointRadius },
      { id: 'harbor', ...centerline[2], radius: checkpointRadius },
      { id: 'esses', ...centerline[4], radius: checkpointRadius },
      { id: 'summit', ...centerline[6], radius: checkpointRadius },
      { id: 'tunnel', ...centerline[8], radius: checkpointRadius },
    ],
  };
}

export function sampleTrackSurface(track: TrackDefinition, x: number, z: number): TrackSurfaceSample {
  const distanceFromCenter = distanceToPolyline(track.centerline, { x, z });
  const halfRoad = track.roadWidth * 0.5;
  const shoulderLimit = halfRoad + track.shoulderWidth;
  const onRoad = distanceFromCenter <= halfRoad;

  if (onRoad) {
    return { distanceFromCenter, onRoad, grip: 1 };
  }

  if (distanceFromCenter <= shoulderLimit) {
    const shoulderT = (distanceFromCenter - halfRoad) / track.shoulderWidth;
    return { distanceFromCenter, onRoad, grip: lerp(0.82, 0.5, shoulderT) };
  }

  return { distanceFromCenter, onRoad, grip: 0.38 };
}

function distanceToPolyline(points: readonly TrackPoint[], point: TrackPoint): number {
  let closest = Number.POSITIVE_INFINITY;

  for (let i = 0; i < points.length; i += 1) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    closest = Math.min(closest, distanceToSegment(start, end, point));
  }

  return closest;
}

function distanceToSegment(start: TrackPoint, end: TrackPoint, point: TrackPoint): number {
  const segmentX = end.x - start.x;
  const segmentZ = end.z - start.z;
  const lengthSq = segmentX * segmentX + segmentZ * segmentZ;
  const t = lengthSq === 0 ? 0 : clamp(((point.x - start.x) * segmentX + (point.z - start.z) * segmentZ) / lengthSq, 0, 1);
  const projectedX = start.x + segmentX * t;
  const projectedZ = start.z + segmentZ * t;
  return Math.hypot(point.x - projectedX, point.z - projectedZ);
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

