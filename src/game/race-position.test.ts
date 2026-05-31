import { describe, expect, it } from 'vitest';
import type { RaceProgress } from './race';
import { createDefaultTrack, type TrackDefinition } from './track';
import { getTrackLapLength, sampleTrackCenterlineAtDistance } from './track-progress';
import { getPlayerRaceDistance, rankRaceParticipants } from './race-position';

const squareTrack: TrackDefinition = {
  name: 'Test Square',
  roadWidth: 10,
  shoulderWidth: 2,
  centerline: [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 10, z: 10 },
    { x: 0, z: 10 },
  ],
  checkpoints: [],
};

function raceProgress(overrides: Partial<RaceProgress> = {}): RaceProgress {
  return {
    totalLaps: 3,
    currentLap: 1,
    nextCheckpointIndex: 0,
    lapStartedAtSeconds: null,
    lastLapSeconds: null,
    bestLapSeconds: null,
    finished: false,
    ...overrides,
  };
}

describe('race position', () => {
  it('ranks unfinished racers by descending distance', () => {
    const ranking = rankRaceParticipants([
      { id: 'slow', name: 'Slow', distance: 20, finishedAtSeconds: null },
      { id: 'leader', name: 'Leader', distance: 62, finishedAtSeconds: null },
      { id: 'midfield', name: 'Midfield', distance: 41, finishedAtSeconds: null },
    ]);

    expect(ranking.position).toBe(3);
    expect(ranking.total).toBe(3);
    expect(ranking.participants.map((participant) => participant.id)).toEqual(['leader', 'midfield', 'slow']);
  });

  it('ranks finished racers by ascending finish time ahead of unfinished racers', () => {
    const ranking = rankRaceParticipants([
      { id: 'unfinished-leader', name: 'Unfinished Leader', distance: 999, finishedAtSeconds: null },
      { id: 'second', name: 'Second', distance: 120, finishedAtSeconds: 92.5 },
      { id: 'winner', name: 'Winner', distance: 120, finishedAtSeconds: 88.2 },
    ]);

    expect(ranking.participants.map((participant) => participant.id)).toEqual([
      'winner',
      'second',
      'unfinished-leader',
    ]);
  });

  it('puts the player first for deterministic exact-distance ties when playerId is provided', () => {
    const ranking = rankRaceParticipants(
      [
        { id: 'opponent-a', name: 'Opponent A', distance: 50, finishedAtSeconds: null },
        { id: 'player', name: 'Player', distance: 50, finishedAtSeconds: null },
        { id: 'opponent-b', name: 'Opponent B', distance: 50, finishedAtSeconds: null },
      ],
      'player',
    );

    expect(ranking.position).toBe(1);
    expect(ranking.participants.map((participant) => participant.id)).toEqual([
      'player',
      'opponent-a',
      'opponent-b',
    ]);
  });

  it('combines the player current lap and projected lap distance', () => {
    const distance = getPlayerRaceDistance({
      progress: raceProgress({ currentLap: 2 }),
      track: squareTrack,
      position: { x: 4, z: 3 },
    });

    expect(distance).toBe(44);
  });

  it('does not count the previous lap approach after crossing the start checkpoint', () => {
    const track = createDefaultTrack();
    const lapLength = getTrackLapLength(track);
    const sample = sampleTrackCenterlineAtDistance(track, lapLength - 10);
    const distance = getPlayerRaceDistance({
      progress: raceProgress({ currentLap: 2, nextCheckpointIndex: 1 }),
      track,
      position: sample.position,
    });

    expect(distance).toBeCloseTo(lapLength, 5);
    expect(distance).toBeLessThan(lapLength + track.checkpoints[0].radius);
  });
});
