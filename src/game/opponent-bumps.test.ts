import { describe, expect, it } from 'vitest';
import { createOpponentBumpState, resolveOpponentBumps } from './opponent-bumps';
import { createOpponentGrid } from './opponents';
import { createDefaultTrack } from './track';
import type { VehicleState } from './vehicle';

const baseVehicle: VehicleState = {
  position: { x: 1, z: 0 },
  heading: 0,
  speed: 42,
  lateralVelocity: 0,
  drift: 0,
  boostFuel: 1,
};

describe('opponent bump collisions', () => {
  it('pushes the player away from an overlapping opponent and scrubs speed', () => {
    const opponent = {
      ...createOpponentGrid(createDefaultTrack(), 1)[0],
      position: { x: 0, z: 0 },
      speed: 36,
    };

    const result = resolveOpponentBumps(baseVehicle, [opponent], createOpponentBumpState(), 1 / 60);

    expect(result.vehicle.position.x).toBeGreaterThan(baseVehicle.position.x);
    expect(result.vehicle.speed).toBeLessThan(baseVehicle.speed);
    expect(result.vehicle.lateralVelocity).toBeGreaterThan(1);
    expect(result.state).toMatchObject({
      active: true,
      count: 1,
      lastOpponentId: opponent.id,
    });
    expect(result.state.lastSpeedDelta).toBeLessThan(0);
    expect(result.state.lastLateralImpulse).toBeGreaterThan(1);
  });

  it('uses a short cooldown so one contact does not count every frame', () => {
    const opponent = {
      ...createOpponentGrid(createDefaultTrack(), 1)[0],
      position: { x: 0, z: 0 },
    };
    const first = resolveOpponentBumps(baseVehicle, [opponent], createOpponentBumpState(), 1 / 60);
    const second = resolveOpponentBumps(first.vehicle, [opponent], first.state, 1 / 60);

    expect(second.state.count).toBe(1);
    expect(second.state.lastOpponentId).toBe(opponent.id);
  });
});
