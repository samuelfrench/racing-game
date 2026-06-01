import { expect, test, type Page } from '@playwright/test';

type DebugState = {
  running: boolean;
  phase: 'idle' | 'countdown' | 'racing' | 'finished';
  countdownSeconds: number;
  frame: number;
  speed: number;
  trackFeedback: {
    distanceFromCenter: number;
    offTrack: boolean;
    wrongWay: boolean;
    recovering: boolean;
    message: 'OFF TRACK' | 'WRONG WAY' | 'RECOVERING' | null;
  };
  lap: number;
  checkpoint: string;
  carX: number;
  carZ: number;
  carHeading: number;
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
    touchControlsMode: 'auto' | 'on' | 'off';
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
  touchControls: {
    visible: boolean;
    mode: 'auto' | 'on' | 'off';
    activeActions: readonly string[];
    input: {
      throttle: number;
      brake: number;
      steer: number;
      handbrake: boolean;
      boost: boolean;
    };
  };
  racePosition: {
    position: number;
    total: number;
    participants: readonly {
      id: string;
      name: string;
      distance: number;
      finishedAtSeconds: number | null;
    }[];
  };
  raceAwareness: {
    positionLabel: string;
    gapLabel: string;
    gapMeters: number | null;
    tone: 'leader' | 'chasing' | 'midfield' | 'last';
  };
  timing: {
    currentLapSeconds: number | null;
    currentLapLabel: string;
    bestLapLabel: string;
    currentSectorNumber: number;
    currentSectorLabel: string;
    currentSectorLabelText: string;
    currentSectorSeconds: number | null;
    currentSectorTimeLabel: string;
    lastSectorLabel: string;
    lastSectorTimeLabel: string;
    sectorDeltaLabel: string;
    sectorDeltaTone: 'neutral' | 'best' | 'faster' | 'slower' | 'matched';
  };
  splitSummary: {
    visible: boolean;
    lapRows: readonly {
      lapNumber: number;
      lapLabel: string;
      timeLabel: string;
      isBest: boolean;
    }[];
    sectorRows: readonly {
      lapNumber: number;
      lapLabel: string;
      sectors: readonly {
        sectorNumber: number;
        sectorLabel: string;
        timeLabel: string;
        tone: 'best' | 'normal';
      }[];
    }[];
  };
  ghostReplay: {
    status: {
      mode: 'empty' | 'best' | 'new-best';
      label: string;
      currentSampleCount: number;
      bestSampleCount: number;
      bestLapSeconds: number | null;
    };
    visible: boolean;
    currentSampleCount: number;
    bestSampleCount: number;
    bestLapSeconds: number | null;
    x: number | null;
    z: number | null;
    heading: number | null;
  };
  minimap: {
    canvasWidth: number;
    canvasHeight: number;
    progressRatio: number;
    markers: readonly {
      id: string;
      x: number;
      z: number;
      color: string;
      kind: 'player' | 'opponent';
      rank: number;
      heading: number;
      label: string;
    }[];
  };
  opponents: readonly {
    id: string;
    x: number;
    z: number;
    lap: number;
    speed: number;
    targetSpeed: number;
    finishedAtSeconds: number | null;
  }[];
  results: readonly {
    id: string;
    name: string;
    finishSeconds: number;
  }[];
};

declare global {
  interface Window {
    __racingGameTestControls?: {
      finishRace: () => void;
    };
  }
}

const viewports = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'tablet', width: 768, height: 720 },
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
    await expect(page.locator('#race-position')).toHaveText(/^P[1-4]\/4$/);
    await expect(page.locator('#race-gap')).toHaveText(/^(?:LEAD|GAP) \d+m$|^FINISH$/);
    await expect(page.locator('#lap-time')).toBeVisible();
    await expect(page.locator('#sector-label')).toHaveText(/^S[1-5]$/);
    await expect(page.locator('#sector-time')).toBeVisible();
    await expect(page.locator('#sector-delta')).toBeVisible();
    await expect(page.locator('#minimap-canvas')).toBeVisible();
    await expectElementToBeWithinViewport(page, '#minimap-canvas');
    await expectElementToBeWithinViewport(page, '#lap-time');
    await expectElementToBeWithinViewport(page, '#sector-label');
    await expectElementToBeWithinViewport(page, '#sector-time');
    await expectElementToBeWithinViewport(page, '#sector-delta');
    await expectElementsNotToOverlap(page, ['#lap-time', '#sector-label', '#sector-time', '#sector-delta'], '#minimap-canvas');
    await expectRaceStatusTextToFit(page, ['READY', '3', 'GO', 'FINISH', 'OFF TRACK', 'WRONG WAY', 'RECOVERING']);
    await expect(page.locator('#start-button')).toBeVisible();
    await expect.poll(() => hasDebugState(page), { message: 'debug state is initialized' }).toBe(true);
    await expect.poll(() => readDebug(page).then((debug) => debug.frame)).toBeGreaterThan(3);
    await expect.poll(() => readDebug(page).then((debug) => debug.racePosition.total)).toBe(4);
    await expect.poll(() => readDebug(page).then((debug) => debug.raceAwareness.positionLabel)).toMatch(/^P[1-4]\/4$/);
    await expect
      .poll(() => readDebug(page).then((debug) => debug.raceAwareness.gapLabel))
      .toMatch(/^(?:LEAD|GAP) \d+m$|^FINISH$/);
    await expect
      .poll(async () => {
        const debug = await readDebug(page);
        const hudGap = (await page.locator('#race-gap').textContent())?.trim();
        return debug.raceAwareness.gapLabel === hudGap;
      })
      .toBe(true);
    await expect.poll(() => readDebug(page).then((debug) => debug.minimap.progressRatio)).toBeGreaterThanOrEqual(0);
    await expect.poll(() => readDebug(page).then((debug) => debug.timing.currentSectorLabel)).toMatch(/^S[1-5]$/);
    await expect
      .poll(() => readDebug(page).then((debug) => debug.racePosition.position), {
        message: 'player race position is in the four-car field',
      })
      .toBeGreaterThanOrEqual(1);
    await expect
      .poll(() => readDebug(page).then((debug) => debug.racePosition.position), {
        message: 'player race position is in the four-car field',
      })
      .toBeLessThanOrEqual(4);
    await expect.poll(() => readDebug(page).then((debug) => debug.racePosition.participants.length)).toBe(4);
    await expect.poll(() => readDebug(page).then((debug) => debug.minimap.markers.length)).toBe(4);
    await expect.poll(() => readTimingHudMatch(page)).toBe(true);

    await expect
      .poll(() => countCanvasSampleColors(page), { message: 'canvas has varied rendered pixels' })
      .toBeGreaterThan(4);
    await expect
      .poll(() => countMinimapSampleColors(page), { message: 'minimap has nonblank rendered pixels' })
      .toBeGreaterThan(1);
    const initialDebug = await readDebug(page);
    expect(initialDebug.trackArt.chevrons).toBeGreaterThanOrEqual(14);
    expect(initialDebug.trackArt.crowdPanels).toBeGreaterThanOrEqual(6);
    expect(initialDebug.trackArt.lightMasts).toBeGreaterThanOrEqual(10);
    expect(initialDebug.trackArt.speedStreaks).toBeGreaterThanOrEqual(12);
    expect(initialDebug.racePosition.participants).toHaveLength(4);
    expect(initialDebug.minimap).toMatchObject({
      canvasWidth: 168,
      canvasHeight: 104,
    });
    expect(initialDebug.minimap.markers.every((marker) => marker.rank >= 1)).toBe(true);
    expect(initialDebug.minimap.markers.every((marker) => Number.isFinite(marker.heading))).toBe(true);
    expect(initialDebug.minimap.markers.map((marker) => marker.label)).toContain('P1');
    const before = await readDebug(page);

    if (viewport.name === 'mobile') {
      await expectElementsNotToOverlap(page, ['#minimap-canvas'], '#settings-button');
      await expectElementsNotToOverlap(page, touchButtonSelectors, '#minimap-canvas');
    }

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
      .poll(() => readDebug(page).then((debug) => debug.timing.currentLapSeconds ?? 0), {
        message: 'current lap timer advances after launch',
      })
      .toBeGreaterThan(0);
    await expect
      .poll(() => readDebug(page).then((debug) => debug.timing.currentSectorSeconds ?? 0), {
        message: 'current sector timer advances after launch',
      })
      .toBeGreaterThan(0);
    await expect.poll(() => readTimingHudMatch(page)).toBe(true);
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
    expect(after.racePosition.total).toBe(4);
    expect(after.racePosition.position).toBeGreaterThanOrEqual(1);
    expect(after.racePosition.position).toBeLessThanOrEqual(4);
    expect(after.racePosition.participants).toHaveLength(4);
    expect(after.minimap.markers).toHaveLength(4);
    expect(consoleErrors).toEqual([]);

    await page.screenshot({ path: `test-results/racing-game-${viewport.name}.png`, fullPage: true });
  });
}

test('timing HUD stays in bounds at tablet breakpoint edge widths', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  for (const viewportWidth of [721, 730]) {
    await page.setViewportSize({ width: viewportWidth, height: 720 });
    await page.goto('/');
    await expect.poll(() => hasDebugState(page), { message: `debug state is initialized at ${viewportWidth}px` }).toBe(true);

    await expectElementToBeWithinViewport(page, '#minimap-canvas');
    await expectElementToBeWithinViewport(page, '#lap-time');
    await expectElementToBeWithinViewport(page, '#sector-label');
    await expectElementToBeWithinViewport(page, '#sector-time');
    await expectElementToBeWithinViewport(page, '#sector-delta');
    await expectElementsNotToOverlap(page, ['#lap-time', '#sector-label', '#sector-time', '#sector-delta'], '#minimap-canvas');
  }

  expect(consoleErrors).toEqual([]);
});

test('post-race lap and sector split summary shows results, debug match, reset, and layout', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);
  const summaryViewports = [
    { name: 'desktop', width: 1280, height: 720 },
    { name: 'tablet', width: 768, height: 720 },
    { name: 'narrow tablet', width: 721, height: 720 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'narrow mobile', width: 320, height: 844 },
    { name: 'short mobile', width: 320, height: 568 },
  ] as const;

  for (const viewport of summaryViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await expect.poll(() => hasDebugState(page), { message: `debug state is initialized on ${viewport.name}` }).toBe(true);
    await expect(page.locator('#split-summary'), `split summary exists on ${viewport.name}`).toHaveCount(1);
    await expect(page.locator('#lap-splits'), `lap split container exists on ${viewport.name}`).toHaveCount(1);
    await expect(page.locator('#sector-splits'), `sector split container exists on ${viewport.name}`).toHaveCount(1);
    await expect(page.locator('#split-summary')).toBeHidden();
    await expect(page.locator('#lap-splits')).toBeEmpty();
    await expect(page.locator('#sector-splits')).toBeEmpty();
    await expect.poll(() => readDebug(page).then((debug) => debug.splitSummary.visible)).toBe(false);
    await expect
      .poll(() => page.evaluate(() => typeof window.__racingGameTestControls?.finishRace), {
        message: 'dev-only finishRace test control is installed',
      })
      .toBe('function');

    await page.evaluate(() => window.__racingGameTestControls?.finishRace());
    await expect.poll(() => readDebug(page).then((debug) => debug.phase)).toBe('finished');
    await expect(page.locator('#results-panel')).toBeVisible();
    await expect(page.locator('#results-list li')).toHaveCount(4);
    await expect(page.locator('#split-summary')).toBeVisible();
    await expect(page.locator('#lap-splits')).toContainText('L1');
    await expect(page.locator('#lap-splits')).toContainText('L2');
    await expect(page.locator('#sector-splits')).toContainText('S1');
    await expect(page.locator('#sector-splits')).toContainText('S2');
    await expect.poll(() => readDebug(page).then((debug) => debug.splitSummary.visible)).toBe(true);
    await expect.poll(() => readSplitSummaryHudMatch(page)).toBe(true);
    await expectElementToBeWithinViewport(page, '#results-panel');
    await expectElementToBeWithinViewport(page, '#split-summary');
    await expectElementsNotToOverlap(page, ['#results-panel'], '#hud');

    if (viewport.width <= 420) {
      await expect(page.locator('#touch-controls')).toBeHidden();
      await expectElementsNotToOverlap(page, touchButtonSelectors, '#results-panel');
      await expectElementsNotToOverlap(page, touchButtonSelectors, '#split-summary');
    }

    await page.keyboard.press('r');
    await expect(page.locator('#results-panel')).toBeHidden();
    await expect(page.locator('#split-summary')).toBeHidden();
    await expect(page.locator('#lap-splits')).toBeEmpty();
    await expect(page.locator('#sector-splits')).toBeEmpty();
    await expect.poll(() => readDebug(page).then((debug) => debug.splitSummary.visible)).toBe(false);
    await expect.poll(() => readDebug(page).then((debug) => debug.splitSummary.lapRows.length)).toBe(0);
    await expect.poll(() => readDebug(page).then((debug) => debug.splitSummary.sectorRows.length)).toBe(0);
    if (viewport.width <= 420) {
      await expect(page.locator('#touch-controls')).toBeVisible();
    }
  }

  expect(consoleErrors).toEqual([]);
});

test('ghost replay records a best lap, renders the next race ghost, and resets', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect.poll(() => hasDebugState(page), { message: 'debug state is initialized' }).toBe(true);

  await expect(page.locator('#ghost-status')).toHaveText('No ghost');
  let debug = await readDebug(page);
  expect(debug.ghostReplay).toMatchObject({
    status: {
      mode: 'empty',
      label: 'No ghost',
      currentSampleCount: 0,
      bestSampleCount: 0,
      bestLapSeconds: null,
    },
    visible: false,
    currentSampleCount: 0,
    bestSampleCount: 0,
    bestLapSeconds: null,
    x: null,
    z: null,
    heading: null,
  });

  await expect
    .poll(() => page.evaluate(() => typeof window.__racingGameTestControls?.finishRace), {
      message: 'deterministic finish control is installed',
    })
    .toBe('function');
  await page.evaluate(() => window.__racingGameTestControls?.finishRace());
  await expect.poll(() => readDebug(page).then((state) => state.phase)).toBe('finished');
  await expect.poll(() => readDebug(page).then((state) => state.ghostReplay.status.label)).toBe('New best ghost');
  await expect(page.locator('#ghost-status')).toHaveText('New best ghost');
  debug = await readDebug(page);
  expect(debug.ghostReplay.status.mode).toBe('new-best');
  expect(debug.ghostReplay.currentSampleCount).toBe(0);
  expect(debug.ghostReplay.bestSampleCount).toBeGreaterThan(2);
  expect(debug.ghostReplay.bestLapSeconds).toBeGreaterThan(0);
  expect(debug.ghostReplay.visible).toBe(false);
  const storedBestSampleCount = debug.ghostReplay.bestSampleCount;
  const storedBestLapSeconds = debug.ghostReplay.bestLapSeconds;

  await page.keyboard.press('r');
  await expect.poll(() => readDebug(page).then((state) => state.phase)).toBe('idle');
  await expect(page.locator('#ghost-status')).toHaveText('Best ghost');
  debug = await readDebug(page);
  expect(debug.ghostReplay.visible).toBe(false);
  expect(debug.ghostReplay.status.mode).toBe('best');
  expect(debug.ghostReplay.bestSampleCount).toBe(storedBestSampleCount);
  expect(debug.ghostReplay.bestLapSeconds).toBe(storedBestLapSeconds);

  await page.locator('#start-button').click();
  await expect.poll(() => readDebug(page).then((state) => state.phase)).toBe('racing');
  await expect.poll(() => readDebug(page).then((state) => state.ghostReplay.visible)).toBe(true);
  await expect.poll(() => readDebug(page).then((state) => state.ghostReplay.status.label)).toBe('Best ghost');
  await expect(page.locator('#ghost-status')).toHaveText('Best ghost');
  debug = await readDebug(page);
  expect(debug.ghostReplay.status.mode).toBe('best');
  expect(debug.ghostReplay.status.label).toBe(await page.locator('#ghost-status').textContent());
  expect(debug.ghostReplay.bestSampleCount).toBe(storedBestSampleCount);
  expect(debug.ghostReplay.bestLapSeconds).toBe(storedBestLapSeconds);
  expect(debug.ghostReplay.currentSampleCount).toBeGreaterThan(0);
  expect(debug.ghostReplay.x).not.toBeNull();
  expect(debug.ghostReplay.z).not.toBeNull();
  expect(debug.ghostReplay.heading).not.toBeNull();
  expect(Number.isFinite(debug.ghostReplay.x)).toBe(true);
  expect(Number.isFinite(debug.ghostReplay.z)).toBe(true);
  expect(Number.isFinite(debug.ghostReplay.heading)).toBe(true);

  await page.reload();
  await expect.poll(() => hasDebugState(page), { message: 'debug state is initialized after reload' }).toBe(true);
  await expect(page.locator('#ghost-status')).toHaveText('No ghost');
  debug = await readDebug(page);
  expect(debug.ghostReplay).toMatchObject({
    status: {
      mode: 'empty',
      label: 'No ghost',
      currentSampleCount: 0,
      bestSampleCount: 0,
      bestLapSeconds: null,
    },
    visible: false,
    currentSampleCount: 0,
    bestSampleCount: 0,
    bestLapSeconds: null,
    x: null,
    z: null,
    heading: null,
  });

  expect(consoleErrors).toEqual([]);
});

test('keyboard steering follows chase-camera left and right direction', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await page.setViewportSize({ width: 1280, height: 720 });

  const left = await runSteeringDirectionProbe(page, 'ArrowLeft');
  expect(Number.isFinite(left.startHeading)).toBe(true);
  expect(Number.isFinite(left.endHeading)).toBe(true);
  expect(left.headingDelta).toBeGreaterThan(0.06);
  expect(Math.abs(left.headingDelta)).toBeLessThan(1.45);
  expect(left.travelDistance).toBeGreaterThan(8);

  const right = await runSteeringDirectionProbe(page, 'ArrowRight');
  expect(Number.isFinite(right.startHeading)).toBe(true);
  expect(Number.isFinite(right.endHeading)).toBe(true);
  expect(right.headingDelta).toBeLessThan(-0.06);
  expect(Math.abs(right.headingDelta)).toBeLessThan(1.45);
  expect(right.travelDistance).toBeGreaterThan(8);
  expect(Math.abs(Math.abs(left.headingDelta) - Math.abs(right.headingDelta))).toBeLessThan(0.25);

  expect(consoleErrors).toEqual([]);
});

test('shows wrong-way feedback when reversing after launch', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect.poll(() => hasDebugState(page)).toBe(true);

  await page.locator('#start-button').click();
  await expect.poll(() => readDebug(page).then((debug) => debug.phase), { timeout: 5_000 }).toBe('racing');

  await page.keyboard.down('ArrowDown');
  await expect
    .poll(() => readDebug(page).then((debug) => debug.trackFeedback.wrongWay), {
      message: 'reverse travel triggers wrong-way feedback',
    })
    .toBe(true);
  await expect(page.locator('#race-status')).toHaveText('WRONG WAY');
  const debug = await readDebug(page);
  expect(debug.trackFeedback.message).toBe('WRONG WAY');
  expect(Math.abs(debug.speed)).toBeGreaterThan(3);
  await page.keyboard.up('ArrowDown');

  expect(consoleErrors).toEqual([]);
});

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

test('touch controls drive the race on mobile', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await expect(page.locator('#touch-controls')).toBeVisible();
  await expect.poll(() => hasDebugState(page), { message: 'debug state is initialized' }).toBe(true);
  await expect.poll(() => readDebug(page).then((debug) => debug.touchControls.visible)).toBe(true);
  let debug = await readDebug(page);
  expect(debug.settings.touchControlsMode).toBe('auto');
  expect(debug.touchControls).toMatchObject({
    visible: true,
    mode: 'auto',
    activeActions: [],
    input: {
      throttle: 0,
      brake: 0,
      steer: 0,
      handbrake: false,
      boost: false,
    },
  });

  await page.locator('#start-button').click();
  await expect(page.locator('#start-panel')).toHaveClass(/hidden/);
  await expectTouchButtonsToBeTopHitTargets(page);
  await expectElementsNotToOverlap(page, touchButtonSelectors, '#control-hints');
  await expect.poll(() => readDebug(page).then((state) => state.phase)).toBe('countdown');
  await holdTouchButton(page, '#touch-throttle', 21);
  await expect.poll(() => readDebug(page).then((state) => state.touchControls.activeActions)).toContain('throttle');
  await expect.poll(() => readDebug(page).then((state) => state.touchControls.input.throttle)).toBe(1);

  await expect.poll(() => readDebug(page).then((state) => state.phase), { timeout: 5_000 }).toBe('racing');
  const racingStart = await readDebug(page);
  await expect
    .poll(async () => {
      const current = await readDebug(page);
      return Math.hypot(current.carX - racingStart.carX, current.carZ - racingStart.carZ);
    })
    .toBeGreaterThan(8);
  await expect.poll(() => readDebug(page).then((state) => state.speed)).toBeGreaterThan(10);
  const launchDebug = await readDebug(page);
  expect(launchDebug.racePosition.position).toBeLessThanOrEqual(3);
  expect(launchDebug.opponents.some((opponent) => opponent.speed < opponent.targetSpeed)).toBe(true);

  await holdTouchButton(page, '#touch-left', 22);
  await holdTouchButton(page, '#touch-drift', 23);
  await expect.poll(() => readDebug(page).then((state) => state.touchControls.activeActions)).toEqual(
    expect.arrayContaining(['left', 'drift', 'throttle']),
  );
  await expect.poll(() => readDebug(page).then((state) => state.audio.skidGain), {
    message: 'held touch drift and steer produce skid audio',
  }).toBeGreaterThan(0);

  await releaseTouchButton(page, '#touch-drift', 23);
  await releaseTouchButton(page, '#touch-left', 22);
  await releaseTouchButton(page, '#touch-throttle', 21);
  await expect.poll(() => readDebug(page).then((state) => state.touchControls.activeActions)).toEqual([]);

  debug = await readDebug(page);
  expect(debug.phase).toBe('racing');
  expect(debug.speed).toBeGreaterThan(10);
  expect(consoleErrors).toEqual([]);
});

test('touch controls visibility follows auto and manual settings', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect.poll(() => hasDebugState(page), { message: 'debug state is initialized' }).toBe(true);
  await expect(page.locator('#touch-controls')).toBeHidden();
  await expect.poll(() => readDebug(page).then((state) => state.touchControls.visible)).toBe(false);
  await expect(page.locator('#control-hints')).toBeVisible();
  await expect.poll(() => readDebug(page).then((state) => state.controlHintsVisible)).toBe(true);

  await page.locator('#settings-button').click();
  await page.locator('#touch-controls-mode').selectOption('on');
  await expect(page.locator('#touch-controls')).toBeVisible();
  await expect(page.locator('#control-hints')).toBeHidden();
  await expect.poll(() => readDebug(page).then((state) => state.settings.touchControlsMode)).toBe('on');
  await expect.poll(() => readDebug(page).then((state) => state.touchControls.visible)).toBe(true);
  await expect.poll(() => readDebug(page).then((state) => state.controlHintsVisible)).toBe(false);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#touch-controls-mode').selectOption('auto');
  await expect(page.locator('#touch-controls')).toBeVisible();
  await expect(page.locator('#control-hints')).toBeHidden();
  await expect.poll(() => readDebug(page).then((state) => state.touchControls.visible)).toBe(true);
  await expect.poll(() => readDebug(page).then((state) => state.controlHintsVisible)).toBe(false);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('#touch-controls-mode').selectOption('off');
  await expect(page.locator('#touch-controls')).toBeHidden();
  await expect(page.locator('#control-hints')).toBeVisible();
  await expect.poll(() => readDebug(page).then((state) => state.touchControls.visible)).toBe(false);
  await expect.poll(() => readDebug(page).then((state) => state.controlHintsVisible)).toBe(true);
  expect(consoleErrors).toEqual([]);
});

test('touch controls stay clear of mobile settings and results surfaces', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  for (const viewportWidth of [320, 390, 720]) {
    await page.setViewportSize({ width: viewportWidth, height: 844 });
    await page.goto('/');
    await expect.poll(() => hasDebugState(page), { message: `debug state is initialized at ${viewportWidth}px` }).toBe(true);
    await expect(page.locator('#touch-controls')).toBeVisible();
    await page.locator('#start-button').click();
    await expect(page.locator('#start-panel')).toHaveClass(/hidden/);
    await expectTouchButtonsToBeTopHitTargets(page);
    await expectTouchButtonsToMeetMinimumSize(page, viewportWidth <= 420 ? 70 : 76, viewportWidth <= 420 ? 64 : 68);
    await expectElementsNotToOverlap(page, touchButtonSelectors, '#settings-button');

    await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('#results-panel');
      if (!panel) {
        throw new Error('Missing results panel');
      }
      panel.hidden = false;
      panel.classList.remove('hidden');
    });
    await expectElementsNotToOverlap(page, touchButtonSelectors, '#results-panel');
  }

  expect(consoleErrors).toEqual([]);
});

test('touch controls clear a held action when pointer capture is unavailable and release happens outside button', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect.poll(() => hasDebugState(page), { message: 'debug state is initialized' }).toBe(true);
  await page.evaluate(() => {
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-touch-action]')) {
      button.setPointerCapture = () => {
        throw new Error('capture unavailable');
      };
    }
  });

  await holdTouchButton(page, '#touch-throttle', 31);
  await expect.poll(() => readDebug(page).then((state) => state.touchControls.activeActions)).toContain('throttle');
  await page.locator('body').dispatchEvent('pointerup', {
    pointerId: 31,
    pointerType: 'touch',
    isPrimary: true,
    buttons: 0,
    button: 0,
  });
  await expect.poll(() => readDebug(page).then((state) => state.touchControls.activeActions)).toEqual([]);
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

async function readTimingHudMatch(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const debug = window.__racingGameDebug;
    if (!debug) {
      throw new Error('Missing racing game debug state');
    }

    const text = (selector: string) => document.querySelector(selector)?.textContent?.trim() ?? null;
    const sectorDelta = document.querySelector('#sector-delta');

    return (
      debug.timing.currentLapLabel === text('#lap-time') &&
      debug.timing.currentSectorLabel === text('#sector-label') &&
      debug.timing.currentSectorTimeLabel === text('#sector-time') &&
      debug.timing.sectorDeltaLabel === text('#sector-delta') &&
      debug.timing.sectorDeltaTone === sectorDelta?.getAttribute('data-tone')
    );
  });
}

async function readSplitSummaryHudMatch(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const debug = window.__racingGameDebug;
    if (!debug) {
      throw new Error('Missing racing game debug state');
    }

    const lapText = document.querySelector('#lap-splits')?.textContent ?? '';
    const sectorText = document.querySelector('#sector-splits')?.textContent ?? '';
    const sectorChips = Array.from(document.querySelectorAll<HTMLElement>('#sector-splits .sector-chip')).map(
      (chip) => ({
        text: chip.textContent ?? '',
        tone: chip.getAttribute('data-tone'),
      }),
    );
    const expectedSectorCount = debug.splitSummary.sectorRows.reduce(
      (count, row) => count + row.sectors.length,
      0,
    );

    return (
      debug.splitSummary.visible &&
      debug.splitSummary.lapRows.every(
        (row) => lapText.includes(row.lapLabel) && lapText.includes(row.timeLabel),
      ) &&
      debug.splitSummary.sectorRows.every((row) => sectorText.includes(row.lapLabel)) &&
      debug.splitSummary.sectorRows.every((row) =>
        row.sectors.every((sector) =>
          sectorChips.some(
            (chip) =>
              chip.text.includes(sector.sectorLabel) &&
              chip.text.includes(sector.timeLabel) &&
              chip.tone === sector.tone,
          ),
        ),
      ) &&
      sectorChips.length === expectedSectorCount
    );
  });
}

async function runSteeringDirectionProbe(
  page: Page,
  key: 'ArrowLeft' | 'ArrowRight',
): Promise<{
  readonly startHeading: number;
  readonly endHeading: number;
  readonly headingDelta: number;
  readonly travelDistance: number;
}> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => hasDebugState(page), { message: `debug state is initialized before ${key}` }).toBe(true);
  await page.locator('#start-button').click();
  await expect.poll(() => readDebug(page).then((debug) => debug.phase)).toBe('countdown');
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => readDebug(page).then((debug) => debug.phase), { timeout: 5_000 }).toBe('racing');
  const start = await readDebug(page);
  await page.keyboard.down(key);
  await page.waitForTimeout(800);
  await page.keyboard.up(key);
  await page.keyboard.up('ArrowUp');
  const end = await readDebug(page);

  return {
    startHeading: start.carHeading,
    endHeading: end.carHeading,
    headingDelta: normalizeRadians(end.carHeading - start.carHeading),
    travelDistance: Math.hypot(end.carX - start.carX, end.carZ - start.carZ),
  };
}

function normalizeRadians(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function collectConsoleErrors(page: Page): string[] {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });
  return consoleErrors;
}

const touchButtonSelectors = [
  '#touch-left',
  '#touch-right',
  '#touch-throttle',
  '#touch-brake',
  '#touch-drift',
  '#touch-boost',
] as const;

async function holdTouchButton(page: Page, selector: string, pointerId: number): Promise<void> {
  await page.locator(selector).dispatchEvent('pointerdown', {
    pointerId,
    pointerType: 'touch',
    isPrimary: pointerId === 21,
    buttons: 1,
    button: 0,
  });
}

async function releaseTouchButton(page: Page, selector: string, pointerId: number): Promise<void> {
  await page.locator(selector).dispatchEvent('pointerup', {
    pointerId,
    pointerType: 'touch',
    isPrimary: pointerId === 21,
    buttons: 0,
    button: 0,
  });
}

async function expectTouchButtonsToBeTopHitTargets(page: Page): Promise<void> {
  const misses = await page.evaluate((selectors) => {
    return selectors.flatMap((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element || element.hidden) {
        return [`${selector} is missing or hidden`];
      }
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === element || element.contains(hit) ? [] : [`${selector} center hit ${hit?.id || hit?.tagName || 'nothing'}`];
    });
  }, touchButtonSelectors);

  expect(misses).toEqual([]);
}

async function expectTouchButtonsToMeetMinimumSize(
  page: Page,
  minimumWidth: number,
  minimumHeight: number,
): Promise<void> {
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
          : [`${selector} is ${rect.width}x${rect.height}; expected >= ${minWidth}x${minHeight}`];
      });
    },
    { selectors: touchButtonSelectors, minWidth: minimumWidth, minHeight: minimumHeight },
  );

  expect(undersized).toEqual([]);
}

async function expectElementsNotToOverlap(
  page: Page,
  sourceSelectors: readonly string[],
  targetSelector: string,
): Promise<void> {
  const overlaps = await page.evaluate(
    ({ sources, target }) => {
      const targetElement = document.querySelector<HTMLElement>(target);
      if (!targetElement || targetElement.hidden) {
        return [];
      }
      const targetRect = targetElement.getBoundingClientRect();
      return sources.flatMap((source) => {
        const sourceElement = document.querySelector<HTMLElement>(source);
        if (!sourceElement || sourceElement.hidden) {
          return [];
        }
        const sourceRect = sourceElement.getBoundingClientRect();
        const overlaps =
          sourceRect.left < targetRect.right &&
          sourceRect.right > targetRect.left &&
          sourceRect.top < targetRect.bottom &&
          sourceRect.bottom > targetRect.top;
        return overlaps ? [`${source} overlaps ${target}`] : [];
      });
    },
    { sources: sourceSelectors, target: targetSelector },
  );

  expect(overlaps).toEqual([]);
}

async function expectElementToBeWithinViewport(page: Page, selector: string): Promise<void> {
  const overflow = await page.evaluate((targetSelector) => {
    const element = document.querySelector<HTMLElement>(targetSelector);
    if (!element || element.hidden) {
      return [`${targetSelector} is missing or hidden`];
    }
    const rect = element.getBoundingClientRect();
    const tolerance = 0.5;
    return [
      rect.left >= -tolerance ? null : `${targetSelector} left ${rect.left}`,
      rect.top >= -tolerance ? null : `${targetSelector} top ${rect.top}`,
      rect.right <= window.innerWidth + tolerance
        ? null
        : `${targetSelector} right ${rect.right} > ${window.innerWidth}`,
      rect.bottom <= window.innerHeight + tolerance
        ? null
        : `${targetSelector} bottom ${rect.bottom} > ${window.innerHeight}`,
    ].filter((message): message is string => message !== null);
  }, selector);

  expect(overflow).toEqual([]);
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

async function countMinimapSampleColors(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#minimap-canvas');
    if (!canvas) {
      throw new Error('Missing minimap canvas');
    }
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Missing minimap 2D context');
    }

    const colors = new Set<string>();
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let y = 0; y < canvas.height; y += 8) {
      for (let x = 0; x < canvas.width; x += 8) {
        const index = (y * canvas.width + x) * 4;
        const alpha = imageData[index + 3];
        if (alpha > 0) {
          colors.add(`${imageData[index]},${imageData[index + 1]},${imageData[index + 2]},${alpha}`);
        }
      }
    }

    return colors.size;
  });
}
