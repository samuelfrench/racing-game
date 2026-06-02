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
  readonly boostIntensity?: number;
  readonly trackGrip: number;
  readonly performance?: VehiclePerformanceProfile;
};

export type VehiclePerformanceProfile = {
  readonly speedMultiplier: number;
  readonly accelerationMultiplier: number;
  readonly handlingMultiplier: number;
  readonly gripMultiplier: number;
  readonly boostMultiplier: number;
  readonly boostFuelUseMultiplier: number;
  readonly boostFuelRecoveryMultiplier: number;
  readonly impactResistance: number;
};

const maxForwardSpeed = 84;
const maxReverseSpeed = -12;
const throttleAcceleration = 32;
const brakeDeceleration = 34;
const reverseAcceleration = 12;
const rollingDrag = 1.6;
const aeroDrag = 0.014;
const boostAcceleration = 62;
const boostFuelUsePerSecond = 0.2;
const boostFuelRecoveryPerSecond = 0.08;
const turnRateRadians = 1.75;
const fullSteeringSpeed = 30;
const poweredLowSpeedSteeringFloor = 0.32;
const highSpeedUndersteerStart = 38;
const neutralPerformance: VehiclePerformanceProfile = {
  speedMultiplier: 1,
  accelerationMultiplier: 1,
  handlingMultiplier: 1,
  gripMultiplier: 1,
  boostMultiplier: 1,
  boostFuelUseMultiplier: 1,
  boostFuelRecoveryMultiplier: 1,
  impactResistance: 0,
};

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
  const performance = normalizePerformance(input.performance);
  const effectiveMaxForwardSpeed = maxForwardSpeed * performance.speedMultiplier;
  const trackGrip = clamp(input.trackGrip * performance.gripMultiplier, 0.15, 1.35);
  const manualBoostActive = input.boost && state.boostFuel > 0 && throttle > 0;
  const boostIntensity = Math.max(manualBoostActive ? 1 : 0, clamp(input.boostIntensity ?? 0, 0, 1.4));
  const boostActive = boostIntensity > 0 && throttle > 0;

  const forwardAcceleration = throttle * throttleAcceleration * performance.accelerationMultiplier;
  const braking = brake * (state.speed > 0 ? brakeDeceleration : reverseAcceleration);
  const boost = boostActive ? boostAcceleration * performance.boostMultiplier * boostIntensity : 0;
  const drag = Math.sign(state.speed) * (rollingDrag + state.speed * state.speed * aeroDrag);
  const nextSpeed = clamp(
    state.speed + (forwardAcceleration + boost - braking - drag) * deltaSeconds,
    maxReverseSpeed,
    effectiveMaxForwardSpeed,
  );

  const absSpeed = Math.abs(nextSpeed);
  const speedDirection = nextSpeed < 0 ? -1 : 1;
  const turnDirection = -steer;
  const poweredSteeringIntent = Math.max(throttle, brake);
  const lowSpeedSteering = Math.max(
    clamp(absSpeed / fullSteeringSpeed, 0, 1),
    poweredSteeringIntent * poweredLowSpeedSteeringFloor,
  );
  const highSpeedUndersteer = lerp(
    1,
    0.46,
    clamp((absSpeed - highSpeedUndersteerStart) / (maxForwardSpeed - highSpeedUndersteerStart), 0, 1),
  );
  const gripSteering = lerp(0.5, 1, clamp(trackGrip, 0, 1));
  const handbrakeRotation = input.handbrake ? 1.12 : 1;
  const steeringAuthority = lowSpeedSteering * highSpeedUndersteer * gripSteering * handbrakeRotation;
  const headingDelta =
    turnDirection * speedDirection * turnRateRadians * performance.handlingMultiplier * steeringAuthority * deltaSeconds;
  const heading = wrapRadians(state.heading + headingDelta);

  const speedSlip = clamp((absSpeed - 18) / 54, 0, 1) * 0.11;
  const handbrakeSlip = input.handbrake ? 0.42 : 0;
  const lowGripSlip = (1 - clamp(trackGrip, 0, 1)) * 0.28;
  const slipTarget = -turnDirection * absSpeed * (speedSlip + handbrakeSlip + lowGripSlip);
  const lateralResponsiveness = input.handbrake ? 6.2 : 8.8;
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
    state.boostFuel +
      (
        manualBoostActive
          ? -boostFuelUsePerSecond * performance.boostFuelUseMultiplier
          : boostFuelRecoveryPerSecond * performance.boostFuelRecoveryMultiplier
      ) *
        deltaSeconds,
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

function normalizePerformance(performance: VehiclePerformanceProfile | undefined): VehiclePerformanceProfile {
  if (!performance) {
    return neutralPerformance;
  }

  return {
    speedMultiplier: clamp(performance.speedMultiplier, 0.72, 1.32),
    accelerationMultiplier: clamp(performance.accelerationMultiplier, 0.72, 1.32),
    handlingMultiplier: clamp(performance.handlingMultiplier, 0.72, 1.32),
    gripMultiplier: clamp(performance.gripMultiplier, 0.72, 1.32),
    boostMultiplier: clamp(performance.boostMultiplier, 0.72, 1.32),
    boostFuelUseMultiplier: clamp(performance.boostFuelUseMultiplier, 0.62, 1.28),
    boostFuelRecoveryMultiplier: clamp(performance.boostFuelRecoveryMultiplier, 0.72, 1.32),
    impactResistance: clamp(performance.impactResistance, 0, 0.62),
  };
}

function approach(current: number, target: number, amount: number): number {
  return current + (target - current) * clamp(amount, 0, 1);
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * clamp(amount, 0, 1);
}

function wrapRadians(value: number): number {
  const fullTurn = Math.PI * 2;
  return ((((value + Math.PI) % fullTurn) + fullTurn) % fullTurn) - Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
