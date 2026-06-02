export type TrackPoint = {
  readonly x: number;
  readonly z: number;
};

export type TrackCheckpoint = TrackPoint & {
  readonly id: string;
  readonly radius: number;
};

export type TrackBoostPad = TrackPoint & {
  readonly id: string;
  readonly radius: number;
  readonly strength: number;
};

export type TrackObstacle = TrackPoint & {
  readonly id: string;
  readonly radius: number;
  readonly severity: number;
};

export type TrackGrossHazard = TrackPoint & {
  readonly id: string;
  readonly kind: 'peeSprayer' | 'poopLog';
  readonly radius: number;
  readonly severity: number;
};

export type TrackDefinition = {
  readonly name: string;
  readonly roadWidth: number;
  readonly shoulderWidth: number;
  readonly centerline: readonly TrackPoint[];
  readonly checkpoints: readonly TrackCheckpoint[];
  readonly boostPads: readonly TrackBoostPad[];
  readonly obstacles: readonly TrackObstacle[];
  readonly grossHazards: readonly TrackGrossHazard[];
};

export type TrackSurfaceSample = {
  readonly distanceFromCenter: number;
  readonly onRoad: boolean;
  readonly grip: number;
};

export type TrackFeatureEffects = {
  readonly boostPad: TrackBoostPad | null;
  readonly obstacle: TrackObstacle | null;
  readonly grossHazard: TrackGrossHazard | null;
};

const centerline: readonly TrackPoint[] = [
  { x: 0, z: 132 },
  { x: 52, z: 124 },
  { x: 105, z: 102 },
  { x: 138, z: 62 },
  { x: 122, z: 28 },
  { x: 154, z: -16 },
  { x: 126, z: -74 },
  { x: 74, z: -112 },
  { x: 18, z: -126 },
  { x: -38, z: -112 },
  { x: -84, z: -126 },
  { x: -136, z: -74 },
  { x: -150, z: -16 },
  { x: -122, z: 46 },
  { x: -82, z: 94 },
  { x: -38, z: 124 },
];

const boostPads: readonly TrackBoostPad[] = [
  { id: 'harbor-kick', x: 82, z: 112, radius: 7.4, strength: 1 },
  { id: 'chicane-exit', x: 142, z: -38, radius: 7.2, strength: 0.9 },
  { id: 'market-straight', x: 48, z: -120, radius: 7.6, strength: 1.08 },
  { id: 'marina-run', x: -54, z: 112, radius: 7, strength: 0.96 },
];

const obstacles: readonly TrackObstacle[] = [
  { id: 'dock-crates', x: 128, z: 42, radius: 5.6, severity: 0.52 },
  { id: 'apex-barrels', x: 106, z: -92, radius: 5.1, severity: 0.62 },
  { id: 'switchback-cones', x: -58, z: -120, radius: 4.8, severity: 0.48 },
  { id: 'summit-crates', x: -148, z: -34, radius: 5.4, severity: 0.58 },
  { id: 'tunnel-debris', x: -106, z: 76, radius: 5, severity: 0.5 },
];

const grossHazards: readonly TrackGrossHazard[] = [
  { id: 'piddle-sprayer', kind: 'peeSprayer', x: 116, z: 82, radius: 6.2, severity: 0.42 },
  { id: 'stinky-log', kind: 'poopLog', x: -120, z: 46, radius: 6.8, severity: 0.76 },
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
      { id: 'chicane', ...centerline[5], radius: checkpointRadius },
      { id: 'market', ...centerline[7], radius: checkpointRadius },
      { id: 'switchback', ...centerline[10], radius: checkpointRadius },
      { id: 'summit', ...centerline[12], radius: checkpointRadius },
      { id: 'tunnel', ...centerline[14], radius: checkpointRadius },
      { id: 'marina', ...centerline[15], radius: checkpointRadius },
    ],
    boostPads,
    obstacles,
    grossHazards,
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

export function sampleTrackFeatureEffects(track: TrackDefinition, x: number, z: number): TrackFeatureEffects {
  return {
    boostPad: findNearestFeature(track.boostPads, x, z),
    obstacle: findNearestFeature(track.obstacles, x, z),
    grossHazard: findNearestFeature(track.grossHazards, x, z),
  };
}

function findNearestFeature<TFeature extends TrackPoint & { readonly radius: number }>(
  features: readonly TFeature[],
  x: number,
  z: number,
): TFeature | null {
  let nearest: TFeature | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const feature of features) {
    const distance = Math.hypot(x - feature.x, z - feature.z);
    if (distance <= feature.radius && distance < nearestDistance) {
      nearest = feature;
      nearestDistance = distance;
    }
  }

  return nearest;
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
