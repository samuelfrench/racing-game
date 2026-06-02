import { describe, expect, it } from 'vitest';
import { createDefaultTrack, sampleTrackFeatureEffects, sampleTrackSurface } from './track';

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
      'chicane',
      'market',
      'switchback',
      'summit',
      'tunnel',
      'marina',
    ]);
    expect(track.checkpoints[0].radius).toBeGreaterThanOrEqual(track.roadWidth * 0.5);
  });

  it('defines a longer technical lap with boost pads and obstacle hazards', () => {
    const track = createDefaultTrack();

    expect(track.centerline).toHaveLength(16);
    expect(track.checkpoints).toHaveLength(8);
    expect(track.boostPads).toHaveLength(4);
    expect(track.obstacles).toHaveLength(5);
    expect(new Set(track.boostPads.map((pad) => pad.id)).size).toBe(track.boostPads.length);
    expect(new Set(track.obstacles.map((obstacle) => obstacle.id)).size).toBe(track.obstacles.length);
    expect(track.boostPads.every((pad) => pad.radius > 4 && pad.strength > 0)).toBe(true);
    expect(track.obstacles.every((obstacle) => obstacle.radius > 3 && obstacle.severity > 0)).toBe(true);
  });

  it('samples active boost pads and obstacle hazards near the car', () => {
    const track = createDefaultTrack();
    const boostPad = track.boostPads[0];
    const obstacle = track.obstacles[0];

    expect(sampleTrackFeatureEffects(track, boostPad.x, boostPad.z)).toMatchObject({
      boostPad,
      obstacle: null,
    });
    expect(sampleTrackFeatureEffects(track, obstacle.x, obstacle.z)).toMatchObject({
      boostPad: null,
      obstacle,
    });
    expect(sampleTrackFeatureEffects(track, 240, 240)).toEqual({
      boostPad: null,
      obstacle: null,
    });
  });
});
