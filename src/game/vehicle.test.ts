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

  it('reaches a slightly higher unboosted straight-line pace', () => {
    let car = createInitialVehicleState();

    for (let i = 0; i < 180; i += 1) {
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

    expect(car.speed).toBeGreaterThan(41);
  });

  it('allows boost to carry the faster tune above the old speed cap', () => {
    let car = createInitialVehicleState();

    for (let i = 0; i < 240; i += 1) {
      car = stepVehicle(car, {
        deltaSeconds: 1 / 60,
        throttle: 1,
        brake: 0,
        steer: 0,
        handbrake: false,
        boost: true,
        trackGrip: 1,
      });
    }

    expect(car.speed).toBeGreaterThan(72);
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

  it('maps player left and right inputs to the corrected steering direction', () => {
    const moving = {
      ...createInitialVehicleState(),
      speed: 30,
    };

    const left = stepVehicle(moving, {
      deltaSeconds: 0.1,
      throttle: 0,
      brake: 0,
      steer: -1,
      handbrake: false,
      boost: false,
      trackGrip: 1,
    });
    const right = stepVehicle(moving, {
      deltaSeconds: 0.1,
      throttle: 0,
      brake: 0,
      steer: 1,
      handbrake: false,
      boost: false,
      trackGrip: 1,
    });

    expect(left.heading).toBeGreaterThan(0);
    expect(right.heading).toBeLessThan(0);
    expect(Math.abs(left.heading)).toBeCloseTo(Math.abs(right.heading), 6);
  });

  it('keeps low-speed steering responsive under throttle or brake without pivoting in place', () => {
    const parked = stepVehicle(createInitialVehicleState(), {
      deltaSeconds: 0.1,
      throttle: 0,
      brake: 0,
      steer: -1,
      handbrake: false,
      boost: false,
      trackGrip: 1,
    });
    const parkedHandbrake = stepVehicle(createInitialVehicleState(), {
      deltaSeconds: 0.1,
      throttle: 0,
      brake: 0,
      steer: -1,
      handbrake: true,
      boost: false,
      trackGrip: 1,
    });
    const launching = stepVehicle(createInitialVehicleState(), {
      deltaSeconds: 0.1,
      throttle: 1,
      brake: 0,
      steer: -1,
      handbrake: false,
      boost: false,
      trackGrip: 1,
    });
    const trailBraking = stepVehicle(
      {
        ...createInitialVehicleState(),
        speed: 5,
      },
      {
        deltaSeconds: 0.1,
        throttle: 0,
        brake: 1,
        steer: -1,
        handbrake: false,
        boost: false,
        trackGrip: 1,
      },
    );

    expect(parked.heading).toBe(0);
    expect(parkedHandbrake.heading).toBe(0);
    expect(launching.heading).toBeGreaterThan(0.045);
    expect(trailBraking.heading).toBeGreaterThan(0.045);
  });

  it('reduces steering authority at very high speed instead of pivoting at max rate', () => {
    const mediumSpeed = stepVehicle(
      {
        ...createInitialVehicleState(),
        speed: 34,
      },
      {
        deltaSeconds: 0.1,
        throttle: 0,
        brake: 0,
        steer: -1,
        handbrake: false,
        boost: false,
        trackGrip: 1,
      },
    );
    const highSpeed = stepVehicle(
      {
        ...createInitialVehicleState(),
        speed: 68,
      },
      {
        deltaSeconds: 0.1,
        throttle: 0,
        brake: 0,
        steer: -1,
        handbrake: false,
        boost: false,
        trackGrip: 1,
      },
    );

    expect(Math.abs(highSpeed.heading)).toBeLessThan(Math.abs(mediumSpeed.heading));
  });

  it('slides toward the outside of a hard handbrake corner', () => {
    const moving = {
      ...createInitialVehicleState(),
      speed: 42,
    };

    const left = stepVehicle(moving, {
      deltaSeconds: 0.1,
      throttle: 0,
      brake: 0,
      steer: -1,
      handbrake: true,
      boost: false,
      trackGrip: 1,
    });
    const right = stepVehicle(moving, {
      deltaSeconds: 0.1,
      throttle: 0,
      brake: 0,
      steer: 1,
      handbrake: true,
      boost: false,
      trackGrip: 1,
    });

    expect(left.lateralVelocity).toBeLessThan(0);
    expect(right.lateralVelocity).toBeGreaterThan(0);
    expect(left.drift).toBeGreaterThan(0.1);
    expect(right.drift).toBeGreaterThan(0.1);
  });

  it('reverses steering yaw while backing up', () => {
    const forward = stepVehicle(
      {
        ...createInitialVehicleState(),
        speed: 24,
      },
      {
        deltaSeconds: 0.1,
        throttle: 0,
        brake: 0,
        steer: -1,
        handbrake: false,
        boost: false,
        trackGrip: 1,
      },
    );
    const reverse = stepVehicle(
      {
        ...createInitialVehicleState(),
        speed: -8,
      },
      {
        deltaSeconds: 0.1,
        throttle: 0,
        brake: 0,
        steer: -1,
        handbrake: false,
        boost: false,
        trackGrip: 1,
      },
    );

    expect(forward.heading).toBeGreaterThan(0);
    expect(reverse.heading).toBeLessThan(0);
  });
});
