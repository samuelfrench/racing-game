# Race Structure And Opponents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real race flow with countdown, deterministic AI opponents, finish detection, and a results board.

**Architecture:** Keep time/race state and AI movement in pure TypeScript modules covered by Vitest. Wire those modules into the existing Three.js scene with small UI additions in `index.html`, `src/main.ts`, and `src/styles.css`, then extend Playwright to verify countdown/start behavior and opponent/result surfaces.

**Tech Stack:** Vite, TypeScript, Three.js, Vitest, Playwright.

---

### Task 1: Pure Race Session And Opponent Logic

**Files:**
- Create: `src/game/race-session.ts`
- Create: `src/game/race-session.test.ts`
- Create: `src/game/opponents.ts`
- Create: `src/game/opponents.test.ts`
- Modify only if needed: `src/game/track.ts`
- Modify only if needed: `src/game/track.test.ts`

- [ ] **Step 1: Write failing tests for countdown/session flow**

`src/game/race-session.test.ts` must verify:
- `createRaceSession()` starts in `idle` with a `countdownSeconds` value of `3`.
- `requestRaceStart(session)` moves to `countdown`.
- `stepRaceSession(session, 1.2)` remains in `countdown` with time remaining.
- Stepping past 3 seconds moves to `racing`.
- `finishRace(session, [{ id: 'player', name: 'You', finishSeconds: 92.4 }])` moves to `finished` and stores sorted results.
- `resetRaceSession(session)` returns to `idle`.

Run: `npm test -- src/game/race-session.test.ts`
Expected: FAIL because the module does not exist yet.

- [ ] **Step 2: Implement minimal race session logic**

Create `src/game/race-session.ts` with:
- `RacePhase = 'idle' | 'countdown' | 'racing' | 'finished'`
- `RaceResult` with `id`, `name`, `finishSeconds`
- `RaceSession` with `phase`, `countdownSeconds`, `startedAtSeconds`, `finishedAtSeconds`, `results`
- `createRaceSession()`
- `requestRaceStart(session)`
- `stepRaceSession(session, deltaSeconds)`
- `finishRace(session, results)`
- `resetRaceSession(session)`

Keep it pure and deterministic. Clamp countdown at `0`. Sort results by ascending `finishSeconds`.

- [ ] **Step 3: Verify race session tests pass**

Run: `npm test -- src/game/race-session.test.ts`
Expected: PASS.

- [ ] **Step 4: Write failing tests for AI opponents**

`src/game/opponents.test.ts` must verify:
- `createOpponentGrid(track, totalLaps)` returns three opponents with stable names, ids, colors, staggered start distances, and `finishedAtSeconds === null`.
- `stepOpponents(opponents, track, 1, true, 1)` advances their positions along the track and increases `distanceTraveled`.
- `stepOpponents(opponents, track, 1, false, 2)` does not advance while countdown is active.
- Repeated stepping finishes opponents and records `finishedAtSeconds`.
- `getOpponentResults(opponents)` returns only finished opponents sorted by `finishSeconds`.

Run: `npm test -- src/game/opponents.test.ts`
Expected: FAIL because the module does not exist yet.

- [ ] **Step 5: Implement deterministic AI opponents**

Create `src/game/opponents.ts` with:
- `OpponentState` containing `id`, `name`, `color`, `position`, `heading`, `distanceTraveled`, `lap`, `speed`, `finishedAtSeconds`.
- `createOpponentGrid(track, totalLaps)`.
- `stepOpponents(opponents, track, deltaSeconds, racing, elapsedSeconds)`.
- `getOpponentResults(opponents)`.

Use the track centerline as a loop. Compute segment lengths internally. Movement should wrap around the lap until `totalLaps * lapLength`, then clamp at finish and set `finishedAtSeconds`.

- [ ] **Step 6: Verify pure logic tests pass**

Run: `npm test -- src/game/race-session.test.ts src/game/opponents.test.ts`
Expected: PASS.

### Task 2: Scene, HUD, Results, And Browser Verification

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Modify: `tests/game.spec.ts`
- Modify: `TODO.md`
- Modify: `README.md`

- [ ] **Step 1: Write failing browser expectations**

Extend `tests/game.spec.ts` so the desktop/mobile smoke verifies:
- `#race-status` is visible.
- After clicking `#start-button`, `window.__racingGameDebug.phase` becomes `countdown`.
- The car does not move materially during countdown while throttle is held.
- After countdown, phase becomes `racing` and movement works.
- `window.__racingGameDebug.opponents.length === 3`.

Run: `npm run test:e2e`
Expected: FAIL before UI integration because `phase`, `race-status`, and opponents are missing.

- [ ] **Step 2: Wire race session and opponents into `src/main.ts`**

Integrate the Task 1 modules:
- Start button calls `requestRaceStart`.
- During `countdown`, input is ignored and `stepRaceSession` counts down.
- During `racing`, player and opponents advance.
- When `progress.finished`, combine player result with opponent results and call `finishRace`.
- Reset restores player, progress, session, opponents, elapsed time, and results UI.
- Add three opponent meshes with distinct colors.
- Extend debug state with `phase`, `countdownSeconds`, `opponents`, and `results`.

- [ ] **Step 3: Add HUD/results UI**

Update markup and styles:
- `#race-status` shows `READY`, countdown number, `GO`, or `FINISH`.
- Results board lists the player and opponents by finish time once the player finishes.
- Styling stays dense, readable, and arcade-race themed without overlapping HUD on desktop/mobile.

- [ ] **Step 4: Verify local behavior**

Run:
- `npm test`
- `npm run build`
- `npm run test:e2e`

Expected: all pass.

- [ ] **Step 5: Commit and push**

Run:
- `git add docs/superpowers/plans/2026-05-31-race-structure-opponents.md index.html src tests README.md TODO.md`
- `git commit -m "Add race countdown and AI opponents"`
- `git push`

Expected: push to `origin/main` triggers deploy.
