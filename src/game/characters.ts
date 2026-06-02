export type RacerCharacterId = 'emberclaw-drake' | 'kage-viper' | 'iron-valkyrie' | 'void-revenant';

export type RacerCharacterStats = {
  readonly speed: number;
  readonly launch: number;
  readonly grip: number;
  readonly boost: number;
  readonly impact: number;
};

export type RacerPerformanceProfile = {
  readonly speedMultiplier: number;
  readonly accelerationMultiplier: number;
  readonly handlingMultiplier: number;
  readonly gripMultiplier: number;
  readonly boostMultiplier: number;
  readonly boostFuelUseMultiplier: number;
  readonly boostFuelRecoveryMultiplier: number;
  readonly impactResistance: number;
};

export type RacerCharacter = {
  readonly id: RacerCharacterId;
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly imageSrc: string;
  readonly carColor: string;
  readonly accentColor: string;
  readonly stats: RacerCharacterStats;
  readonly performance: RacerPerformanceProfile;
};

export const DEFAULT_CHARACTER_ID: RacerCharacterId = 'emberclaw-drake';

export const RACER_CHARACTERS: readonly RacerCharacter[] = [
  {
    id: 'emberclaw-drake',
    name: 'Emberclaw Drake',
    title: 'Dragon Warlord',
    description: 'A flame-scarred bruiser built for brutal top speed and shrugging off contact.',
    imageSrc: '/images/characters/emberclaw-drake.jpg',
    carColor: '#c2410c',
    accentColor: '#facc15',
    stats: {
      speed: 5,
      launch: 3,
      grip: 3,
      boost: 3,
      impact: 5,
    },
    performance: {
      speedMultiplier: 1.18,
      accelerationMultiplier: 0.92,
      handlingMultiplier: 0.9,
      gripMultiplier: 1,
      boostMultiplier: 1,
      boostFuelUseMultiplier: 1,
      boostFuelRecoveryMultiplier: 0.96,
      impactResistance: 0.52,
    },
  },
  {
    id: 'kage-viper',
    name: 'Kage Viper',
    title: 'Ninja Apex Hunter',
    description: 'A razor-quick shadow racer with violent launches and surgical corner exits.',
    imageSrc: '/images/characters/kage-viper.jpg',
    carColor: '#111827',
    accentColor: '#22c55e',
    stats: {
      speed: 3,
      launch: 5,
      grip: 5,
      boost: 3,
      impact: 2,
    },
    performance: {
      speedMultiplier: 0.98,
      accelerationMultiplier: 1.24,
      handlingMultiplier: 1.23,
      gripMultiplier: 1.18,
      boostMultiplier: 0.96,
      boostFuelUseMultiplier: 0.98,
      boostFuelRecoveryMultiplier: 1.05,
      impactResistance: 0.18,
    },
  },
  {
    id: 'iron-valkyrie',
    name: 'Iron Valkyrie',
    title: 'Armored Storm Captain',
    description: 'A steel-nerved brawler with stable grip, heavy launches, and balanced boost control.',
    imageSrc: '/images/characters/iron-valkyrie.jpg',
    carColor: '#64748b',
    accentColor: '#38bdf8',
    stats: {
      speed: 4,
      launch: 4,
      grip: 4,
      boost: 3,
      impact: 4,
    },
    performance: {
      speedMultiplier: 1.08,
      accelerationMultiplier: 1.08,
      handlingMultiplier: 1.03,
      gripMultiplier: 1.1,
      boostMultiplier: 1.02,
      boostFuelUseMultiplier: 0.92,
      boostFuelRecoveryMultiplier: 1,
      impactResistance: 0.42,
    },
  },
  {
    id: 'void-revenant',
    name: 'Void Revenant',
    title: 'Nitro Phantom',
    description: 'A haunted speed fiend that bends every straightaway around savage boost bursts.',
    imageSrc: '/images/characters/void-revenant.jpg',
    carColor: '#581c87',
    accentColor: '#e879f9',
    stats: {
      speed: 4,
      launch: 4,
      grip: 3,
      boost: 5,
      impact: 3,
    },
    performance: {
      speedMultiplier: 1.02,
      accelerationMultiplier: 1.05,
      handlingMultiplier: 1,
      gripMultiplier: 0.98,
      boostMultiplier: 1.3,
      boostFuelUseMultiplier: 0.68,
      boostFuelRecoveryMultiplier: 1.25,
      impactResistance: 0.3,
    },
  },
] as const;

const defaultCharacter = RACER_CHARACTERS[0];

export function getCharacterById(id: string | null | undefined): RacerCharacter {
  return RACER_CHARACTERS.find((character) => character.id === id) ?? defaultCharacter;
}

export function getCharacterPerformance(character: RacerCharacter): RacerPerformanceProfile {
  return character.performance;
}
