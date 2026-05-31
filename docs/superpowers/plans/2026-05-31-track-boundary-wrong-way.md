# Track Boundary Recovery and Wrong-Way Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add off-track, wrong-way, and boundary recovery feedback so driving mistakes are readable and recoverable.

**Architecture:** Add a pure `track-feedback` module that projects the player onto the existing track centerline and returns both feedback state and an optional recovered vehicle pose. Integrate that state into the main loop, existing race status HUD, and browser debug state.

**Tech Stack:** TypeScript, Vite, Three.js, Vitest, Playwright.

---

## File Structure

- Create `src/game/track-feedback.ts`: pure track feedback and recovery logic.
- Create `src/game/track-feedback.test.ts`: unit tests for off-track, wrong-way, and recovery behavior.
- Modify `src/main.ts`: update runtime feedback state, race status text, and debug exposure.
- Modify `tests/game.spec.ts`: browser coverage for warning text and debug state.
- Modify `README.md`: mention boundary recovery and wrong-way feedback.
- Modify `TODO.md`: move this slice to completed and keep minimap styling as the next item.

## Task 1: Pure Track Feedback Logic

**Files:**
- Create: `src/game/track-feedback.ts`
- Create: `src/game/track-feedback.test.ts`

- [x] **Step 1: Write failing tests**

Create `src/game/track-feedback.test.ts`:

```ts
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
```

- [x] **Step 2: Run RED**

Run: `npm test -- src/game/track-feedback.test.ts`

Expected: FAIL because `src/game/track-feedback.ts` does not exist.

- [x] **Step 3: Implement the pure module**

Create `src/game/track-feedback.ts`:

```ts
import type { TrackDefinition } from './track';
import { projectPointOntoTrack, sampleTrackCenterlineAtDistance } from './track-progress';
import type { VehicleState } from './vehicle';

export type TrackFeedbackMessage = 'OFF TRACK' | 'WRONG WAY' | 'RECOVERING';

export type TrackFeedbackState = {
  readonly distanceFromCenter: number;
  readonly offTrack: boolean;
  readonly wrongWay: boolean;
  readonly recovering: boolean;
  readonly wrongWaySeconds: number;
  readonly recoveryFlashSeconds: number;
  readonly message: TrackFeedbackMessage | null;
};

export type TrackFeedbackInput = {
  readonly track: TrackDefinition;
  readonly vehicle: VehicleState;
  readonly deltaSeconds: number;
  readonly racing: boolean;
};

export type TrackFeedbackResult = {
  readonly state: TrackFeedbackState;
  readonly vehicle: VehicleState;
};

const wrongWayMinimumSpeed = 5;
const wrongWayAngleRadians = 2.1;
const wrongWayGraceSeconds = 0.45;
const recoveryExtraDistance = 28;
const recoveryFlashSeconds = 1.15;
const recoveredSpeedFactor = 0.35;
const recoveredSpeedCap = 18;

export function createTrackFeedbackState(): TrackFeedbackState {
  return {
    distanceFromCenter: 0,
    offTrack: false,
    wrongWay: false,
    recovering: false,
    wrongWaySeconds: 0,
    recoveryFlashSeconds: 0,
    message: null,
  };
}

export function updateTrackFeedback(
  previous: TrackFeedbackState,
  input: TrackFeedbackInput,
): TrackFeedbackResult {
  const deltaSeconds = clamp(input.deltaSeconds, 0, 0.1);
  const recoveryFlash = Math.max(0, previous.recoveryFlashSeconds - deltaSeconds);

  if (!input.racing) {
    return {
      state: {
        ...createTrackFeedbackState(),
        recoveryFlashSeconds: recoveryFlash,
      },
      vehicle: input.vehicle,
    };
  }

  const projection = projectPointOntoTrack(input.track, input.vehicle.position);
  const halfRoad = input.track.roadWidth * 0.5;
  const offTrack = projection.distanceFromCenter > halfRoad;
  const recoveryDistance = halfRoad + input.track.shoulderWidth + recoveryExtraDistance;
  const shouldRecover = projection.distanceFromCenter > recoveryDistance;

  if (shouldRecover) {
    const sample = sampleTrackCenterlineAtDistance(input.track, projection.distanceAlongLap);
    const vehicle = {
      ...input.vehicle,
      position: sample.position,
      heading: sample.heading,
      speed: Math.min(Math.abs(input.vehicle.speed) * recoveredSpeedFactor, recoveredSpeedCap),
      lateralVelocity: 0,
      drift: 0,
    };

    return {
      state: {
        distanceFromCenter: projection.distanceFromCenter,
        offTrack: true,
        wrongWay: false,
        recovering: true,
        wrongWaySeconds: 0,
        recoveryFlashSeconds,
        message: 'RECOVERING',
      },
      vehicle,
    };
  }

  const sample = sampleTrackCenterlineAtDistance(input.track, projection.distanceAlongLap);
  const travelHeading = input.vehicle.speed < -wrongWayMinimumSpeed
    ? wrapRadians(input.vehicle.heading + Math.PI)
    : input.vehicle.heading;
  const angleDelta = Math.abs(shortestAngle(travelHeading, sample.heading));
  const movingWrongWay = Math.abs(input.vehicle.speed) >= wrongWayMinimumSpeed && angleDelta >= wrongWayAngleRadians;
  const wrongWaySeconds = movingWrongWay ? previous.wrongWaySeconds + deltaSeconds : 0;
  const wrongWay = wrongWaySeconds >= wrongWayGraceSeconds;
  const recovering = recoveryFlash > 0;

  return {
    state: {
      distanceFromCenter: projection.distanceFromCenter,
      offTrack,
      wrongWay,
      recovering,
      wrongWaySeconds,
      recoveryFlashSeconds: recoveryFlash,
      message: recovering ? 'RECOVERING' : wrongWay ? 'WRONG WAY' : offTrack ? 'OFF TRACK' : null,
    },
    vehicle: input.vehicle,
  };
}

function shortestAngle(a: number, b: number): number {
  return wrapRadians(a - b);
}

function wrapRadians(value: number): number {
  const fullTurn = Math.PI * 2;
  return ((((value + Math.PI) % fullTurn) + fullTurn) % fullTurn) - Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
```

- [x] **Step 4: Run GREEN**

Run: `npm test -- src/game/track-feedback.test.ts`

Expected: PASS.

## Task 2: Runtime HUD and Browser Coverage

**Files:**
- Modify: `src/main.ts`
- Modify: `tests/game.spec.ts`
- Modify: `README.md`
- Modify: `TODO.md`

- [x] **Step 1: Write failing browser assertions**

Update `tests/game.spec.ts` debug type:

```ts
trackFeedback: {
  distanceFromCenter: number;
  offTrack: boolean;
  wrongWay: boolean;
  recovering: boolean;
  message: 'OFF TRACK' | 'WRONG WAY' | 'RECOVERING' | null;
};
```

Add `OFF TRACK`, `WRONG WAY`, and `RECOVERING` to the race-status fit labels in the viewport render test.

Add a Playwright test:

```ts
test('shows wrong-way feedback when reversing after launch', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect.poll(() => hasDebugState(page)).toBe(true);

  await page.locator('#start-button').click();
  await expect.poll(() => readDebug(page).then((debug) => debug.phase), { timeout: 5_000 }).toBe('racing');

  await page.keyboard.down('ArrowDown');
  await expect
    .poll(() => readDebug(page).then((debug) => debug.trackFeedback.wrongWay), {
      message: 'reverse travel triggers wrong-way feedback',
    })
    .toBe(true);
  await expect(page.locator('#race-status')).toHaveText('WRONG WAY');
  const debug = await readDebug(page);
  expect(debug.trackFeedback.message).toBe('WRONG WAY');
  expect(Math.abs(debug.speed)).toBeGreaterThan(3);
  await page.keyboard.up('ArrowDown');

  expect(consoleErrors).toEqual([]);
});
```

- [x] **Step 2: Run RED**

Run: `CI=1 npm run test:e2e -- --grep "wrong-way feedback"`

Expected: FAIL because `trackFeedback` is not exposed and the HUD never shows `WRONG WAY`.

- [x] **Step 3: Integrate feedback state**

In `src/main.ts`:

- import `createTrackFeedbackState`, `updateTrackFeedback`, and `type TrackFeedbackState`
- add `trackFeedback: TrackFeedbackState` to `DebugState`
- initialize `let trackFeedback = createTrackFeedbackState()`
- after `stepVehicle` in the racing branch, call `updateTrackFeedback`
- assign `vehicle` from the returned result before checkpoint/progress updates
- expose `trackFeedback` in `createDebugState()`
- update `getRaceStatusText` to accept feedback state and return feedback message before normal `GO`
- reset track feedback in `resetRace()`

The race loop integration should look like:

```ts
const feedbackResult = updateTrackFeedback(trackFeedback, {
  track,
  vehicle,
  deltaSeconds,
  racing: session.phase === 'racing',
});
trackFeedback = feedbackResult.state;
vehicle = feedbackResult.vehicle;
```

The HUD status call should become:

```ts
hud.raceStatus.textContent = getRaceStatusText(session, trackFeedback);
```

And racing status should prioritize feedback:

```ts
if (currentSession.phase === 'racing') {
  return feedback.message ?? 'GO';
}
```

- [x] **Step 4: Update docs**

In `README.md`, include boundary recovery and wrong-way feedback in the lead sentence.

In `TODO.md`, move `Add track boundary recovery and wrong-way feedback.` from Next Improvements to Completed.

- [x] **Step 5: Run GREEN**

Run: `CI=1 npm run test:e2e -- --grep "wrong-way feedback"`

Expected: PASS.

## Final Verification

- [x] Run `git diff --check`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `CI=1 npm run test:e2e`.
- [x] Start a local dev server and smoke test desktop/tablet/mobile launch behavior.
- [x] Verify wrong-way feedback in browser runtime.
- [ ] Commit and push to `main`.
- [ ] Watch the Deploy workflow.
- [ ] Run a live GitHub Pages smoke check.
