import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_CHARACTER_ID,
  RACER_CHARACTERS,
  getCharacterById,
  getCharacterPerformance,
} from './characters';

describe('racer characters', () => {
  it('defines four tough character archetypes with unique selectable ids', () => {
    expect(RACER_CHARACTERS).toHaveLength(4);
    expect(new Set(RACER_CHARACTERS.map((character) => character.id)).size).toBe(RACER_CHARACTERS.length);
    expect(RACER_CHARACTERS.map((character) => character.id)).toEqual([
      'emberclaw-drake',
      'kage-viper',
      'iron-valkyrie',
      'void-revenant',
    ]);
    expect(RACER_CHARACTERS.map((character) => character.name)).toEqual([
      'Emberclaw Drake',
      'Kage Viper',
      'Iron Valkyrie',
      'Void Revenant',
    ]);
  });

  it('keeps stat cards bounded and gives every racer a real portrait asset', () => {
    for (const character of RACER_CHARACTERS) {
      expect(character.imageSrc).toMatch(/^\/images\/characters\/[-a-z]+\.jpg$/);
      expect(existsSync(join(process.cwd(), 'public', character.imageSrc))).toBe(true);
      expect(character.description.length).toBeGreaterThan(18);

      for (const value of Object.values(character.stats)) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(5);
      }
    }
  });

  it('resolves invalid ids to the default dragon racer', () => {
    const fallback = getCharacterById('unknown-racer');

    expect(DEFAULT_CHARACTER_ID).toBe('emberclaw-drake');
    expect(fallback.id).toBe(DEFAULT_CHARACTER_ID);
    expect(getCharacterById('kage-viper').name).toBe('Kage Viper');
  });

  it('maps character stats to distinct performance profiles', () => {
    const dragon = getCharacterPerformance(getCharacterById('emberclaw-drake'));
    const ninja = getCharacterPerformance(getCharacterById('kage-viper'));
    const revenant = getCharacterPerformance(getCharacterById('void-revenant'));

    expect(dragon.speedMultiplier).toBeGreaterThan(ninja.speedMultiplier);
    expect(ninja.accelerationMultiplier).toBeGreaterThan(dragon.accelerationMultiplier);
    expect(ninja.handlingMultiplier).toBeGreaterThan(dragon.handlingMultiplier);
    expect(revenant.boostMultiplier).toBeGreaterThan(dragon.boostMultiplier);
    expect(dragon.impactResistance).toBeGreaterThan(ninja.impactResistance);
  });
});
