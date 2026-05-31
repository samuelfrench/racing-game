# Race Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent in-game settings for graphics quality, camera mode, audio volume/mute, reduced motion, high contrast, and control-hint visibility.

**Architecture:** Keep settings rules pure in `src/game/settings.ts`, then wire DOM controls and runtime effects through `src/main.ts`. Renderer, speed effect, camera, audio, CSS class, and debug-state changes must all derive from the same sanitized `GameSettings` object.

**Tech Stack:** TypeScript, Three.js, Web Audio API, localStorage, Vitest, Playwright, Vite.

---

## File Structure

- Create: `src/game/settings.ts` for defaults, sanitization, storage, graphics/camera profiles, and motion-effect adjustment.
- Create: `src/game/settings.test.ts` for unit coverage.
- Modify: `src/game/audio-engine.ts` to expose current master gain in debug state.
- Modify: `src/main.ts` to load settings, wire settings controls, apply runtime effects, persist changes, and expose debug state.
- Modify: `index.html` to add the settings button, settings panel, and control hints strip.
- Modify: `src/styles.css` to style the settings panel, high contrast mode, reduced-motion affordances, and control hints.
- Modify: `tests/game.spec.ts` to verify settings UI and runtime effects in the browser.
- Modify: `README.md` and `TODO.md` to document/close the shipped slice.

---

### Task 1: Pure Settings State

**Files:**
- Create: `src/game/settings.ts`
- Create: `src/game/settings.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/game/settings.test.ts` with tests for default values, stale value sanitization, storage read/write fallback, graphics profile, camera profile, and reduced-motion speed-effect damping.

Run: `npm test -- src/game/settings.test.ts`

Expected: FAIL because `src/game/settings.ts` does not exist.

- [ ] **Step 2: Implement the pure settings module**

Create `src/game/settings.ts` with:

- `GameSettings`
- `DEFAULT_GAME_SETTINGS`
- `GAME_SETTINGS_STORAGE_KEY`
- `sanitizeGameSettings(value)`
- `readStoredGameSettings(storage)`
- `writeStoredGameSettings(storage, settings)`
- `resolveGraphicsProfile(settings)`
- `resolveCameraProfile(settings)`
- `applyMotionSettings(settings, effects)`

The module must not import DOM globals directly; storage is injected.

- [ ] **Step 3: Verify green**

Run: `npm test -- src/game/settings.test.ts`

Expected: PASS.

- [ ] **Step 4: Verify all unit tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/game/settings.ts src/game/settings.test.ts && git commit -m "Add pure race settings state"`

---

### Task 2: Runtime Settings UI And Browser Verification

**Files:**
- Modify: `index.html`
- Modify: `src/styles.css`
- Modify: `src/main.ts`
- Modify: `src/game/audio-engine.ts`
- Modify: `tests/game.spec.ts`
- Modify: `README.md`
- Modify: `TODO.md`

- [ ] **Step 1: Write failing browser assertions**

Extend `tests/game.spec.ts` debug typing with `settings`, `graphics`, and `camera` fields. Add a desktop-focused test that opens the settings panel, changes each setting, reloads to prove persistence, starts a race, and asserts:

- quality `low` lowers the debug pixel-ratio cap and active streak count;
- camera mode `hood` changes camera profile;
- reduced motion lowers runtime speed-effect outputs;
- muted audio drives debug `audio.masterGain` to `0`;
- high contrast applies the body class;
- hidden control hints remove the hints strip;
- reset restores defaults.

Run: `CI=1 npm run test:e2e -- --project=chromium --grep "settings"`

Expected: FAIL because the settings UI/debug state does not exist.

- [ ] **Step 2: Add settings markup and styles**

Add `#settings-button`, `#settings-panel`, form controls, and `#control-hints` to `index.html`. Style them in `src/styles.css` using the current HUD palette, 8px-or-less radii, stable dimensions, responsive constraints, and high-contrast/reduced-motion classes.

- [ ] **Step 3: Wire settings into runtime**

In `src/main.ts`:

- load sanitized settings from `localStorage`;
- cache all settings DOM elements;
- open/close the panel with button, close button, and `Escape`;
- update settings from controls and persist after each change;
- reset defaults from the reset button;
- ignore driving/reset keyboard handling when events originate from settings form elements;
- apply graphics profile in `resize`;
- apply camera profile in `updateCamera`;
- apply reduced-motion speed effects before rendering visual effects;
- apply high-contrast body class and scene clear/fog color;
- apply audio volume/mute by scaling `audioMix.masterGain`;
- expose settings, graphics, camera, and hints visibility in debug state.

- [ ] **Step 4: Expose audio master gain debug**

Extend `RaceAudioDebugState` and `getDebugState()` in `src/game/audio-engine.ts` with `masterGain`.

- [ ] **Step 5: Verify green browser test**

Run: `CI=1 npm run test:e2e -- --project=chromium --grep "settings"`

Expected: PASS.

- [ ] **Step 6: Verify full local gates**

Run:

```bash
npm test
npm run build
CI=1 npm run test:e2e
git diff --check
```

Expected: all pass.

- [ ] **Step 7: Commit**

Run: `git add index.html src/styles.css src/main.ts src/game/audio-engine.ts tests/game.spec.ts README.md TODO.md && git commit -m "Add in-game race settings"`

---

## Plan Self-Review

- Spec coverage: every design requirement maps to Task 1 pure rules or Task 2 integration/browser verification.
- Placeholder scan: no `TBD`, `TODO`, or open-ended implementation placeholders remain.
- Type consistency: `GameSettings`, `graphics`, `camera`, and `audio.masterGain` are named consistently across plan tasks.
