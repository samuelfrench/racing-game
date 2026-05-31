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

  it('records sector splits and best-sector deltas across laps', () => {
    const checkpoints = [
      { id: 'start', x: 0, z: 0, radius: 10 },
      { id: 'ridge', x: 100, z: 0, radius: 10 },
      { id: 'harbor', x: 100, z: 100, radius: 10 },
    ];

    let progress = createRaceProgress(checkpoints, 3);

    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 10);
    expect(progress.sectorStartedAtSeconds).toBe(10);
    expect(progress.lastSectorNumber).toBeNull();
    expect(progress.bestSectorSeconds).toEqual([null, null, null]);
    expect(progress.completedLapSeconds).toEqual([]);
    expect(progress.completedSectorSplits).toEqual([]);

    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 0 }, 17.5);
    expect(progress.lastSectorNumber).toBe(1);
    expect(progress.lastSectorCheckpointId).toBe('ridge');
    expect(progress.lastSectorSeconds).toBe(7.5);
    expect(progress.lastSectorDeltaSeconds).toBeNull();
    expect(progress.lastSectorPersonalBest).toBe(true);

    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 100 }, 26.25);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 40);
    expect(progress.bestSectorSeconds).toEqual([7.5, 8.75, 13.75]);

    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 0 }, 46);
    expect(progress.bestSectorSeconds).toEqual([6, 8.75, 13.75]);
    expect(progress.lastSectorNumber).toBe(1);
    expect(progress.lastSectorCheckpointId).toBe('ridge');
    expect(progress.lastSectorSeconds).toBe(6);
    expect(progress.lastSectorDeltaSeconds).toBe(-1.5);
    expect(progress.lastSectorPersonalBest).toBe(true);
    expect(progress.completedLapSeconds).toEqual([30]);
    expect(progress.completedSectorSplits.map((split) => ({
      lapNumber: split.lapNumber,
      sectorNumber: split.sectorNumber,
      checkpointId: split.checkpointId,
      seconds: split.seconds,
      deltaSeconds: split.deltaSeconds,
      personalBest: split.personalBest,
    }))).toEqual([
      { lapNumber: 1, sectorNumber: 1, checkpointId: 'ridge', seconds: 7.5, deltaSeconds: null, personalBest: true },
      { lapNumber: 1, sectorNumber: 2, checkpointId: 'harbor', seconds: 8.75, deltaSeconds: null, personalBest: true },
      { lapNumber: 1, sectorNumber: 3, checkpointId: 'start', seconds: 13.75, deltaSeconds: null, personalBest: true },
      { lapNumber: 2, sectorNumber: 1, checkpointId: 'ridge', seconds: 6, deltaSeconds: -1.5, personalBest: true },
    ]);
  });

  it('stops the active sector timer when the race finishes', () => {
    const checkpoints = [
      { id: 'start', x: 0, z: 0, radius: 10 },
      { id: 'ridge', x: 100, z: 0, radius: 10 },
    ];

    let progress = createRaceProgress(checkpoints, 1);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 0);
    progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 0 }, 8);
    progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 20);

    expect(progress.finished).toBe(true);
    expect(progress.sectorStartedAtSeconds).toBeNull();
    expect(progress.lastSectorNumber).toBe(2);
    expect(progress.lastSectorSeconds).toBe(12);
    expect(progress.bestSectorSeconds).toEqual([8, 12]);
  });
});
