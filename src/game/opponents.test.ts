import { describe, expect, it } from 'vitest';
import { createDefaultTrack } from './track';
import { createOpponentGrid, getOpponentResults, stepOpponents } from './opponents';

describe('opponents', () => {
  it('creates a stable three-car opponent grid', () => {
    const track = createDefaultTrack();
    const opponents = createOpponentGrid(track, 2);

    expect(opponents).toHaveLength(3);
    expect(opponents.map((opponent) => opponent.id)).toEqual(['opponent-1', 'opponent-2', 'opponent-3']);
    expect(opponents.map((opponent) => opponent.name)).toEqual(['Mara Voss', 'Timo Reyes', 'Juno Park']);
    expect(opponents.map((opponent) => opponent.color)).toEqual(['#ff4d6d', '#49c6ff', '#f5d547']);
    expect(opponents.map((opponent) => opponent.distanceTraveled)).toEqual([0, -8, -16]);

    for (const opponent of opponents) {
      expect(Number.isFinite(opponent.position.x)).toBe(true);
      expect(Number.isFinite(opponent.position.z)).toBe(true);
      expect(Number.isFinite(opponent.heading)).toBe(true);
      expect(opponent.lap).toBe(1);
      expect(opponent.finishedAtSeconds).toBeNull();
    }
  });

  it('advances opponents along the track only while racing', () => {
    const track = createDefaultTrack();
    const opponents = createOpponentGrid(track, 1);

    const countdown = stepOpponents(opponents, track, 1, false, 2);

    expect(countdown).toEqual(opponents);

    const racing = stepOpponents(opponents, track, 1, true, 1);

    for (let i = 0; i < opponents.length; i += 1) {
      expect(racing[i]).not.toBe(opponents[i]);
      expect(racing[i].distanceTraveled).toBeGreaterThan(opponents[i].distanceTraveled);
      expect(racing[i].position).not.toEqual(opponents[i].position);
    }
    expect(opponents.map((opponent) => opponent.distanceTraveled)).toEqual([0, -8, -16]);
  });

  it('finishes opponents and returns sorted finished results', () => {
    const track = createDefaultTrack();
    let opponents = createOpponentGrid(track, 1);

    for (let i = 0; i < 40; i += 1) {
      opponents = stepOpponents(opponents, track, 1, true, i + 1);
    }

    expect(opponents.every((opponent) => opponent.finishedAtSeconds !== null)).toBe(true);

    const results = getOpponentResults([
      { ...opponents[1], finishedAtSeconds: 91.2 },
      { ...opponents[0], finishedAtSeconds: null },
      { ...opponents[2], finishedAtSeconds: 88.6 },
    ]);

    expect(results).toEqual([
      { id: opponents[2].id, name: opponents[2].name, finishSeconds: 88.6 },
      { id: opponents[1].id, name: opponents[1].name, finishSeconds: 91.2 },
    ]);
  });
});
