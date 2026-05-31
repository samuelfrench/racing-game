import { describe, expect, it } from 'vitest';
import {
  createRaceSession,
  finishRace,
  requestRaceStart,
  resetRaceSession,
  stepRaceSession,
} from './race-session';

describe('race session', () => {
  it('runs countdown, racing, finished, and reset phases without mutation', () => {
    const idle = createRaceSession();

    expect(idle.phase).toBe('idle');
    expect(idle.countdownSeconds).toBe(3);

    const countdown = requestRaceStart(idle);

    expect(countdown.phase).toBe('countdown');
    expect(idle.phase).toBe('idle');

    const duringCountdown = stepRaceSession(countdown, 1.2);

    expect(duringCountdown.phase).toBe('countdown');
    expect(duringCountdown.countdownSeconds).toBeCloseTo(1.8);

    const racing = stepRaceSession(duringCountdown, 2);

    expect(racing.phase).toBe('racing');
    expect(racing.countdownSeconds).toBe(0);

    const unsortedResults = [
      { id: 'rival', name: 'Rival', finishSeconds: 94.1 },
      { id: 'player', name: 'You', finishSeconds: 92.4 },
    ];
    const finished = finishRace(racing, unsortedResults);

    expect(finished.phase).toBe('finished');
    expect(finished.results).toEqual([
      { id: 'player', name: 'You', finishSeconds: 92.4 },
      { id: 'rival', name: 'Rival', finishSeconds: 94.1 },
    ]);
    expect(unsortedResults.map((result) => result.id)).toEqual(['rival', 'player']);

    const reset = resetRaceSession(finished);

    expect(reset.phase).toBe('idle');
    expect(reset.countdownSeconds).toBe(3);
    expect(reset.results).toEqual([]);
  });
});
