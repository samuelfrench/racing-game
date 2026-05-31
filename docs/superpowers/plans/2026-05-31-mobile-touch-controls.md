# Mobile Touch Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tested, persistent, mobile-ready touch controls to the Three.js racing game.

**Architecture:** A pure `touch-controls` module owns touch action state, control-input conversion, input merging, and visibility resolution. `main.ts` wires DOM buttons and settings to that module; CSS handles responsive overlay layout.

**Tech Stack:** TypeScript, Vitest, Vite, Three.js, Playwright, Pointer Events.

---

## File Structure

- Create `src/game/touch-controls.ts`: pure touch input state, input merging, mode resolution.
- Create `src/game/touch-controls.test.ts`: focused unit coverage for touch state and merged controls.
- Modify `src/game/settings.ts` and `src/game/settings.test.ts`: add persisted `touchControlsMode`.
- Modify `index.html`: add settings select and touch control overlay buttons.
- Modify `src/styles.css`: style responsive touch controls without overlapping HUD/settings.
- Modify `src/main.ts`: wire DOM events, merge input, expose debug state.
- Modify `tests/game.spec.ts`: cover mobile touch driving and settings visibility behavior.
- Modify `README.md` and `TODO.md`: document controls and close the TODO item.

## Task 1: Pure Touch State And Settings

**Files:**
- Create: `src/game/touch-controls.ts`
- Create: `src/game/touch-controls.test.ts`
- Modify: `src/game/settings.ts`
- Modify: `src/game/settings.test.ts`

- [ ] **Step 1: Write failing settings tests**

Add tests asserting default `touchControlsMode: 'auto'`, valid stored modes `auto/on/off`, and invalid mode fallback to `auto`.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/game/settings.test.ts`

Expected: FAIL because `touchControlsMode` does not exist yet.

- [ ] **Step 3: Implement settings mode**

Add `TouchControlsMode = 'auto' | 'on' | 'off'`, include it in `GameSettings`, defaults, sanitizer, and storage write sanitization.

- [ ] **Step 4: Write failing touch-control tests**

Cover active pointer tracking, multi-touch actions, cleanup, `ControlInput` conversion, keyboard+touch input merging, and `shouldShowTouchControls`.

- [ ] **Step 5: Run RED**

Run: `npm test -- src/game/touch-controls.test.ts`

Expected: FAIL because `src/game/touch-controls.ts` is missing.

- [ ] **Step 6: Implement pure touch-control module**

Expose `TOUCH_ACTIONS`, `createTouchControlState`, `setTouchActionActive`, `clearTouchAction`, `clearTouchControls`, `resolveTouchInput`, `mergeControlInputs`, `getActiveTouchActions`, and `shouldShowTouchControls`.

- [ ] **Step 7: Run GREEN**

Run: `npm test -- src/game/settings.test.ts src/game/touch-controls.test.ts`

Expected: PASS.

## Task 2: DOM Integration, Browser Coverage, And Docs

**Files:**
- Modify: `index.html`
- Modify: `src/styles.css`
- Modify: `src/main.ts`
- Modify: `tests/game.spec.ts`
- Modify: `README.md`
- Modify: `TODO.md`

- [ ] **Step 1: Write failing Playwright coverage**

Add browser assertions that mobile auto mode shows touch controls, held throttle drives the car, held drift+steer produces skid audio, desktop auto mode hides touch controls, settings can force controls on desktop, and settings can hide controls on mobile.

- [ ] **Step 2: Run RED**

Run: `CI=1 npm run test:e2e -- --grep "touch controls"`

Expected: FAIL because the DOM overlay and debug state do not exist.

- [ ] **Step 3: Add DOM controls**

Add a `Touch controls` settings select and an overlay section with buttons for left, right, throttle, brake, drift, and boost. Use stable IDs and `data-touch-action` attributes.

- [ ] **Step 4: Wire runtime input**

In `main.ts`, cache touch elements, bind Pointer Events with pointer capture, merge touch input with keyboard input in `readInput()`, clear state on race reset/window lifecycle, update overlay visibility on settings/resize, and expose debug fields.

- [ ] **Step 5: Add CSS**

Style the overlay as fixed control banks with large buttons, stable dimensions, high contrast support, reduced motion compatibility, and no overlap with start/settings panels.

- [ ] **Step 6: Update docs**

Document touch controls in `README.md` and move the project TODO item to completed.

- [ ] **Step 7: Run GREEN**

Run: `npm test`, `npm run build`, and `CI=1 npm run test:e2e`.

Expected: PASS.

## Final Verification

- [ ] Run `git diff --check`.
- [ ] Start the local dev server and use Playwright to verify mobile touch gameplay with no console errors.
- [ ] Commit and push changes.
- [ ] Watch the GitHub Actions Deploy workflow.
- [ ] Smoke test the live GitHub Pages build on mobile viewport.
