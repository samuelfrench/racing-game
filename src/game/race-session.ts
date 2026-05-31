export type RacePhase = 'idle' | 'countdown' | 'racing' | 'finished';

export type RaceResult = {
  readonly id: string;
  readonly name: string;
  readonly finishSeconds: number;
};

export type RaceSession = {
  readonly phase: RacePhase;
  readonly countdownSeconds: number;
  readonly startedAtSeconds: number | null;
  readonly finishedAtSeconds: number | null;
  readonly results: readonly RaceResult[];
};

const defaultCountdownSeconds = 3;

export function createRaceSession(): RaceSession {
  return {
    phase: 'idle',
    countdownSeconds: defaultCountdownSeconds,
    startedAtSeconds: null,
    finishedAtSeconds: null,
    results: [],
  };
}

export function requestRaceStart(session: RaceSession): RaceSession {
  if (session.phase !== 'idle') {
    return session;
  }

  return {
    ...session,
    phase: 'countdown',
    countdownSeconds: defaultCountdownSeconds,
    startedAtSeconds: null,
    finishedAtSeconds: null,
    results: [],
  };
}

export function stepRaceSession(session: RaceSession, deltaSeconds: number): RaceSession {
  if (session.phase !== 'countdown') {
    return session;
  }

  const countdownSeconds = Math.max(0, session.countdownSeconds - Math.max(0, deltaSeconds));

  if (countdownSeconds > 0) {
    return {
      ...session,
      countdownSeconds,
    };
  }

  return {
    ...session,
    phase: 'racing',
    countdownSeconds,
    startedAtSeconds: defaultCountdownSeconds,
  };
}

export function finishRace(session: RaceSession, results: readonly RaceResult[]): RaceSession {
  const sortedResults = [...results].sort((a, b) => a.finishSeconds - b.finishSeconds);
  const finishedAtSeconds = sortedResults.length === 0 ? null : sortedResults[sortedResults.length - 1].finishSeconds;

  return {
    ...session,
    phase: 'finished',
    finishedAtSeconds,
    results: sortedResults,
  };
}

export function resetRaceSession(_session: RaceSession): RaceSession {
  return createRaceSession();
}
