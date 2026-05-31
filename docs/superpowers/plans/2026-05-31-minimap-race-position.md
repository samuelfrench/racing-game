# Minimap and Race Position Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact minimap and live race-position display to the existing Three.js racing game.

**Architecture:** Extract reusable centerline-distance helpers, build pure race-position ranking on top of them, then wire a small 2D minimap canvas into the current HUD. Keep visual integration inside the existing `split-card` to avoid adding mobile clutter.

**Tech Stack:** TypeScript, Vite, Three.js, Canvas 2D, CSS, Vitest, Playwright.

---

## File Structure

- Create `src/game/track-progress.ts`: shared closed-track segment projection, lap length, and distance sampling helpers.
- Create `src/game/track-progress.test.ts`: focused tests for projection and sampling.
- Create `src/game/race-position.ts`: pure participant ranking helpers.
- Create `src/game/race-position.test.ts`: focused tests for race order and player position.
- Modify `src/game/opponents.ts`: replace private centerline-distance helpers with `track-progress.ts`.
- Modify `index.html`: add `#race-position` and `#minimap-canvas` inside `.split-card`.
- Modify `src/main.ts`: compute player/opponent race position, render minimap, expose debug state.
- Modify `src/styles.css`: compact split-card layout, stable minimap sizing, mobile fit.
- Modify `tests/game.spec.ts`: browser assertions for minimap, position, debug state, and mobile fit.
- Modify `README.md`: mention live minimap and position display.
- Modify `TODO.md`: move the minimap/position item to completed.

## Task 1: Track Projection and Race Ranking

**Files:**
- Create: `src/game/track-progress.ts`
- Create: `src/game/track-progress.test.ts`
- Create: `src/game/race-position.ts`
- Create: `src/game/race-position.test.ts`
- Modify: `src/game/opponents.ts`

- [ ] **Step 1: Write failing tests**

Add Vitest tests proving that a point projected onto a square track returns the expected distance, sampling wraps negative and oversized distances, ranking sorts by distance during a race, finished racers sort by finish time, and exact player/opponent distance ties put the player first.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/game/track-progress.test.ts src/game/race-position.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement shared helpers**

Implement:

```ts
export function getTrackLapLength(track: TrackDefinition): number
export function projectPointOntoTrack(track: TrackDefinition, point: TrackPoint): TrackProjection
export function sampleTrackCenterlineAtDistance(track: TrackDefinition, distance: number): TrackSample
```

`TrackProjection` includes `distanceAlongLap`, `distanceFromCenter`, `segmentIndex`, and `t`. `TrackSample` includes `position` and `heading`.

- [ ] **Step 4: Implement ranking**

Implement:

```ts
export type RaceParticipantProgress = {
  readonly id: string;
  readonly name: string;
  readonly distance: number;
  readonly finishedAtSeconds: number | null;
};

export type RacePositionState = {
  readonly position: number;
  readonly total: number;
  readonly participants: readonly RaceParticipantProgress[];
};

export function getPlayerRaceDistance(input: {
  readonly progress: RaceProgress;
  readonly track: TrackDefinition;
  readonly position: TrackPoint;
}): number;

export function rankRaceParticipants(
  participants: readonly RaceParticipantProgress[],
  playerId?: string,
): RacePositionState;
```

- [ ] **Step 5: Refactor opponents**

Update `src/game/opponents.ts` to import `getTrackLapLength` and `sampleTrackCenterlineAtDistance`. Preserve current opponent movement behavior.

- [ ] **Step 6: Run GREEN**

Run: `npm test -- src/game/track-progress.test.ts src/game/race-position.test.ts`

Expected: PASS.

## Task 2: HUD Integration and Minimap Rendering

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Modify: `tests/game.spec.ts`
- Modify: `README.md`
- Modify: `TODO.md`

- [ ] **Step 1: Write failing Playwright assertions**

Extend the render/drive tests to assert:

```ts
await expect(page.locator('#race-position')).toHaveText(/\d\/4/);
await expect(page.locator('#minimap-canvas')).toBeVisible();
await expect.poll(() => readDebug(page).then((debug) => debug.racePosition.total)).toBe(4);
await expect.poll(() => readDebug(page).then((debug) => debug.minimap.markers.length)).toBe(4);
```

Add a helper that samples the 2D minimap canvas pixels and expects more than one color.

- [ ] **Step 2: Run RED**

Run: `CI=1 npm run test:e2e -- --grep "renders and drives"`

Expected: FAIL because the HUD elements and debug fields do not exist.

- [ ] **Step 3: Add HUD markup**

Update `.split-card` with a text column containing checkpoint, best lap, and position, plus:

```html
<canvas id="minimap-canvas" width="168" height="104" aria-label="Track minimap"></canvas>
```

- [ ] **Step 4: Wire runtime state**

In `src/main.ts`, import the ranking helpers, cache `#race-position` and `#minimap-canvas`, compute `racePosition` each frame, update the text, draw the minimap, and include both `racePosition` and `minimap` in `window.__racingGameDebug`.

- [ ] **Step 5: Style compact HUD**

Make `.split-card` a two-column card with stable minimap dimensions. Under `max-width: 720px`, keep it full-width with a narrower minimap so the text column and canvas fit at 320px.

- [ ] **Step 6: Update docs**

Update `README.md` and move `Add a track minimap and race-position display.` to `TODO.md` completed.

- [ ] **Step 7: Run GREEN**

Run: `CI=1 npm run test:e2e -- --grep "renders and drives"`

Expected: PASS.

## Final Verification

- [ ] Run `git diff --check`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `CI=1 npm run test:e2e`.
- [ ] Start a local dev server and run desktop/mobile Playwright smoke checks for visible minimap, nonblank pixels, position text, movement, and no console errors.
- [ ] Commit and push to `main`.
- [ ] Watch the Deploy workflow.
- [ ] Run a live GitHub Pages smoke check.
