import { describe, expect, it } from 'vitest';
import { createRaceProgress, updateRaceProgress } from './race';

describe('race progress', () => {
  it('requires checkpoints in order before counting a lap', () => {
    const checkpoints = [
      { id: 'start', x: 0, z: 0, radius: 10 },
      { id: 'ridge', x: 100, z: 0, radius: 10 },
      { id: 'harbor', x: 100, z: 100, radius: 10 },
    ];

    let progress = createRaceProgress(checkpoints, 3);

    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 100 }, 5);
    expect(progress.nextCheckpointIndex).toBe(0);
    expect(progress.currentLap).toBe(1);

    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 10);
    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 0 }, 20);
    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 100 }, 30);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 40);

    expect(progress.currentLap).toBe(2);
    expect(progress.lastLapSeconds).toBe(30);
    expect(progress.bestLapSeconds).toBe(30);
  });

  it('marks the race finished without exposing another checkpoint after the final lap', () => {
    const checkpoints = [
      { id: 'start', x: 0, z: 0, radius: 10 },
      { id: 'ridge', x: 100, z: 0, radius: 10 },
    ];

    let progress = createRaceProgress(checkpoints, 1);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 0);
    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 0 }, 10);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 20);

    expect(progress.finished).toBe(true);
    expect(progress.currentLap).toBe(1);
    expect(progress.nextCheckpointIndex).toBe(-1);
    expect(progress.lastLapSeconds).toBe(20);
    expect(progress.bestLapSeconds).toBe(20);
  });
});
