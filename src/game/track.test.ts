import { describe, expect, it } from 'vitest';
import { createDefaultTrack, sampleTrackSurface } from './track';

describe('track geometry', () => {
  it('classifies centerline as road and far points as dirt', () => {
    const track = createDefaultTrack();
    const firstPoint = track.centerline[0];

    const center = sampleTrackSurface(track, firstPoint.x, firstPoint.z);
    const far = sampleTrackSurface(track, firstPoint.x + 180, firstPoint.z + 180);

    expect(center.onRoad).toBe(true);
    expect(center.grip).toBe(1);
    expect(far.onRoad).toBe(false);
    expect(far.grip).toBeLessThan(0.6);
  });

  it('places checkpoint gates in stable race order', () => {
    const track = createDefaultTrack();

    expect(track.checkpoints.map((checkpoint) => checkpoint.id)).toEqual([
      'start',
      'harbor',
      'esses',
      'summit',
      'tunnel',
    ]);
    expect(track.checkpoints[0].radius).toBeGreaterThanOrEqual(track.roadWidth * 0.5);
  });
});

