import type { RaceProgress } from './race';

export type SectorDeltaTone = 'neutral' | 'best' | 'faster' | 'slower' | 'matched';

export type RaceTimingDisplayState = {
  readonly currentLapSeconds: number | null;
  readonly currentLapLabel: string;
  readonly bestLapLabel: string;
  readonly currentSectorNumber: number;
  readonly currentSectorLabel: string;
  readonly currentSectorLabelText: string;
  readonly currentSectorSeconds: number | null;
  readonly currentSectorTimeLabel: string;
  readonly lastSectorLabel: string;
  readonly lastSectorTimeLabel: string;
  readonly sectorDeltaLabel: string;
  readonly sectorDeltaTone: SectorDeltaTone;
};

export function createRaceTimingDisplay(
  progress: RaceProgress,
  checkpointCount: number,
  elapsedSeconds: number,
): RaceTimingDisplayState {
  const currentLapSeconds = getCurrentLapSeconds(progress, elapsedSeconds);
  const currentSectorNumber = getCurrentSectorNumber(progress, checkpointCount);
  const currentSectorSeconds = getCurrentSectorSeconds(progress, elapsedSeconds);
  const sectorDelta = getSectorDeltaDisplay(progress);

  return {
    currentLapSeconds,
    currentLapLabel: formatTimeLabel(currentLapSeconds),
    bestLapLabel: formatTimeLabel(progress.bestLapSeconds),
    currentSectorNumber,
    currentSectorLabel: formatSectorLabel(currentSectorNumber),
    currentSectorLabelText: 'Sector',
    currentSectorSeconds,
    currentSectorTimeLabel: formatTimeLabel(currentSectorSeconds),
    lastSectorLabel:
      progress.lastSectorNumber === null ? '--' : formatSectorLabel(progress.lastSectorNumber),
    lastSectorTimeLabel: formatTimeLabel(progress.lastSectorSeconds),
    sectorDeltaLabel: sectorDelta.label,
    sectorDeltaTone: sectorDelta.tone,
  };
}

function getCurrentLapSeconds(progress: RaceProgress, elapsedSeconds: number): number | null {
  if (progress.finished) {
    return progress.lastLapSeconds;
  }

  if (progress.lapStartedAtSeconds === null) {
    return null;
  }

  return elapsedSeconds - progress.lapStartedAtSeconds;
}

function getCurrentSectorNumber(progress: RaceProgress, checkpointCount: number): number {
  if (progress.finished && progress.lastSectorNumber !== null) {
    return progress.lastSectorNumber;
  }

  if (progress.lastSectorNumber === null || progress.sectorStartedAtSeconds === null) {
    return 1;
  }

  return progress.lastSectorNumber >= checkpointCount ? 1 : progress.lastSectorNumber + 1;
}

function getCurrentSectorSeconds(progress: RaceProgress, elapsedSeconds: number): number | null {
  if (progress.finished) {
    return progress.lastSectorSeconds;
  }

  if (progress.sectorStartedAtSeconds === null) {
    return null;
  }

  return elapsedSeconds - progress.sectorStartedAtSeconds;
}

function getSectorDeltaDisplay(progress: RaceProgress): {
  readonly label: string;
  readonly tone: SectorDeltaTone;
} {
  if (progress.lastSectorNumber === null || progress.lastSectorSeconds === null) {
    return { label: '--', tone: 'neutral' };
  }

  if (progress.lastSectorDeltaSeconds === null) {
    return progress.lastSectorPersonalBest
      ? { label: 'BEST', tone: 'best' }
      : { label: '--', tone: 'neutral' };
  }

  if (progress.lastSectorPersonalBest) {
    return { label: formatDeltaLabel(progress.lastSectorDeltaSeconds), tone: 'best' };
  }

  const roundedDelta = Math.round(progress.lastSectorDeltaSeconds * 100) / 100;
  if (roundedDelta < 0) {
    return { label: formatDeltaLabel(progress.lastSectorDeltaSeconds), tone: 'faster' };
  }

  if (roundedDelta > 0) {
    return { label: formatDeltaLabel(progress.lastSectorDeltaSeconds), tone: 'slower' };
  }

  return { label: formatDeltaLabel(progress.lastSectorDeltaSeconds), tone: 'matched' };
}

function formatSectorLabel(sectorNumber: number): string {
  return `S${Math.max(1, Math.trunc(sectorNumber))}`;
}

function formatTimeLabel(seconds: number | null): string {
  if (seconds === null) {
    return '--';
  }

  return seconds.toFixed(2).padStart(5, '0');
}

function formatDeltaLabel(seconds: number): string {
  const sign = seconds < 0 ? '-' : '+';
  return `${sign}${Math.abs(seconds).toFixed(2).padStart(5, '0')}`;
}
