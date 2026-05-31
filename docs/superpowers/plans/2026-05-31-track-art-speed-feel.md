# Track Art And Speed Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Neon Harbor GP feel faster and more alive with tested speed-effect state, richer trackside signage, animated crowd panels, and browser assertions.

**Architecture:** Keep game math testable by adding a pure `speed-effects` module, then consume it from `src/main.ts` to drive camera FOV, a CSS vignette, and speed streak meshes. Keep scenery code inside the existing scene builder, but expose debug counts so Playwright can verify that track art and effects are present at runtime.

**Tech Stack:** TypeScript, Three.js, Vitest, Playwright, Vite.

---

## File Structure

- Create: `src/game/speed-effects.ts` for pure speed-effect calculations.
- Create: `src/game/speed-effects.test.ts` for red/green unit coverage.
- Modify: `src/main.ts` for scene art, animation, camera FOV, debug state, and effect wiring.
- Modify: `src/styles.css` for the full-screen speed vignette overlay.
- Modify: `index.html` to add the `#speed-vignette` element.
- Modify: `tests/game.spec.ts` to assert debug track-art counts and speed effects during actual driving.
- Modify: `README.md` and `TODO.md` for shipped feature state.

---

### Task 1: Pure Speed-Effect State

**Files:**
- Create: `src/game/speed-effects.ts`
- Create: `src/game/speed-effects.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/speed-effects.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { computeSpeedEffects } from './speed-effects';

describe('computeSpeedEffects', () => {
  test('keeps idle camera and overlay effects restrained', () => {
    const effects = computeSpeedEffects({
      speed: 0,
      drift: 0,
      boostActive: false,
      deltaSeconds: 1 / 60,
      previousIntensity: 0,
    });

    expect(effects.intensity).toBeCloseTo(0, 3);
    expect(effects.cameraFov).toBe(62);
    expect(effects.vignetteOpacity).toBe(0);
    expect(effects.streakOpacity).toBe(0);
  });

  test('ramps camera, vignette, and streak opacity at racing speed', () => {
    const effects = computeSpeedEffects({
      speed: 58,
      drift: 0.08,
      boostActive: true,
      deltaSeconds: 0.2,
      previousIntensity: 0.42,
    });

    expect(effects.intensity).toBeGreaterThan(0.42);
    expect(effects.intensity).toBeLessThanOrEqual(1);
    expect(effects.cameraFov).toBeGreaterThan(66);
    expect(effects.vignetteOpacity).toBeGreaterThan(0.15);
    expect(effects.streakOpacity).toBeGreaterThan(0.25);
    expect(effects.roadPulse).toBeGreaterThan(0.2);
  });

  test('smooths and clamps bad inputs', () => {
    const effects = computeSpeedEffects({
      speed: -999,
      drift: 4,
      boostActive: true,
      deltaSeconds: 4,
      previousIntensity: 9,
    });

    expect(effects.intensity).toBeGreaterThanOrEqual(0);
    expect(effects.intensity).toBeLessThanOrEqual(1);
    expect(effects.cameraFov).toBeLessThanOrEqual(72);
    expect(effects.vignetteOpacity).toBeLessThanOrEqual(0.38);
    expect(effects.streakOpacity).toBeLessThanOrEqual(0.78);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/game/speed-effects.test.ts`

Expected: FAIL because `src/game/speed-effects.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/game/speed-effects.ts`:

```ts
export type SpeedEffectInput = {
  readonly speed: number;
  readonly drift: number;
  readonly boostActive: boolean;
  readonly deltaSeconds: number;
  readonly previousIntensity: number;
};

export type SpeedEffectState = {
  readonly intensity: number;
  readonly cameraFov: number;
  readonly vignetteOpacity: number;
  readonly streakOpacity: number;
  readonly roadPulse: number;
};

const baseCameraFov = 62;
const maxCameraFov = 72;

export function computeSpeedEffects(input: SpeedEffectInput): SpeedEffectState {
  const deltaSeconds = clamp(input.deltaSeconds, 0, 0.25);
  const speedT = clamp(Math.abs(input.speed) / 64, 0, 1);
  const driftT = clamp(input.drift * 2.2, 0, 0.24);
  const boostT = input.boostActive ? 0.16 : 0;
  const targetIntensity = clamp(speedT * 0.82 + driftT + boostT, 0, 1);
  const responsiveness = targetIntensity > input.previousIntensity ? 9 : 4.5;
  const smoothing = 1 - Math.exp(-responsiveness * deltaSeconds);
  const intensity = lerp(clamp(input.previousIntensity, 0, 1), targetIntensity, smoothing);

  return {
    intensity,
    cameraFov: Math.round(lerp(baseCameraFov, maxCameraFov, intensity) * 100) / 100,
    vignetteOpacity: Math.round(lerp(0, 0.38, intensity) * 1000) / 1000,
    streakOpacity: Math.round(lerp(0, 0.78, intensity) * 1000) / 1000,
    roadPulse: Math.round(Math.pow(intensity, 0.72) * 1000) / 1000,
  };
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/game/speed-effects.test.ts`

Expected: PASS.

- [ ] **Step 5: Run full unit tests**

Run: `npm test`

Expected: PASS.

---

### Task 2: Scene Integration, Art, Animation, And Browser Verification

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Modify: `tests/game.spec.ts`
- Modify: `README.md`
- Modify: `TODO.md`

- [ ] **Step 1: Write the failing browser test**

In `tests/game.spec.ts`, extend `DebugState` with:

```ts
  speedEffects: {
    intensity: number;
    cameraFov: number;
    vignetteOpacity: number;
    streakOpacity: number;
  };
  trackArt: {
    chevrons: number;
    crowdPanels: number;
    lightMasts: number;
    speedStreaks: number;
  };
```

After the canvas color assertion, add:

```ts
    const initialDebug = await readDebug(page);
    expect(initialDebug.trackArt.chevrons).toBeGreaterThanOrEqual(12);
    expect(initialDebug.trackArt.crowdPanels).toBeGreaterThanOrEqual(4);
    expect(initialDebug.trackArt.lightMasts).toBeGreaterThanOrEqual(8);
    expect(initialDebug.trackArt.speedStreaks).toBeGreaterThanOrEqual(10);
```

After the speed assertion during racing, add:

```ts
    await expect
      .poll(() => readDebug(page).then((debug) => debug.speedEffects.intensity), { message: 'speed effect intensity increases while driving' })
      .toBeGreaterThan(0.18);
    const speedEffectDebug = await readDebug(page);
    expect(speedEffectDebug.speedEffects.cameraFov).toBeGreaterThan(62);
    expect(speedEffectDebug.speedEffects.vignetteOpacity).toBeGreaterThan(0);
    expect(speedEffectDebug.speedEffects.streakOpacity).toBeGreaterThan(0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- --project=chromium --grep "desktop"`

Expected: FAIL because `speedEffects` and `trackArt` are not yet exposed on the debug state.

- [ ] **Step 3: Add vignette markup**

In `index.html`, place this directly before the canvas:

```html
      <div id="speed-vignette" aria-hidden="true"></div>
      <canvas id="game-canvas" aria-label="Three dimensional racing game"></canvas>
```

- [ ] **Step 4: Add CSS overlay**

In `src/styles.css`, add:

```css
#speed-vignette {
  position: fixed;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0;
  background:
    radial-gradient(circle at 50% 56%, transparent 34%, rgb(255 79 123 / 20%) 76%, rgb(255 230 107 / 22%) 100%),
    linear-gradient(90deg, rgb(54 241 255 / 0%) 0%, rgb(54 241 255 / 13%) 8%, transparent 20%, transparent 80%, rgb(255 230 107 / 13%) 92%, rgb(255 230 107 / 0%) 100%);
  mix-blend-mode: screen;
  transition: opacity 120ms linear;
}
```

- [ ] **Step 5: Wire speed effects and art into `src/main.ts`**

Import speed effects:

```ts
import { computeSpeedEffects, type SpeedEffectState } from './game/speed-effects';
```

Add `speedVignette` to `HudElements` and `hud`:

```ts
  speedVignette: HTMLElement;
```

```ts
  speedVignette: mustGet('speed-vignette'),
```

Extend `DebugState` with:

```ts
  speedEffects: Pick<SpeedEffectState, 'intensity' | 'cameraFov' | 'vignetteOpacity' | 'streakOpacity'>;
  trackArt: TrackArtDebug;
```

Add types:

```ts
type TrackArtDebug = {
  readonly chevrons: number;
  readonly crowdPanels: number;
  readonly lightMasts: number;
  readonly speedStreaks: number;
};

type AnimatedTrackArt = {
  readonly crowdPanels: readonly THREE.Mesh[];
  readonly lightMasts: readonly THREE.Mesh[];
  readonly speedStreaks: readonly THREE.Mesh[];
  readonly debug: TrackArtDebug;
};
```

Add state:

```ts
let speedEffects: SpeedEffectState = computeSpeedEffects({
  speed: 0,
  drift: 0,
  boostActive: false,
  deltaSeconds: 0,
  previousIntensity: 0,
});
const trackArt = addTracksideObjects(world, track);
```

Change `buildWorld()` so it does not call `addTracksideObjects` internally. Replace the existing `addTracksideObjects` function with one that returns `AnimatedTrackArt`, creates at least 14 chevron signs, 6 crowd panels, 10 light masts, and 12 speed streak meshes, and adds them to the passed group.

In the game loop, compute effects every frame:

```ts
  const input = readInput();
  const boostActive = session.phase === 'racing' && input.boost && input.throttle > 0 && vehicle.boostFuel > 0;
  speedEffects = computeSpeedEffects({
    speed: vehicle.speed,
    drift: vehicle.drift,
    boostActive,
    deltaSeconds,
    previousIntensity: speedEffects.intensity,
  });
```

Use `input` for `stepVehicle` instead of calling `readInput()` again.

After `updateCamera(deltaSeconds);`, call:

```ts
  updateSpeedEffects();
  animateTrackArt(deltaSeconds);
```

Implement:

```ts
function updateSpeedEffects(): void {
  camera.fov = speedEffects.cameraFov;
  camera.updateProjectionMatrix();
  hud.speedVignette.style.opacity = speedEffects.vignetteOpacity.toFixed(3);
  trackArt.speedStreaks.forEach((streak, index) => {
    const visible = speedEffects.intensity > 0.12;
    streak.visible = visible;
    streak.material.opacity = speedEffects.streakOpacity * (index % 3 === 0 ? 0.82 : 1);
  });
}

function animateTrackArt(deltaSeconds: number): void {
  const pulse = 1 + Math.sin(elapsedSeconds * 8) * 0.045 * speedEffects.roadPulse;
  trackArt.crowdPanels.forEach((panel, index) => {
    panel.scale.y = 1 + Math.sin(elapsedSeconds * 4.2 + index) * 0.08;
  });
  trackArt.lightMasts.forEach((mast, index) => {
    mast.scale.y = pulse + (index % 2) * 0.018;
  });
  trackArt.speedStreaks.forEach((streak, index) => {
    const offset = ((elapsedSeconds * (36 + index * 2)) % 42) - 21;
    streak.position.y = 0.35 + (index % 2) * 0.08;
    streak.position.z += offset * deltaSeconds * speedEffects.intensity;
  });
}
```

Adjust the final implementation if needed to keep streaks visually near the player car instead of drifting away, but keep the debug counts and speed-effect behavior intact.

- [ ] **Step 6: Update debug state**

In `createDebugState()`, add:

```ts
    speedEffects: {
      intensity: speedEffects.intensity,
      cameraFov: speedEffects.cameraFov,
      vignetteOpacity: speedEffects.vignetteOpacity,
      streakOpacity: speedEffects.streakOpacity,
    },
    trackArt: trackArt.debug,
```

- [ ] **Step 7: Update docs**

In `README.md`, update the first paragraph to mention speed-sense visuals:

```md
Three.js arcade racing prototype with deterministic vehicle physics, countdown starts, visible AI opponents, ordered checkpoints, lap timing, boost, drift input, finish results, speed-responsive camera effects, animated trackside art, and browser-level gameplay verification.
```

In `TODO.md`, move the track-art item from `Next Improvements` to `Completed`:

```md
- [x] Improve track art with roadside objects, signage, animated crowds, and stronger sense of speed.
```

- [ ] **Step 8: Run focused and full verification**

Run:

```bash
npm test
npm run build
npm run test:e2e
git diff --check
```

Expected: all commands PASS with no console errors in Playwright.

