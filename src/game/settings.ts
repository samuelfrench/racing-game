import type { SpeedEffectState } from './speed-effects';

export type GraphicsQuality = 'high' | 'balanced' | 'low';
export type CameraMode = 'chase' | 'far' | 'hood';
export type TouchControlsMode = 'auto' | 'on' | 'off';

export type GameSettings = {
  readonly graphicsQuality: GraphicsQuality;
  readonly cameraMode: CameraMode;
  readonly masterVolume: number;
  readonly muted: boolean;
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
  readonly showControlHints: boolean;
  readonly touchControlsMode: TouchControlsMode;
};

export const DEFAULT_GAME_SETTINGS: GameSettings = Object.freeze({
  graphicsQuality: 'high',
  cameraMode: 'chase',
  masterVolume: 0.82,
  muted: false,
  reducedMotion: false,
  highContrast: false,
  showControlHints: true,
  touchControlsMode: 'auto',
});

export const GAME_SETTINGS_STORAGE_KEY = 'racing-game:settings';

export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

type GraphicsProfile = {
  readonly quality: GraphicsQuality;
  readonly pixelRatioCap: number;
  readonly speedStreaksVisible: number;
};

type CameraProfile = {
  readonly mode: CameraMode;
  readonly chaseDistance: number;
  readonly chaseHeight: number;
  readonly lookAhead: number;
  readonly targetHeight: number;
  readonly lerpSpeed: number;
  readonly targetLerpSpeed: number;
  readonly fovOffset: number;
};

const reducedMotionBaseCameraFov = 62;

const graphicsProfiles: Record<GraphicsQuality, GraphicsProfile> = {
  high: {
    quality: 'high',
    pixelRatioCap: 2,
    speedStreaksVisible: 12,
  },
  balanced: {
    quality: 'balanced',
    pixelRatioCap: 1.5,
    speedStreaksVisible: 8,
  },
  low: {
    quality: 'low',
    pixelRatioCap: 1,
    speedStreaksVisible: 4,
  },
};

const cameraProfiles: Record<CameraMode, CameraProfile> = {
  chase: {
    mode: 'chase',
    chaseDistance: 50,
    chaseHeight: 24,
    lookAhead: 46,
    targetHeight: 4.2,
    lerpSpeed: 6.4,
    targetLerpSpeed: 8.4,
    fovOffset: 0,
  },
  far: {
    mode: 'far',
    chaseDistance: 84,
    chaseHeight: 42,
    lookAhead: 42,
    targetHeight: 4.6,
    lerpSpeed: 4.6,
    targetLerpSpeed: 5.8,
    fovOffset: -1,
  },
  hood: {
    mode: 'hood',
    chaseDistance: -3.5,
    chaseHeight: 4.2,
    lookAhead: 72,
    targetHeight: 3.1,
    lerpSpeed: 9,
    targetLerpSpeed: 10,
    fovOffset: 6,
  },
};

export function sanitizeGameSettings(value: unknown): GameSettings {
  if (!isRecord(value)) {
    return DEFAULT_GAME_SETTINGS;
  }

  return {
    graphicsQuality: sanitizeGraphicsQuality(value.graphicsQuality),
    cameraMode: sanitizeCameraMode(value.cameraMode),
    masterVolume: sanitizeVolume(value.masterVolume),
    muted: sanitizeBoolean(value.muted, DEFAULT_GAME_SETTINGS.muted),
    reducedMotion: sanitizeBoolean(value.reducedMotion, DEFAULT_GAME_SETTINGS.reducedMotion),
    highContrast: sanitizeBoolean(value.highContrast, DEFAULT_GAME_SETTINGS.highContrast),
    showControlHints: sanitizeBoolean(
      value.showControlHints,
      DEFAULT_GAME_SETTINGS.showControlHints,
    ),
    touchControlsMode: sanitizeTouchControlsMode(value.touchControlsMode),
  };
}

export function readStoredGameSettings(storage: SettingsStorage | null | undefined): GameSettings {
  if (!storage) {
    return DEFAULT_GAME_SETTINGS;
  }

  try {
    const storedValue = storage.getItem(GAME_SETTINGS_STORAGE_KEY);
    if (storedValue === null) {
      return DEFAULT_GAME_SETTINGS;
    }
    return sanitizeGameSettings(JSON.parse(storedValue));
  } catch {
    return DEFAULT_GAME_SETTINGS;
  }
}

export function writeStoredGameSettings(
  storage: SettingsStorage | null | undefined,
  settings: GameSettings,
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(GAME_SETTINGS_STORAGE_KEY, JSON.stringify(sanitizeGameSettings(settings)));
  } catch {
    // Storage writes can fail in private browsing or restricted embeds. Settings remain in memory.
  }
}

export function resolveGraphicsProfile(
  settings: Pick<GameSettings, 'graphicsQuality'>,
): { quality: GraphicsQuality; pixelRatioCap: number; speedStreaksVisible: number } {
  return (
    graphicsProfiles[settings.graphicsQuality] ??
    graphicsProfiles[DEFAULT_GAME_SETTINGS.graphicsQuality]
  );
}

export function resolveCameraProfile(settings: Pick<GameSettings, 'cameraMode'>): {
  mode: CameraMode;
  chaseDistance: number;
  chaseHeight: number;
  lookAhead: number;
  targetHeight: number;
  lerpSpeed: number;
  targetLerpSpeed: number;
  fovOffset: number;
} {
  return cameraProfiles[settings.cameraMode] ?? cameraProfiles[DEFAULT_GAME_SETTINGS.cameraMode];
}

export function applyMotionSettings(
  settings: Pick<GameSettings, 'reducedMotion'>,
  effects: SpeedEffectState,
): SpeedEffectState {
  if (!settings.reducedMotion) {
    return effects;
  }

  return {
    intensity: roundToPrecision(effects.intensity * 0.4),
    cameraFov: effects.cameraFov + (reducedMotionBaseCameraFov - effects.cameraFov) * 0.25,
    vignetteOpacity: roundToPrecision(effects.vignetteOpacity * 0.45),
    streakOpacity: 0,
    roadPulse: 0,
  };
}

function sanitizeGraphicsQuality(value: unknown): GraphicsQuality {
  if (value === 'high' || value === 'balanced' || value === 'low') {
    return value;
  }
  return DEFAULT_GAME_SETTINGS.graphicsQuality;
}

function sanitizeCameraMode(value: unknown): CameraMode {
  if (value === 'chase' || value === 'far' || value === 'hood') {
    return value;
  }
  return DEFAULT_GAME_SETTINGS.cameraMode;
}

function sanitizeTouchControlsMode(value: unknown): TouchControlsMode {
  if (value === 'auto' || value === 'on' || value === 'off') {
    return value;
  }
  return DEFAULT_GAME_SETTINGS.touchControlsMode;
}

function sanitizeVolume(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_GAME_SETTINGS.masterVolume;
  }
  return clamp(value, 0, 1);
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToPrecision(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
