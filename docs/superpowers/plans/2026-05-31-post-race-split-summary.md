# Post-Race Split Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact post-race lap and sector split summary to the existing results panel.

**Architecture:** Extend `RaceProgress` with completed lap and sector split history at checkpoint-crossing time. Add a pure `race-summary` display helper, then render its state inside the existing results panel and expose it through debug state.

**Tech Stack:** TypeScript, Vite, Three.js, DOM rendering, CSS, Vitest, Playwright.

---

## File Structure

- Modify `src/game/race.ts`: add completed lap and sector history to `RaceProgress`.
- Modify `src/game/race.test.ts`: cover lap/sector history recording.
- Create `src/game/race-summary.ts`: convert finished `RaceProgress` into display-ready summary rows.
- Create `src/game/race-summary.test.ts`: cover hidden/finished/best-tone display behavior.
- Modify `index.html`: add split summary containers inside `#results-panel`.
- Modify `src/main.ts`: render the split summary, expose debug state, and add dev-only finish/reset test controls.
- Modify `src/styles.css`: style compact summary rows/chips with mobile-safe wrapping.
- Modify `tests/game.spec.ts`: add browser coverage for post-race summary display/debug/layout/reset.
- Modify `README.md`: mention post-race split summary.
- Modify `TODO.md`: mark the summary item complete and add the next improvement.

## Task 1: Pure Split History And Summary

**Files:**
- Modify: `src/game/race.ts`
- Modify: `src/game/race.test.ts`
- Create: `src/game/race-summary.ts`
- Create: `src/game/race-summary.test.ts`

- [ ] **Step 1: Write failing race history tests**

Add tests to `src/game/race.test.ts` asserting:

```ts
expect(progress.completedLapSeconds).toEqual([]);
expect(progress.completedSectorSplits).toEqual([]);
```

Then after completing a two-lap race on a three-checkpoint track:

```ts
expect(progress.completedLapSeconds).toEqual([30, 28]);
expect(progress.completedSectorSplits.map((split) => ({
  lapNumber: split.lapNumber,
  sectorNumber: split.sectorNumber,
  checkpointId: split.checkpointId,
  seconds: split.seconds,
  deltaSeconds: split.deltaSeconds,
  personalBest: split.personalBest,
}))).toEqual([
  { lapNumber: 1, sectorNumber: 1, checkpointId: 'ridge', seconds: 7.5, deltaSeconds: null, personalBest: true },
  { lapNumber: 1, sectorNumber: 2, checkpointId: 'harbor', seconds: 8.75, deltaSeconds: null, personalBest: true },
  { lapNumber: 1, sectorNumber: 3, checkpointId: 'start', seconds: 13.75, deltaSeconds: null, personalBest: true },
  { lapNumber: 2, sectorNumber: 1, checkpointId: 'ridge', seconds: 6, deltaSeconds: -1.5, personalBest: true },
]);
```

- [ ] **Step 2: Run RED for race history**

Run: `npm test -- src/game/race.test.ts`

Expected: FAIL because `completedLapSeconds` and `completedSectorSplits` do not exist.

- [ ] **Step 3: Implement race history**

In `src/game/race.ts`, add:

```ts
export type CompletedSectorSplit = {
  readonly lapNumber: number;
  readonly sectorNumber: number;
  readonly checkpointId: string;
  readonly seconds: number;
  readonly deltaSeconds: number | null;
  readonly personalBest: boolean;
};
```

Extend `RaceProgress` with:

```ts
readonly completedLapSeconds: readonly number[];
readonly completedSectorSplits: readonly CompletedSectorSplit[];
```

Initialize both to empty arrays in `createRaceProgress`.

When `recordCompletedSector` returns state, append a split:

```ts
completedSectorSplits: [
  ...progress.completedSectorSplits,
  {
    lapNumber: progress.currentLap,
    sectorNumber,
    checkpointId,
    seconds: sectorSeconds,
    deltaSeconds: sectorDeltaSeconds,
    personalBest,
  },
],
```

When a lap completes, append:

```ts
completedLapSeconds: [...sectorProgress.completedLapSeconds, lapSeconds],
```

- [ ] **Step 4: Run GREEN for race history**

Run: `npm test -- src/game/race.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing summary helper tests**

Create `src/game/race-summary.test.ts` with tests for:

```ts
expect(createRaceSplitSummary(createRaceProgress(checkpoints, 2))).toMatchObject({ visible: false });
```

And after a finished two-lap progress object:

```ts
expect(summary.visible).toBe(true);
expect(summary.lapRows.map((row) => row.timeLabel)).toEqual(['30.00', '28.00']);
expect(summary.lapRows.map((row) => row.isBest)).toEqual([false, true]);
expect(summary.sectorRows[0].sectors.map((sector) => sector.sectorLabel)).toEqual(['S1', 'S2', 'S3']);
expect(summary.sectorRows[1].sectors[0]).toMatchObject({
  sectorLabel: 'S1',
  timeLabel: '06.00',
  tone: 'best',
});
```

- [ ] **Step 6: Run RED for summary helper**

Run: `npm test -- src/game/race-summary.test.ts`

Expected: FAIL because `./race-summary` does not exist.

- [ ] **Step 7: Implement summary helper**

Create `src/game/race-summary.ts` exporting:

```ts
export type RaceSplitSummarySector = {
  readonly sectorNumber: number;
  readonly sectorLabel: string;
  readonly timeLabel: string;
  readonly tone: 'best' | 'normal';
};

export type RaceSplitSummaryLapRow = {
  readonly lapNumber: number;
  readonly lapLabel: string;
  readonly timeLabel: string;
  readonly isBest: boolean;
};

export type RaceSplitSummarySectorRow = {
  readonly lapNumber: number;
  readonly lapLabel: string;
  readonly sectors: readonly RaceSplitSummarySector[];
};

export type RaceSplitSummaryState = {
  readonly visible: boolean;
  readonly lapRows: readonly RaceSplitSummaryLapRow[];
  readonly sectorRows: readonly RaceSplitSummarySectorRow[];
};
```

Implement `createRaceSplitSummary(progress: RaceProgress): RaceSplitSummaryState`:

- returns hidden if `!progress.finished || progress.completedLapSeconds.length === 0`
- formats times with `seconds.toFixed(2).padStart(5, '0')`
- marks the shortest lap as `isBest`
- groups `completedSectorSplits` by `lapNumber`
- marks sectors with `split.personalBest === true` as `tone: "best"`

- [ ] **Step 8: Run focused pure tests**

Run: `npm test -- src/game/race.test.ts src/game/race-summary.test.ts`

Expected: PASS.

## Task 2: Results Panel Runtime Integration

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Modify: `tests/game.spec.ts`
- Modify: `README.md`
- Modify: `TODO.md`

- [ ] **Step 1: Write failing Playwright coverage**

In `tests/game.spec.ts`, add a test named:

```ts
test('shows post-race lap and sector split summary after finish', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect.poll(() => hasDebugState(page)).toBe(true);
  await expect(page.locator('#split-summary')).toBeHidden();
  await page.evaluate(() => window.__racingGameTestControls?.finishRace());
  await expect(page.locator('#results-panel')).toBeVisible();
  await expect(page.locator('#split-summary')).toBeVisible();
  await expect(page.locator('#lap-splits')).toContainText('L1');
  await expect(page.locator('#sector-splits')).toContainText('S1');
  await expect.poll(() => readDebug(page).then((debug) => debug.splitSummary.visible)).toBe(true);
  await expect.poll(() => readSplitSummaryHudMatch(page)).toBe(true);
  await page.keyboard.press('r');
  await expect(page.locator('#split-summary')).toBeHidden();
  expect(consoleErrors).toEqual([]);
});
```

Add the `splitSummary` type to the Playwright `DebugState` type and add `readSplitSummaryHudMatch(page)` as a helper that compares debug lap/sector labels with DOM text.

- [ ] **Step 2: Run RED for browser coverage**

Run: `CI=1 npm run test:e2e -- --grep "post-race lap and sector split summary"`

Expected: FAIL because elements/test controls do not exist.

- [ ] **Step 3: Add result panel markup**

In `index.html`, inside `#results-panel` after `#results-list`, add:

```html
<section id="split-summary" class="split-summary hidden" aria-label="Lap and sector splits" hidden>
  <h3>Splits</h3>
  <div id="lap-splits" class="lap-splits"></div>
  <div id="sector-splits" class="sector-splits"></div>
</section>
```

- [ ] **Step 4: Wire runtime rendering**

In `src/main.ts`:

- import `createRaceSplitSummary`
- add `splitSummary`, `lapSplits`, and `sectorSplits` HUD elements
- keep `let splitSummaryDisplay = createRaceSplitSummary(progress)`
- add `splitSummary: RaceSplitSummaryState` to `DebugState`
- update `updateResultsBoard()` to render the summary when results render
- clear/hide summary when not finished
- expose `window.__racingGameDebug.splitSummary`

Rendering details:

- lap split rows should use `button`-free static elements
- sector chips should use `data-tone`
- `resultsKey` should include completed lap and sector counts so summary updates when test controls finish

- [ ] **Step 5: Add dev-only test controls**

In `src/main.ts`, extend `Window` only for dev:

```ts
__racingGameTestControls?: {
  finishRace: () => void;
};
```

When `import.meta.env.DEV`, assign a `finishRace` function that:

- creates a deterministic completed `RaceProgress` by replaying checkpoints and timestamps through `updateRaceProgress`
- assigns it to `progress`
- sets `elapsedSeconds` to the final timestamp
- finishes opponents with `finishRemainingOpponents`
- calls `finishRace(session, [playerResult, ...getOpponentResults(opponents)])`
- sets `running = false`
- calls `updateHud`, `updateRaceAwareness`, `updateResultsBoard`, and refreshes debug state

- [ ] **Step 6: Add CSS**

In `src/styles.css`, add:

- `.split-summary`
- `.split-summary h3`
- `.lap-splits`
- `.lap-split-row`
- `.sector-splits`
- `.sector-split-row`
- `.sector-chip`
- `[data-tone="best"]`

Keep the panel width mobile-safe. Use tabular numerals, small uppercase labels, wrapping chips, and no overlap with touch controls.

- [ ] **Step 7: Update docs/TODO**

Update `README.md` to mention post-race split summaries.

Update `TODO.md`:

- move `Add post-race lap and sector split summary to the results panel.` to Completed
- add next improvement: `Add ghost-car replay for the player's best lap.`

- [ ] **Step 8: Run focused integration verification**

Run:

```bash
npm test -- src/game/race.test.ts src/game/race-summary.test.ts
npm run build
CI=1 npm run test:e2e -- --grep "post-race lap and sector split summary|renders and drives|touch controls stay clear"
git diff --check
```

Expected: all pass.
