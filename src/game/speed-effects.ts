export type SpeedEffectInput = {
  readonly speed: number;
  readonly drift: number;
  readonly boostActive: boolean;
  readonly deltaSeconds: number;
  readonly previousIntensity: number;
};

export type SpeedEffectState = {
  readonly intensity: number;
  readonly cameraFov: number;
  readonly vignetteOpacity: number;
  readonly streakOpacity: number;
  readonly roadPulse: number;
};

const baseCameraFov = 62;
const maxCameraFov = 72;
const speedEffectReferenceSpeed = 76;

export function computeSpeedEffects(input: SpeedEffectInput): SpeedEffectState {
  const deltaSeconds = clamp(input.deltaSeconds, 0, 0.25);
  const speedT = clamp(Math.abs(input.speed) / speedEffectReferenceSpeed, 0, 1);
  const driftT = clamp(input.drift * 2.2, 0, 0.24);
  const boostT = input.boostActive ? 0.16 : 0;
  const targetIntensity = clamp(speedT * 0.82 + driftT + boostT, 0, 1);
  const responsiveness = targetIntensity > input.previousIntensity ? 9 : 4.5;
  const smoothing = 1 - Math.exp(-responsiveness * deltaSeconds);
  const intensity = lerp(clamp(input.previousIntensity, 0, 1), targetIntensity, smoothing);

  return {
    intensity,
    cameraFov: Math.round(lerp(baseCameraFov, maxCameraFov, intensity) * 100) / 100,
    vignetteOpacity: Math.round(lerp(0, 0.38, intensity) * 1000) / 1000,
    streakOpacity: Math.round(lerp(0, 0.78, intensity) * 1000) / 1000,
    roadPulse: Math.round(Math.pow(intensity, 0.72) * 1000) / 1000,
  };
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
