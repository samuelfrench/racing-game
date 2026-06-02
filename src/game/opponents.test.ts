import { describe, expect, it } from 'vitest';
import { createDefaultTrack } from './track';
import { createOpponentGrid, getOpponentResults, stepOpponents } from './opponents';
import { sampleTrackCenterlineAtDistance } from './track-progress';

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
      expect(Number.isFinite(opponent.racingLineOffset)).toBe(true);
      expect(opponent.passingLineOffset).toBe(0);
      expect(opponent.lap).toBe(1);
      expect(opponent.finishedAtSeconds).toBeNull();
    }
  });

  it('starts opponents from rest with target speeds', () => {
    const opponents = createOpponentGrid(createDefaultTrack(), 1);

    expect(opponents.map((opponent) => opponent.speed)).toEqual([0, 0, 0]);
    expect(opponents.map((opponent) => opponent.targetSpeed)).toEqual([56, 54, 52]);
    expect(opponents.every((opponent) => opponent.acceleration > 0)).toBe(true);
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

  it('ramps opponent speed during the first racing second instead of jumping to target speed', () => {
    const track = createDefaultTrack();
    const opponents = createOpponentGrid(track, 1);
    const racing = stepOpponents(opponents, track, 1, true, 1);

    expect(racing[0].speed).toBeGreaterThan(0);
    expect(racing[0].speed).toBeLessThan(racing[0].targetSpeed);
    expect(racing[0].distanceTraveled).toBeLessThan(racing[0].targetSpeed);
  });

  it('ramps opponents toward their target pace over repeated racing steps', () => {
    const track = createDefaultTrack();
    let opponents = createOpponentGrid(track, 1);

    for (let i = 0; i < 240; i += 1) {
      opponents = stepOpponents(opponents, track, 1 / 60, true, (i + 1) / 60);
    }

    expect(opponents[0].speed).toBeGreaterThan(50);
    expect(opponents[0].speed).toBeLessThanOrEqual(opponents[0].targetSpeed);
  });

  it('moves opponents onto dynamic racing lines through upcoming corners', () => {
    const track = createDefaultTrack();
    const [, challenger] = createOpponentGrid(track, 1);
    const straightState = {
      ...challenger,
      speed: challenger.targetSpeed,
      distanceTraveled: 20,
    };
    const cornerEntryState = {
      ...challenger,
      speed: challenger.targetSpeed,
      distanceTraveled: 92,
    };

    const [straight] = stepOpponents([straightState], track, 1 / 60, true, 1);
    const [cornerEntry] = stepOpponents([cornerEntryState], track, 1 / 60, true, 1);
    const cornerCenterline = sampleTrackCenterlineAtDistance(track, cornerEntry.distanceTraveled);
    const cornerDistanceFromCenterline = Math.hypot(
      cornerEntry.position.x - cornerCenterline.position.x,
      cornerEntry.position.z - cornerCenterline.position.z,
    );

    expect(cornerEntry.racingLineOffset).toBeGreaterThan(straight.racingLineOffset + 1);
    expect(cornerDistanceFromCenterline).toBeCloseTo(Math.abs(cornerEntry.racingLineOffset), 1);
    expect(Math.abs(cornerEntry.racingLineOffset)).toBeLessThan(track.roadWidth * 0.5);
  });

  it('opens a passing line near the player without changing pace or pressure', () => {
    const track = createDefaultTrack();
    const [leader] = createOpponentGrid(track, 1);
    const nearPlayerState = {
      ...leader,
      speed: leader.targetSpeed - 1,
      distanceTraveled: 20,
    };

    const nearPlayer = stepOpponents([nearPlayerState], track, 1 / 60, true, 1, {
      playerDistance: 24,
    });
    const playerFarBehind = stepOpponents([nearPlayerState], track, 1 / 60, true, 1, {
      playerDistance: -40,
    });

    expect(nearPlayer[0].passingLineOffset).toBeLessThan(0);
    expect(Math.abs(nearPlayer[0].passingLineOffset)).toBeGreaterThan(1);
    expect(playerFarBehind[0].passingLineOffset).toBe(0);
    expect(Math.abs(nearPlayer[0].racingLineOffset)).toBeGreaterThan(Math.abs(playerFarBehind[0].racingLineOffset));
    expect(nearPlayer[0].speed).toBe(playerFarBehind[0].speed);
    expect(nearPlayer[0].pressureBonus).toBe(0);
    expect(playerFarBehind[0].pressureBonus).toBe(0);
  });

  it('adds passing pressure when the player opens a gap without changing base target speed', () => {
    const track = createDefaultTrack();
    const [leader] = createOpponentGrid(track, 1);
    const nearTarget = {
      ...leader,
      speed: leader.targetSpeed - 2,
      distanceTraveled: 140,
    };

    const baseline = stepOpponents([nearTarget], track, 0.5, true, 6);
    const pressured = stepOpponents([nearTarget], track, 0.5, true, 6, {
      playerDistance: 280,
    });
    const playerBehind = stepOpponents([nearTarget], track, 0.5, true, 6, {
      playerDistance: 110,
    });

    expect(baseline[0].speed).toBe(leader.targetSpeed);
    expect(baseline[0].pressureBonus).toBe(0);
    expect(baseline[0].peakPressureBonus).toBe(0);
    expect(pressured[0].targetSpeed).toBe(leader.targetSpeed);
    expect(pressured[0].pressureBonus).toBeGreaterThan(0);
    expect(pressured[0].pressureBonus).toBeLessThanOrEqual(7);
    expect(pressured[0].peakPressureBonus).toBe(pressured[0].pressureBonus);
    expect(pressured[0].speed).toBeGreaterThan(baseline[0].speed);
    expect(pressured[0].speed).toBeLessThanOrEqual(leader.targetSpeed + 7);
    expect(playerBehind[0].pressureBonus).toBe(0);
    expect(playerBehind[0].peakPressureBonus).toBe(0);
    expect(playerBehind[0].speed).toBe(leader.targetSpeed);
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
