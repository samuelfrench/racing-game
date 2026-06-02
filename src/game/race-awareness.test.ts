import { describe, expect, it } from 'vitest';
import type { RacePositionState } from './race-position';
import { createRaceAwareness } from './race-awareness';

function state(overrides: Partial<RacePositionState> = {}): RacePositionState {
  return {
    position: 1,
    total: 4,
    participants: [
      { id: 'player', name: 'You', distance: 620, finishedAtSeconds: null },
      { id: 'opponent-a', name: 'Nova', distance: 590, finishedAtSeconds: null },
      { id: 'opponent-b', name: 'Vega', distance: 520, finishedAtSeconds: null },
      { id: 'opponent-c', name: 'Orion', distance: 410, finishedAtSeconds: null },
    ],
    ...overrides,
  };
}

describe('race awareness display state', () => {
  it('formats the player lead from the next car behind', () => {
    const awareness = createRaceAwareness(state());

    expect(awareness).toEqual({
      positionLabel: 'P1/4',
      gapLabel: 'LEAD 30m',
      gapMeters: 30,
      nearestOpponentMeters: 30,
      proximity: 'clear',
      tone: 'leader',
    });
  });

  it('formats the gap to the next car ahead while chasing', () => {
    const awareness = createRaceAwareness(
      state({
        position: 2,
        participants: [
          { id: 'opponent-a', name: 'Nova', distance: 700, finishedAtSeconds: null },
          { id: 'player', name: 'You', distance: 682.4, finishedAtSeconds: null },
          { id: 'opponent-b', name: 'Vega', distance: 620, finishedAtSeconds: null },
          { id: 'opponent-c', name: 'Orion', distance: 410, finishedAtSeconds: null },
        ],
      }),
    );

    expect(awareness.positionLabel).toBe('P2/4');
    expect(awareness.gapLabel).toBe('GAP 18m');
    expect(awareness.gapMeters).toBeCloseTo(17.6);
    expect(awareness.nearestOpponentMeters).toBeCloseTo(17.6);
    expect(awareness.proximity).toBe('clear');
    expect(awareness.tone).toBe('chasing');
  });

  it('warns when an active opponent is alongside the player', () => {
    const awareness = createRaceAwareness(
      state({
        position: 1,
        participants: [
          { id: 'player', name: 'You', distance: 620, finishedAtSeconds: null },
          { id: 'opponent-a', name: 'Nova', distance: 615.4, finishedAtSeconds: null },
          { id: 'opponent-b', name: 'Vega', distance: 540, finishedAtSeconds: null },
          { id: 'opponent-c', name: 'Orion', distance: 410, finishedAtSeconds: null },
        ],
      }),
    );

    expect(awareness.gapLabel).toBe('ALONGSIDE');
    expect(awareness.gapMeters).toBeCloseTo(4.6);
    expect(awareness.nearestOpponentMeters).toBeCloseTo(4.6);
    expect(awareness.proximity).toBe('alongside');
    expect(awareness.tone).toBe('leader');
  });

  it('shows finish state for a classified player', () => {
    const awareness = createRaceAwareness(
      state({
        position: 1,
        participants: [
          { id: 'player', name: 'You', distance: 2400, finishedAtSeconds: 82.2 },
          { id: 'opponent-a', name: 'Nova', distance: 2380, finishedAtSeconds: null },
        ],
      }),
    );

    expect(awareness.gapLabel).toBe('FINISH');
    expect(awareness.proximity).toBe('clear');
    expect(awareness.nearestOpponentMeters).toBeNull();
    expect(awareness.tone).toBe('leader');
  });

  it('falls back safely when the player is missing', () => {
    const awareness = createRaceAwareness({
      position: 2,
      total: 2,
      participants: [
        { id: 'opponent-a', name: 'Nova', distance: 100, finishedAtSeconds: null },
        { id: 'opponent-b', name: 'Vega', distance: 90, finishedAtSeconds: null },
      ],
    });

    expect(awareness).toEqual({
      positionLabel: 'P2/2',
      gapLabel: '--',
      gapMeters: null,
      nearestOpponentMeters: null,
      proximity: 'clear',
      tone: 'last',
    });
  });

  it('keeps an empty field display coherent before race participants are ranked', () => {
    const awareness = createRaceAwareness({
      position: 0,
      total: 0,
      participants: [],
    });

    expect(awareness).toEqual({
      positionLabel: 'P0/0',
      gapLabel: '--',
      gapMeters: null,
      nearestOpponentMeters: null,
      proximity: 'clear',
      tone: 'midfield',
    });
  });
});
