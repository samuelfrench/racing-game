import type { ControlInput } from './input';
import type { TouchControlsMode } from './settings';

export const TOUCH_ACTIONS = ['left', 'right', 'throttle', 'brake', 'drift', 'boost'] as const;

export type TouchAction = (typeof TOUCH_ACTIONS)[number];

export type TouchControlState = {
  readonly pointersByAction: Record<TouchAction, Set<number>>;
};

export type TouchControlsEnvironment = {
  readonly coarsePointer: boolean;
  readonly viewportWidth: number;
};

export function createTouchControlState(): TouchControlState {
  return {
    pointersByAction: {
      left: new Set<number>(),
      right: new Set<number>(),
      throttle: new Set<number>(),
      brake: new Set<number>(),
      drift: new Set<number>(),
      boost: new Set<number>(),
    },
  };
}

export function setTouchActionActive(
  state: TouchControlState,
  action: TouchAction,
  pointerId: number,
): TouchControlState {
  state.pointersByAction[action].add(pointerId);
  return state;
}

export function clearTouchAction(
  state: TouchControlState,
  action: TouchAction,
  pointerId: number,
): TouchControlState {
  state.pointersByAction[action].delete(pointerId);
  return state;
}

export function clearTouchControls(state: TouchControlState): TouchControlState {
  for (const action of TOUCH_ACTIONS) {
    state.pointersByAction[action].clear();
  }
  return state;
}

export function resolveTouchInput(state: TouchControlState): ControlInput {
  const steer =
    (hasActivePointers(state, 'right') ? 1 : 0) -
    (hasActivePointers(state, 'left') ? 1 : 0);

  return {
    throttle: hasActivePointers(state, 'throttle') ? 1 : 0,
    brake: hasActivePointers(state, 'brake') ? 1 : 0,
    steer: clamp(steer, -1, 1),
    handbrake: hasActivePointers(state, 'drift'),
    boost: hasActivePointers(state, 'boost'),
  };
}

export function mergeControlInputs(keyboard: ControlInput, touch: ControlInput): ControlInput {
  return {
    throttle: Math.max(clamp(keyboard.throttle, 0, 1), clamp(touch.throttle, 0, 1)),
    brake: Math.max(clamp(keyboard.brake, 0, 1), clamp(touch.brake, 0, 1)),
    steer: clamp(keyboard.steer + touch.steer, -1, 1),
    handbrake: keyboard.handbrake || touch.handbrake,
    boost: keyboard.boost || touch.boost,
  };
}

export function getActiveTouchActions(state: TouchControlState): TouchAction[] {
  const actions: TouchAction[] = [];
  for (const action of TOUCH_ACTIONS) {
    if (hasActivePointers(state, action)) {
      actions.push(action);
    }
  }
  return actions;
}

export function shouldShowTouchControls(
  mode: TouchControlsMode,
  environment: TouchControlsEnvironment,
): boolean {
  if (mode === 'on') {
    return true;
  }
  if (mode === 'off') {
    return false;
  }
  return environment.coarsePointer || environment.viewportWidth <= 720;
}

function hasActivePointers(state: TouchControlState, action: TouchAction): boolean {
  return state.pointersByAction[action].size > 0;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min <= 0 && max >= 0 ? 0 : min;
  }
  return Math.min(max, Math.max(min, value));
}
