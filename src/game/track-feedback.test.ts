import { describe, expect, it } from 'vitest';
import type { TrackDefinition } from './track';
import type { VehicleState } from './vehicle';
import { createTrackFeedbackState, updateTrackFeedback } from './track-feedback';

const squareTrack: TrackDefinition = {
  name: 'Test Square',
  roadWidth: 10,
  shoulderWidth: 5,
  centerline: [
    { x: 0, z: 0 },
    { x: 100, z: 0 },
    { x: 100, z: 100 },
    { x: 0, z: 100 },
  ],
  checkpoints: [],
};

function vehicle(overrides: Partial<VehicleState> = {}): VehicleState {
  return {
    position: { x: 40, z: 0 },
    heading: Math.PI / 2,
    speed: 18,
    lateralVelocity: 0,
    drift: 0,
    boostFuel: 0.7,
    ...overrides,
  };
}

describe('track feedback', () => {
  it('keeps on-road driving clear of warnings', () => {
    const result = updateTrackFeedback(createTrackFeedbackState(), {
      track: squareTrack,
      vehicle: vehicle(),
      deltaSeconds: 1 / 60,
      racing: true,
    });

    expect(result.state).toMatchObject({
      offTrack: false,
      wrongWay: false,
      recovering: false,
      message: null,
    });
    expect(result.vehicle).toEqual(vehicle());
  });

  it('warns off track without recovering while the car is near the shoulder', () => {
    const result = updateTrackFeedback(createTrackFeedbackState(), {
      track: squareTrack,
      vehicle: vehicle({ position: { x: 40, z: 8 } }),
      deltaSeconds: 1 / 60,
      racing: true,
    });

    expect(result.state.offTrack).toBe(true);
    expect(result.state.recovering).toBe(false);
    expect(result.state.message).toBe('OFF TRACK');
    expect(result.vehicle.position).toEqual({ x: 40, z: 8 });
  });

  it('shows wrong way only after sustained opposite travel', () => {
    const first = updateTrackFeedback(createTrackFeedbackState(), {
      track: squareTrack,
      vehicle: vehicle({ speed: -10 }),
      deltaSeconds: 0.25,
      racing: true,
    });
    const second = updateTrackFeedback(first.state, {
      track: squareTrack,
      vehicle: vehicle({ speed: -10 }),
      deltaSeconds: 0.25,
      racing: true,
    });

    expect(first.state.wrongWay).toBe(false);
    expect(second.state.wrongWay).toBe(true);
    expect(second.state.message).toBe('WRONG WAY');
  });

  it('recovers a deep off-track car to the nearest centerline sample', () => {
    const result = updateTrackFeedback(createTrackFeedbackState(), {
      track: squareTrack,
      vehicle: vehicle({
        position: { x: 50, z: 50 },
        heading: -1,
        speed: 48,
        lateralVelocity: 7,
        drift: 0.4,
      }),
      deltaSeconds: 1 / 60,
      racing: true,
    });

    expect(result.state.recovering).toBe(true);
    expect(result.state.message).toBe('RECOVERING');
    expect(result.vehicle.position).toEqual({ x: 50, z: 0 });
    expect(result.vehicle.heading).toBeCloseTo(Math.PI / 2);
    expect(result.vehicle.speed).toBeGreaterThan(0);
    expect(result.vehicle.speed).toBeLessThan(20);
    expect(result.vehicle.lateralVelocity).toBe(0);
    expect(result.vehicle.drift).toBe(0);
    expect(result.vehicle.boostFuel).toBe(0.7);
  });

  it('keeps recovering visible through the recovery flash window', () => {
    const recovered = updateTrackFeedback(createTrackFeedbackState(), {
      track: squareTrack,
      vehicle: vehicle({
        position: { x: 50, z: 50 },
        speed: 48,
        lateralVelocity: 7,
        drift: 0.4,
      }),
      deltaSeconds: 1 / 60,
      racing: true,
    });

    const flashing = updateTrackFeedback(recovered.state, {
      track: squareTrack,
      vehicle: recovered.vehicle,
      deltaSeconds: 0.5,
      racing: true,
    });

    expect(flashing.state.recovering).toBe(true);
    expect(flashing.state.message).toBe('RECOVERING');
    expect(flashing.state.recoveryFlashSeconds).toBeGreaterThan(0);

    const settled = updateTrackFeedback(flashing.state, {
      track: squareTrack,
      vehicle: flashing.vehicle,
      deltaSeconds: 1,
      racing: true,
    });

    expect(settled.state.recovering).toBe(false);
    expect(settled.state.message).toBe(null);
  });

  it('suppresses warnings and recovery outside racing', () => {
    const result = updateTrackFeedback(createTrackFeedbackState(), {
      track: squareTrack,
      vehicle: vehicle({ position: { x: 50, z: 50 }, speed: -10 }),
      deltaSeconds: 1,
      racing: false,
    });

    expect(result.state).toMatchObject({
      offTrack: false,
      wrongWay: false,
      recovering: false,
      message: null,
    });
    expect(result.vehicle.position).toEqual({ x: 50, z: 50 });
  });
});
