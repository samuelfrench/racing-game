# Lap Sector Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add current lap timing, sector timing, and sector split delta feedback to the existing race HUD.

**Architecture:** Extend `RaceProgress` with authoritative sector split state at checkpoint-crossing time. Add a pure `race-timing` display helper that formats that state for HUD/debug use, then wire it into the existing split-card without adding a new overlay.

**Tech Stack:** TypeScript, Vite, Three.js, Canvas 2D, CSS, Vitest, Playwright.

---

## File Structure

- Modify `src/game/race.ts`: add sector timing fields to `RaceProgress` and update them inside `updateRaceProgress`.
- Modify `src/game/race.test.ts`: cover sector split recording, best-sector deltas, final sector, and finish behavior.
- Create `src/game/race-timing.ts`: convert `RaceProgress` plus elapsed seconds into display-ready timing labels and tone.
- Create `src/game/race-timing.test.ts`: cover idle, active, sector-completed, and finished display states.
- Modify `index.html`: add `#lap-time`, `#sector-label`, `#sector-time`, and `#sector-delta` in the existing split-card text column.
- Modify `src/main.ts`: import timing helper, update HUD elements, expose `debug.timing`, and reset timing state naturally through `createRaceProgress`.
- Modify `src/styles.css`: style compact timing rows with stable tabular widths and delta tones.
- Modify `tests/game.spec.ts`: assert timing HUD/debug behavior across desktop/tablet/mobile.
- Modify `README.md`: mention split/sector timing.
- Modify `TODO.md`: move the sector timing item to Completed and add the next improvement.

## Task 1: Pure Race Timing State And Display

**Files:**
- Modify: `src/game/race.ts`
- Modify: `src/game/race.test.ts`
- Create: `src/game/race-timing.ts`
- Create: `src/game/race-timing.test.ts`

- [ ] **Step 1: Write failing sector progress tests**

Append these tests to `src/game/race.test.ts`:

```ts
  it('records sector splits and best-sector deltas across laps', () => {
    const checkpoints = [
      { id: 'start', x: 0, z: 0, radius: 10 },
      { id: 'ridge', x: 100, z: 0, radius: 10 },
      { id: 'harbor', x: 100, z: 100, radius: 10 },
    ];

    let progress = createRaceProgress(checkpoints, 3);

    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 10);
    expect(progress.sectorStartedAtSeconds).toBe(10);
    expect(progress.lastSectorSeconds).toBeNull();
    expect(progress.bestSectorSeconds).toEqual([null, null, null]);

    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 0 }, 17.5);
    expect(progress.nextCheckpointIndex).toBe(2);
    expect(progress.lastSectorNumber).toBe(1);
    expect(progress.lastSectorCheckpointId).toBe('ridge');
    expect(progress.lastSectorSeconds).toBe(7.5);
    expect(progress.lastSectorDeltaSeconds).toBeNull();
    expect(progress.lastSectorPersonalBest).toBe(true);
    expect(progress.bestSectorSeconds).toEqual([7.5, null, null]);

    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 100 }, 26.25);
    expect(progress.lastSectorNumber).toBe(2);
    expect(progress.lastSectorCheckpointId).toBe('harbor');
    expect(progress.lastSectorSeconds).toBe(8.75);
    expect(progress.bestSectorSeconds).toEqual([7.5, 8.75, null]);

    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 40);
    expect(progress.currentLap).toBe(2);
    expect(progress.lastLapSeconds).toBe(30);
    expect(progress.lastSectorNumber).toBe(3);
    expect(progress.lastSectorCheckpointId).toBe('start');
    expect(progress.lastSectorSeconds).toBe(13.75);
    expect(progress.bestSectorSeconds).toEqual([7.5, 8.75, 13.75]);

    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 0 }, 46);
    expect(progress.lastSectorNumber).toBe(1);
    expect(progress.lastSectorSeconds).toBe(6);
    expect(progress.lastSectorDeltaSeconds).toBe(-1.5);
    expect(progress.lastSectorPersonalBest).toBe(true);
    expect(progress.bestSectorSeconds).toEqual([6, 8.75, 13.75]);
  });

  it('stops the active sector timer when the race finishes', () => {
    const checkpoints = [
      { id: 'start', x: 0, z: 0, radius: 10 },
      { id: 'ridge', x: 100, z: 0, radius: 10 },
    ];

    let progress = createRaceProgress(checkpoints, 1);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 0);
    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 0 }, 8);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 20);

    expect(progress.finished).toBe(true);
    expect(progress.sectorStartedAtSeconds).toBeNull();
    expect(progress.lastSectorNumber).toBe(2);
    expect(progress.lastSectorSeconds).toBe(12);
    expect(progress.bestSectorSeconds).toEqual([8, 12]);
  });
```

- [ ] **Step 2: Run RED for sector progress**

Run: `npm test -- src/game/race.test.ts`

Expected: FAIL because `RaceProgress` does not expose the new sector timing fields.

- [ ] **Step 3: Implement sector fields in `src/game/race.ts`**

Update the `RaceProgress` type:

```ts
  readonly sectorStartedAtSeconds: number | null;
  readonly lastSectorNumber: number | null;
  readonly lastSectorCheckpointId: string | null;
  readonly lastSectorSeconds: number | null;
  readonly lastSectorDeltaSeconds: number | null;
  readonly lastSectorPersonalBest: boolean;
  readonly bestSectorSeconds: readonly (number | null)[];
```

Initialize those fields in `createRaceProgress`:

```ts
    sectorStartedAtSeconds: null,
    lastSectorNumber: null,
    lastSectorCheckpointId: null,
    lastSectorSeconds: null,
    lastSectorDeltaSeconds: null,
    lastSectorPersonalBest: false,
    bestSectorSeconds: checkpoints.map(() => null),
```

In `updateRaceProgress`, compute `const checkpointIndex = progress.nextCheckpointIndex;` before reading the checkpoint. Replace the existing non-start and lap-completion branches with sector-aware updates using these helper functions in the same file:

```ts
function completeSector(
  progress: RaceProgress,
  checkpoints: readonly RaceCheckpoint[],
  checkpointIndex: number,
  elapsedSeconds: number,
): Pick<
  RaceProgress,
  | 'sectorStartedAtSeconds'
  | 'lastSectorNumber'
  | 'lastSectorCheckpointId'
  | 'lastSectorSeconds'
  | 'lastSectorDeltaSeconds'
  | 'lastSectorPersonalBest'
  | 'bestSectorSeconds'
> {
  if (progress.sectorStartedAtSeconds === null) {
    return {
      sectorStartedAtSeconds: elapsedSeconds,
      lastSectorNumber: progress.lastSectorNumber,
      lastSectorCheckpointId: progress.lastSectorCheckpointId,
      lastSectorSeconds: progress.lastSectorSeconds,
      lastSectorDeltaSeconds: progress.lastSectorDeltaSeconds,
      lastSectorPersonalBest: progress.lastSectorPersonalBest,
      bestSectorSeconds: progress.bestSectorSeconds,
    };
  }

  const sectorSeconds = Math.max(0, elapsedSeconds - progress.sectorStartedAtSeconds);
  const sectorIndex = getCompletedSectorIndex(checkpoints, checkpointIndex);
  const previousBest = progress.bestSectorSeconds[sectorIndex] ?? null;
  const nextBest = previousBest === null ? sectorSeconds : Math.min(previousBest, sectorSeconds);
  const bestSectorSeconds = progress.bestSectorSeconds.map((seconds, index) =>
    index === sectorIndex ? nextBest : seconds,
  );
  const deltaSeconds = previousBest === null ? null : sectorSeconds - previousBest;

  return {
    sectorStartedAtSeconds: elapsedSeconds,
    lastSectorNumber: sectorIndex + 1,
    lastSectorCheckpointId: checkpoints[checkpointIndex]?.id ?? null,
    lastSectorSeconds: sectorSeconds,
    lastSectorDeltaSeconds: deltaSeconds,
    lastSectorPersonalBest: previousBest === null || sectorSeconds <= previousBest,
    bestSectorSeconds,
  };
}

function getCompletedSectorIndex(checkpoints: readonly RaceCheckpoint[], checkpointIndex: number): number {
  return checkpointIndex === 0 ? Math.max(0, checkpoints.length - 1) : checkpointIndex - 1;
}
```

The first start checkpoint should only set `lapStartedAtSeconds` and `sectorStartedAtSeconds` to `elapsedSeconds`. Non-start checkpoints should apply `completeSector(...)` and then set `nextCheckpointIndex`. Final-lap finish should apply `completeSector(...)`, set `sectorStartedAtSeconds: null`, and keep `currentLap` at the final lap.

- [ ] **Step 4: Run GREEN for sector progress**

Run: `npm test -- src/game/race.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing timing display tests**

Create `src/game/race-timing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createRaceProgress, updateRaceProgress, type RaceCheckpoint } from './race';
import { createRaceTimingDisplay } from './race-timing';

const checkpoints: readonly RaceCheckpoint[] = [
  { id: 'start', x: 0, z: 0, radius: 10 },
  { id: 'ridge', x: 100, z: 0, radius: 10 },
  { id: 'harbor', x: 100, z: 100, radius: 10 },
];

describe('race timing display', () => {
  it('shows idle placeholders and the first sector label', () => {
    const timing = createRaceTimingDisplay(createRaceProgress(checkpoints, 3), checkpoints.length, 0);

    expect(timing).toMatchObject({
      currentLapSeconds: null,
      currentLapLabel: '--',
      bestLapLabel: '--',
      currentSectorNumber: 1,
      currentSectorLabel: 'S1',
      currentSectorSeconds: null,
      currentSectorTimeLabel: '--',
      lastSectorLabel: '--',
      lastSectorTimeLabel: '--',
      sectorDeltaLabel: '--',
      sectorDeltaTone: 'neutral',
    });
  });

  it('formats active lap and sector timers from elapsed race time', () => {
    let progress = createRaceProgress(checkpoints, 3);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 10);

    const timing = createRaceTimingDisplay(progress, checkpoints.length, 14.25);

    expect(timing.currentLapSeconds).toBeCloseTo(4.25);
    expect(timing.currentLapLabel).toBe('04.25');
    expect(timing.currentSectorNumber).toBe(1);
    expect(timing.currentSectorLabel).toBe('S1');
    expect(timing.currentSectorSeconds).toBeCloseTo(4.25);
    expect(timing.currentSectorTimeLabel).toBe('04.25');
  });

  it('formats completed sector split and first personal best tone', () => {
    let progress = createRaceProgress(checkpoints, 3);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 10);
    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 0 }, 17.5);

    const timing = createRaceTimingDisplay(progress, checkpoints.length, 19);

    expect(timing.lastSectorLabel).toBe('S1');
    expect(timing.lastSectorTimeLabel).toBe('07.50');
    expect(timing.sectorDeltaLabel).toBe('BEST');
    expect(timing.sectorDeltaTone).toBe('best');
  });

  it('formats faster sector deltas against previous best', () => {
    let progress = createRaceProgress(checkpoints, 3);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 10);
    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 0 }, 17.5);
    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 100 }, 26.25);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 40);
    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 0 }, 46);

    const timing = createRaceTimingDisplay(progress, checkpoints.length, 48);

    expect(timing.lastSectorLabel).toBe('S1');
    expect(timing.lastSectorTimeLabel).toBe('06.00');
    expect(timing.sectorDeltaLabel).toBe('-01.50');
    expect(timing.sectorDeltaTone).toBe('best');
  });
});
```

- [ ] **Step 6: Run RED for timing display**

Run: `npm test -- src/game/race-timing.test.ts`

Expected: FAIL because `src/game/race-timing.ts` does not exist.

- [ ] **Step 7: Implement `src/game/race-timing.ts`**

Create `src/game/race-timing.ts`:

```ts
import type { RaceProgress } from './race';

export type SectorDeltaTone = 'neutral' | 'best' | 'faster' | 'slower' | 'matched';

export type RaceTimingDisplayState = {
  readonly currentLapSeconds: number | null;
  readonly currentLapLabel: string;
  readonly bestLapLabel: string;
  readonly currentSectorNumber: number;
  readonly currentSectorLabel: string;
  readonly currentSectorSeconds: number | null;
  readonly currentSectorTimeLabel: string;
  readonly lastSectorLabel: string;
  readonly lastSectorTimeLabel: string;
  readonly sectorDeltaLabel: string;
  readonly sectorDeltaTone: SectorDeltaTone;
};

export function createRaceTimingDisplay(
  progress: RaceProgress,
  checkpointCount: number,
  elapsedSeconds: number,
): RaceTimingDisplayState {
  const currentLapSeconds = getCurrentLapSeconds(progress, elapsedSeconds);
  const currentSectorSeconds = getCurrentSectorSeconds(progress, elapsedSeconds);
  const currentSectorNumber = getCurrentSectorNumber(progress, checkpointCount);
  const deltaTone = getSectorDeltaTone(progress);

  return {
    currentLapSeconds,
    currentLapLabel: formatTimer(currentLapSeconds),
    bestLapLabel: formatTimer(progress.bestLapSeconds),
    currentSectorNumber,
    currentSectorLabel: `S${currentSectorNumber}`,
    currentSectorSeconds,
    currentSectorTimeLabel: formatTimer(currentSectorSeconds),
    lastSectorLabel: progress.lastSectorNumber === null ? '--' : `S${progress.lastSectorNumber}`,
    lastSectorTimeLabel: formatTimer(progress.lastSectorSeconds),
    sectorDeltaLabel: formatSectorDelta(progress),
    sectorDeltaTone: deltaTone,
  };
}

function getCurrentLapSeconds(progress: RaceProgress, elapsedSeconds: number): number | null {
  if (progress.finished) {
    return progress.lastLapSeconds;
  }

  if (progress.lapStartedAtSeconds === null) {
    return null;
  }

  return Math.max(0, elapsedSeconds - progress.lapStartedAtSeconds);
}

function getCurrentSectorSeconds(progress: RaceProgress, elapsedSeconds: number): number | null {
  if (progress.finished) {
    return progress.lastSectorSeconds;
  }

  if (progress.sectorStartedAtSeconds === null) {
    return null;
  }

  return Math.max(0, elapsedSeconds - progress.sectorStartedAtSeconds);
}

function getCurrentSectorNumber(progress: RaceProgress, checkpointCount: number): number {
  const sectors = Math.max(1, Math.trunc(checkpointCount));
  if (progress.finished && progress.lastSectorNumber !== null) {
    return progress.lastSectorNumber;
  }

  if (progress.nextCheckpointIndex <= 0) {
    return progress.lapStartedAtSeconds === null ? 1 : sectors;
  }

  return Math.min(sectors, progress.nextCheckpointIndex);
}

function formatSectorDelta(progress: RaceProgress): string {
  if (progress.lastSectorSeconds === null) {
    return '--';
  }

  if (progress.lastSectorDeltaSeconds === null) {
    return 'BEST';
  }

  return formatSignedTimer(progress.lastSectorDeltaSeconds);
}

function getSectorDeltaTone(progress: RaceProgress): SectorDeltaTone {
  if (progress.lastSectorSeconds === null) {
    return 'neutral';
  }

  if (progress.lastSectorPersonalBest) {
    return 'best';
  }

  const delta = progress.lastSectorDeltaSeconds;
  if (delta === null) {
    return 'best';
  }

  if (Math.abs(delta) < 0.005) {
    return 'matched';
  }

  return delta < 0 ? 'faster' : 'slower';
}

function formatTimer(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) {
    return '--';
  }

  return Math.max(0, seconds).toFixed(2).padStart(5, '0');
}

function formatSignedTimer(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return '--';
  }

  const sign = seconds > 0 ? '+' : seconds < 0 ? '-' : '+';
  return `${sign}${Math.abs(seconds).toFixed(2).padStart(5, '0')}`;
}
```

- [ ] **Step 8: Run GREEN for pure timing**

Run: `npm test -- src/game/race.test.ts src/game/race-timing.test.ts`

Expected: PASS.

## Task 2: HUD, Runtime Debug, Browser Coverage

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Modify: `tests/game.spec.ts`
- Modify: `README.md`
- Modify: `TODO.md`

- [ ] **Step 1: Write failing browser assertions**

Update the `DebugState` type in `tests/game.spec.ts` with:

```ts
  timing: {
    currentLapSeconds: number | null;
    currentLapLabel: string;
    bestLapLabel: string;
    currentSectorNumber: number;
    currentSectorLabel: string;
    currentSectorSeconds: number | null;
    currentSectorTimeLabel: string;
    lastSectorLabel: string;
    lastSectorTimeLabel: string;
    sectorDeltaLabel: string;
    sectorDeltaTone: 'neutral' | 'best' | 'faster' | 'slower' | 'matched';
  };
```

In the `renders and drives` test, add initial HUD assertions after `#race-gap`:

```ts
    await expect(page.locator('#lap-time')).toBeVisible();
    await expect(page.locator('#sector-label')).toHaveText(/^S[1-5]$/);
    await expect(page.locator('#sector-time')).toBeVisible();
    await expect(page.locator('#sector-delta')).toBeVisible();
```

After the race reaches `racing`, add:

```ts
    await expect
      .poll(() => readDebug(page).then((debug) => debug.timing.currentLapSeconds ?? 0), {
        message: 'current lap timer advances after launch',
      })
      .toBeGreaterThan(0);
    await expect
      .poll(() => readDebug(page).then((debug) => debug.timing.currentSectorSeconds ?? 0), {
        message: 'current sector timer advances after launch',
      })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => {
        const debug = await readDebug(page);
        const lapTime = (await page.locator('#lap-time').textContent())?.trim();
        const sectorLabel = (await page.locator('#sector-label').textContent())?.trim();
        const sectorTime = (await page.locator('#sector-time').textContent())?.trim();
        return (
          debug.timing.currentLapLabel === lapTime &&
          debug.timing.currentSectorLabel === sectorLabel &&
          debug.timing.currentSectorTimeLabel === sectorTime
        );
      })
      .toBe(true);
```

Expected failure before implementation: missing selectors and `debug.timing`.

- [ ] **Step 2: Run RED browser check**

Run: `CI=1 npm run test:e2e -- --grep "renders and drives"`

Expected: FAIL because timing HUD elements and debug state do not exist.

- [ ] **Step 3: Add timing HUD markup**

In `index.html`, replace the existing best-lap line:

```html
            <p>Best <span id="best-lap">--</span></p>
```

with:

```html
            <p class="timing-line">Lap <span id="lap-time">--</span> <span>Best</span> <span id="best-lap">--</span></p>
            <p class="timing-line timing-line-sector">
              Sector <span id="sector-label">S1</span> <span id="sector-time">--</span>
              <span id="sector-delta" data-tone="neutral">--</span>
            </p>
```

- [ ] **Step 4: Wire timing runtime in `src/main.ts`**

Import timing display:

```ts
import { createRaceTimingDisplay, type RaceTimingDisplayState } from './game/race-timing';
```

Extend `HudElements`:

```ts
  lapTime: HTMLElement;
  sectorLabel: HTMLElement;
  sectorTime: HTMLElement;
  sectorDelta: HTMLElement;
```

Extend `DebugState`:

```ts
  timing: RaceTimingDisplayState;
```

Add the HUD lookups:

```ts
  lapTime: mustGet('lap-time'),
  sectorLabel: mustGet('sector-label'),
  sectorTime: mustGet('sector-time'),
  sectorDelta: mustGet('sector-delta'),
```

Add state near `raceAwareness`:

```ts
let timingDisplay: RaceTimingDisplayState = createRaceTimingDisplay(progress, track.checkpoints.length, elapsedSeconds);
```

In `updateHud`, after setting `bestLap`, write:

```ts
  timingDisplay = createRaceTimingDisplay(raceProgress, track.checkpoints.length, elapsedSeconds);
  hud.lapTime.textContent = timingDisplay.currentLapLabel;
  hud.bestLap.textContent = timingDisplay.bestLapLabel;
  hud.sectorLabel.textContent = timingDisplay.currentSectorLabel;
  hud.sectorTime.textContent = timingDisplay.currentSectorTimeLabel;
  hud.sectorDelta.textContent = timingDisplay.sectorDeltaLabel;
  hud.sectorDelta.dataset.tone = timingDisplay.sectorDeltaTone;
```

In `createDebugState`, include:

```ts
    timing: { ...timingDisplay },
```

- [ ] **Step 5: Style timing rows**

Add to `src/styles.css` near the race-awareness styles:

```css
.timing-line {
  display: flex;
  gap: 6px;
  align-items: baseline;
  min-width: 0;
  color: rgb(214 230 238 / 0.86);
  white-space: nowrap;
}

.timing-line span {
  font-variant-numeric: tabular-nums;
}

#lap-time,
#best-lap,
#sector-time,
#sector-delta {
  display: inline-block;
  min-width: 5.2ch;
  color: #f8fbff;
  font-weight: 900;
  text-align: right;
}

#sector-label {
  color: #36f1ff;
  font-weight: 900;
}

#sector-delta {
  min-width: 6ch;
}

#sector-delta[data-tone="best"],
#sector-delta[data-tone="faster"] {
  color: #63f7a4;
}

#sector-delta[data-tone="slower"] {
  color: #ff9bb3;
}

#sector-delta[data-tone="matched"] {
  color: #ffe66b;
}
```

In the `@media (max-width: 720px)` block, add:

```css
  .timing-line {
    gap: 4px;
    font-size: 0.72rem;
  }

  #lap-time,
  #best-lap,
  #sector-time,
  #sector-delta {
    min-width: 4.8ch;
  }
```

- [ ] **Step 6: Update README and TODO**

Update `README.md` first paragraph to include `lap split and sector timing feedback`.

In `TODO.md`, move `Add lap split and sector timing feedback.` from Next Improvements to Completed. Add this new Next Improvements item:

```md
- [ ] Add race line ghost replay and time-trial target lap.
```

- [ ] **Step 7: Run GREEN browser check**

Run: `CI=1 npm run test:e2e -- --grep "renders and drives"`

Expected: PASS.

## Final Verification

- [ ] Run `git diff --check`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `CI=1 npm run test:e2e`.
- [ ] Start a local dev server and run desktop/tablet/mobile Playwright smoke checks for movement, timing HUD/debug, gap HUD, minimap metadata, mobile touch, and no console errors.
- [ ] Commit and push to `main`.
- [ ] Watch the Deploy workflow.
- [ ] Run a live GitHub Pages smoke check for timing HUD/debug across desktop/tablet/mobile.
