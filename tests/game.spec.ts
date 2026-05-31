import { expect, test, type Page } from '@playwright/test';

type DebugState = {
  running: boolean;
  phase: 'idle' | 'countdown' | 'racing' | 'finished';
  countdownSeconds: number;
  frame: number;
  speed: number;
  lap: number;
  checkpoint: string;
  carX: number;
  carZ: number;
  speedEffects: {
    intensity: number;
    cameraFov: number;
    vignetteOpacity: number;
    streakOpacity: number;
  };
  audio: {
    available: boolean;
    started: boolean;
    contextState: string;
    masterGain: number;
    engineFrequency: number;
    engineGain: number;
    skidGain: number;
    boostGain: number;
    cueCount: number;
    lastCue: string | null;
  };
  trackArt: {
    chevrons: number;
    crowdPanels: number;
    lightMasts: number;
    speedStreaks: number;
  };
  settings: {
    graphicsQuality: 'high' | 'balanced' | 'low';
    cameraMode: 'chase' | 'far' | 'hood';
    masterVolume: number;
    muted: boolean;
    reducedMotion: boolean;
    highContrast: boolean;
    showControlHints: boolean;
  };
  graphics: {
    quality: 'high' | 'balanced' | 'low';
    pixelRatioCap: number;
    speedStreaksVisible: number;
    rendererPixelRatio: number;
  };
  camera: {
    mode: 'chase' | 'far' | 'hood';
    chaseDistance: number;
    chaseHeight: number;
    lookAhead: number;
    targetHeight: number;
    fov: number;
  };
  controlHintsVisible: boolean;
  opponents: readonly {
    id: string;
    x: number;
    z: number;
    lap: number;
    finishedAtSeconds: number | null;
  }[];
  results: readonly {
    id: string;
    name: string;
    finishSeconds: number;
  }[];
};

const viewports = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`renders and drives on ${viewport.name}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await expect(page.locator('#game-canvas')).toBeVisible();
    await expect(page.locator('#race-status')).toBeVisible();
    await expectRaceStatusTextToFit(page, ['READY', '3', 'GO', 'FINISH']);
    await expect(page.locator('#start-button')).toBeVisible();
    await expect.poll(() => hasDebugState(page), { message: 'debug state is initialized' }).toBe(true);
    await expect.poll(() => readDebug(page).then((debug) => debug.frame)).toBeGreaterThan(3);

    await expect
      .poll(() => countCanvasSampleColors(page), { message: 'canvas has varied rendered pixels' })
      .toBeGreaterThan(4);
    const initialDebug = await readDebug(page);
    expect(initialDebug.trackArt.chevrons).toBeGreaterThanOrEqual(14);
    expect(initialDebug.trackArt.crowdPanels).toBeGreaterThanOrEqual(6);
    expect(initialDebug.trackArt.lightMasts).toBeGreaterThanOrEqual(10);
    expect(initialDebug.trackArt.speedStreaks).toBeGreaterThanOrEqual(12);
    const before = await readDebug(page);

    await page.locator('#start-button').click();
    await expect.poll(() => readDebug(page).then((debug) => (debug.audio.available ? debug.audio.contextState : 'unavailable')), {
      message: 'audio context reaches running state from the race-start user gesture',
    }).toBe('running');
    await expect.poll(() => readDebug(page).then((debug) => debug.audio.started), {
      message: 'audio starts from the race-start user gesture',
    }).toBe(true);
    await expect.poll(() => readDebug(page).then((debug) => debug.phase)).toBe('countdown');

    const countdownStart = await readDebug(page);
    await page.keyboard.down('ArrowUp');
    await page.keyboard.down('Shift');
    await page.waitForTimeout(700);
    const duringCountdown = await readDebug(page);
    expect(Math.hypot(duringCountdown.carX - countdownStart.carX, duringCountdown.carZ - countdownStart.carZ)).toBeLessThan(0.75);
    expect(duringCountdown.opponents).toHaveLength(3);

    await expect.poll(() => readDebug(page).then((debug) => debug.phase), { timeout: 5_000 }).toBe('racing');
    const racingStart = await readDebug(page);
    await expect
      .poll(async () => {
        const current = await readDebug(page);
        return Math.hypot(current.carX - racingStart.carX, current.carZ - racingStart.carZ);
      })
      .toBeGreaterThan(8);
    await expect.poll(() => readDebug(page).then((debug) => debug.speed)).toBeGreaterThan(10);
    await expect
      .poll(() => readDebug(page).then((debug) => debug.speedEffects.intensity), {
        message: 'speed effect intensity increases while driving',
      })
      .toBeGreaterThan(0.18);
    const speedEffectDebug = await readDebug(page);
    expect(speedEffectDebug.speedEffects.cameraFov).toBeGreaterThan(62);
    expect(speedEffectDebug.speedEffects.vignetteOpacity).toBeGreaterThan(0);
    expect(speedEffectDebug.speedEffects.streakOpacity).toBeGreaterThan(0);
    const audioDebug = await readDebug(page);
    expect(audioDebug.audio.available).toBe(true);
    expect(audioDebug.audio.engineFrequency).toBeGreaterThan(90);
    expect(audioDebug.audio.engineGain).toBeGreaterThan(0);
    expect(audioDebug.audio.boostGain).toBeGreaterThan(0);
    expect(audioDebug.audio.cueCount).toBeGreaterThanOrEqual(1);
    expect(audioDebug.audio.lastCue).toBe('start');

    await page.keyboard.down('Space');
    await page.keyboard.down('ArrowLeft');
    await expect
      .poll(() => readDebug(page).then((debug) => debug.audio.skidGain), {
        message: 'tire skid audio responds to handbrake drift',
      })
      .toBeGreaterThan(0);
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('Space');
    await page.keyboard.up('Shift');
    await page.keyboard.up('ArrowUp');

    const after = await readDebug(page);
    expect(after.running).toBe(true);
    expect(after.phase).toBe('racing');
    expect(after.speed).toBeGreaterThan(10);
    expect(Math.hypot(after.carX - before.carX, after.carZ - before.carZ)).toBeGreaterThan(8);
    expect(after.lap).toBe(1);
    expect(after.checkpoint).not.toBe('');
    expect(consoleErrors).toEqual([]);

    await page.screenshot({ path: `test-results/racing-game-${viewport.name}.png`, fullPage: true });
  });
}

test('settings persist and affect race runtime debug state on desktop', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect.poll(() => hasDebugState(page), { message: 'debug state is initialized' }).toBe(true);

  await page.locator('#settings-button').click();
  await expect(page.locator('#settings-panel')).toBeVisible();
  await page.locator('#graphics-quality').selectOption('low');
  await page.locator('#camera-mode').selectOption('hood');
  await page.locator('#master-volume').fill('34');
  await page.locator('#audio-muted').check();
  await page.locator('#reduced-motion').check();
  await page.locator('#high-contrast').check();
  await page.locator('#show-control-hints').uncheck();

  await expect.poll(() => readDebug(page).then((debug) => debug.settings.graphicsQuality)).toBe('low');
  await expect.poll(() => readDebug(page).then((debug) => debug.camera.mode)).toBe('hood');
  await expect.poll(() => readDebug(page).then((debug) => debug.settings.showControlHints)).toBe(false);
  let debug = await readDebug(page);
  expect(debug.settings).toMatchObject({
    graphicsQuality: 'low',
    cameraMode: 'hood',
    masterVolume: 0.34,
    muted: true,
    reducedMotion: true,
    highContrast: true,
    showControlHints: false,
  });
  expect(debug.graphics).toMatchObject({
    quality: 'low',
    pixelRatioCap: 1,
    speedStreaksVisible: 4,
  });
  expect(debug.trackArt.speedStreaks).toBe(12);
  expect(debug.camera).toMatchObject({
    mode: 'hood',
    chaseDistance: -3.5,
    chaseHeight: 4.2,
    lookAhead: 72,
    targetHeight: 3.1,
  });
  expect(debug.controlHintsVisible).toBe(false);
  await expect(page.locator('#control-hints')).toBeHidden();
  await expect(page.locator('body')).toHaveClass(/settings-high-contrast/);

  await page.keyboard.press('Escape');
  await expect(page.locator('#settings-panel')).toBeHidden();
  await page.locator('#start-button').click();
  await expect.poll(() => readDebug(page).then((state) => state.phase)).toBe('countdown');
  await expect.poll(() => readDebug(page).then((state) => (state.audio.available ? state.audio.contextState : 'unavailable'))).toBe('running');

  await expect.poll(() => readDebug(page).then((state) => state.phase), { timeout: 5_000 }).toBe('racing');
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('Shift');
  await page.waitForTimeout(900);
  debug = await readDebug(page);
  expect(debug.speed).toBeGreaterThan(10);
  expect(debug.speedEffects.streakOpacity).toBe(0);
  expect(debug.speedEffects.cameraFov).toBeLessThanOrEqual(66);
  expect(debug.audio.masterGain).toBe(0);
  expect(debug.graphics.rendererPixelRatio).toBeLessThanOrEqual(debug.graphics.pixelRatioCap);
  await page.keyboard.up('Shift');
  await page.keyboard.up('ArrowUp');

  await page.reload();
  await expect.poll(() => hasDebugState(page), { message: 'debug state is initialized after reload' }).toBe(true);
  debug = await readDebug(page);
  expect(debug.settings).toMatchObject({
    graphicsQuality: 'low',
    cameraMode: 'hood',
    masterVolume: 0.34,
    muted: true,
    reducedMotion: true,
    highContrast: true,
    showControlHints: false,
  });
  await expect(page.locator('body')).toHaveClass(/settings-high-contrast/);
  await expect(page.locator('#control-hints')).toBeHidden();

  await page.locator('#settings-button').click();
  await page.locator('#settings-reset').click();
  await expect.poll(() => readDebug(page).then((state) => state.settings.graphicsQuality)).toBe('high');
  debug = await readDebug(page);
  expect(debug.settings).toMatchObject({
    graphicsQuality: 'high',
    cameraMode: 'chase',
    masterVolume: 0.82,
    muted: false,
    reducedMotion: false,
    highContrast: false,
    showControlHints: true,
  });
  expect(debug.graphics).toMatchObject({
    quality: 'high',
    pixelRatioCap: 2,
    speedStreaksVisible: 12,
  });
  expect(debug.camera).toMatchObject({
    mode: 'chase',
    chaseDistance: 58,
    chaseHeight: 28,
    lookAhead: 30,
    targetHeight: 3.6,
  });
  expect(debug.controlHintsVisible).toBe(true);
  await expect(page.locator('body')).not.toHaveClass(/settings-high-contrast/);
  await expect(page.locator('#control-hints')).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('settings use defaults and stay interactive when browser storage is blocked', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });

  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('localStorage is blocked', 'SecurityError');
      },
    });
  });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await expect.poll(() => hasDebugState(page), { message: 'debug state initializes without localStorage' }).toBe(true);

  let debug = await readDebug(page);
  expect(debug.settings).toMatchObject({
    graphicsQuality: 'high',
    cameraMode: 'chase',
    masterVolume: 0.82,
    muted: false,
    reducedMotion: false,
    highContrast: false,
    showControlHints: true,
  });

  await page.locator('#settings-button').click();
  await expect(page.locator('#settings-panel')).toBeVisible();
  await page.locator('#graphics-quality').selectOption('low');
  await page.locator('#audio-muted').check();
  await expect.poll(() => readDebug(page).then((state) => state.settings.graphicsQuality)).toBe('low');
  await expect.poll(() => readDebug(page).then((state) => state.settings.muted)).toBe(true);

  await page.locator('#settings-reset').click();
  await expect.poll(() => readDebug(page).then((state) => state.settings.graphicsQuality)).toBe('high');
  debug = await readDebug(page);
  expect(debug.settings).toMatchObject({
    graphicsQuality: 'high',
    cameraMode: 'chase',
    masterVolume: 0.82,
    muted: false,
    reducedMotion: false,
    highContrast: false,
    showControlHints: true,
  });
  expect(consoleErrors).toEqual([]);
});

async function readDebug(page: Page): Promise<DebugState> {
  return page.evaluate(() => {
    const debug = window.__racingGameDebug;
    if (!debug) {
      throw new Error('Missing racing game debug state');
    }
    return debug;
  });
}

async function hasDebugState(page: Page): Promise<boolean> {
  return page.evaluate(() => Boolean(window.__racingGameDebug));
}

async function expectRaceStatusTextToFit(page: Page, labels: readonly string[]): Promise<void> {
  for (const label of labels) {
    const measurement = await page.evaluate((nextLabel) => {
      const status = document.querySelector<HTMLElement>('#race-status');
      const card = document.querySelector<HTMLElement>('.race-state-card');
      if (!status || !card) {
        throw new Error('Missing race status layout elements');
      }

      status.textContent = nextLabel;
      const statusRect = status.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();

      return {
        label: nextLabel,
        fits:
          statusRect.left >= cardRect.left &&
          statusRect.right <= cardRect.right &&
          statusRect.width <= cardRect.width,
        statusWidth: statusRect.width,
        cardWidth: cardRect.width,
      };
    }, label);

    expect(measurement, `${measurement.label} status should fit in race-state card`).toMatchObject({
      fits: true,
    });
  }
}

async function countCanvasSampleColors(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
    if (!canvas) {
      throw new Error('Missing game canvas');
    }
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) {
      throw new Error('Missing WebGL context');
    }

    const colors = new Set<string>();
    const pixel = new Uint8Array(4);
    const xs = [0.2, 0.35, 0.5, 0.65, 0.8];
    const ys = [0.25, 0.4, 0.55, 0.7];

    for (const x of xs) {
      for (const y of ys) {
        gl.readPixels(
          Math.floor(canvas.width * x),
          Math.floor(canvas.height * y),
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixel,
        );
        colors.add(`${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3]}`);
      }
    }

    return colors.size;
  });
}
