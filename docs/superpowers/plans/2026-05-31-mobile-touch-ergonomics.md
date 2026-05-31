# Mobile Touch Ergonomics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce mobile control clutter and make touch controls easier to hit.

**Architecture:** Keep the existing touch-control input module. Add runtime-derived control-hint visibility in `main.ts`, enlarge touch controls in CSS, and extend Playwright coverage for hint visibility and hit-target dimensions.

**Tech Stack:** TypeScript, Vite, Three.js, CSS, Playwright, Vitest.

---

## File Structure

- Modify `src/main.ts`: derive control hint visibility from `settings.showControlHints` and `touchControlsVisible`.
- Modify `src/styles.css`: enlarge touch targets while preserving small-screen fit and surface clearance.
- Modify `tests/game.spec.ts`: add browser assertions for desktop/mobile hint visibility and mobile hit-target sizes.
- Modify `README.md`: document that keyboard hints are hidden while touch controls are active.
- Modify `TODO.md`: close the mobile ergonomics TODO and add the next polish item.

## Task 1: Runtime Hint Visibility

**Files:**
- Modify: `src/main.ts`
- Modify: `tests/game.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing Playwright assertions**

In `tests/game.spec.ts`, extend `touch controls visibility follows auto and manual settings`:

```ts
await expect(page.locator('#control-hints')).toBeVisible();
await page.locator('#settings-button').click();
await page.locator('#touch-controls-mode').selectOption('on');
await expect(page.locator('#control-hints')).toBeHidden();
await expect.poll(() => readDebug(page).then((state) => state.controlHintsVisible)).toBe(false);
```

Then after switching to mobile auto mode:

```ts
await page.locator('#touch-controls-mode').selectOption('auto');
await expect(page.locator('#control-hints')).toBeHidden();
await expect.poll(() => readDebug(page).then((state) => state.controlHintsVisible)).toBe(false);
```

- [ ] **Step 2: Run RED**

Run: `CI=1 npm run test:e2e -- --grep "touch controls visibility"`

Expected: FAIL because `#control-hints` is still visible while touch controls are visible.

- [ ] **Step 3: Implement derived hint visibility**

In `src/main.ts`, add:

```ts
function updateControlHintsVisibility(): void {
  const visible = settings.showControlHints && !touchControlsVisible;
  settingsElements.controlHints.classList.toggle('hidden', !visible);
  settingsElements.controlHints.hidden = !visible;
}
```

Call `updateControlHintsVisibility()` from `applyRuntimeSettings()` and after `touchControlsVisible` is updated in `updateTouchControlsVisibility()`. Remove the direct `settingsElements.controlHints` toggle from `applyRuntimeSettings()`.

- [ ] **Step 4: Run GREEN**

Run: `CI=1 npm run test:e2e -- --grep "touch controls visibility"`

Expected: PASS.

## Task 2: Larger Touch Targets

**Files:**
- Modify: `src/styles.css`
- Modify: `tests/game.spec.ts`
- Modify: `README.md`
- Modify: `TODO.md`

- [ ] **Step 1: Write failing hit-target assertions**

In `tests/game.spec.ts`, add a helper:

```ts
async function expectTouchButtonsToMeetMinimumSize(page: Page, minimumWidth: number, minimumHeight: number): Promise<void> {
  const undersized = await page.evaluate(
    ({ selectors, minWidth, minHeight }) => {
      return selectors.flatMap((selector) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element || element.hidden) {
          return [`${selector} is missing or hidden`];
        }
        const rect = element.getBoundingClientRect();
        return rect.width >= minWidth && rect.height >= minHeight
          ? []
          : [`${selector} is ${rect.width}x${rect.height}`];
      });
    },
    { selectors: touchButtonSelectors, minWidth: minimumWidth, minHeight: minimumHeight },
  );

  expect(undersized).toEqual([]);
}
```

Call it from `touch controls stay clear of mobile settings and results surfaces`:

```ts
await expectTouchButtonsToMeetMinimumSize(page, viewportWidth <= 420 ? 70 : 76, viewportWidth <= 420 ? 64 : 68);
```

- [ ] **Step 2: Run RED**

Run: `CI=1 npm run test:e2e -- --grep "touch controls stay clear"`

Expected: FAIL because the current `max-width: 420px` buttons are 60 x 58.

- [ ] **Step 3: Enlarge touch-control CSS**

In `src/styles.css`:

```css
.touch-bank-steer,
.touch-bank-drive {
  grid-template-columns: repeat(2, 76px);
}

.touch-controls button {
  width: 76px;
  height: 68px;
  min-width: 76px;
  min-height: 68px;
}

@media (max-width: 420px) {
  .touch-bank-steer,
  .touch-bank-drive {
    grid-template-columns: repeat(2, 70px);
  }

  .touch-controls button {
    width: 70px;
    height: 64px;
    min-width: 70px;
    min-height: 64px;
  }
}
```

Keep the current non-overlap checks for `#settings-button` and `#results-panel`.

- [ ] **Step 4: Update docs and TODO**

In `README.md`, state that keyboard hints are hidden while touch controls are active.

In `TODO.md`, move `Tune mobile touch control ergonomics after live-device feedback.` to completed and add `Add a track minimap and race-position display.` under next improvements.

- [ ] **Step 5: Run GREEN**

Run: `CI=1 npm run test:e2e -- --grep "touch controls stay clear"`

Expected: PASS.

## Final Verification

- [ ] Run `git diff --check`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `CI=1 npm run test:e2e`.
- [ ] Start a local dev server and run a 390px mobile smoke with console-error capture.
- [ ] Commit and push.
- [ ] Watch the Deploy workflow.
- [ ] Run a live GitHub Pages mobile smoke.
