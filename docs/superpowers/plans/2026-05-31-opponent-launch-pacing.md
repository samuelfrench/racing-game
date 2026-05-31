# Opponent Launch Pacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give AI opponents acceleration-based race starts so the player does not immediately fall to last while driving cleanly.

**Architecture:** Keep the current centerline opponent model. Extend opponent state with current speed, target speed, and acceleration, then update browser debug/tests to assert fair launch behavior.

**Tech Stack:** TypeScript, Vite, Three.js, Vitest, Playwright.

---

## File Structure

- Modify `src/game/opponents.ts`: add opponent launch acceleration and target-speed state.
- Modify `src/game/opponents.test.ts`: add RED/GREEN unit coverage for launch pacing.
- Modify `src/main.ts`: expose opponent current/target speed in debug state.
- Modify `tests/game.spec.ts`: assert the player is not immediately last after a clean launch.
- Modify `README.md`: mention launch-paced AI opponents.
- Modify `TODO.md`: move launch pacing to completed and add the next improvement.
- Add these docs under `docs/superpowers/specs` and `docs/superpowers/plans`.

## Task 1: Opponent Launch Physics

**Files:**
- Modify: `src/game/opponents.ts`
- Modify: `src/game/opponents.test.ts`

- [ ] **Step 1: Write failing unit tests**

Add tests in `src/game/opponents.test.ts`:

```ts
it('starts opponents from rest with target speeds', () => {
  const opponents = createOpponentGrid(createDefaultTrack(), 1);

  expect(opponents.map((opponent) => opponent.speed)).toEqual([0, 0, 0]);
  expect(opponents.map((opponent) => opponent.targetSpeed)).toEqual([56, 54, 52]);
  expect(opponents.every((opponent) => opponent.acceleration > 0)).toBe(true);
});
```

```ts
it('ramps opponent speed during the first racing second instead of jumping to target speed', () => {
  const track = createDefaultTrack();
  const opponents = createOpponentGrid(track, 1);
  const racing = stepOpponents(opponents, track, 1, true, 1);

  expect(racing[0].speed).toBeGreaterThan(0);
  expect(racing[0].speed).toBeLessThan(racing[0].targetSpeed);
  expect(racing[0].distanceTraveled).toBeLessThan(racing[0].targetSpeed);
});
```

```ts
it('ramps opponents toward their target pace over repeated racing steps', () => {
  const track = createDefaultTrack();
  let opponents = createOpponentGrid(track, 1);

  for (let i = 0; i < 240; i += 1) {
    opponents = stepOpponents(opponents, track, 1 / 60, true, (i + 1) / 60);
  }

  expect(opponents[0].speed).toBeGreaterThan(50);
  expect(opponents[0].speed).toBeLessThanOrEqual(opponents[0].targetSpeed);
});
```

- [ ] **Step 2: Run RED**

Run: `npm test -- src/game/opponents.test.ts`

Expected: FAIL because `targetSpeed`/`acceleration` do not exist and current speed starts at top speed.

- [ ] **Step 3: Implement opponent pacing**

In `src/game/opponents.ts`:

- add `targetSpeed` and `acceleration` to `OpponentState`
- change configs to `{ targetSpeed: 56 | 54 | 52, acceleration: 18 | 17 | 16 }`
- initialize `speed: 0`
- in `stepOpponents`, calculate `nextSpeed = approach(opponent.speed, opponent.targetSpeed, opponent.acceleration * delta)`
- advance distance by `nextSpeed * delta`
- use `nextSpeed` for finish overshoot interpolation

- [ ] **Step 4: Run GREEN**

Run: `npm test -- src/game/opponents.test.ts`

Expected: PASS.

## Task 2: Browser Launch Fairness

**Files:**
- Modify: `src/main.ts`
- Modify: `tests/game.spec.ts`
- Modify: `README.md`
- Modify: `TODO.md`

- [ ] **Step 1: Write failing browser assertion**

Update the Playwright debug type opponent entries to include:

```ts
speed: number;
targetSpeed: number;
```

In the mobile touch launch test, after holding throttle through the first racing second, assert:

```ts
const launchDebug = await readDebug(page);
expect(launchDebug.racePosition.position).toBeLessThanOrEqual(3);
expect(launchDebug.opponents.some((opponent) => opponent.speed < opponent.targetSpeed)).toBe(true);
```

- [ ] **Step 2: Run RED**

Run: `CI=1 npm run test:e2e -- --grep "touch controls drive"`

Expected: FAIL because the player currently drops to 4th almost immediately.

- [ ] **Step 3: Expose debug state**

In `src/main.ts`, include opponent `speed` and `targetSpeed` in `createDebugState()`.

- [ ] **Step 4: Update docs**

Update `README.md` to describe launch-paced AI opponents.

Update `TODO.md`:

- move `Tune opponent launch pacing after race-position HUD feedback.` to completed
- add a new next improvement: `Add track boundary recovery and wrong-way feedback.`

- [ ] **Step 5: Run GREEN**

Run: `CI=1 npm run test:e2e -- --grep "touch controls drive"`

Expected: PASS.

## Final Verification

- [ ] Run `git diff --check`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `CI=1 npm run test:e2e`.
- [ ] Start a local dev server and smoke test desktop/tablet/mobile launch behavior.
- [ ] Commit and push to `main`.
- [ ] Watch the Deploy workflow.
- [ ] Run a live GitHub Pages smoke check.
