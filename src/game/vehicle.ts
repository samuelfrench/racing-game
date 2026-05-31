export type VehiclePosition = {
  readonly x: number;
  readonly z: number;
};

export type VehicleState = {
  readonly position: VehiclePosition;
  readonly heading: number;
  readonly speed: number;
  readonly lateralVelocity: number;
  readonly drift: number;
  readonly boostFuel: number;
};

export type VehicleInput = {
  readonly deltaSeconds: number;
  readonly throttle: number;
  readonly brake: number;
  readonly steer: number;
  readonly handbrake: boolean;
  readonly boost: boolean;
  readonly trackGrip: number;
};

const maxForwardSpeed = 72;
const maxReverseSpeed = -12;
const throttleAcceleration = 28;
const brakeDeceleration = 34;
const reverseAcceleration = 12;
const rollingDrag = 1.6;
const aeroDrag = 0.018;
const boostAcceleration = 18;
const boostFuelUsePerSecond = 0.42;
const boostFuelRecoveryPerSecond = 0.08;
const turnRateRadians = 2.8;

export function createInitialVehicleState(): VehicleState {
  return {
    position: { x: 0, z: 0 },
    heading: 0,
    speed: 0,
    lateralVelocity: 0,
    drift: 0,
    boostFuel: 1,
  };
}

export function stepVehicle(state: VehicleState, input: VehicleInput): VehicleState {
  const deltaSeconds = clamp(input.deltaSeconds, 0, 0.1);
  const throttle = clamp(input.throttle, 0, 1);
  const brake = clamp(input.brake, 0, 1);
  const steer = clamp(input.steer, -1, 1);
  const trackGrip = clamp(input.trackGrip, 0.15, 1.25);
  const boostActive = input.boost && state.boostFuel > 0 && throttle > 0;
  const handbrakeGrip = input.handbrake ? 0.48 : 1;
  const effectiveGrip = trackGrip * handbrakeGrip;

  const forwardAcceleration = throttle * throttleAcceleration;
  const braking = brake * (state.speed > 0 ? brakeDeceleration : reverseAcceleration);
  const boost = boostActive ? boostAcceleration : 0;
  const drag = Math.sign(state.speed) * (rollingDrag + state.speed * state.speed * aeroDrag);
  const nextSpeed = clamp(
    state.speed + (forwardAcceleration + boost - braking - drag) * deltaSeconds,
    maxReverseSpeed,
    maxForwardSpeed,
  );

  const speedFactor = clamp(Math.abs(nextSpeed) / 32, 0, 1);
  const headingDelta = steer * turnRateRadians * speedFactor * effectiveGrip * deltaSeconds;
  const heading = wrapRadians(state.heading + headingDelta);

  const slipTarget = steer * nextSpeed * (input.handbrake ? 0.58 : 0.12) * (1.15 - clamp(trackGrip, 0, 1));
  const lateralResponsiveness = input.handbrake ? 7 : 11;
  const lateralVelocity = approach(state.lateralVelocity, slipTarget, lateralResponsiveness * deltaSeconds);
  const drift = Math.abs(lateralVelocity) / Math.max(1, Math.abs(nextSpeed));

  const forwardX = Math.sin(heading);
  const forwardZ = Math.cos(heading);
  const rightX = Math.cos(heading);
  const rightZ = -Math.sin(heading);
  const position = {
    x: state.position.x + (forwardX * nextSpeed + rightX * lateralVelocity) * deltaSeconds,
    z: state.position.z + (forwardZ * nextSpeed + rightZ * lateralVelocity) * deltaSeconds,
  };

  const boostFuel = clamp(
    state.boostFuel + (boostActive ? -boostFuelUsePerSecond : boostFuelRecoveryPerSecond) * deltaSeconds,
    0,
    1,
  );

  return {
    position,
    heading,
    speed: nextSpeed,
    lateralVelocity,
    drift,
    boostFuel,
  };
}

function approach(current: number, target: number, amount: number): number {
  return current + (target - current) * clamp(amount, 0, 1);
}

function wrapRadians(value: number): number {
  const fullTurn = Math.PI * 2;
  return ((((value + Math.PI) % fullTurn) + fullTurn) % fullTurn) - Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
