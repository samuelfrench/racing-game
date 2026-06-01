export type DriftSmokeInput = {
  readonly speed: number;
  readonly drift: number;
  readonly handbrake: boolean;
  readonly deltaSeconds: number;
  readonly previousIntensity: number;
};

export type DriftSmokeEffect = {
  readonly intensity: number;
  readonly opacity: number;
  readonly scale: number;
  readonly visiblePuffs: number;
};

const idleEffect: DriftSmokeEffect = {
  intensity: 0,
  opacity: 0,
  scale: 1,
  visiblePuffs: 0,
};

export function computeDriftSmokeEffect(input: DriftSmokeInput): DriftSmokeEffect {
  const speed = finiteOr(input.speed, 0);
  const drift = finiteOr(input.drift, 0);
  const deltaSeconds = clamp(finiteOr(input.deltaSeconds, 0), 0, 0.25);
  const previousIntensity = clamp(finiteOr(input.previousIntensity, 0), 0, 1);
  const speedT = clamp(Math.abs(speed) / 46, 0, 1);
  const driftT = clamp(drift * 2.45, 0, 1);
  const handbrakeBoost = input.handbrake ? 0.22 : 0;
  const targetIntensity = clamp(speedT * driftT + handbrakeBoost * speedT, 0, 1);
  const responsiveness = targetIntensity > previousIntensity ? 8 : 5.2;
  const smoothing = 1 - Math.exp(-responsiveness * deltaSeconds);
  const intensity = round(lerp(previousIntensity, targetIntensity, smoothing), 4);

  if (intensity <= 0) {
    return idleEffect;
  }

  return {
    intensity,
    opacity: round(lerp(0.2, 0.5, Math.pow(intensity, 0.78)), 3),
    scale: round(lerp(1, 2.18, Math.pow(intensity, 0.86)), 3),
    visiblePuffs: Math.ceil(intensity * 6),
  };
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
