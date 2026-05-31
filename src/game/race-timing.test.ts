import { describe, expect, it } from 'vitest';
import { createRaceProgress, updateRaceProgress } from './race';
import { createRaceTimingDisplay } from './race-timing';

describe('race timing display', () => {
  it('shows idle placeholders before lap and sector clocks start', () => {
    const progress = createRaceProgress(makeCheckpoints(), 2);

    const display = createRaceTimingDisplay(progress, 3, 12.5);

    expect(display.currentLapSeconds).toBeNull();
    expect(display.currentLapLabel).toBe('--');
    expect(display.bestLapLabel).toBe('--');
    expect(display.currentSectorNumber).toBe(1);
    expect(display.currentSectorLabel).toBe('S1');
    expect(display.currentSectorLabelText).toBe('Sector');
    expect(display.currentSectorSeconds).toBeNull();
    expect(display.currentSectorTimeLabel).toBe('--');
    expect(display.lastSectorLabel).toBe('--');
    expect(display.lastSectorTimeLabel).toBe('--');
    expect(display.sectorDeltaLabel).toBe('--');
    expect(display.sectorDeltaTone).toBe('neutral');
  });

  it('formats active lap and sector clocks from start time', () => {
    const checkpoints = makeCheckpoints();
    let progress = createRaceProgress(checkpoints, 2);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 10);

    const display = createRaceTimingDisplay(progress, checkpoints.length, 14.25);

    expect(display.currentLapSeconds).toBe(4.25);
    expect(display.currentLapLabel).toBe('04.25');
    expect(display.currentSectorNumber).toBe(1);
    expect(display.currentSectorLabel).toBe('S1');
    expect(display.currentSectorLabelText).toBe('Sector');
    expect(display.currentSectorSeconds).toBe(4.25);
    expect(display.currentSectorTimeLabel).toBe('04.25');
  });

  it('shows a completed first sector as best with no previous delta', () => {
    const checkpoints = makeCheckpoints();
    let progress = createRaceProgress(checkpoints, 2);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 10);
    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 0 }, 17.5);

    const display = createRaceTimingDisplay(progress, checkpoints.length, 20);

    expect(display.currentSectorNumber).toBe(2);
    expect(display.currentSectorLabel).toBe('S2');
    expect(display.lastSectorLabel).toBe('S1');
    expect(display.lastSectorTimeLabel).toBe('07.50');
    expect(display.sectorDeltaLabel).toBe('BEST');
    expect(display.sectorDeltaTone).toBe('best');
  });

  it('formats faster personal-best sector deltas', () => {
    const checkpoints = makeCheckpoints();
    let progress = createRaceProgress(checkpoints, 3);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 10);
    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 0 }, 17.5);
    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 100 }, 26.25);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 40);
    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 0 }, 46);

    const display = createRaceTimingDisplay(progress, checkpoints.length, 50);

    expect(display.lastSectorLabel).toBe('S1');
    expect(display.lastSectorTimeLabel).toBe('06.00');
    expect(display.sectorDeltaLabel).toBe('-01.50');
    expect(display.sectorDeltaTone).toBe('best');
  });

  it('holds final lap and sector times after the race finishes', () => {
    const checkpoints = [
      { id: 'start', x: 0, z: 0, radius: 10 },
      { id: 'ridge', x: 100, z: 0, radius: 10 },
    ];
    let progress = createRaceProgress(checkpoints, 1);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 0);
    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 0 }, 8);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 20);

    const display = createRaceTimingDisplay(progress, checkpoints.length, 45);

    expect(display.currentLapSeconds).toBe(20);
    expect(display.currentLapLabel).toBe('20.00');
    expect(display.currentSectorNumber).toBe(2);
    expect(display.currentSectorLabel).toBe('S2');
    expect(display.currentSectorSeconds).toBe(12);
    expect(display.currentSectorTimeLabel).toBe('12.00');
    expect(display.lastSectorLabel).toBe('S2');
    expect(display.lastSectorTimeLabel).toBe('12.00');
  });
});

function makeCheckpoints() {
  return [
    { id: 'start', x: 0, z: 0, radius: 10 },
    { id: 'ridge', x: 100, z: 0, radius: 10 },
    { id: 'harbor', x: 100, z: 100, radius: 10 },
  ];
}
