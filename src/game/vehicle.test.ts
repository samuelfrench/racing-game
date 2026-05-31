import { describe, expect, it } from 'vitest';
import { createInitialVehicleState, stepVehicle } from './vehicle';

describe('vehicle physics', () => {
  it('builds speed under throttle and slows under braking', () => {
    let car = createInitialVehicleState();

    for (let i = 0; i < 90; i += 1) {
      car = stepVehicle(car, {
        deltaSeconds: 1 / 60,
        throttle: 1,
        brake: 0,
        steer: 0,
        handbrake: false,
        boost: false,
        trackGrip: 1,
      });
    }

    expect(car.speed).toBeGreaterThan(28);

    for (let i = 0; i < 45; i += 1) {
      car = stepVehicle(car, {
        deltaSeconds: 1 / 60,
        throttle: 0,
        brake: 1,
        steer: 0,
        handbrake: false,
        boost: false,
        trackGrip: 1,
      });
    }

    expect(car.speed).toBeLessThan(16);
  });

  it('turns with speed, slips more with handbrake, and consumes boost', () => {
    let stable = createInitialVehicleState();
    let sliding = createInitialVehicleState();

    for (let i = 0; i < 120; i += 1) {
      stable = stepVehicle(stable, {
        deltaSeconds: 1 / 60,
        throttle: 1,
        brake: 0,
        steer: 0.8,
        handbrake: false,
        boost: false,
        trackGrip: 1,
      });
      sliding = stepVehicle(sliding, {
        deltaSeconds: 1 / 60,
        throttle: 1,
        brake: 0,
        steer: 0.8,
        handbrake: true,
        boost: true,
        trackGrip: 1,
      });
    }

    expect(Math.abs(stable.heading)).toBeGreaterThan(0.6);
    expect(sliding.drift).toBeGreaterThan(stable.drift);
    expect(sliding.boostFuel).toBeLessThan(stable.boostFuel);
  });
});

