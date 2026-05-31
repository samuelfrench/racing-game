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
  trackArt: {
    chevrons: number;
    crowdPanels: number;
    lightMasts: number;
    speedStreaks: number;
  };
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
