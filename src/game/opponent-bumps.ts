import type { OpponentState } from './opponents';
import type { VehicleState } from './vehicle';

export type OpponentBumpDebugState = {
  readonly active: boolean;
  readonly count: number;
  readonly lastOpponentId: string | null;
  readonly lastSpeedDelta: number;
  readonly lastLateralImpulse: number;
};

export type OpponentBumpState = OpponentBumpDebugState & {
  readonly cooldownSeconds: number;
  readonly flashSeconds: number;
};

export type OpponentBumpResult = {
  readonly vehicle: VehicleState;
  readonly state: OpponentBumpState;
};

const contactRadius = 6.2;
const cooldownSeconds = 0.34;
const flashSeconds = 0.22;

export function createOpponentBumpState(): OpponentBumpState {
  return {
    active: false,
    count: 0,
    lastOpponentId: null,
    lastSpeedDelta: 0,
    lastLateralImpulse: 0,
    cooldownSeconds: 0,
    flashSeconds: 0,
  };
}

export function createOpponentBumpDebugState(state: OpponentBumpState): OpponentBumpDebugState {
  return {
    active: state.active,
    count: state.count,
    lastOpponentId: state.lastOpponentId,
    lastSpeedDelta: state.lastSpeedDelta,
    lastLateralImpulse: state.lastLateralImpulse,
  };
}

export function resolveOpponentBumps(
  vehicle: VehicleState,
  opponents: readonly OpponentState[],
  previous: OpponentBumpState,
  deltaSeconds: number,
): OpponentBumpResult {
  const steppedState = stepBumpState(previous, deltaSeconds);

  if (steppedState.cooldownSeconds > 0) {
    return {
      vehicle,
      state: steppedState,
    };
  }

  const collision = findNearestCollision(vehicle, opponents);

  if (!collision) {
    return {
      vehicle,
      state: steppedState,
    };
  }

  const rightX = Math.cos(vehicle.heading);
  const rightZ = -Math.sin(vehicle.heading);
  const lateralDirection = dot(collision.normalX, collision.normalZ, rightX, rightZ) >= 0 ? 1 : -1;
  const impulseAmount = 18 + Math.min(14, Math.abs(vehicle.speed) * 0.24);
  const lateralImpulse = lateralDirection * impulseAmount * collision.strength;
  const speedDelta = -Math.sign(vehicle.speed || 1) * Math.min(Math.abs(vehicle.speed), 8 + 8 * collision.strength);
  const pushDistance = 1.05 + collision.overlap * 0.72;

  return {
    vehicle: {
      ...vehicle,
      position: {
        x: vehicle.position.x + collision.normalX * pushDistance,
        z: vehicle.position.z + collision.normalZ * pushDistance,
      },
      speed: vehicle.speed + speedDelta,
      lateralVelocity: vehicle.lateralVelocity + lateralImpulse,
      drift: Math.max(vehicle.drift, 0.24 + 0.22 * collision.strength),
    },
    state: {
      active: true,
      count: previous.count + 1,
      lastOpponentId: collision.opponent.id,
      lastSpeedDelta: round2(speedDelta),
      lastLateralImpulse: round2(lateralImpulse),
      cooldownSeconds,
      flashSeconds,
    },
  };
}

function stepBumpState(previous: OpponentBumpState, deltaSeconds: number): OpponentBumpState {
  const delta = clamp(deltaSeconds, 0, 0.1);
  const nextFlashSeconds = Math.max(0, previous.flashSeconds - delta);
  return {
    ...previous,
    active: nextFlashSeconds > 0,
    cooldownSeconds: Math.max(0, previous.cooldownSeconds - delta),
    flashSeconds: nextFlashSeconds,
  };
}

function findNearestCollision(
  vehicle: VehicleState,
  opponents: readonly OpponentState[],
): {
  readonly opponent: OpponentState;
  readonly normalX: number;
  readonly normalZ: number;
  readonly overlap: number;
  readonly strength: number;
} | null {
  let nearest:
    | {
        readonly opponent: OpponentState;
        readonly normalX: number;
        readonly normalZ: number;
        readonly overlap: number;
        readonly strength: number;
        readonly distance: number;
      }
    | null = null;

  for (const opponent of opponents) {
    if (opponent.finishedAtSeconds !== null) {
      continue;
    }

    const dx = vehicle.position.x - opponent.position.x;
    const dz = vehicle.position.z - opponent.position.z;
    const distance = Math.hypot(dx, dz);
    const overlap = contactRadius - distance;

    if (overlap <= 0) {
      continue;
    }

    const normal = normalize(dx, dz, vehicle.heading);
    const strength = clamp(overlap / contactRadius, 0.18, 1);

    if (!nearest || distance < nearest.distance) {
      nearest = {
        opponent,
        normalX: normal.x,
        normalZ: normal.z,
        overlap,
        strength,
        distance,
      };
    }
  }

  return nearest;
}

function normalize(x: number, z: number, heading: number): { readonly x: number; readonly z: number } {
  const length = Math.hypot(x, z);
  if (length > 0.001) {
    return {
      x: x / length,
      z: z / length,
    };
  }

  return {
    x: Math.cos(heading),
    z: -Math.sin(heading),
  };
}

function dot(ax: number, az: number, bx: number, bz: number): number {
  return ax * bx + az * bz;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
