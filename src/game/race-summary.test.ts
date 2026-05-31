import { describe, expect, it } from 'vitest';
import { createRaceProgress, updateRaceProgress } from './race';
import { createRaceSplitSummary } from './race-summary';

describe('race split summary', () => {
  it('stays hidden before the race finishes', () => {
    const summary = createRaceSplitSummary(createRaceProgress(makeCheckpoints(), 2));

    expect(summary).toMatchObject({ visible: false });
    expect(summary.lapRows).toEqual([]);
    expect(summary.sectorRows).toEqual([]);
  });

  it('stays hidden without a completed lap', () => {
    const summary = createRaceSplitSummary(createRaceProgress([], 2));

    expect(summary).toMatchObject({ visible: false });
    expect(summary.lapRows).toEqual([]);
    expect(summary.sectorRows).toEqual([]);
  });

  it('renders completed lap and sector rows after the race finishes', () => {
    const summary = createRaceSplitSummary(finishedTwoLapProgress());

    expect(summary.visible).toBe(true);
    expect(summary.lapRows.map((row) => row.lapLabel)).toEqual(['L1', 'L2']);
    expect(summary.lapRows.map((row) => row.timeLabel)).toEqual(['30.00', '28.00']);
    expect(summary.lapRows.map((row) => row.isBest)).toEqual([false, true]);
    expect(summary.sectorRows.map((row) => row.lapLabel)).toEqual(['L1', 'L2']);
    expect(summary.sectorRows[0].sectors.map((sector) => sector.sectorLabel)).toEqual([
      'S1',
      'S2',
      'S3',
    ]);
    expect(summary.sectorRows[1].sectors[0]).toMatchObject({
      sectorNumber: 1,
      sectorLabel: 'S1',
      timeLabel: '06.00',
      tone: 'best',
    });
    expect(summary.sectorRows.map((row) => row.sectors.map((sector) => sector.tone))).toEqual([
      ['normal', 'normal', 'best'],
      ['best', 'best', 'normal'],
    ]);
  });
});

function finishedTwoLapProgress() {
  const checkpoints = makeCheckpoints();
  let progress = createRaceProgress(checkpoints, 2);

  progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 10);
  progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 0 }, 17.5);
  progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 100 }, 26.25);
  progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 40);
  progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 0 }, 46);
  progress = updateRaceProgress(progress, checkpoints, { x: 100, z: 100 }, 54);
  progress = updateRaceProgress(progress, checkpoints, { x: 0, z: 0 }, 68);

  return progress;
}

function makeCheckpoints() {
  return [
    { id: 'start', x: 0, z: 0, radius: 10 },
    { id: 'ridge', x: 100, z: 0, radius: 10 },
    { id: 'harbor', x: 100, z: 100, radius: 10 },
  ];
}
