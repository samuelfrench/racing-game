import type { RacePositionState } from './race-position';

export type RaceAwarenessTone = 'leader' | 'chasing' | 'midfield' | 'last';

export type RaceAwarenessState = {
  readonly positionLabel: string;
  readonly gapLabel: string;
  readonly gapMeters: number | null;
  readonly tone: RaceAwarenessTone;
};

export function createRaceAwareness(
  racePosition: RacePositionState,
  playerId = 'player',
): RaceAwarenessState {
  const total = sanitizeTotal(racePosition.total);
  const position = sanitizeOrdinal(racePosition.position, total);
  const positionLabel = `P${position}/${total}`;
  const tone = getPositionTone(position, total);
  const playerIndex = racePosition.participants.findIndex((participant) => participant.id === playerId);

  if (playerIndex < 0) {
    return {
      positionLabel,
      gapLabel: '--',
      gapMeters: null,
      tone,
    };
  }

  const player = racePosition.participants[playerIndex];
  if (player.finishedAtSeconds !== null) {
    return {
      positionLabel,
      gapLabel: 'FINISH',
      gapMeters: null,
      tone,
    };
  }

  const comparison = playerIndex === 0 ? racePosition.participants[1] : racePosition.participants[playerIndex - 1];
  if (!comparison) {
    return {
      positionLabel,
      gapLabel: position === 1 ? 'LEAD' : '--',
      gapMeters: null,
      tone,
    };
  }

  const rawGap =
    playerIndex === 0
      ? sanitizeDistance(player.distance) - sanitizeDistance(comparison.distance)
      : sanitizeDistance(comparison.distance) - sanitizeDistance(player.distance);
  const gapMeters = Math.max(0, rawGap);
  const roundedGap = Math.max(0, Math.round(gapMeters));
  const gapPrefix = playerIndex === 0 ? 'LEAD' : 'GAP';

  return {
    positionLabel,
    gapLabel: `${gapPrefix} ${roundedGap}m`,
    gapMeters,
    tone,
  };
}

function getPositionTone(position: number, total: number): RaceAwarenessTone {
  if (total <= 0) {
    return 'midfield';
  }

  if (position <= 1) {
    return 'leader';
  }

  if (position >= total) {
    return 'last';
  }

  return position <= Math.ceil(total / 2) ? 'chasing' : 'midfield';
}

function sanitizeTotal(total: number): number {
  return Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0;
}

function sanitizeOrdinal(position: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  if (!Number.isFinite(position)) {
    return Math.max(1, total);
  }

  return Math.min(Math.max(1, Math.trunc(position)), Math.max(1, total));
}

function sanitizeDistance(distance: number): number {
  return Number.isFinite(distance) ? Math.max(0, distance) : 0;
}
