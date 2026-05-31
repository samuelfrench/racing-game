import type { VehicleInput } from './vehicle';

export type ControlInput = Omit<VehicleInput, 'deltaSeconds' | 'trackGrip'>;

export function resolveInputFromKeys(keys: ReadonlySet<string>): ControlInput {
  return {
    throttle: keys.has('w') || keys.has('arrowup') ? 1 : 0,
    brake: keys.has('s') || keys.has('arrowdown') ? 1 : 0,
    steer: (keys.has('a') || keys.has('arrowleft') ? -1 : 0) + (keys.has('d') || keys.has('arrowright') ? 1 : 0),
    handbrake: keys.has(' '),
    boost: keys.has('shift'),
  };
}

