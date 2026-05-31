import { describe, expect, it } from 'vitest';
import type { TrackDefinition } from './track';
import {
  getTrackLapLength,
  projectPointOntoTrack,
  sampleTrackCenterlineAtDistance,
} from './track-progress';

const squareTrack: TrackDefinition = {
  name: 'Test Square',
  roadWidth: 10,
  shoulderWidth: 2,
  centerline: [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 10, z: 10 },
    { x: 0, z: 10 },
  ],
  checkpoints: [],
};

describe('track progress', () => {
  it('gets the lap length of a simple closed square track', () => {
    expect(getTrackLapLength(squareTrack)).toBe(40);
  });

  it('projects a point onto a segment with lap distance and center distance', () => {
    const projection = projectPointOntoTrack(squareTrack, { x: 4, z: 3 });

    expect(projection).toEqual({
      distanceAlongLap: 4,
      distanceFromCenter: 3,
      segmentIndex: 0,
      t: 0.4,
    });
  });

  it('samples the centerline with oversized and negative distances wrapped around the lap', () => {
    expect(sampleTrackCenterlineAtDistance(squareTrack, 42)).toEqual({
      position: { x: 2, z: 0 },
      heading: Math.PI / 2,
    });
    expect(sampleTrackCenterlineAtDistance(squareTrack, -5)).toEqual({
      position: { x: 0, z: 5 },
      heading: Math.PI,
    });
  });
});
