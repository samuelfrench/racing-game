import { describe, expect, test } from 'vitest';
import {
  TOUCH_ACTIONS,
  clearTouchAction,
  clearTouchControls,
  createTouchControlState,
  getActiveTouchActions,
  mergeControlInputs,
  resolveTouchInput,
  setTouchActionActive,
  shouldShowTouchControls,
} from './touch-controls';
import type { ControlInput } from './input';

const neutralInput: ControlInput = {
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false,
  boost: false,
  jump: false,
};

describe('touch controls state', () => {
  test('exposes the supported touch actions in stable UI order', () => {
    expect(TOUCH_ACTIONS).toEqual(['left', 'right', 'throttle', 'brake', 'drift', 'boost', 'jump']);
  });

  test('tracks active pointer ids independently per action', () => {
    const state = createTouchControlState();

    setTouchActionActive(state, 'throttle', 1);
    setTouchActionActive(state, 'left', 2);

    expect(getActiveTouchActions(state)).toEqual(['left', 'throttle']);
  });

  test('keeps an action active until every held pointer for that action clears', () => {
    const state = createTouchControlState();

    setTouchActionActive(state, 'boost', 10);
    setTouchActionActive(state, 'boost', 11);
    clearTouchAction(state, 'boost', 10);

    expect(getActiveTouchActions(state)).toEqual(['boost']);

    clearTouchAction(state, 'boost', 11);

    expect(getActiveTouchActions(state)).toEqual([]);
  });

  test('clears all active pointers across all actions', () => {
    const state = createTouchControlState();

    setTouchActionActive(state, 'left', 1);
    setTouchActionActive(state, 'drift', 2);
    clearTouchControls(state);

    expect(getActiveTouchActions(state)).toEqual([]);
    expect(resolveTouchInput(state)).toEqual(neutralInput);
  });
});

describe('touch controls input resolution', () => {
  test('maps held actions to control input values', () => {
    const state = createTouchControlState();

    setTouchActionActive(state, 'throttle', 1);
    setTouchActionActive(state, 'left', 2);
    setTouchActionActive(state, 'drift', 3);
    setTouchActionActive(state, 'boost', 4);
    setTouchActionActive(state, 'jump', 5);

    expect(resolveTouchInput(state)).toEqual({
      throttle: 1,
      brake: 0,
      steer: -1,
      handbrake: true,
      boost: true,
      jump: true,
    });
  });

  test('sums opposing steering actions and clamps the resolved value', () => {
    const state = createTouchControlState();

    setTouchActionActive(state, 'left', 1);
    setTouchActionActive(state, 'right', 2);

    expect(resolveTouchInput(state)).toMatchObject({ steer: 0 });
  });

  test('merges keyboard and touch control inputs without exceeding supported ranges', () => {
    const keyboard: ControlInput = {
      throttle: 0.25,
      brake: 1,
      steer: 0.8,
      handbrake: false,
      boost: true,
      jump: false,
    };
    const touch: ControlInput = {
      throttle: 1,
      brake: 0,
      steer: 0.7,
      handbrake: true,
      boost: false,
      jump: true,
    };

    expect(mergeControlInputs(keyboard, touch)).toEqual({
      throttle: 1,
      brake: 1,
      steer: 1,
      handbrake: true,
      boost: true,
      jump: true,
    });
    expect(mergeControlInputs({ ...neutralInput, steer: -0.9 }, { ...neutralInput, steer: -0.5 }).steer).toBe(-1);
  });
});

describe('touch controls visibility', () => {
  test('uses explicit settings before environment heuristics', () => {
    expect(shouldShowTouchControls('on', { coarsePointer: false, viewportWidth: 1200 })).toBe(true);
    expect(shouldShowTouchControls('off', { coarsePointer: true, viewportWidth: 360 })).toBe(false);
  });

  test('auto mode shows controls on coarse pointers or compact viewports', () => {
    expect(shouldShowTouchControls('auto', { coarsePointer: true, viewportWidth: 1200 })).toBe(true);
    expect(shouldShowTouchControls('auto', { coarsePointer: false, viewportWidth: 720 })).toBe(true);
    expect(shouldShowTouchControls('auto', { coarsePointer: false, viewportWidth: 721 })).toBe(false);
  });
});
