# Race Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser-safe synthesized race audio with engine pitch, tire skid, boost, checkpoint, lap, start, and finish cues.

**Architecture:** Keep tuning and cue decisions pure in `src/game/audio-state.ts`, then integrate a small WebAudio wrapper in `src/game/audio-engine.ts`. `src/main.ts` owns when audio starts, updates the audio mix every frame, emits cues from race-state transitions, and exposes debug state for Playwright.

**Tech Stack:** TypeScript, Web Audio API, Three.js, Vitest, Playwright, Vite.

---

## File Structure

- Create: `src/game/audio-state.ts` for pure audio mix and cue calculations.
- Create: `src/game/audio-state.test.ts` for red/green unit coverage.
- Create: `src/game/audio-engine.ts` for WebAudio graph creation, mix updates, cue synthesis, and debug state.
- Modify: `src/main.ts` to start audio from the race-start user gesture, update audio every frame, play cues on checkpoint/lap/start/finish transitions, reset audio snapshots, and expose debug state.
- Modify: `tests/game.spec.ts` to assert audio is browser-initialized and responds to driving.
- Modify: `README.md` and `TODO.md` for shipped feature state.

---

### Task 1: Pure Audio State And Cue Logic

**Files:**
- Create: `src/game/audio-state.ts`
- Create: `src/game/audio-state.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/game/audio-state.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { collectRaceAudioCues, computeRaceAudioMix, createRaceAudioSnapshot } from './audio-state';

describe('computeRaceAudioMix', () => {
  test('keeps idle race audio quiet', () => {
    const mix = computeRaceAudioMix({
      phase: 'idle',
      speed: 0,
      drift: 0,
      boostActive: false,
    });

    expect(mix.engineFrequency).toBe(72);
    expect(mix.engineGain).toBe(0);
    expect(mix.skidGain).toBe(0);
    expect(mix.boostGain).toBe(0);
  });

  test('raises engine pitch and boost bed while racing fast', () => {
    const mix = computeRaceAudioMix({
      phase: 'racing',
      speed: 58,
      drift: 0.03,
      boostActive: true,
    });

    expect(mix.engineFrequency).toBeGreaterThan(300);
    expect(mix.engineGain).toBeGreaterThan(0.08);
    expect(mix.boostGain).toBeGreaterThan(0.08);
    expect(mix.masterGain).toBeGreaterThan(0.35);
  });

  test('adds skid noise from drift and clamps bad inputs', () => {
    const mix = computeRaceAudioMix({
      phase: 'racing',
      speed: Number.POSITIVE_INFINITY,
      drift: 9,
      boostActive: false,
    });

    expect(mix.engineFrequency).toBeLessThanOrEqual(520);
    expect(mix.skidGain).toBeGreaterThan(0.15);
    expect(mix.skidGain).toBeLessThanOrEqual(0.34);
    expect(mix.boostGain).toBe(0);
  });
});

describe('collectRaceAudioCues', () => {
  test('emits start, checkpoint, lap, and finish transition cues', () => {
    const idle = createRaceAudioSnapshot({ phase: 'idle', lap: 1, checkpoint: 'start' });
    const racing = createRaceAudioSnapshot({ phase: 'racing', lap: 1, checkpoint: 'start' });
    const harbor = createRaceAudioSnapshot({ phase: 'racing', lap: 1, checkpoint: 'harbor' });
    const nextLap = createRaceAudioSnapshot({ phase: 'racing', lap: 2, checkpoint: 'start' });
    const finished = createRaceAudioSnapshot({ phase: 'finished', lap: 3, checkpoint: 'finish' });

    expect(collectRaceAudioCues(idle, racing)).toEqual(['start']);
    expect(collectRaceAudioCues(racing, harbor)).toEqual(['checkpoint']);
    expect(collectRaceAudioCues(harbor, nextLap)).toEqual(['lap']);
    expect(collectRaceAudioCues(nextLap, finished)).toEqual(['finish']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/game/audio-state.test.ts`

Expected: FAIL because `src/game/audio-state.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/game/audio-state.ts`:

```ts
import type { RacePhase } from './race-session';

export type RaceAudioCue = 'start' | 'checkpoint' | 'lap' | 'finish';

export type RaceAudioMixInput = {
  readonly phase: RacePhase;
  readonly speed: number;
  readonly drift: number;
  readonly boostActive: boolean;
};

export type RaceAudioMix = {
  readonly masterGain: number;
  readonly engineFrequency: number;
  readonly engineGain: number;
  readonly skidGain: number;
  readonly boostGain: number;
};

export type RaceAudioSnapshot = {
  readonly phase: RacePhase;
  readonly lap: number;
  readonly checkpoint: string;
};

export function computeRaceAudioMix(input: RaceAudioMixInput): RaceAudioMix {
  const speedT = clamp(Math.abs(input.speed) / 72, 0, 1);
  const driftT = clamp(input.drift * 2.8, 0, 1);
  const active = input.phase === 'racing' || input.phase === 'finished';
  const masterGain = active ? 0.42 : 0.16;
  const engineGain = input.phase === 'racing' ? lerp(0.045, 0.16, speedT) : 0;
  const boostGain = input.phase === 'racing' && input.boostActive ? lerp(0.08, 0.16, speedT) : 0;

  return {
    masterGain: round(masterGain, 3),
    engineFrequency: round(clamp(lerp(72, 520, speedT) + (input.boostActive ? 34 : 0), 72, 520), 2),
    engineGain: round(engineGain, 3),
    skidGain: round(input.phase === 'racing' ? lerp(0, 0.34, driftT) : 0, 3),
    boostGain: round(boostGain, 3),
  };
}

export function createRaceAudioSnapshot(input: RaceAudioSnapshot): RaceAudioSnapshot {
  return {
    phase: input.phase,
    lap: Math.max(1, Math.trunc(input.lap)),
    checkpoint: input.checkpoint,
  };
}

export function collectRaceAudioCues(
  previous: RaceAudioSnapshot,
  current: RaceAudioSnapshot,
): readonly RaceAudioCue[] {
  if (previous.phase !== 'finished' && current.phase === 'finished') {
    return ['finish'];
  }

  if (previous.phase !== 'racing' && current.phase === 'racing') {
    return ['start'];
  }

  if (current.phase !== 'racing') {
    return [];
  }

  if (current.lap > previous.lap) {
    return ['lap'];
  }

  if (current.checkpoint !== previous.checkpoint) {
    return ['checkpoint'];
  }

  return [];
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return max;
  }
  return Math.min(max, Math.max(min, value));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/game/audio-state.test.ts`

Expected: PASS.

- [ ] **Step 5: Run full unit tests**

Run: `npm test`

Expected: PASS.

---

### Task 2: WebAudio Runtime Integration And Browser Verification

**Files:**
- Create: `src/game/audio-engine.ts`
- Modify: `src/main.ts`
- Modify: `tests/game.spec.ts`
- Modify: `README.md`
- Modify: `TODO.md`

- [ ] **Step 1: Write the failing browser assertions**

In `tests/game.spec.ts`, extend `DebugState` with:

```ts
  audio: {
    available: boolean;
    started: boolean;
    contextState: string;
    engineFrequency: number;
    engineGain: number;
    skidGain: number;
    boostGain: number;
    cueCount: number;
    lastCue: string | null;
  };
```

After `await page.locator('#start-button').click();`, add:

```ts
    await expect.poll(() => readDebug(page).then((debug) => debug.audio.started), {
      message: 'audio starts from the race-start user gesture',
    }).toBe(true);
```

After the existing `speedEffectDebug` assertions, add:

```ts
    const audioDebug = await readDebug(page);
    expect(audioDebug.audio.available).toBe(true);
    expect(audioDebug.audio.engineFrequency).toBeGreaterThan(90);
    expect(audioDebug.audio.engineGain).toBeGreaterThan(0);
    expect(audioDebug.audio.boostGain).toBeGreaterThan(0);
    expect(audioDebug.audio.cueCount).toBeGreaterThanOrEqual(1);
    expect(audioDebug.audio.lastCue).toBe('start');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- --project=chromium --grep "desktop"`

Expected: FAIL because `debug.audio` is not present yet.

- [ ] **Step 3: Create WebAudio engine**

Create `src/game/audio-engine.ts`:

```ts
import type { RaceAudioCue, RaceAudioMix } from './audio-state';

export type RaceAudioDebugState = {
  readonly available: boolean;
  readonly started: boolean;
  readonly contextState: string;
  readonly engineFrequency: number;
  readonly engineGain: number;
  readonly skidGain: number;
  readonly boostGain: number;
  readonly cueCount: number;
  readonly lastCue: RaceAudioCue | null;
};

type BrowserAudioContext = AudioContext & {
  createGain(): GainNode;
};

type AudioConstructor = new () => BrowserAudioContext;

type WindowWithWebkitAudio = Window & {
  readonly webkitAudioContext?: AudioConstructor;
};

export type RaceAudioEngine = {
  readonly start: () => Promise<void>;
  readonly update: (mix: RaceAudioMix) => void;
  readonly playCue: (cue: RaceAudioCue) => void;
  readonly getDebugState: () => RaceAudioDebugState;
};

export function createRaceAudioEngine(win: Window = window): RaceAudioEngine {
  const AudioCtor = win.AudioContext ?? (win as WindowWithWebkitAudio).webkitAudioContext;
  let context: BrowserAudioContext | null = null;
  let masterGain: GainNode | null = null;
  let engineOscillator: OscillatorNode | null = null;
  let engineGain: GainNode | null = null;
  let skidSource: AudioBufferSourceNode | null = null;
  let skidGain: GainNode | null = null;
  let boostOscillator: OscillatorNode | null = null;
  let boostGain: GainNode | null = null;
  let started = false;
  let cueCount = 0;
  let lastCue: RaceAudioCue | null = null;
  let debugMix: RaceAudioMix = {
    masterGain: 0,
    engineFrequency: 72,
    engineGain: 0,
    skidGain: 0,
    boostGain: 0,
  };

  async function start(): Promise<void> {
    if (!AudioCtor) {
      started = true;
      return;
    }

    if (!context) {
      context = new AudioCtor();
      const graph = createGraph(context);
      masterGain = graph.masterGain;
      engineOscillator = graph.engineOscillator;
      engineGain = graph.engineGain;
      skidSource = graph.skidSource;
      skidGain = graph.skidGain;
      boostOscillator = graph.boostOscillator;
      boostGain = graph.boostGain;
    }

    if (context.state !== 'running') {
      await context.resume();
    }
    started = true;
  }

  function update(mix: RaceAudioMix): void {
    debugMix = mix;
    if (!context || !masterGain || !engineOscillator || !engineGain || !skidGain || !boostGain) {
      return;
    }

    const now = context.currentTime;
    masterGain.gain.setTargetAtTime(mix.masterGain, now, 0.08);
    engineOscillator.frequency.setTargetAtTime(mix.engineFrequency, now, 0.055);
    engineGain.gain.setTargetAtTime(mix.engineGain, now, 0.045);
    skidGain.gain.setTargetAtTime(mix.skidGain, now, 0.035);
    boostGain.gain.setTargetAtTime(mix.boostGain, now, 0.05);
  }

  function playCue(cue: RaceAudioCue): void {
    cueCount += 1;
    lastCue = cue;
    if (!context || !masterGain) {
      return;
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const frequency = cue === 'start' ? 680 : cue === 'checkpoint' ? 920 : cue === 'lap' ? 540 : 260;
    oscillator.type = cue === 'finish' ? 'sawtooth' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(cue === 'finish' ? 110 : frequency * 1.42, now + 0.18);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(cue === 'finish' ? 0.18 : 0.12, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (cue === 'finish' ? 0.62 : 0.24));
    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(now);
    oscillator.stop(now + (cue === 'finish' ? 0.66 : 0.28));
  }

  function getDebugState(): RaceAudioDebugState {
    return {
      available: Boolean(AudioCtor),
      started,
      contextState: context?.state ?? 'unavailable',
      engineFrequency: debugMix.engineFrequency,
      engineGain: debugMix.engineGain,
      skidGain: debugMix.skidGain,
      boostGain: debugMix.boostGain,
      cueCount,
      lastCue,
    };
  }

  return { start, update, playCue, getDebugState };
}

function createGraph(context: BrowserAudioContext): {
  readonly masterGain: GainNode;
  readonly engineOscillator: OscillatorNode;
  readonly engineGain: GainNode;
  readonly skidSource: AudioBufferSourceNode;
  readonly skidGain: GainNode;
  readonly boostOscillator: OscillatorNode;
  readonly boostGain: GainNode;
} {
  const masterGain = context.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(context.destination);

  const engineOscillator = context.createOscillator();
  const engineGain = context.createGain();
  engineOscillator.type = 'sawtooth';
  engineOscillator.frequency.value = 72;
  engineGain.gain.value = 0;
  engineOscillator.connect(engineGain);
  engineGain.connect(masterGain);
  engineOscillator.start();

  const skidSource = context.createBufferSource();
  const skidGain = context.createGain();
  skidSource.buffer = createNoiseBuffer(context);
  skidSource.loop = true;
  skidGain.gain.value = 0;
  skidSource.connect(skidGain);
  skidGain.connect(masterGain);
  skidSource.start();

  const boostOscillator = context.createOscillator();
  const boostGain = context.createGain();
  boostOscillator.type = 'square';
  boostOscillator.frequency.value = 96;
  boostGain.gain.value = 0;
  boostOscillator.connect(boostGain);
  boostGain.connect(masterGain);
  boostOscillator.start();

  return { masterGain, engineOscillator, engineGain, skidSource, skidGain, boostOscillator, boostGain };
}

function createNoiseBuffer(context: BrowserAudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i += 1) {
    channel[i] = Math.sin(i * 91.7) * 0.6 + Math.sin(i * 13.13) * 0.28;
  }
  return buffer;
}
```

- [ ] **Step 4: Integrate audio into `src/main.ts`**

Add imports:

```ts
import { createRaceAudioEngine, type RaceAudioDebugState } from './game/audio-engine';
import { collectRaceAudioCues, computeRaceAudioMix, createRaceAudioSnapshot, type RaceAudioSnapshot } from './game/audio-state';
```

Extend `DebugState`:

```ts
  audio: RaceAudioDebugState;
```

Add state after `speedEffects`:

```ts
const audioEngine = createRaceAudioEngine();
let lastAudioSnapshot: RaceAudioSnapshot = createCurrentAudioSnapshot();
```

In `setupStartButton()`, start audio inside the click handler:

```ts
      void audioEngine.start();
```

In the game loop, after race/session/progress updates and before debug state creation, call:

```ts
  updateRaceAudio(boostActive);
```

Add:

```ts
function updateRaceAudio(boostActive: boolean): void {
  const audioMix = computeRaceAudioMix({
    phase: session.phase,
    speed: vehicle.speed,
    drift: vehicle.drift,
    boostActive,
  });
  audioEngine.update(audioMix);

  const currentSnapshot = createCurrentAudioSnapshot();
  for (const cue of collectRaceAudioCues(lastAudioSnapshot, currentSnapshot)) {
    audioEngine.playCue(cue);
  }
  lastAudioSnapshot = currentSnapshot;
}

function createCurrentAudioSnapshot(): RaceAudioSnapshot {
  const next = track.checkpoints[progress.nextCheckpointIndex];
  return createRaceAudioSnapshot({
    phase: session.phase,
    lap: progress.currentLap,
    checkpoint: next?.id ?? 'finish',
  });
}
```

In `resetRace()`, after resetting `speedEffects`, add:

```ts
  lastAudioSnapshot = createCurrentAudioSnapshot();
  audioEngine.update(computeRaceAudioMix({
    phase: session.phase,
    speed: 0,
    drift: 0,
    boostActive: false,
  }));
```

In `createDebugState()`, add:

```ts
    audio: audioEngine.getDebugState(),
```

- [ ] **Step 5: Update docs**

In `README.md`, update the first paragraph to include synthesized race audio:

```md
Three.js arcade racing prototype with deterministic vehicle physics, countdown starts, visible AI opponents, ordered checkpoints, lap timing, boost, drift input, finish results, speed-responsive camera effects, synthesized race audio, animated trackside art, and browser-level gameplay verification.
```

In `TODO.md`, move the audio item from `Next Improvements` to `Completed`:

```md
- [x] Add audio with engine pitch, tire skid, boost, checkpoint, and lap cues.
```

- [ ] **Step 6: Run focused and full verification**

Run:

```bash
npm run test:e2e -- --project=chromium --grep "desktop"
npm test
npm run build
npm run test:e2e
git diff --check
```

Expected: all commands PASS with no browser console/page errors.
