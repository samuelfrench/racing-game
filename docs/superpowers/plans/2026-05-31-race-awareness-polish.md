# Race Awareness Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the existing race-position and minimap HUD so race order, gap, heading, and progress are readable at a glance.

**Architecture:** Add a pure race-awareness display helper on top of `RacePositionState`, then wire the helper and richer minimap marker metadata into the existing `split-card` HUD. Keep all canvas drawing inside `src/main.ts` and keep gameplay physics unchanged.

**Tech Stack:** TypeScript, Vite, Three.js, Canvas 2D, CSS, Vitest, Playwright.

---

## File Structure

- Create `src/game/race-awareness.ts`: display-ready position label, gap label, gap meters, and tone.
- Create `src/game/race-awareness.test.ts`: focused Vitest coverage for leading, chasing, finished, and missing-player states.
- Modify `index.html`: add a `#race-gap` readout and stable position/gap row markup inside the existing `split-card`.
- Modify `src/main.ts`: compute `raceAwareness`, update HUD text/classes, draw minimap progress/start-finish/ranked markers/heading arrow, and expose richer debug state.
- Modify `src/styles.css`: style the compact position/gap readout and keep desktop/tablet/mobile layout stable.
- Modify `tests/game.spec.ts`: assert HUD/debug race-awareness state and richer minimap marker metadata.
- Modify `README.md`: mention gap-aware race position and richer minimap.
- Modify `TODO.md`: move the race-position/minimap styling item to completed and add the next improvement.

## Task 1: Pure Race Awareness Helper

**Files:**
- Create: `src/game/race-awareness.ts`
- Create: `src/game/race-awareness.test.ts`

- [x] **Step 1: Write failing tests**

Create `src/game/race-awareness.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { RacePositionState } from './race-position';
import { createRaceAwareness } from './race-awareness';

function state(overrides: Partial<RacePositionState> = {}): RacePositionState {
  return {
    position: 1,
    total: 4,
    participants: [
      { id: 'player', name: 'You', distance: 620, finishedAtSeconds: null },
      { id: 'opponent-a', name: 'Nova', distance: 590, finishedAtSeconds: null },
      { id: 'opponent-b', name: 'Vega', distance: 520, finishedAtSeconds: null },
      { id: 'opponent-c', name: 'Orion', distance: 410, finishedAtSeconds: null },
    ],
    ...overrides,
  };
}

describe('race awareness display state', () => {
  it('formats the player lead from the next car behind', () => {
    const awareness = createRaceAwareness(state());

    expect(awareness).toEqual({
      positionLabel: 'P1/4',
      gapLabel: 'LEAD 30m',
      gapMeters: 30,
      tone: 'leader',
    });
  });

  it('formats the gap to the next car ahead while chasing', () => {
    const awareness = createRaceAwareness(
      state({
        position: 2,
        participants: [
          { id: 'opponent-a', name: 'Nova', distance: 700, finishedAtSeconds: null },
          { id: 'player', name: 'You', distance: 682.4, finishedAtSeconds: null },
          { id: 'opponent-b', name: 'Vega', distance: 620, finishedAtSeconds: null },
          { id: 'opponent-c', name: 'Orion', distance: 410, finishedAtSeconds: null },
        ],
      }),
    );

    expect(awareness.positionLabel).toBe('P2/4');
    expect(awareness.gapLabel).toBe('GAP 18m');
    expect(awareness.gapMeters).toBeCloseTo(17.6);
    expect(awareness.tone).toBe('chasing');
  });

  it('shows finish state for a classified player', () => {
    const awareness = createRaceAwareness(
      state({
        position: 1,
        participants: [
          { id: 'player', name: 'You', distance: 2400, finishedAtSeconds: 82.2 },
          { id: 'opponent-a', name: 'Nova', distance: 2380, finishedAtSeconds: null },
        ],
      }),
    );

    expect(awareness.gapLabel).toBe('FINISH');
    expect(awareness.tone).toBe('leader');
  });

  it('falls back safely when the player is missing', () => {
    const awareness = createRaceAwareness({
      position: 2,
      total: 2,
      participants: [
        { id: 'opponent-a', name: 'Nova', distance: 100, finishedAtSeconds: null },
        { id: 'opponent-b', name: 'Vega', distance: 90, finishedAtSeconds: null },
      ],
    });

    expect(awareness).toEqual({
      positionLabel: 'P2/2',
      gapLabel: '--',
      gapMeters: null,
      tone: 'last',
    });
  });
});
```

- [x] **Step 2: Run RED**

Run: `npm test -- src/game/race-awareness.test.ts`

Expected: FAIL because `src/game/race-awareness.ts` does not exist.

- [x] **Step 3: Implement the helper**

Create `src/game/race-awareness.ts`:

```ts
import type { RacePositionState } from './race-position';

export type RaceAwarenessTone = 'leader' | 'chasing' | 'midfield' | 'last';

export type RaceAwarenessState = {
  readonly positionLabel: string;
  readonly gapLabel: string;
  readonly gapMeters: number | null;
  readonly tone: RaceAwarenessTone;
};

export function createRaceAwareness(
  racePosition: RacePositionState,
  playerId = 'player',
): RaceAwarenessState {
  const position = sanitizeOrdinal(racePosition.position, racePosition.total);
  const total = Math.max(0, racePosition.total);
  const positionLabel = `P${position}/${total}`;
  const tone = getPositionTone(position, total);
  const playerIndex = racePosition.participants.findIndex((participant) => participant.id === playerId);

  if (playerIndex < 0) {
    return {
      positionLabel,
      gapLabel: '--',
      gapMeters: null,
      tone,
    };
  }

  const player = racePosition.participants[playerIndex];
  if (player.finishedAtSeconds !== null) {
    return {
      positionLabel,
      gapLabel: 'FINISH',
      gapMeters: null,
      tone,
    };
  }

  const comparison = playerIndex === 0 ? racePosition.participants[1] : racePosition.participants[playerIndex - 1];
  if (!comparison) {
    return {
      positionLabel,
      gapLabel: position === 1 ? 'LEAD' : '--',
      gapMeters: null,
      tone,
    };
  }

  const rawGap =
    playerIndex === 0
      ? sanitizeDistance(player.distance) - sanitizeDistance(comparison.distance)
      : sanitizeDistance(comparison.distance) - sanitizeDistance(player.distance);
  const gapMeters = Math.max(0, rawGap);
  const roundedGap = Math.max(0, Math.round(gapMeters));
  const gapPrefix = playerIndex === 0 ? 'LEAD' : 'GAP';

  return {
    positionLabel,
    gapLabel: `${gapPrefix} ${roundedGap}m`,
    gapMeters,
    tone,
  };
}

function getPositionTone(position: number, total: number): RaceAwarenessTone {
  if (position <= 1) {
    return 'leader';
  }

  if (position >= total) {
    return 'last';
  }

  return position <= Math.ceil(total / 2) ? 'chasing' : 'midfield';
}

function sanitizeOrdinal(position: number, total: number): number {
  if (!Number.isFinite(position)) {
    return Math.max(1, total);
  }

  return Math.min(Math.max(1, Math.trunc(position)), Math.max(1, total));
}

function sanitizeDistance(distance: number): number {
  return Number.isFinite(distance) ? Math.max(0, distance) : 0;
}
```

- [x] **Step 4: Run GREEN**

Run: `npm test -- src/game/race-awareness.test.ts`

Expected: PASS.

## Task 2: HUD and Minimap Runtime Polish

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Modify: `tests/game.spec.ts`
- Modify: `README.md`
- Modify: `TODO.md`

- [x] **Step 1: Write failing browser assertions**

Update `tests/game.spec.ts` debug types to include:

```ts
raceAwareness: {
  positionLabel: string;
  gapLabel: string;
  gapMeters: number | null;
  tone: 'leader' | 'chasing' | 'midfield' | 'last';
};
minimap: {
  canvasWidth: number;
  canvasHeight: number;
  progressRatio: number;
  markers: readonly {
    id: string;
    x: number;
    z: number;
    color: string;
    kind: 'player' | 'opponent';
    rank: number;
    heading: number;
    label: string;
  }[];
};
```

In the render/drive viewport test, add:

```ts
await expect(page.locator('#race-position')).toHaveText(/^P[1-4]\/4$/);
await expect(page.locator('#race-gap')).not.toHaveText('');
await expect.poll(() => readDebug(page).then((debug) => debug.raceAwareness.positionLabel)).toMatch(/^P[1-4]\/4$/);
await expect.poll(() => readDebug(page).then((debug) => debug.raceAwareness.gapLabel.length)).toBeGreaterThan(1);
await expect.poll(() => readDebug(page).then((debug) => debug.minimap.progressRatio)).toBeGreaterThanOrEqual(0);
```

After reading debug state, assert:

```ts
expect(initialDebug.minimap.markers.every((marker) => marker.rank >= 1)).toBe(true);
expect(initialDebug.minimap.markers.every((marker) => Number.isFinite(marker.heading))).toBe(true);
expect(initialDebug.minimap.markers.map((marker) => marker.label)).toContain('P1');
```

- [x] **Step 2: Run RED**

Run: `CI=1 npm run test:e2e -- --grep "renders and drives"`

Expected: FAIL because `#race-gap`, `debug.raceAwareness`, and richer minimap metadata do not exist.

- [x] **Step 3: Add HUD markup**

In `index.html`, replace the existing position paragraph with:

```html
<div class="race-awareness-line">
  <p>Position</p>
  <strong id="race-position">P1/4</strong>
</div>
<p>Gap <span id="race-gap">--</span></p>
```

- [x] **Step 4: Wire runtime state and debug**

In `src/main.ts`:

- import `createRaceAwareness` and `type RaceAwarenessState`
- import `projectPointOntoTrack`
- add `raceGap` to `HudElements`
- extend `MinimapMarkerDebug` with `rank`, `heading`, and `label`
- extend `MinimapDebugState` with `progressRatio`
- add `raceAwareness: RaceAwarenessState` to `DebugState`
- initialize `raceAwareness = createRaceAwareness(racePosition)`
- after `racePosition` is ranked, set `raceAwareness = createRaceAwareness(racePosition)`
- write `hud.racePosition.textContent = raceAwareness.positionLabel`
- write `hud.raceGap.textContent = raceAwareness.gapLabel`
- set `hud.racePosition.dataset.tone = raceAwareness.tone`
- include `raceAwareness` in debug state

For minimap:

- compute `const playerProjection = projectPointOntoTrack(track, vehicle.position)`
- draw a progress ribbon from start to `playerProjection.distanceAlongLap`
- draw a start/finish stripe across the first centerline segment
- use `racePosition.participants` to assign marker rank and label
- set player marker heading from `vehicle.heading`
- set opponent marker heading from `opponent.heading`
- return `progressRatio` as `playerProjection.distanceAlongLap / getTrackLapLength(track)`

- [x] **Step 5: Style compact awareness text**

In `src/styles.css`:

- style `.race-awareness-line` as a compact two-column row
- make `#race-position` larger and tabular
- make `#race-gap` cyan/yellow depending on tone via `#race-position[data-tone="..."] ~ *` not required; keep gap neutral if sibling selectors become brittle
- keep `.split-card-text` width stable and allow no overlap at 320px

- [x] **Step 6: Update docs and TODO**

Update `README.md` to mention gap-aware race position and richer minimap.

Move `Tune race-position/minimap styling after live-device feedback.` from Next Improvements to Completed in `TODO.md`. Add `Add lap split and sector timing feedback.` as the next improvement.

- [x] **Step 7: Run GREEN**

Run: `CI=1 npm run test:e2e -- --grep "renders and drives"`

Expected: PASS.

## Final Verification

- [x] Run `git diff --check`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `CI=1 npm run test:e2e`.
- [x] Start a local dev server and run desktop/tablet/mobile Playwright smoke checks for movement, gap HUD, minimap progress, marker metadata, and no console errors.
- [ ] Commit and push to `main`.
- [ ] Watch the Deploy workflow.
- [ ] Run a live GitHub Pages smoke check.
