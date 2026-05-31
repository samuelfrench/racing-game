import type { RaceProgress } from './race';

export type RaceSplitSummarySector = {
  readonly sectorNumber: number;
  readonly sectorLabel: string;
  readonly timeLabel: string;
  readonly tone: 'best' | 'normal';
};

export type RaceSplitSummaryLapRow = {
  readonly lapNumber: number;
  readonly lapLabel: string;
  readonly timeLabel: string;
  readonly isBest: boolean;
};

export type RaceSplitSummarySectorRow = {
  readonly lapNumber: number;
  readonly lapLabel: string;
  readonly sectors: readonly RaceSplitSummarySector[];
};

export type RaceSplitSummaryState = {
  readonly visible: boolean;
  readonly lapRows: readonly RaceSplitSummaryLapRow[];
  readonly sectorRows: readonly RaceSplitSummarySectorRow[];
};

export function createRaceSplitSummary(progress: RaceProgress): RaceSplitSummaryState {
  if (!progress.finished || progress.completedLapSeconds.length === 0) {
    return hiddenSummary();
  }

  const bestLapSeconds = Math.min(...progress.completedLapSeconds);
  const lapRows = progress.completedLapSeconds.map((seconds, index) => {
    const lapNumber = index + 1;

    return {
      lapNumber,
      lapLabel: formatLapLabel(lapNumber),
      timeLabel: formatTimeLabel(seconds),
      isBest: seconds === bestLapSeconds,
    };
  });
  const sectorRows = groupSectorRows(progress);

  return {
    visible: true,
    lapRows,
    sectorRows,
  };
}

function hiddenSummary(): RaceSplitSummaryState {
  return {
    visible: false,
    lapRows: [],
    sectorRows: [],
  };
}

function groupSectorRows(progress: RaceProgress): readonly RaceSplitSummarySectorRow[] {
  const sectorsByLap = new Map<number, RaceSplitSummarySector[]>();

  for (const split of progress.completedSectorSplits) {
    const sectors = sectorsByLap.get(split.lapNumber) ?? [];
    const bestSectorSeconds = progress.bestSectorSeconds[split.sectorNumber - 1];
    sectors.push({
      sectorNumber: split.sectorNumber,
      sectorLabel: formatSectorLabel(split.sectorNumber),
      timeLabel: formatTimeLabel(split.seconds),
      tone: bestSectorSeconds !== null && split.seconds === bestSectorSeconds ? 'best' : 'normal',
    });
    sectorsByLap.set(split.lapNumber, sectors);
  }

  return Array.from(sectorsByLap.entries()).map(([lapNumber, sectors]) => ({
    lapNumber,
    lapLabel: formatLapLabel(lapNumber),
    sectors,
  }));
}

function formatLapLabel(lapNumber: number): string {
  return `L${lapNumber}`;
}

function formatSectorLabel(sectorNumber: number): string {
  return `S${sectorNumber}`;
}

function formatTimeLabel(seconds: number): string {
  return seconds.toFixed(2).padStart(5, '0');
}
