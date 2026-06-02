import * as THREE from 'three';
import './styles.css';
import { resolveInputFromKeys, type ControlInput } from './game/input';
import { createRaceProgress, updateRaceProgress, type RaceProgress } from './game/race';
import {
  createRaceSession,
  finishRace,
  requestRaceStart,
  resetRaceSession,
  stepRaceSession,
  type RacePhase,
  type RaceResult,
  type RaceSession,
} from './game/race-session';
import { createOpponentGrid, getOpponentResults, stepOpponents, type OpponentState } from './game/opponents';
import {
  createDefaultTrack,
  sampleTrackFeatureEffects,
  sampleTrackSurface,
  type TrackBoostPad,
  type TrackDefinition,
  type TrackFeatureEffects,
  type TrackGrossHazard,
  type TrackObstacle,
  type TrackPoint,
} from './game/track';
import {
  getTrackLapLength,
  projectPointOntoTrack,
  sampleTrackCenterlineAtDistance,
  type TrackProjection,
} from './game/track-progress';
import { computeSpeedEffects, type SpeedEffectState } from './game/speed-effects';
import { computeDriftSmokeEffect, type DriftSmokeEffect } from './game/drift-smoke';
import { createInitialVehicleState, stepVehicle, type VehicleState } from './game/vehicle';
import { createRaceAudioEngine, type RaceAudioDebugState } from './game/audio-engine';
import {
  collectRaceAudioCues,
  writeRaceAudioMix,
  writeRaceAudioSnapshot,
  type RaceAudioMixTarget,
  type RaceAudioSnapshotTarget,
} from './game/audio-state';
import {
  applyMotionSettings,
  DEFAULT_GAME_SETTINGS,
  readStoredGameSettings,
  resolveCameraProfile,
  resolveGraphicsProfile,
  writeStoredGameSettings,
  type CameraMode,
  type GameSettings,
  type GraphicsQuality,
  type SettingsStorage,
  type TouchControlsMode,
} from './game/settings';
import {
  TOUCH_ACTIONS,
  clearTouchAction,
  clearTouchControls,
  createTouchControlState,
  getActiveTouchActions,
  mergeControlInputs,
  resolveTouchInput,
  setTouchActionActive,
  shouldShowTouchControls,
  type TouchAction,
} from './game/touch-controls';
import {
  getPlayerRaceDistance,
  rankRaceParticipants,
  type RacePositionState,
} from './game/race-position';
import { createRaceAwareness, type RaceAwarenessState } from './game/race-awareness';
import {
  createOpponentBumpDebugState,
  createOpponentBumpState,
  resolveOpponentBumps,
  type OpponentBumpDebugState,
  type OpponentBumpState,
} from './game/opponent-bumps';
import {
  createTrackFeedbackState,
  updateTrackFeedback,
  type TrackFeedbackState,
} from './game/track-feedback';
import { createRaceTimingDisplay, type RaceTimingDisplayState } from './game/race-timing';
import { createRaceSplitSummary, type RaceSplitSummaryState } from './game/race-summary';
import {
  completeGhostReplayLap,
  createGhostReplayState,
  createGhostReplayStatus,
  recordGhostReplaySample,
  resetGhostReplayRecording,
  sampleGhostReplay,
  type GhostReplayPose,
  type GhostReplayState,
  type GhostReplayStatusState,
} from './game/ghost-replay';
import {
  RACER_CHARACTERS,
  getCharacterById,
  getCharacterPerformance,
  type RacerCharacter,
} from './game/characters';

type HudElements = {
  lap: HTMLElement;
  boostMeter: HTMLElement;
  speed: HTMLElement;
  checkpoint: HTMLElement;
  lapTime: HTMLElement;
  bestLap: HTMLElement;
  sectorLabelText: HTMLElement;
  sectorLabel: HTMLElement;
  sectorTime: HTMLElement;
  sectorDelta: HTMLElement;
  racePosition: HTMLElement;
  raceGap: HTMLElement;
  ghostStatus: HTMLElement;
  minimapCanvas: HTMLCanvasElement;
  raceStatus: HTMLElement;
  resultsPanel: HTMLElement;
  resultsList: HTMLOListElement;
  splitSummary: HTMLElement;
  lapSplits: HTMLElement;
  sectorSplits: HTMLElement;
  startPanel: HTMLElement;
  startButton: HTMLButtonElement;
  speedVignette: HTMLElement;
  grossOverlay: HTMLElement;
  grossOverlayLabel: HTMLElement;
};

type CharacterSelectionElements = {
  grid: HTMLElement;
  panel: HTMLElement;
  portrait: HTMLImageElement;
  name: HTMLElement;
  title: HTMLElement;
  description: HTMLElement;
  stats: HTMLElement;
};

type SettingsElements = {
  button: HTMLButtonElement;
  panel: HTMLElement;
  graphicsQuality: HTMLSelectElement;
  cameraMode: HTMLSelectElement;
  touchControlsMode: HTMLSelectElement;
  masterVolume: HTMLInputElement;
  muted: HTMLInputElement;
  reducedMotion: HTMLInputElement;
  highContrast: HTMLInputElement;
  showControlHints: HTMLInputElement;
  close: HTMLButtonElement;
  reset: HTMLButtonElement;
  controlHints: HTMLElement;
};

type TouchControlElements = {
  overlay: HTMLElement;
  buttons: Record<TouchAction, HTMLButtonElement>;
};

type GraphicsProfile = ReturnType<typeof resolveGraphicsProfile>;
type CameraProfile = ReturnType<typeof resolveCameraProfile>;
type RacerPerformanceProfile = ReturnType<typeof getCharacterPerformance>;

type CharacterDebugState = {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly imageSrc: string;
  readonly carColor: string;
  readonly accentColor: string;
  readonly stats: RacerCharacter['stats'];
  readonly performance: RacerPerformanceProfile;
};

type DebugState = {
  running: boolean;
  phase: RacePhase;
  countdownSeconds: number;
  frame: number;
  speed: number;
  character: CharacterDebugState;
  trackFeedback: TrackFeedbackState;
  trackFeatures: TrackFeatureDebugState;
  grossEffects: GrossEffectsDebugState;
  lap: number;
  checkpoint: string;
  carX: number;
  carZ: number;
  carHeading: number;
  speedEffects: Pick<SpeedEffectState, 'intensity' | 'cameraFov' | 'vignetteOpacity' | 'streakOpacity'>;
  driftSmoke: DriftSmokeEffect;
  audio: RaceAudioDebugState;
  trackArt: TrackArtDebug;
  settings: GameSettings;
  graphics: {
    readonly quality: GraphicsQuality;
    readonly pixelRatioCap: number;
    readonly speedStreaksVisible: number;
    readonly rendererPixelRatio: number;
  };
  camera: {
    readonly mode: CameraMode;
    readonly chaseDistance: number;
    readonly chaseHeight: number;
    readonly lookAhead: number;
    readonly targetHeight: number;
    readonly fov: number;
  };
  controlHintsVisible: boolean;
  touchControls: {
    readonly visible: boolean;
    readonly mode: TouchControlsMode;
    readonly activeActions: readonly TouchAction[];
    readonly input: ControlInput;
  };
  racePosition: RacePositionState;
  raceAwareness: RaceAwarenessState;
  timing: RaceTimingDisplayState;
  splitSummary: RaceSplitSummaryState;
  ghostReplay: GhostReplayDebugState;
  minimap: MinimapDebugState;
  opponents: readonly DebugOpponent[];
  opponentBumps: OpponentBumpDebugState;
  results: readonly RaceResult[];
};

const characterStatLabels: ReadonlyArray<{
  readonly key: keyof RacerCharacter['stats'];
  readonly label: string;
}> = [
  { key: 'speed', label: 'Speed' },
  { key: 'launch', label: 'Launch' },
  { key: 'grip', label: 'Grip' },
  { key: 'boost', label: 'Boost' },
  { key: 'impact', label: 'Impact' },
];

type MinimapMarkerDebug = {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly color: string;
  readonly kind: 'player' | 'opponent' | 'ghost';
  readonly rank: number;
  readonly heading: number;
  readonly label: string;
};

type MinimapDebugState = {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly progressRatio: number;
  readonly markers: readonly MinimapMarkerDebug[];
};

type DebugOpponent = {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly lap: number;
  readonly speed: number;
  readonly targetSpeed: number;
  readonly pressureBonus: number;
  readonly peakPressureBonus: number;
  readonly racingLineOffset: number;
  readonly passingLineOffset: number;
  readonly finishedAtSeconds: number | null;
};

type GhostReplayDebugState = {
  readonly status: GhostReplayStatusState;
  readonly visible: boolean;
  readonly currentSampleCount: number;
  readonly bestSampleCount: number;
  readonly bestLapSeconds: number | null;
  readonly x: number | null;
  readonly z: number | null;
  readonly heading: number | null;
  readonly visualAid: GhostReplayVisualAidDebugState;
};

type GhostReplayVisualAidDebugState = {
  visible: boolean;
  opacity: number;
  scale: number;
  readonly color: '#36f1ff';
};

type GhostVisualAid = {
  readonly mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  readonly material: THREE.MeshBasicMaterial;
};

type DriftSmokeVisual = {
  readonly group: THREE.Group;
  readonly puffs: readonly THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[];
};

type TrackArtDebug = {
  readonly chevrons: number;
  readonly crowdPanels: number;
  readonly lightMasts: number;
  readonly speedStreaks: number;
  readonly finishMarkers: number;
  readonly boostPads: number;
  readonly obstacles: number;
  readonly grossHazards: {
    readonly peeSprayers: number;
    readonly poopLogs: number;
  };
  readonly startLights: StartLightDebug;
};

type StartLightDebug = {
  readonly activeRedLights: number;
  readonly greenLit: boolean;
  readonly state: 'idle' | 'countdown' | 'go';
};

type TrackFeatureDebugState = {
  readonly activeBoostPadId: string | null;
  readonly activeObstacleId: string | null;
  readonly activeGrossHazardId: string | null;
  readonly lastBoostPadId: string | null;
  readonly lastObstacleId: string | null;
  readonly boostIntensity: number;
  readonly obstacleSeverity: number;
  readonly lastObstacleSpeedDelta: number;
  readonly grossHazardKind: 'peeSprayer' | 'poopLog' | null;
};

type GrossEffectsDebugState = {
  readonly activeEffect: 'none' | 'pee' | 'poop';
  readonly peeOverlayOpacity: number;
  readonly poopOverlayOpacity: number;
  readonly jumpActive: boolean;
  readonly jumpHeight: number;
  readonly peeSplashes: number;
  readonly poopFalls: number;
  readonly poopJumps: number;
  readonly lastPeeHazardId: string | null;
  readonly lastPoopHazardId: string | null;
  readonly lastPoopOutcome: 'none' | 'jumped' | 'fell';
};

type GrossEffectsState = GrossEffectsDebugState & {
  readonly peeOverlaySeconds: number;
  readonly poopOverlaySeconds: number;
  readonly poopFallSeconds: number;
  readonly jumpSeconds: number;
  readonly jumpCooldownSeconds: number;
  readonly grossHazardCooldownSeconds: number;
  readonly grossHazardCooldownId: string | null;
  readonly previousJumpPressed: boolean;
};

type TrackArtMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
type StartLightMesh = THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;

type AnimatedTrackArt = {
  readonly crowdPanels: readonly TrackArtMesh[];
  readonly lightMasts: readonly TrackArtMesh[];
  readonly speedStreaks: readonly TrackArtMesh[];
  readonly startLights: {
    readonly redLights: readonly StartLightMesh[];
    readonly greenLight: StartLightMesh;
  };
  readonly debug: TrackArtDebug;
};

declare global {
  interface Window {
    __racingGameDebug?: DebugState;
    __racingGameTestControls?: {
      finishRace: () => void;
      placeOnBoostPad: (index?: number) => void;
      placeOnObstacle: (index?: number) => void;
      placeOnGrossHazard: (kind: 'peeSprayer' | 'poopLog') => void;
      placeNearOpponent: (index?: number) => void;
    };
  }
}

const canvas = mustGet<HTMLCanvasElement>('game-canvas');
const hud = {
  lap: mustGet('lap'),
  boostMeter: mustGet('boost-meter'),
  speed: mustGet('speed'),
  checkpoint: mustGet('checkpoint'),
  lapTime: mustGet('lap-time'),
  bestLap: mustGet('best-lap'),
  sectorLabelText: mustGet('sector-label-text'),
  sectorLabel: mustGet('sector-label'),
  sectorTime: mustGet('sector-time'),
  sectorDelta: mustGet('sector-delta'),
  racePosition: mustGet('race-position'),
  raceGap: mustGet('race-gap'),
  ghostStatus: mustGet('ghost-status'),
  minimapCanvas: mustGet<HTMLCanvasElement>('minimap-canvas'),
  raceStatus: mustGet('race-status'),
  resultsPanel: mustGet('results-panel'),
  resultsList: mustGet<HTMLOListElement>('results-list'),
  splitSummary: mustGet('split-summary'),
  lapSplits: mustGet('lap-splits'),
  sectorSplits: mustGet('sector-splits'),
  startPanel: mustGet('start-panel'),
  startButton: mustGet<HTMLButtonElement>('start-button'),
  speedVignette: mustGet('speed-vignette'),
  grossOverlay: mustGet('gross-overlay'),
  grossOverlayLabel: mustGet('gross-overlay-label'),
} satisfies HudElements;
const characterElements = {
  grid: mustGet('character-grid'),
  panel: mustGet('selected-character-panel'),
  portrait: mustGet<HTMLImageElement>('selected-character-portrait'),
  name: mustGet('selected-character-name'),
  title: mustGet('selected-character-title'),
  description: mustGet('selected-character-description'),
  stats: mustGet('selected-character-stats'),
} satisfies CharacterSelectionElements;
const settingsElements = {
  button: mustGet<HTMLButtonElement>('settings-button'),
  panel: mustGet('settings-panel'),
  graphicsQuality: mustGet<HTMLSelectElement>('graphics-quality'),
  cameraMode: mustGet<HTMLSelectElement>('camera-mode'),
  touchControlsMode: mustGet<HTMLSelectElement>('touch-controls-mode'),
  masterVolume: mustGet<HTMLInputElement>('master-volume'),
  muted: mustGet<HTMLInputElement>('audio-muted'),
  reducedMotion: mustGet<HTMLInputElement>('reduced-motion'),
  highContrast: mustGet<HTMLInputElement>('high-contrast'),
  showControlHints: mustGet<HTMLInputElement>('show-control-hints'),
  close: mustGet<HTMLButtonElement>('settings-close'),
  reset: mustGet<HTMLButtonElement>('settings-reset'),
  controlHints: mustGet('control-hints'),
} satisfies SettingsElements;
const touchControls = {
  overlay: mustGet('touch-controls'),
  buttons: {
    left: mustGet<HTMLButtonElement>('touch-left'),
    right: mustGet<HTMLButtonElement>('touch-right'),
    throttle: mustGet<HTMLButtonElement>('touch-throttle'),
    brake: mustGet<HTMLButtonElement>('touch-brake'),
    drift: mustGet<HTMLButtonElement>('touch-drift'),
    boost: mustGet<HTMLButtonElement>('touch-boost'),
    jump: mustGet<HTMLButtonElement>('touch-jump'),
  },
} satisfies TouchControlElements;

const track = createDefaultTrack();
const minimapContext = getMinimapContext();
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.debug.checkShaderErrors = false;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const sceneColor = new THREE.Color();
scene.fog = new THREE.FogExp2(0x071017, 0.0048);

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 950);
const keys = new Set<string>();
const touchState = createTouchControlState();
let touchControlsVisible = false;
const checkpointMeshes = new Map<string, THREE.Object3D>();
const startPose = getStartPose(track);
const characterStorageKey = 'neon-harbor-gp.character';
let vehicle = createVehicleAtStart();
let progress = createRaceProgress(track.checkpoints, 3);
let session: RaceSession = createRaceSession();
let trackFeedback = createTrackFeedbackState();
let trackFeatures: TrackFeatureDebugState = createTrackFeatureDebugState();
let grossEffects: GrossEffectsState = createGrossEffectsState();
let opponents: readonly OpponentState[] = createOpponentGrid(track, progress.totalLaps);
let opponentBumps: OpponentBumpState = createOpponentBumpState();
let running = false;
let elapsedSeconds = 0;
let frame = 0;
let racePosition: RacePositionState = rankRaceParticipants([]);
let raceAwareness: RaceAwarenessState = createRaceAwareness(racePosition);
let timingDisplay: RaceTimingDisplayState = createRaceTimingDisplay(progress, track.checkpoints.length, elapsedSeconds);
let splitSummaryDisplay: RaceSplitSummaryState = createRaceSplitSummary(progress);
let ghostReplay: GhostReplayState = createGhostReplayState();
let ghostReplayStatus: GhostReplayStatusState = createGhostReplayStatus(ghostReplay);
let ghostPose: GhostReplayPose | null = null;
let minimapDebug: MinimapDebugState = {
  canvasWidth: hud.minimapCanvas.width,
  canvasHeight: hud.minimapCanvas.height,
  progressRatio: 0,
  markers: [],
};
let lastFrameTimestamp = performance.now();
let renderedResultsKey = '';
let cachedSettingsStorage: SettingsStorage | null | undefined;
let settings: GameSettings = readStoredGameSettings(getSettingsStorage());
let selectedCharacter: RacerCharacter = readStoredCharacter(getSettingsStorage());
let graphicsProfile: GraphicsProfile = resolveGraphicsProfile(settings);
let cameraProfile: CameraProfile = resolveCameraProfile(settings);
let speedEffects: SpeedEffectState = computeSpeedEffects({
  speed: 0,
  drift: 0,
  boostActive: false,
  deltaSeconds: 0,
  previousIntensity: 0,
});
let driftSmokeEffect: DriftSmokeEffect = computeDriftSmokeEffect({
  speed: 0,
  drift: 0,
  handbrake: false,
  deltaSeconds: 0,
  previousIntensity: 0,
});
const audioEngine = createRaceAudioEngine();
const audioMixInput = {
  phase: session.phase,
  speed: 0,
  drift: 0,
  boostActive: false,
};
const audioMix: RaceAudioMixTarget = {
  masterGain: 0.16,
  engineFrequency: 72,
  engineGain: 0,
  skidGain: 0,
  boostGain: 0,
};
const audioSnapshotInput: RaceAudioSnapshotTarget = {
  phase: session.phase,
  lap: progress.currentLap,
  checkpoint: 'finish',
};
const currentAudioSnapshot: RaceAudioSnapshotTarget = {
  phase: session.phase,
  lap: progress.currentLap,
  checkpoint: 'finish',
};
const lastAudioSnapshot: RaceAudioSnapshotTarget = {
  phase: session.phase,
  lap: progress.currentLap,
  checkpoint: 'finish',
};
writeCurrentAudioSnapshot(currentAudioSnapshot);
writeRaceAudioSnapshot(lastAudioSnapshot, currentAudioSnapshot);

const ghostVisualAidState: GhostReplayVisualAidDebugState = {
  visible: false,
  opacity: 0,
  scale: 1,
  color: '#36f1ff',
};
const world = buildWorld(track);
const trackArt = addTracksideObjects(world, track);
scene.add(world);
const car = buildCar(selectedCharacter.carColor, selectedCharacter.accentColor);
scene.add(car);
const driftSmoke = buildDriftSmokeVisual();
car.add(driftSmoke.group);
const ghostCar = buildGhostCar();
scene.add(ghostCar);
const ghostVisualAid = buildGhostVisualAid();
ghostCar.add(ghostVisualAid.mesh);
const opponentMeshes = opponents.map((opponent) => {
  const opponentCar = buildCar(opponent.color);
  opponentCar.scale.setScalar(0.92);
  scene.add(opponentCar);
  return opponentCar;
});
const followTarget = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const cameraPosition = new THREE.Vector3(startPose.x, 38, startPose.z - 58);

setupSettings();
setupCharacterSelection();
setupTouchControls();
applyRuntimeSettings();
updateRaceAwareness();
window.__racingGameDebug = createDebugState();
setupInput();
setupStartButton();
setupDevTestControls();
resize();
window.addEventListener('resize', handleResize);
requestAnimationFrame(loop);

function loop(timestamp = performance.now()): void {
  const deltaSeconds = Math.min((timestamp - lastFrameTimestamp) / 1000, 0.05);
  lastFrameTimestamp = timestamp;
  frame += 1;

  if (session.phase === 'countdown') {
    session = stepRaceSession(session, deltaSeconds);
  }

  const input = readInput();
  grossEffects = stepGrossEffects(grossEffects, input, deltaSeconds, session.phase === 'racing');
  const featureEffects = session.phase === 'racing'
    ? sampleTrackFeatureEffects(track, vehicle.position.x, vehicle.position.z)
    : { boostPad: null, obstacle: null, grossHazard: null };
  trackFeatures = updateTrackFeatureDebugState(trackFeatures, featureEffects, 0);
  grossEffects = handleGrossHazard(grossEffects, featureEffects.grossHazard);
  const manualBoostActive = input.boost && input.throttle > 0 && vehicle.boostFuel > 0;
  const padBoostActive = trackFeatures.boostIntensity > 0 && input.throttle > 0;
  const boostActive = session.phase === 'racing' && (manualBoostActive || padBoostActive);
  speedEffects = applyMotionSettings(
    settings,
    computeSpeedEffects({
      speed: vehicle.speed,
      drift: vehicle.drift,
      boostActive,
      deltaSeconds,
      previousIntensity: speedEffects.intensity,
    }),
  );
  driftSmokeEffect = computeDriftSmokeEffect({
    speed: session.phase === 'racing' ? vehicle.speed : 0,
    drift: session.phase === 'racing' ? vehicle.drift : 0,
    handbrake: session.phase === 'racing' && input.handbrake,
    deltaSeconds,
    previousIntensity: driftSmokeEffect.intensity,
  });

  if (session.phase === 'racing') {
    elapsedSeconds += deltaSeconds;
    const surface = sampleTrackSurface(track, vehicle.position.x, vehicle.position.z);
    vehicle = stepVehicle(vehicle, {
      ...input,
      deltaSeconds,
      boostIntensity: trackFeatures.boostIntensity,
      trackGrip: surface.grip,
      performance: getCharacterPerformance(selectedCharacter),
    });
    const obstacleResult = applyObstaclePenalty(vehicle, trackFeatures.obstacleSeverity, deltaSeconds);
    vehicle = obstacleResult.vehicle;
    trackFeatures = {
      ...trackFeatures,
      lastObstacleSpeedDelta: obstacleResult.speedDelta,
    };
    vehicle = applyGrossFallPenalty(vehicle, grossEffects, deltaSeconds);
    const playerDistanceBeforeBump = getPlayerRaceDistance({ progress, track, position: vehicle.position });
    opponents = stepOpponents(opponents, track, deltaSeconds, true, elapsedSeconds, {
      playerDistance: playerDistanceBeforeBump,
    });
    const bumpResult = resolveOpponentBumps(vehicle, opponents, opponentBumps, deltaSeconds, {
      impactResistance: getCharacterPerformance(selectedCharacter).impactResistance,
    });
    vehicle = bumpResult.vehicle;
    opponentBumps = bumpResult.state;
    const feedbackResult = updateTrackFeedback(trackFeedback, {
      track,
      vehicle,
      deltaSeconds,
      racing: session.phase === 'racing',
    });
    trackFeedback = feedbackResult.state;
    vehicle = feedbackResult.vehicle;
    const previousProgress = progress;
    recordGhostReplayFrame(previousProgress);
    progress = updateRaceProgress(progress, track.checkpoints, vehicle.position, elapsedSeconds);
    completeGhostReplayLapIfNeeded(previousProgress);

    if (progress.finished) {
      const playerResult: RaceResult = {
        id: 'player',
        name: 'You',
        finishSeconds: elapsedSeconds,
      };
      const finishDistance = getTrackLapLength(track) * progress.totalLaps;
      opponents = finishRemainingOpponents(opponents, elapsedSeconds, finishDistance);
      session = finishRace(session, [playerResult, ...getOpponentResults(opponents)]);
      running = false;
      updateTouchControlsVisibility();
    }
  }
  if (session.phase !== 'racing') {
    trackFeedback = createTrackFeedbackState();
    opponentBumps = createOpponentBumpState();
  }

  updateCarMesh(car, vehicle);
  updateDriftSmoke(deltaSeconds);
  updateOpponentMeshes();
  updateGhostReplayMesh();
  updateCheckpoints(progress);
  updateCamera(deltaSeconds);
  updateSpeedEffects();
  updateGrossOverlay();
  animateTrackArt(deltaSeconds);
  updateStartLights();
  updateHud(progress, vehicle);
  updateRaceAwareness();
  updateResultsBoard();
  updateRaceAudio(boostActive);
  window.__racingGameDebug = createDebugState();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function buildWorld(trackDefinition: TrackDefinition): THREE.Group {
  const group = new THREE.Group();

  const sun = new THREE.DirectionalLight(0xfff5d7, 2.9);
  sun.position.set(-70, 120, -45);
  group.add(sun);
  group.add(new THREE.HemisphereLight(0x80e7ff, 0x11161d, 1.8));

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x122024 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(210, 160),
    new THREE.MeshBasicMaterial({
      color: 0x0a4a5f,
    }),
  );
  water.position.set(158, 0.03, 146);
  water.rotation.x = -Math.PI / 2;
  group.add(water);

  addTrackMesh(group, trackDefinition);
  addCheckpointGates(group, trackDefinition);
  addSkyline(group);
  return group;
}

function addTrackMesh(group: THREE.Group, trackDefinition: TrackDefinition): void {
  const roadMaterial = new THREE.MeshBasicMaterial({ color: 0x191f23 });
  const shoulderMaterial = new THREE.MeshBasicMaterial({ color: 0x273137 });
  const stripeMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff1a8,
  });
  const railMaterial = new THREE.MeshBasicMaterial({ color: 0x78e9ff });

  forEachSegment(trackDefinition.centerline, (start, end) => {
    group.add(segmentBox(start, end, trackDefinition.roadWidth + trackDefinition.shoulderWidth * 2, 0.12, 0.05, shoulderMaterial));
    group.add(segmentBox(start, end, trackDefinition.roadWidth, 0.14, 0.09, roadMaterial));
    group.add(segmentBox(start, end, 0.62, 0.16, 0.18, stripeMaterial, 0, 0.48));
    group.add(edgeRail(start, end, trackDefinition.roadWidth * 0.5 + 2.2, railMaterial));
    group.add(edgeRail(start, end, -(trackDefinition.roadWidth * 0.5 + 2.2), railMaterial));
  });

  for (const point of trackDefinition.centerline) {
    const shoulder = new THREE.Mesh(
      new THREE.CylinderGeometry(trackDefinition.roadWidth * 0.5 + trackDefinition.shoulderWidth, trackDefinition.roadWidth * 0.5 + trackDefinition.shoulderWidth, 0.12, 36),
      shoulderMaterial,
    );
    shoulder.position.set(point.x, 0.05, point.z);
    group.add(shoulder);

    const road = new THREE.Mesh(new THREE.CylinderGeometry(trackDefinition.roadWidth * 0.5, trackDefinition.roadWidth * 0.5, 0.14, 36), roadMaterial);
    road.position.set(point.x, 0.09, point.z);
    road.receiveShadow = true;
    group.add(road);
  }
}

function addCheckpointGates(group: THREE.Group, trackDefinition: TrackDefinition): void {
  for (const checkpoint of trackDefinition.checkpoints) {
    const gate = new THREE.Group();
    gate.name = `checkpoint-${checkpoint.id}`;
    const material = new THREE.MeshBasicMaterial({
      color: 0x36f1ff,
    });
    const postGeometry = new THREE.BoxGeometry(1.2, 12, 1.2);
    const archGeometry = new THREE.BoxGeometry(trackDefinition.roadWidth * 0.92, 1.1, 1.1);
    const leftPost = new THREE.Mesh(postGeometry, material);
    const rightPost = new THREE.Mesh(postGeometry, material);
    const arch = new THREE.Mesh(archGeometry, material);
    leftPost.position.set(-trackDefinition.roadWidth * 0.44, 6, 0);
    rightPost.position.set(trackDefinition.roadWidth * 0.44, 6, 0);
    arch.position.set(0, 12, 0);
    gate.add(leftPost, rightPost, arch);
    gate.position.set(checkpoint.x, 0, checkpoint.z);
    gate.rotation.y = checkpointHeading(trackDefinition, checkpoint.id) + Math.PI / 2;
    checkpointMeshes.set(checkpoint.id, gate);
    group.add(gate);
  }
}

function addSkyline(group: THREE.Group): void {
  const materials = [
    new THREE.MeshBasicMaterial({ color: 0x182b37 }),
    new THREE.MeshBasicMaterial({ color: 0x27313f }),
    new THREE.MeshBasicMaterial({ color: 0x13242d }),
  ];

  for (let i = 0; i < 28; i += 1) {
    const width = 10 + seededNoise(i * 3.1) * 12;
    const depth = 9 + seededNoise(i * 4.7) * 15;
    const height = 18 + seededNoise(i * 8.3) * 58;
    const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials[i % materials.length]);
    building.position.set(-236 + i * 18, height * 0.5, -224 + seededNoise(i * 1.7) * 28);
    building.castShadow = true;
    building.receiveShadow = true;
    group.add(building);
  }
}

function addTracksideObjects(group: THREE.Group, trackDefinition: TrackDefinition): AnimatedTrackArt {
  const coneMaterial = new THREE.MeshBasicMaterial({ color: 0xff6b3a });
  const bannerMaterials = [
    new THREE.MeshBasicMaterial({ color: 0xff4f7b }),
    new THREE.MeshBasicMaterial({ color: 0x36f1ff }),
    new THREE.MeshBasicMaterial({ color: 0xffe66b }),
  ];
  const crowdMaterials = [
    new THREE.MeshBasicMaterial({ color: 0x36f1ff }),
    new THREE.MeshBasicMaterial({ color: 0xff4f7b }),
    new THREE.MeshBasicMaterial({ color: 0xffe66b }),
  ];
  const mastMaterial = new THREE.MeshBasicMaterial({ color: 0xb9f7ff });
  const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff3ac });
  const finishWhiteMaterial = new THREE.MeshBasicMaterial({ color: 0xf8fbff });
  const finishBlackMaterial = new THREE.MeshBasicMaterial({ color: 0x050607 });
  const finishAccentMaterial = new THREE.MeshBasicMaterial({ color: 0xffe66b });
  const startLightOffMaterial = new THREE.MeshBasicMaterial({ color: 0x231217 });
  const startLightRedMaterial = new THREE.MeshBasicMaterial({ color: 0xff335f });
  const startLightGreenMaterial = new THREE.MeshBasicMaterial({ color: 0x63f7a4 });
  const boostPadMaterial = new THREE.MeshBasicMaterial({
    color: 0x63f7a4,
    opacity: 0.74,
    transparent: true,
  });
  const boostPadStripeMaterial = new THREE.MeshBasicMaterial({ color: 0xf8fbff });
  const obstacleMaterial = new THREE.MeshBasicMaterial({ color: 0xd43f2f });
  const obstacleBandMaterial = new THREE.MeshBasicMaterial({ color: 0xffe66b });
  const peeHazardMaterial = new THREE.MeshBasicMaterial({ color: 0xffe66b });
  const peeSprayMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff3ac,
    opacity: 0.6,
    transparent: true,
    depthWrite: false,
  });
  const poopLogMaterial = new THREE.MeshBasicMaterial({ color: 0x6b3a1f });
  const stinkMaterial = new THREE.MeshBasicMaterial({
    color: 0x63f7a4,
    opacity: 0.54,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const streakMaterial = new THREE.MeshBasicMaterial({
    color: 0x9af7ff,
    opacity: 0,
    transparent: true,
    depthWrite: false,
  });

  let chevrons = 0;
  const crowdPanels: TrackArtMesh[] = [];
  const lightMasts: TrackArtMesh[] = [];
  const speedStreaks: TrackArtMesh[] = [];
  const startLights = createStartLightMeshes({
    off: startLightOffMaterial,
    red: startLightRedMaterial,
    green: startLightGreenMaterial,
  });
  const finishMarkers = addFinishLineMarkers(group, trackDefinition, {
    accent: finishAccentMaterial,
    black: finishBlackMaterial,
    white: finishWhiteMaterial,
    startLights,
  });
  addBoostPadMarkers(group, trackDefinition.boostPads, {
    pad: boostPadMaterial,
    stripe: boostPadStripeMaterial,
  });
  addObstacleMarkers(group, trackDefinition.obstacles, {
    body: obstacleMaterial,
    band: obstacleBandMaterial,
  });
  addGrossHazardMarkers(group, trackDefinition.grossHazards, {
    pee: peeHazardMaterial,
    peeSpray: peeSprayMaterial,
    poop: poopLogMaterial,
    stink: stinkMaterial,
  });

  forEachSegment(trackDefinition.centerline, (start, end, index) => {
    const midpoint = midpointOf(start, end);
    const heading = Math.atan2(end.x - start.x, end.z - start.z);

    if (chevrons < 14) {
      const side = index % 2 === 0 ? 1 : -1;
      const offset = perpendicularOffset(heading, (trackDefinition.roadWidth * 0.5 + 12) * side);
      const chevron = new THREE.Mesh(
        new THREE.BoxGeometry(7.2, 3.4, 0.42),
        bannerMaterials[index % bannerMaterials.length],
      );
      chevron.position.set(midpoint.x + offset.x, 3.2, midpoint.z + offset.z);
      chevron.rotation.y = heading + (side > 0 ? -0.22 : 0.22);
      chevron.castShadow = true;
      group.add(chevron);

      const arrow = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.62, 0.5), bannerMaterials[(index + 1) % bannerMaterials.length]);
      arrow.position.set(midpoint.x + offset.x, 3.2, midpoint.z + offset.z);
      arrow.rotation.y = heading + Math.PI / 4 * side;
      group.add(arrow);
      chevrons += 1;
    }

    if (crowdPanels.length < 6 && index % 2 === 0) {
      const side = index % 4 === 0 ? 1 : -1;
      const offset = perpendicularOffset(heading, (trackDefinition.roadWidth + 24) * side);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(22, 5.4, 1), crowdMaterials[index % crowdMaterials.length]);
      panel.position.set(midpoint.x + offset.x, 5.1, midpoint.z + offset.z);
      panel.rotation.y = heading;
      panel.castShadow = true;
      group.add(panel);
      crowdPanels.push(panel);
    }

    if (lightMasts.length < 10) {
      const side = index % 2 === 0 ? -1 : 1;
      const offset = perpendicularOffset(heading, (trackDefinition.roadWidth * 0.5 + 19) * side);
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.9, 14, 0.9), mastMaterial);
      mast.position.set(midpoint.x + offset.x, 7, midpoint.z + offset.z);
      mast.castShadow = true;
      group.add(mast);
      lightMasts.push(mast);

      const light = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.55, 1.1), lightMaterial);
      light.position.set(midpoint.x + offset.x, 14.2, midpoint.z + offset.z);
      light.rotation.y = heading;
      group.add(light);
    }
  });

  while (chevrons < 14) {
    const point = trackDefinition.centerline[chevrons % trackDefinition.centerline.length];
    const next = trackDefinition.centerline[(chevrons + 1) % trackDefinition.centerline.length];
    const heading = Math.atan2(next.x - point.x, next.z - point.z);
    const side = chevrons % 2 === 0 ? 1 : -1;
    const offset = perpendicularOffset(heading, (trackDefinition.roadWidth * 0.5 + 16) * side);
    const chevron = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 3, 0.42),
      bannerMaterials[chevrons % bannerMaterials.length],
    );
    chevron.position.set(point.x + offset.x, 3.2, point.z + offset.z);
    chevron.rotation.y = heading + (side > 0 ? -0.32 : 0.32);
    group.add(chevron);
    chevrons += 1;
  }

  while (crowdPanels.length < 6) {
    const index = crowdPanels.length + 2;
    const point = trackDefinition.centerline[index % trackDefinition.centerline.length];
    const next = trackDefinition.centerline[(index + 1) % trackDefinition.centerline.length];
    const heading = Math.atan2(next.x - point.x, next.z - point.z);
    const side = index % 2 === 0 ? 1 : -1;
    const offset = perpendicularOffset(heading, (trackDefinition.roadWidth + 28) * side);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(20, 5.2, 1), crowdMaterials[index % crowdMaterials.length]);
    panel.position.set(point.x + offset.x, 5.1, point.z + offset.z);
    panel.rotation.y = heading;
    group.add(panel);
    crowdPanels.push(panel);
  }

  while (lightMasts.length < 10) {
    const index = lightMasts.length + 3;
    const point = trackDefinition.centerline[index % trackDefinition.centerline.length];
    const next = trackDefinition.centerline[(index + 1) % trackDefinition.centerline.length];
    const heading = Math.atan2(next.x - point.x, next.z - point.z);
    const side = index % 2 === 0 ? -1 : 1;
    const offset = perpendicularOffset(heading, (trackDefinition.roadWidth * 0.5 + 21) * side);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.9, 14, 0.9), mastMaterial);
    mast.position.set(point.x + offset.x, 7, point.z + offset.z);
    group.add(mast);
    lightMasts.push(mast);

    const light = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.55, 1.1), lightMaterial);
    light.position.set(point.x + offset.x, 14.2, point.z + offset.z);
    light.rotation.y = heading;
    group.add(light);
  }

  for (let i = 0; i < 44; i += 1) {
    const point = trackDefinition.centerline[i % trackDefinition.centerline.length];
    const next = trackDefinition.centerline[(i + 1) % trackDefinition.centerline.length];
    const heading = Math.atan2(next.x - point.x, next.z - point.z);
    const t = (i % 7) / 7;
    const base = {
      x: point.x + (next.x - point.x) * t,
      z: point.z + (next.z - point.z) * t,
    };
    const side = i % 2 === 0 ? 1 : -1;
    const offset = perpendicularOffset(heading, (trackDefinition.roadWidth * 0.5 + 7) * side);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.2, 14), coneMaterial);
    cone.position.set(base.x + offset.x, 1.6, base.z + offset.z);
    cone.castShadow = true;
    group.add(cone);
  }

  for (let i = 0; i < 12; i += 1) {
    const material = streakMaterial.clone();
    const streak = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 12 + (i % 3) * 3), material);
    streak.visible = false;
    group.add(streak);
    speedStreaks.push(streak);
  }

  return {
    crowdPanels,
    lightMasts,
    speedStreaks,
    startLights,
    debug: {
      chevrons,
      crowdPanels: crowdPanels.length,
      lightMasts: lightMasts.length,
      speedStreaks: speedStreaks.length,
      finishMarkers,
      boostPads: trackDefinition.boostPads.length,
      obstacles: trackDefinition.obstacles.length,
      grossHazards: {
        peeSprayers: trackDefinition.grossHazards.filter((hazard) => hazard.kind === 'peeSprayer').length,
        poopLogs: trackDefinition.grossHazards.filter((hazard) => hazard.kind === 'poopLog').length,
      },
      startLights: {
        activeRedLights: 0,
        greenLit: false,
        state: 'idle',
      },
    },
  };
}

function createStartLightMeshes(materials: {
  readonly off: THREE.MeshBasicMaterial;
  readonly red: THREE.MeshBasicMaterial;
  readonly green: THREE.MeshBasicMaterial;
}): {
  readonly redLights: readonly StartLightMesh[];
  readonly greenLight: StartLightMesh;
} {
  const lightGeometry = new THREE.SphereGeometry(0.92, 18, 12);
  const redLights = Array.from({ length: 4 }, () => new THREE.Mesh(lightGeometry, materials.off.clone()));
  const greenLight = new THREE.Mesh(lightGeometry, materials.off.clone());

  for (const light of [...redLights, greenLight]) {
    light.userData.offMaterial = materials.off;
    light.userData.redMaterial = materials.red;
    light.userData.greenMaterial = materials.green;
  }

  return { redLights, greenLight };
}

function addBoostPadMarkers(
  group: THREE.Group,
  boostPads: readonly TrackBoostPad[],
  materials: {
    readonly pad: THREE.MeshBasicMaterial;
    readonly stripe: THREE.MeshBasicMaterial;
  },
): void {
  for (const pad of boostPads) {
    const marker = new THREE.Group();
    marker.name = `boost-pad-${pad.id}`;

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(pad.radius, pad.radius, 0.18, 36),
      materials.pad,
    );
    base.position.set(0, 0.26, 0);
    marker.add(base);

    for (const offset of [-2.4, 0, 2.4]) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(pad.radius * 1.1, 0.12, 0.72),
        materials.stripe,
      );
      stripe.position.set(0, 0.4, offset);
      stripe.rotation.y = -0.34;
      marker.add(stripe);
    }

    marker.position.set(pad.x, 0, pad.z);
    group.add(marker);
  }
}

function addObstacleMarkers(
  group: THREE.Group,
  obstacles: readonly TrackObstacle[],
  materials: {
    readonly body: THREE.MeshBasicMaterial;
    readonly band: THREE.MeshBasicMaterial;
  },
): void {
  for (const obstacle of obstacles) {
    const marker = new THREE.Group();
    marker.name = `obstacle-${obstacle.id}`;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(obstacle.radius * 1.1, 2.6, obstacle.radius * 0.92),
      materials.body,
    );
    body.position.set(0, 1.3, 0);
    marker.add(body);

    const band = new THREE.Mesh(
      new THREE.BoxGeometry(obstacle.radius * 1.2, 0.42, obstacle.radius),
      materials.band,
    );
    band.position.set(0, 2.35, 0);
    marker.add(band);

    marker.position.set(obstacle.x, 0, obstacle.z);
    marker.rotation.y = seededNoise(obstacle.x * 0.17 + obstacle.z * 0.11) * Math.PI;
    group.add(marker);
  }
}

function addGrossHazardMarkers(
  group: THREE.Group,
  hazards: readonly TrackGrossHazard[],
  materials: {
    readonly pee: THREE.MeshBasicMaterial;
    readonly peeSpray: THREE.MeshBasicMaterial;
    readonly poop: THREE.MeshBasicMaterial;
    readonly stink: THREE.MeshBasicMaterial;
  },
): void {
  for (const hazard of hazards) {
    const marker = new THREE.Group();
    marker.name = `gross-hazard-${hazard.id}`;
    marker.position.set(hazard.x, 0, hazard.z);

    if (hazard.kind === 'peeSprayer') {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 4.8, 18), materials.pee);
      post.position.set(0, 2.4, 0);
      marker.add(post);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.15, 18, 12), materials.pee);
      cap.position.set(0, 4.9, 0);
      marker.add(cap);

      for (let index = 0; index < 3; index += 1) {
        const spray = new THREE.Mesh(new THREE.ConeGeometry(0.42, 8.5, 18, 1, true), materials.peeSpray.clone());
        spray.position.set((index - 1) * 1.3, 3.1, 2.8 + index * 0.7);
        spray.rotation.x = Math.PI * 0.48;
        spray.rotation.z = (index - 1) * 0.18;
        marker.add(spray);
      }
    } else {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.55, 11.5, 24), materials.poop);
      log.position.set(0, 1.05, 0);
      log.rotation.z = Math.PI / 2;
      marker.add(log);

      for (let index = 0; index < 4; index += 1) {
        const stink = new THREE.Mesh(new THREE.RingGeometry(0.7 + index * 0.12, 1.05 + index * 0.16, 24), materials.stink.clone());
        stink.position.set(-4.2 + index * 2.8, 2.3 + index * 0.35, 0.2);
        stink.rotation.x = -Math.PI / 2.6;
        stink.rotation.z = index * 0.5;
        marker.add(stink);
      }
    }

    group.add(marker);
  }
}

function addFinishLineMarkers(
  group: THREE.Group,
  trackDefinition: TrackDefinition,
  materials: {
    readonly accent: THREE.MeshBasicMaterial;
    readonly black: THREE.MeshBasicMaterial;
    readonly startLights: {
      readonly redLights: readonly StartLightMesh[];
      readonly greenLight: StartLightMesh;
    };
    readonly white: THREE.MeshBasicMaterial;
  },
): number {
  const start = trackDefinition.checkpoints[0];
  const next = trackDefinition.centerline[1] ?? trackDefinition.checkpoints[1];
  if (!start || !next) {
    return 0;
  }

  const heading = Math.atan2(next.x - start.x, next.z - start.z);
  const forward = { x: Math.sin(heading), z: Math.cos(heading) };
  const tileColumns = 8;
  const tileRows = 2;
  const tileWidth = trackDefinition.roadWidth / tileColumns;
  const tileLength = 3.4;
  let markerCount = 0;

  for (let row = 0; row < tileRows; row += 1) {
    for (let column = 0; column < tileColumns; column += 1) {
      const sideOffset = (column - (tileColumns - 1) * 0.5) * tileWidth;
      const forwardOffset = (row - (tileRows - 1) * 0.5) * tileLength;
      const side = perpendicularOffset(heading, sideOffset);
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(tileWidth * 0.92, 0.1, tileLength * 0.92),
        (row + column) % 2 === 0 ? materials.white : materials.black,
      );
      marker.position.set(
        start.x + side.x + forward.x * forwardOffset,
        0.26,
        start.z + side.z + forward.z * forwardOffset,
      );
      marker.rotation.y = heading;
      marker.receiveShadow = true;
      group.add(marker);
      markerCount += 1;
    }
  }

  const gantryGroup = new THREE.Group();
  gantryGroup.position.set(start.x, 0, start.z);
  gantryGroup.rotation.y = heading;

  const postGeometry = new THREE.BoxGeometry(1.7, 17, 1.7);
  const leftPost = new THREE.Mesh(postGeometry, materials.accent);
  const rightPost = new THREE.Mesh(postGeometry, materials.accent);
  leftPost.position.set(-trackDefinition.roadWidth * 0.62, 8.5, 0);
  rightPost.position.set(trackDefinition.roadWidth * 0.62, 8.5, 0);
  gantryGroup.add(leftPost, rightPost);
  markerCount += 2;

  const capGeometry = new THREE.BoxGeometry(trackDefinition.roadWidth * 1.34, 1.35, 1.4);
  const cap = new THREE.Mesh(capGeometry, materials.black);
  cap.position.set(0, 16.2, 0);
  gantryGroup.add(cap);
  markerCount += 1;

  for (let column = 0; column < tileColumns; column += 1) {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry((trackDefinition.roadWidth * 1.22) / tileColumns, 1.5, 1.55),
      column % 2 === 0 ? materials.white : materials.black,
    );
    block.position.set(
      (column - (tileColumns - 1) * 0.5) * ((trackDefinition.roadWidth * 1.22) / tileColumns),
      17.75,
      0,
    );
    gantryGroup.add(block);
    markerCount += 1;
  }

  const glow = new THREE.Mesh(new THREE.BoxGeometry(trackDefinition.roadWidth * 1.1, 0.45, 1.8), materials.accent);
  glow.position.set(0, 14.8, 0);
  gantryGroup.add(glow);
  markerCount += 1;

  const allLights = [...materials.startLights.redLights, materials.startLights.greenLight];
  for (let index = 0; index < allLights.length; index += 1) {
    const light = allLights[index];
    light.position.set((index - 2) * 2.35, 15.55, 0.92);
    gantryGroup.add(light);
    markerCount += 1;
  }

  group.add(gantryGroup);
  return markerCount;
}

function buildCar(
  bodyColor: THREE.ColorRepresentation = 0xff335f,
  accentColor: THREE.ColorRepresentation = 0x36f1ff,
): THREE.Group {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshBasicMaterial({ color: bodyColor });
  const cockpitMaterial = new THREE.MeshBasicMaterial({
    color: 0x132d36,
  });
  const lightMaterial = new THREE.MeshBasicMaterial({ color: accentColor });
  const wheelMaterial = new THREE.MeshBasicMaterial({ color: 0x050607 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(4.3, 1.15, 6.6), bodyMaterial);
  body.userData.paintRole = 'body';
  body.position.y = 1.4;
  body.castShadow = true;
  group.add(body);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.55, 2.4), bodyMaterial);
  nose.userData.paintRole = 'body';
  nose.position.set(0, 1.08, 3.35);
  nose.castShadow = true;
  group.add(nose);

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.95, 2.1), cockpitMaterial);
  cockpit.position.set(0, 2.2, -0.55);
  cockpit.castShadow = true;
  group.add(cockpit);

  const splitter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 0.28), lightMaterial);
  splitter.userData.paintRole = 'accent';
  splitter.position.set(0, 0.78, 3.95);
  group.add(splitter);

  for (const x of [-1.35, 1.35]) {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.22, 0.34), lightMaterial);
    headlight.userData.paintRole = 'accent';
    headlight.position.set(x, 1.14, 3.72);
    group.add(headlight);
  }

  for (const x of [-3.05, 3.05]) {
    for (const z of [-2.25, 2.25]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.62, 24), wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x * 0.78, 0.68, z);
      wheel.castShadow = true;
      group.add(wheel);
    }
  }

  const wing = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.22, 0.7), bodyMaterial);
  wing.userData.paintRole = 'body';
  wing.position.set(0, 2.12, -3.45);
  wing.castShadow = true;
  group.add(wing);

  return group;
}

function updateCarPaint(
  target: THREE.Object3D,
  bodyColor: THREE.ColorRepresentation,
  accentColor: THREE.ColorRepresentation,
): void {
  target.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    const material = object.material;
    if (!(material instanceof THREE.MeshBasicMaterial)) {
      return;
    }

    if (object.userData.paintRole === 'body') {
      material.color.set(bodyColor);
    }
    if (object.userData.paintRole === 'accent') {
      material.color.set(accentColor);
    }
  });
}

function buildGhostCar(): THREE.Group {
  const group = buildCar(0x36f1ff);
  group.visible = false;
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    const material = object.material;
    if (!(material instanceof THREE.MeshBasicMaterial)) {
      return;
    }

    const ghostMaterial = material.clone();
    ghostMaterial.color.set(0x36f1ff);
    ghostMaterial.transparent = true;
    ghostMaterial.opacity = 0.34;
    ghostMaterial.depthWrite = false;
    object.material = ghostMaterial;
  });
  return group;
}

function buildGhostVisualAid(): GhostVisualAid {
  const material = new THREE.MeshBasicMaterial({
    color: 0x36f1ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(3.9, 5.75, 56), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.04;
  mesh.visible = false;
  mesh.renderOrder = 2;
  return { mesh, material };
}

function buildDriftSmokeVisual(): DriftSmokeVisual {
  const group = new THREE.Group();
  group.visible = false;
  const geometry = new THREE.CircleGeometry(1, 28);
  const puffs: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[] = [];

  for (let index = 0; index < 6; index += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xd8eef1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const puff = new THREE.Mesh(geometry, material);
    puff.rotation.x = -Math.PI / 2;
    puff.renderOrder = 3;
    puff.visible = false;
    group.add(puff);
    puffs.push(puff);
  }

  return { group, puffs };
}

function updateCarMesh(carMesh: THREE.Group, state: VehicleState): void {
  const fallT = clamp(grossEffects.poopFallSeconds / 0.78, 0, 1);
  const fallWobble = settings.reducedMotion ? 0 : Math.sin((1 - fallT) * Math.PI * 4) * 0.22 * fallT;
  carMesh.position.set(
    state.position.x,
    0.12 + grossEffects.jumpHeight - fallT * 0.25,
    state.position.z,
  );
  carMesh.rotation.set(
    0,
    state.heading + fallWobble * 0.18,
    -state.lateralVelocity * 0.016 + fallWobble,
  );
  carMesh.scale.set(1 + fallT * 0.05, 1 - fallT * 0.08, 1 + fallT * 0.04);
}

function updateDriftSmoke(deltaSeconds: number): void {
  const visiblePuffs = driftSmokeEffect.visiblePuffs;
  driftSmoke.group.visible = visiblePuffs > 0;

  if (visiblePuffs === 0) {
    for (const puff of driftSmoke.puffs) {
      puff.visible = false;
      puff.material.opacity = 0;
    }
    return;
  }

  const driftDirection = Math.sign(vehicle.lateralVelocity) || 1;
  const animationAmount = settings.reducedMotion ? 0.25 : 1;
  const time = elapsedSeconds * animationAmount;

  driftSmoke.puffs.forEach((puff, index) => {
    const visible = index < visiblePuffs;
    puff.visible = visible;
    if (!visible) {
      puff.material.opacity = 0;
      return;
    }

    const side = index % 2 === 0 ? -1 : 1;
    const row = Math.floor(index / 2);
    const age = row / 2;
    const sideSpread = side * (1.35 + row * 0.52);
    const rearTrail = -3.05 - row * 0.72 - driftSmokeEffect.intensity * 0.48;
    const sway = Math.sin(time * 5.2 + index * 1.8) * 0.16 * animationAmount;
    const lift = 0.22 + row * 0.06;
    const scale = driftSmokeEffect.scale * (1 + age * 0.34);
    const opacityFade = 1 - age * 0.26;

    puff.position.set(
      sideSpread + driftDirection * row * 0.22 + sway,
      lift,
      rearTrail,
    );
    puff.scale.setScalar(scale);
    puff.rotation.z = time * (0.35 + index * 0.04) * side;
    puff.material.opacity = driftSmokeEffect.opacity * opacityFade;
  });

  if (settings.reducedMotion) {
    driftSmoke.group.position.set(0, 0, 0);
    return;
  }

  driftSmoke.group.position.set(
    Math.sin(elapsedSeconds * 9.1) * 0.08 * driftSmokeEffect.intensity,
    0,
    -Math.min(0.35, deltaSeconds * driftSmokeEffect.intensity * 2),
  );
}

function updateOpponentMeshes(): void {
  opponents.forEach((opponent, index) => {
    const opponentMesh = opponentMeshes[index];
    if (!opponentMesh) {
      return;
    }
    opponentMesh.position.set(opponent.position.x, 0.1, opponent.position.z);
    opponentMesh.rotation.set(0, opponent.heading, 0);
  });
}

function recordGhostReplayFrame(raceProgress: RaceProgress): void {
  if (raceProgress.finished || raceProgress.lapStartedAtSeconds === null) {
    return;
  }

  ghostReplay = recordGhostReplaySample(ghostReplay, {
    lapSeconds: Math.max(0, elapsedSeconds - raceProgress.lapStartedAtSeconds),
    x: vehicle.position.x,
    z: vehicle.position.z,
    headingRadians: vehicle.heading,
  });
}

function completeGhostReplayLapIfNeeded(previousProgress: RaceProgress): void {
  if (progress.completedLapSeconds.length <= previousProgress.completedLapSeconds.length) {
    return;
  }

  const completedLapSeconds = progress.completedLapSeconds[progress.completedLapSeconds.length - 1];
  const isPersonalBest =
    previousProgress.bestLapSeconds === null || completedLapSeconds < previousProgress.bestLapSeconds;
  ghostReplay = completeGhostReplayLap(ghostReplay, completedLapSeconds, isPersonalBest);
}

function updateGhostReplayMesh(): void {
  ghostReplayStatus = createGhostReplayStatus(ghostReplay);

  if (session.phase !== 'racing' || progress.lapStartedAtSeconds === null) {
    ghostPose = null;
    ghostCar.visible = false;
    updateGhostVisualAid(false);
    return;
  }

  ghostPose = sampleGhostReplay(ghostReplay, elapsedSeconds - progress.lapStartedAtSeconds);
  if (ghostPose === null) {
    ghostCar.visible = false;
    updateGhostVisualAid(false);
    return;
  }

  ghostCar.visible = true;
  ghostCar.position.set(ghostPose.x, 0.18, ghostPose.z);
  ghostCar.rotation.set(0, ghostPose.headingRadians, 0);
  updateGhostVisualAid(true);
}

function updateGhostVisualAid(visible: boolean): void {
  ghostVisualAid.mesh.visible = visible;
  ghostVisualAidState.visible = visible;

  if (!visible) {
    ghostVisualAid.material.opacity = 0;
    ghostVisualAid.mesh.scale.setScalar(1);
    ghostVisualAidState.opacity = 0;
    ghostVisualAidState.scale = 1;
    return;
  }

  const pulse = Math.sin(elapsedSeconds * 5.4);
  const opacity = 0.52 + pulse * 0.045;
  const scale = 1.13 + pulse * 0.055;
  ghostVisualAid.material.opacity = opacity;
  ghostVisualAid.mesh.scale.setScalar(scale);
  ghostVisualAidState.opacity = opacity;
  ghostVisualAidState.scale = scale;
}

function updateCheckpoints(raceProgress: RaceProgress): void {
  const nextCheckpoint = track.checkpoints[raceProgress.nextCheckpointIndex]?.id;
  for (const checkpoint of track.checkpoints) {
    const gate = checkpointMeshes.get(checkpoint.id);
    if (!gate) {
      continue;
    }
    const active = checkpoint.id === nextCheckpoint;
    gate.scale.setScalar(active ? 1.12 + Math.sin(elapsedSeconds * 5) * 0.035 : 0.86);
    gate.visible = active;
  }
}

function updateCamera(deltaSeconds: number): void {
  const forward = new THREE.Vector3(Math.sin(vehicle.heading), 0, Math.cos(vehicle.heading));
  const desiredPosition = new THREE.Vector3(vehicle.position.x, cameraProfile.chaseHeight, vehicle.position.z).addScaledVector(forward, -cameraProfile.chaseDistance);
  cameraPosition.lerp(desiredPosition, clamp(deltaSeconds * cameraProfile.lerpSpeed, 0, 1));
  followTarget.set(vehicle.position.x, cameraProfile.targetHeight, vehicle.position.z).addScaledVector(forward, cameraProfile.lookAhead);
  cameraTarget.lerp(followTarget, clamp(deltaSeconds * cameraProfile.targetLerpSpeed, 0, 1));
  camera.position.copy(cameraPosition);
  camera.lookAt(cameraTarget);
}

function updateSpeedEffects(): void {
  const cameraFov = speedEffects.cameraFov + cameraProfile.fovOffset;
  if (camera.fov !== cameraFov) {
    camera.fov = cameraFov;
    camera.updateProjectionMatrix();
  }
  hud.speedVignette.style.opacity = speedEffects.vignetteOpacity.toFixed(3);
  trackArt.speedStreaks.forEach((streak, index) => {
    streak.visible = speedEffects.intensity > 0.12 && index < graphicsProfile.speedStreaksVisible;
    streak.material.opacity = speedEffects.streakOpacity * (index % 3 === 0 ? 0.82 : 1);
  });
}

function updateStartLights(): void {
  const startLights = getStartLightDebug(session);

  trackArt.startLights.redLights.forEach((light, index) => {
    light.material = index < startLights.activeRedLights
      ? light.userData.redMaterial as THREE.MeshBasicMaterial
      : light.userData.offMaterial as THREE.MeshBasicMaterial;
  });
  trackArt.startLights.greenLight.material = startLights.greenLit
    ? trackArt.startLights.greenLight.userData.greenMaterial as THREE.MeshBasicMaterial
    : trackArt.startLights.greenLight.userData.offMaterial as THREE.MeshBasicMaterial;
}

function getStartLightDebug(currentSession: RaceSession): StartLightDebug {
  const greenLit = currentSession.phase === 'racing';
  return {
    activeRedLights: getActiveStartRedLights(currentSession),
    greenLit,
    state: greenLit ? 'go' : currentSession.phase === 'countdown' ? 'countdown' : 'idle',
  };
}

function getActiveStartRedLights(currentSession: RaceSession): number {
  if (currentSession.phase !== 'countdown') {
    return 0;
  }
  return clamp(Math.ceil(4 - currentSession.countdownSeconds), 1, 4);
}

function animateTrackArt(deltaSeconds: number): void {
  const pulse = 1 + Math.sin(elapsedSeconds * 8) * 0.045 * speedEffects.roadPulse;
  const headingSin = Math.sin(vehicle.heading);
  const headingCos = Math.cos(vehicle.heading);
  trackArt.crowdPanels.forEach((panel, index) => {
    panel.scale.y = 1 + Math.sin(elapsedSeconds * 4.2 + index) * 0.08;
  });
  trackArt.lightMasts.forEach((mast, index) => {
    mast.scale.y = pulse + (index % 2) * 0.018;
  });
  trackArt.speedStreaks.forEach((streak, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const laneOffset = 6.8 + (index % 3) * 2.6;
    const travel = ((elapsedSeconds * (36 + index * 2) + index * 5.4) % 42) - 21;
    const scaledTravel = travel * speedEffects.intensity;
    const sideDistance = laneOffset * side;
    streak.position.set(
      vehicle.position.x + headingCos * sideDistance + headingSin * scaledTravel,
      0.35 + (index % 2) * 0.08,
      vehicle.position.z - headingSin * sideDistance + headingCos * scaledTravel,
    );
    streak.rotation.y = vehicle.heading;
    streak.scale.z = 1 + deltaSeconds * speedEffects.intensity * 2.4;
  });
}

function updateHud(raceProgress: RaceProgress, state: VehicleState): void {
  const next = track.checkpoints[raceProgress.nextCheckpointIndex];
  hud.lap.textContent = String(raceProgress.currentLap);
  hud.speed.textContent = Math.max(0, Math.round(Math.abs(state.speed) * 2.237)).toString().padStart(3, '0');
  hud.checkpoint.textContent = next ? next.id.toUpperCase() : 'FINISH';
  timingDisplay = createRaceTimingDisplay(raceProgress, track.checkpoints.length, elapsedSeconds);
  hud.lapTime.textContent = timingDisplay.currentLapLabel;
  hud.bestLap.textContent = timingDisplay.bestLapLabel;
  hud.sectorLabelText.textContent = timingDisplay.currentSectorLabelText;
  hud.sectorLabel.textContent = timingDisplay.currentSectorLabel;
  hud.sectorTime.textContent = timingDisplay.currentSectorTimeLabel;
  hud.sectorDelta.textContent = timingDisplay.sectorDeltaLabel;
  hud.sectorDelta.dataset.tone = timingDisplay.sectorDeltaTone;
  hud.raceStatus.textContent = getRaceStatusText(session, trackFeedback);
  hud.ghostStatus.textContent = ghostReplayStatus.label;
  hud.ghostStatus.dataset.mode = ghostReplayStatus.mode;
  hud.boostMeter.style.transform = `scaleX(${state.boostFuel.toFixed(3)})`;
}

function updateRaceAwareness(): void {
  racePosition = rankRaceParticipants(
    [
      {
        id: 'player',
        name: 'You',
        distance: getPlayerRaceDistance({
          progress,
          track,
          position: vehicle.position,
        }),
        finishedAtSeconds: getRaceResultFinishSeconds('player'),
      },
      ...opponents.map((opponent) => ({
        id: opponent.id,
        name: opponent.name,
        distance: opponent.distanceTraveled,
        finishedAtSeconds: opponent.finishedAtSeconds,
      })),
    ],
    'player',
  );
  raceAwareness = createRaceAwareness(racePosition);
  hud.racePosition.textContent = raceAwareness.positionLabel;
  hud.racePosition.dataset.tone = raceAwareness.tone;
  hud.raceGap.textContent = raceAwareness.gapLabel;
  hud.raceGap.dataset.proximity = raceAwareness.proximity;
  minimapDebug = drawMinimap();
}

function getRaceResultFinishSeconds(id: string): number | null {
  const result = session.results.find((entry) => entry.id === id);
  if (result) {
    return result.finishSeconds;
  }
  return id === 'player' && progress.finished ? elapsedSeconds : null;
}

function drawMinimap(): MinimapDebugState {
  const context = minimapContext;
  const width = hud.minimapCanvas.width;
  const height = hud.minimapCanvas.height;
  const bounds = getMinimapBounds(width, height);
  const lapLength = getTrackLapLength(track);
  const playerProjection = projectPointOntoTrack(track, vehicle.position);
  const progressRatio = lapLength > 0 ? clamp(playerProjection.distanceAlongLap / lapLength, 0, 1) : 0;
  const markers = createMinimapMarkers(bounds);

  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#071018');
  background.addColorStop(1, '#122b33');
  context.clearRect(0, 0, width, height);
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  drawMinimapTrack(context, bounds);
  drawMinimapProgress(context, bounds, playerProjection);
  drawStartFinishStripe(context, bounds);
  drawNextCheckpoint(context, bounds);
  for (const marker of markers) {
    drawMinimapMarker(context, marker);
  }
  context.restore();

  return {
    canvasWidth: width,
    canvasHeight: height,
    progressRatio,
    markers,
  };
}

function drawMinimapTrack(context: CanvasRenderingContext2D, bounds: MinimapBounds): void {
  context.beginPath();
  track.centerline.forEach((point, index) => {
    const mapPoint = worldToMinimap(point, bounds);
    if (index === 0) {
      context.moveTo(mapPoint.x, mapPoint.y);
      return;
    }
    context.lineTo(mapPoint.x, mapPoint.y);
  });
  context.closePath();
  context.strokeStyle = 'rgb(255 255 255 / 0.20)';
  context.lineWidth = 11;
  context.stroke();
  context.strokeStyle = '#58e8ff';
  context.lineWidth = 2.2;
  context.stroke();
}

function drawMinimapProgress(
  context: CanvasRenderingContext2D,
  bounds: MinimapBounds,
  projection: TrackProjection,
): void {
  const projectedPoint = getProjectionPoint(projection);
  if (!projectedPoint) {
    return;
  }

  context.beginPath();
  const start = worldToMinimap(track.centerline[0], bounds);
  context.moveTo(start.x, start.y);

  for (let i = 1; i <= projection.segmentIndex; i += 1) {
    const point = worldToMinimap(track.centerline[i], bounds);
    context.lineTo(point.x, point.y);
  }

  const end = worldToMinimap(projectedPoint, bounds);
  context.lineTo(end.x, end.y);
  context.strokeStyle = 'rgb(255 230 107 / 0.86)';
  context.lineWidth = 4.2;
  context.stroke();
}

function drawStartFinishStripe(context: CanvasRenderingContext2D, bounds: MinimapBounds): void {
  const start = track.centerline[0];
  const next = track.centerline[1];
  if (!start || !next) {
    return;
  }

  const heading = Math.atan2(next.x - start.x, next.z - start.z);
  const halfStripe = track.roadWidth * 0.34;
  const stripeStartOffset = perpendicularOffset(heading, -halfStripe);
  const stripeEndOffset = perpendicularOffset(heading, halfStripe);
  const stripeStart = worldToMinimap({ x: start.x + stripeStartOffset.x, z: start.z + stripeStartOffset.z }, bounds);
  const stripeEnd = worldToMinimap({ x: start.x + stripeEndOffset.x, z: start.z + stripeEndOffset.z }, bounds);

  context.beginPath();
  context.moveTo(stripeStart.x, stripeStart.y);
  context.lineTo(stripeEnd.x, stripeEnd.y);
  context.strokeStyle = '#ffffff';
  context.lineWidth = 3.4;
  context.stroke();

  context.beginPath();
  context.moveTo(stripeStart.x, stripeStart.y);
  context.lineTo(stripeEnd.x, stripeEnd.y);
  context.strokeStyle = '#111820';
  context.setLineDash([3, 3]);
  context.lineWidth = 1.2;
  context.stroke();
  context.setLineDash([]);
}

function drawNextCheckpoint(context: CanvasRenderingContext2D, bounds: MinimapBounds): void {
  const checkpoint = track.checkpoints[progress.nextCheckpointIndex];
  if (!checkpoint) {
    return;
  }
  const point = worldToMinimap(checkpoint, bounds);
  context.beginPath();
  context.arc(point.x, point.y, 7.2, 0, Math.PI * 2);
  context.strokeStyle = '#ffe66b';
  context.lineWidth = 2;
  context.stroke();
}

function drawMinimapMarker(context: CanvasRenderingContext2D, marker: MinimapMarkerDebug): void {
  const x = marker.x * hud.minimapCanvas.width;
  const y = marker.z * hud.minimapCanvas.height;
  if (marker.kind === 'player') {
    context.save();
    context.translate(x, y);
    context.rotate(Math.PI - marker.heading);
    context.beginPath();
    context.moveTo(0, -7.4);
    context.lineTo(5.2, 5.6);
    context.lineTo(0, 2.8);
    context.lineTo(-5.2, 5.6);
    context.closePath();
    context.fillStyle = marker.color;
    context.fill();
    context.lineWidth = 1.8;
    context.strokeStyle = '#ffffff';
    context.stroke();
    context.restore();
    drawMinimapMarkerLabel(context, marker, x, y, 10);
    return;
  }

  if (marker.kind === 'ghost') {
    context.beginPath();
    context.arc(x, y, 5.8, 0, Math.PI * 2);
    context.fillStyle = 'rgb(54 241 255 / 0.22)';
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = marker.color;
    context.stroke();
    context.beginPath();
    context.arc(x, y, 2.2, 0, Math.PI * 2);
    context.fillStyle = marker.color;
    context.fill();
    drawMinimapMarkerLabel(context, marker, x, y, 11);
    return;
  }

  context.beginPath();
  context.arc(x, y, 3.8, 0, Math.PI * 2);
  context.fillStyle = marker.color;
  context.fill();
  context.lineWidth = 1.4;
  context.strokeStyle = 'rgb(4 8 12 / 0.86)';
  context.stroke();
  drawMinimapMarkerLabel(context, marker, x, y, 7.5);
}

type MinimapBounds = {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
};

function getMinimapBounds(canvasWidth: number, canvasHeight: number): MinimapBounds {
  const padding = track.roadWidth + track.shoulderWidth + 10;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const point of track.centerline) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }

  minX -= padding;
  maxX += padding;
  minZ -= padding;
  maxZ += padding;

  const worldWidth = maxX - minX;
  const worldHeight = maxZ - minZ;
  const canvasRatio = canvasWidth / canvasHeight;
  const worldRatio = worldWidth / worldHeight;

  if (worldRatio > canvasRatio) {
    const nextHeight = worldWidth / canvasRatio;
    const extra = (nextHeight - worldHeight) * 0.5;
    minZ -= extra;
    maxZ += extra;
  } else {
    const nextWidth = worldHeight * canvasRatio;
    const extra = (nextWidth - worldWidth) * 0.5;
    minX -= extra;
    maxX += extra;
  }

  return { minX, maxX, minZ, maxZ };
}

function createMinimapMarkers(bounds: MinimapBounds): readonly MinimapMarkerDebug[] {
  const markers = racePosition.participants.map((participant, index) => {
    if (participant.id === 'player') {
      return createMinimapMarker({
        id: participant.id,
        position: vehicle.position,
        color: '#ff335f',
        kind: 'player',
        rank: index + 1,
        heading: vehicle.heading,
        bounds,
      });
    }

    const opponent = opponents.find((entry) => entry.id === participant.id);
    return createMinimapMarker({
      id: participant.id,
      position: opponent?.position ?? { x: 0, z: 0 },
      color: opponent?.color ?? '#a8f7ff',
      kind: 'opponent',
      rank: index + 1,
      heading: opponent?.heading ?? 0,
      bounds,
    });
  });

  if (ghostPose !== null && ghostCar.visible) {
    markers.push(
      createMinimapMarker({
        id: 'ghost',
        position: ghostPose,
        color: '#36f1ff',
        kind: 'ghost',
        rank: markers.length + 1,
        heading: ghostPose.headingRadians,
        label: 'G',
        bounds,
      }),
    );
  }

  return markers;
}

function createMinimapMarker(input: {
  readonly id: string;
  readonly position: TrackPoint;
  readonly color: string;
  readonly kind: MinimapMarkerDebug['kind'];
  readonly rank: number;
  readonly heading: number;
  readonly label?: string;
  readonly bounds: MinimapBounds;
}): MinimapMarkerDebug {
  const { id, position, color, kind, rank, heading, label, bounds } = input;
  const mapPoint = worldToMinimap(position, bounds);
  return {
    id,
    x: clamp(mapPoint.x / hud.minimapCanvas.width, 0, 1),
    z: clamp(mapPoint.y / hud.minimapCanvas.height, 0, 1),
    color,
    kind,
    rank,
    heading: Number.isFinite(heading) ? heading : 0,
    label: label ?? `P${rank}`,
  };
}

function drawMinimapMarkerLabel(
  context: CanvasRenderingContext2D,
  marker: MinimapMarkerDebug,
  x: number,
  y: number,
  offset: number,
): void {
  context.font = '700 8px Bahnschrift, Aptos, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 2.4;
  context.strokeStyle = 'rgb(2 8 12 / 0.9)';
  context.fillStyle = marker.rank === 1 ? '#ffe66b' : '#f8fbff';
  context.strokeText(marker.label, x, y - offset);
  context.fillText(marker.label, x, y - offset);
}

function getProjectionPoint(projection: TrackProjection): TrackPoint | null {
  const start = track.centerline[projection.segmentIndex];
  const end = track.centerline[(projection.segmentIndex + 1) % track.centerline.length];
  if (!start || !end) {
    return null;
  }

  return {
    x: start.x + (end.x - start.x) * projection.t,
    z: start.z + (end.z - start.z) * projection.t,
  };
}

function worldToMinimap(point: TrackPoint, bounds: MinimapBounds): { readonly x: number; readonly y: number } {
  const width = hud.minimapCanvas.width;
  const height = hud.minimapCanvas.height;
  return {
    x: ((point.x - bounds.minX) / (bounds.maxX - bounds.minX)) * width,
    y: ((point.z - bounds.minZ) / (bounds.maxZ - bounds.minZ)) * height,
  };
}

function setupInput(): void {
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setSettingsPanelOpen(settingsElements.panel.hidden === true);
      return;
    }
    if (isSettingsFormEvent(event)) {
      return;
    }
    keys.add(event.key.toLowerCase());
    if (event.key.toLowerCase() === 'r') {
      resetRace();
    }
  });

  window.addEventListener('keyup', (event) => {
    if (isSettingsFormEvent(event)) {
      return;
    }
    keys.delete(event.key.toLowerCase());
  });

  window.addEventListener('blur', clearAllTouchControls);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      clearAllTouchControls();
    }
  });
}

function setupTouchControls(): void {
  for (const action of TOUCH_ACTIONS) {
    const button = touchControls.buttons[action];
    if (button.dataset.touchAction !== action) {
      throw new Error(`Expected #${button.id} to use data-touch-action="${action}"`);
    }
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      setTouchActionActive(touchState, action, event.pointerId);
      button.classList.add('touch-active');
      trySetPointerCapture(button, event.pointerId);
    });
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      button.addEventListener(eventName, (event) => {
        event.preventDefault();
        clearTouchAction(touchState, action, event.pointerId);
        syncTouchButtonStates();
      });
    }
  }

  for (const eventName of ['pointerup', 'pointercancel'] as const) {
    window.addEventListener(eventName, (event) => {
      clearTouchPointer(event.pointerId);
    });
  }
}

function setupSettings(): void {
  syncSettingsControls();
  settingsElements.button.addEventListener('click', () => {
    setSettingsPanelOpen(settingsElements.panel.hidden === true);
  });
  settingsElements.close.addEventListener('click', () => {
    setSettingsPanelOpen(false);
  });
  settingsElements.graphicsQuality.addEventListener('change', () => {
    updateSettings({ graphicsQuality: settingsElements.graphicsQuality.value as GraphicsQuality });
  });
  settingsElements.cameraMode.addEventListener('change', () => {
    updateSettings({ cameraMode: settingsElements.cameraMode.value as CameraMode });
  });
  settingsElements.touchControlsMode.addEventListener('change', () => {
    updateSettings({ touchControlsMode: settingsElements.touchControlsMode.value as TouchControlsMode });
  });
  settingsElements.masterVolume.addEventListener('input', () => {
    updateSettings({ masterVolume: Number(settingsElements.masterVolume.value) / 100 });
  });
  settingsElements.muted.addEventListener('change', () => {
    updateSettings({ muted: settingsElements.muted.checked });
  });
  settingsElements.reducedMotion.addEventListener('change', () => {
    updateSettings({ reducedMotion: settingsElements.reducedMotion.checked });
  });
  settingsElements.highContrast.addEventListener('change', () => {
    updateSettings({ highContrast: settingsElements.highContrast.checked });
  });
  settingsElements.showControlHints.addEventListener('change', () => {
    updateSettings({ showControlHints: settingsElements.showControlHints.checked });
  });
  settingsElements.reset.addEventListener('click', () => {
    settings = DEFAULT_GAME_SETTINGS;
    persistSettings();
    syncSettingsControls();
    applyRuntimeSettings();
  });
}

function setupCharacterSelection(): void {
  characterElements.grid.textContent = '';
  characterElements.grid.style.setProperty('--character-accent', selectedCharacter.accentColor);

  for (const character of RACER_CHARACTERS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'character-card';
    button.dataset.characterId = character.id;
    button.setAttribute('role', 'option');
    button.style.setProperty('--character-accent', character.accentColor);

    const portrait = document.createElement('img');
    portrait.src = character.imageSrc;
    portrait.alt = `${character.name} portrait`;
    portrait.width = 512;
    portrait.height = 512;

    const name = document.createElement('strong');
    name.textContent = character.name;

    const title = document.createElement('span');
    title.textContent = character.title;

    button.append(portrait, name, title);
    button.addEventListener('click', () => {
      selectCharacter(character.id);
    });
    characterElements.grid.append(button);
  }

  syncCharacterSelection();
}

function selectCharacter(id: string): void {
  selectedCharacter = getCharacterById(id);
  writeStoredCharacter(getSettingsStorage(), selectedCharacter);
  syncCharacterSelection();
  updateCarPaint(car, selectedCharacter.carColor, selectedCharacter.accentColor);
  window.__racingGameDebug = createDebugState();
}

function syncCharacterSelection(): void {
  characterElements.grid.style.setProperty('--character-accent', selectedCharacter.accentColor);
  characterElements.panel.style.setProperty('--character-accent', selectedCharacter.accentColor);
  characterElements.portrait.src = selectedCharacter.imageSrc;
  characterElements.portrait.alt = `${selectedCharacter.name} portrait`;
  characterElements.name.textContent = selectedCharacter.name;
  characterElements.title.textContent = selectedCharacter.title;
  characterElements.description.textContent = selectedCharacter.description;

  for (const card of characterElements.grid.querySelectorAll<HTMLButtonElement>('[data-character-id]')) {
    const selected = card.dataset.characterId === selectedCharacter.id;
    card.setAttribute('aria-selected', String(selected));
    card.tabIndex = selected ? 0 : -1;
  }

  characterElements.stats.textContent = '';
  for (const stat of characterStatLabels) {
    const row = document.createElement('div');
    row.className = 'character-stat';
    row.dataset.characterStat = stat.key;

    const label = document.createElement('span');
    label.textContent = stat.label;

    const meter = document.createElement('meter');
    meter.min = 0;
    meter.max = 5;
    meter.value = selectedCharacter.stats[stat.key];
    meter.setAttribute('aria-label', `${stat.label} ${selectedCharacter.stats[stat.key]} of 5`);

    row.append(label, meter);
    characterElements.stats.append(row);
  }
}

function readStoredCharacter(storage: SettingsStorage | null): RacerCharacter {
  try {
    return getCharacterById(storage?.getItem(characterStorageKey));
  } catch {
    return getCharacterById(null);
  }
}

function writeStoredCharacter(storage: SettingsStorage | null, character: RacerCharacter): void {
  try {
    storage?.setItem(characterStorageKey, character.id);
  } catch {
    // Browser privacy modes can block storage; the in-memory selection still works.
  }
}

function getSettingsStorage(): SettingsStorage | null {
  if (cachedSettingsStorage !== undefined) {
    return cachedSettingsStorage;
  }

  try {
    cachedSettingsStorage = window.localStorage;
  } catch {
    cachedSettingsStorage = null;
  }

  return cachedSettingsStorage;
}

function persistSettings(): void {
  writeStoredGameSettings(getSettingsStorage(), settings);
}

function updateSettings(nextSettings: Partial<GameSettings>): void {
  settings = {
    ...settings,
    ...nextSettings,
  };
  persistSettings();
  syncSettingsControls();
  applyRuntimeSettings();
}

function syncSettingsControls(): void {
  settingsElements.graphicsQuality.value = settings.graphicsQuality;
  settingsElements.cameraMode.value = settings.cameraMode;
  settingsElements.touchControlsMode.value = settings.touchControlsMode;
  settingsElements.masterVolume.value = String(Math.round(settings.masterVolume * 100));
  settingsElements.muted.checked = settings.muted;
  settingsElements.reducedMotion.checked = settings.reducedMotion;
  settingsElements.highContrast.checked = settings.highContrast;
  settingsElements.showControlHints.checked = settings.showControlHints;
}

function applyRuntimeSettings(): void {
  graphicsProfile = resolveGraphicsProfile(settings);
  cameraProfile = resolveCameraProfile(settings);
  document.body.classList.toggle('settings-high-contrast', settings.highContrast);
  document.body.classList.toggle('settings-reduced-motion', settings.reducedMotion);
  updateTouchControlsVisibility();
  applySceneColors();
  resize();
}

function applySceneColors(): void {
  const color = settings.highContrast ? 0x020407 : 0x071017;
  sceneColor.setHex(color);
  renderer.setClearColor(sceneColor, 1);
  scene.background = sceneColor;
  scene.fog = new THREE.FogExp2(color, settings.highContrast ? 0.0038 : 0.0048);
}

function setSettingsPanelOpen(open: boolean): void {
  settingsElements.panel.hidden = !open;
  settingsElements.panel.classList.toggle('hidden', !open);
  settingsElements.button.setAttribute('aria-expanded', String(open));
}

function updateControlHintsVisibility(): void {
  const visible = !isResultsVisible() && settings.showControlHints && !touchControlsVisible;
  settingsElements.controlHints.classList.toggle('hidden', !visible);
  settingsElements.controlHints.hidden = !visible;
}

function updateTouchControlsVisibility(): void {
  touchControlsVisible =
    !isResultsVisible() &&
    shouldShowTouchControls(settings.touchControlsMode, {
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      viewportWidth: window.innerWidth,
    });
  touchControls.overlay.hidden = !touchControlsVisible;
  touchControls.overlay.classList.toggle('hidden', !touchControlsVisible);
  document.body.classList.toggle('touch-controls-visible', touchControlsVisible);
  if (!touchControlsVisible) {
    clearAllTouchControls();
  }
  updateControlHintsVisibility();
}

function clearAllTouchControls(): void {
  clearTouchControls(touchState);
  syncTouchButtonStates();
}

function clearTouchPointer(pointerId: number): void {
  for (const action of TOUCH_ACTIONS) {
    clearTouchAction(touchState, action, pointerId);
  }
  syncTouchButtonStates();
}

function syncTouchButtonStates(): void {
  for (const action of TOUCH_ACTIONS) {
    touchControls.buttons[action].classList.toggle(
      'touch-active',
      touchState.pointersByAction[action].size > 0,
    );
  }
}

function trySetPointerCapture(button: HTMLButtonElement, pointerId: number): void {
  try {
    button.setPointerCapture(pointerId);
  } catch {
    // Synthetic browser tests and some old touch browsers may not allow capture for this event.
  }
}

function isSettingsFormEvent(event: KeyboardEvent): boolean {
  const target = event.target;
  return target instanceof HTMLElement && Boolean(target.closest('#settings-panel'));
}

function setupStartButton(): void {
  hud.startButton.addEventListener('click', () => {
    const nextSession = requestRaceStart(session);
    if (nextSession.phase !== session.phase) {
      session = nextSession;
      running = true;
      void audioEngine.start();
      hud.startPanel.classList.add('hidden');
    }
  });
}

function setupDevTestControls(): void {
  if (!import.meta.env.DEV) {
    return;
  }

  window.__racingGameTestControls = {
    finishRace: finishRaceForTest,
    placeOnBoostPad: placeOnBoostPadForTest,
    placeOnObstacle: placeOnObstacleForTest,
    placeOnGrossHazard: placeOnGrossHazardForTest,
    placeNearOpponent: placeNearOpponentForTest,
  };
}

function placeOnBoostPadForTest(index = 0): void {
  const boostPad = getFeatureByIndex(track.boostPads, index);
  if (!boostPad) {
    return;
  }
  placeVehicleOnFeatureForTest(boostPad, 30);
}

function placeOnObstacleForTest(index = 0): void {
  const obstacle = getFeatureByIndex(track.obstacles, index);
  if (!obstacle) {
    return;
  }
  placeVehicleOnFeatureForTest(obstacle, 24);
}

function placeOnGrossHazardForTest(kind: 'peeSprayer' | 'poopLog'): void {
  const hazard = track.grossHazards.find((entry) => entry.kind === kind);
  if (!hazard) {
    return;
  }
  placeVehicleOnFeatureForTest(hazard, kind === 'poopLog' ? 28 : 22);
}

function placeNearOpponentForTest(index = 0): void {
  const opponent = getFeatureByIndex(opponents, index);
  if (!opponent) {
    return;
  }

  const side = perpendicularOffset(opponent.heading, 1.1);
  vehicle = {
    ...vehicle,
    position: {
      x: opponent.position.x + side.x,
      z: opponent.position.z + side.z,
    },
    heading: opponent.heading,
    speed: Math.max(24, opponent.speed + 7),
    lateralVelocity: 0,
    drift: 0,
  };
  opponentBumps = {
    ...opponentBumps,
    cooldownSeconds: 0,
    flashSeconds: 0,
  };
  updateCarMesh(car, vehicle);
  window.__racingGameDebug = createDebugState();
}

function getFeatureByIndex<TFeature>(
  features: readonly TFeature[],
  index: number,
): TFeature | null {
  if (features.length === 0) {
    return null;
  }
  return features[Math.trunc(clamp(index, 0, features.length - 1))] ?? null;
}

function placeVehicleOnFeatureForTest(feature: TrackPoint, speed: number): void {
  const projection = projectPointOntoTrack(track, feature);
  const centerlineSample = sampleTrackCenterlineAtDistance(track, projection.distanceAlongLap);
  vehicle = {
    ...vehicle,
    position: { x: feature.x, z: feature.z },
    heading: centerlineSample.heading,
    speed,
    lateralVelocity: 0,
    drift: 0,
  };
  trackFeatures = updateTrackFeatureDebugState(
    trackFeatures,
    sampleTrackFeatureEffects(track, feature.x, feature.z),
    0,
  );
  updateCarMesh(car, vehicle);
  window.__racingGameDebug = createDebugState();
}

function finishRaceForTest(): void {
  const replay = createDeterministicFinishedProgress();
  progress = replay.progress;
  elapsedSeconds = replay.elapsedSeconds;
  ghostReplay = createDeterministicGhostReplay();
  ghostReplayStatus = createGhostReplayStatus(ghostReplay);
  ghostPose = null;
  ghostCar.visible = false;
  updateGhostVisualAid(false);
  vehicle = {
    ...vehicle,
    position: {
      x: track.checkpoints[0]?.x ?? startPose.x,
      z: track.checkpoints[0]?.z ?? startPose.z,
    },
    heading: startPose.heading,
    speed: 0,
  };
  const finishDistance = getTrackLapLength(track) * progress.totalLaps;
  opponents = finishRemainingOpponents(opponents, elapsedSeconds, finishDistance);
  session = finishRace(session, [
    {
      id: 'player',
      name: 'You',
      finishSeconds: elapsedSeconds,
    },
    ...getOpponentResults(opponents),
  ]);
  running = false;
  trackFeedback = createTrackFeedbackState();
  trackFeatures = createTrackFeatureDebugState();
  grossEffects = createGrossEffectsState();
  opponentBumps = createOpponentBumpState();
  hud.startPanel.classList.add('hidden');
  updateTouchControlsVisibility();
  updateGhostReplayMesh();
  updateGrossOverlay();
  updateHud(progress, vehicle);
  updateRaceAwareness();
  updateResultsBoard();
  updateRaceAudio(false);
  window.__racingGameDebug = createDebugState();
}

function createDeterministicFinishedProgress(): {
  readonly progress: RaceProgress;
  readonly elapsedSeconds: number;
} {
  let replayProgress = createRaceProgress(track.checkpoints, progress.totalLaps);
  let replayElapsedSeconds = 0;
  const startCheckpoint = track.checkpoints[0];

  if (!startCheckpoint) {
    return {
      progress: replayProgress,
      elapsedSeconds: replayElapsedSeconds,
    };
  }

  replayProgress = updateRaceProgress(
    replayProgress,
    track.checkpoints,
    startCheckpoint,
    replayElapsedSeconds,
  );

  for (let lapIndex = 0; lapIndex < replayProgress.totalLaps; lapIndex += 1) {
    for (let checkpointIndex = 1; checkpointIndex < track.checkpoints.length; checkpointIndex += 1) {
      replayElapsedSeconds += getDeterministicSectorSeconds(lapIndex, checkpointIndex - 1);
      replayProgress = updateRaceProgress(
        replayProgress,
        track.checkpoints,
        track.checkpoints[checkpointIndex],
        replayElapsedSeconds,
      );
    }

    replayElapsedSeconds += getDeterministicSectorSeconds(lapIndex, track.checkpoints.length - 1);
    replayProgress = updateRaceProgress(
      replayProgress,
      track.checkpoints,
      startCheckpoint,
      replayElapsedSeconds,
    );
  }

  return {
    progress: replayProgress,
    elapsedSeconds: replayElapsedSeconds,
  };
}

function createDeterministicGhostReplay(): GhostReplayState {
  let replay = createGhostReplayState();
  const startCheckpoint = track.checkpoints[0];

  if (!startCheckpoint) {
    return replay;
  }

  const bestLapIndex = getDeterministicBestLapIndex(progress.totalLaps);
  let lapSeconds = 0;
  replay = recordGhostReplaySample(replay, {
    lapSeconds,
    x: startCheckpoint.x,
    z: startCheckpoint.z,
    headingRadians: startPose.heading,
  });

  for (let checkpointIndex = 1; checkpointIndex < track.checkpoints.length; checkpointIndex += 1) {
    const previousCheckpoint = track.checkpoints[checkpointIndex - 1];
    const checkpoint = track.checkpoints[checkpointIndex];
    lapSeconds += getDeterministicSectorSeconds(bestLapIndex, checkpointIndex - 1);
    replay = recordGhostReplaySample(replay, {
      lapSeconds,
      x: checkpoint.x,
      z: checkpoint.z,
      headingRadians: getHeadingBetweenPoints(previousCheckpoint, checkpoint),
    });
  }

  const previousCheckpoint = track.checkpoints[track.checkpoints.length - 1] ?? startCheckpoint;
  lapSeconds += getDeterministicSectorSeconds(bestLapIndex, track.checkpoints.length - 1);
  replay = recordGhostReplaySample(replay, {
    lapSeconds,
    x: startCheckpoint.x,
    z: startCheckpoint.z,
    headingRadians: getHeadingBetweenPoints(previousCheckpoint, startCheckpoint),
  });
  return completeGhostReplayLap(replay, lapSeconds, true);
}

function getDeterministicSectorSeconds(lapIndex: number, sectorIndex: number): number {
  const sectorDurations = [
    [7.42, 8.18, 7.86, 9.12, 8.48],
    [7.06, 7.94, 7.68, 8.88, 8.16],
    [7.18, 8.04, 7.52, 9.02, 8.22],
  ] as const;
  const lapDurations = sectorDurations[lapIndex % sectorDurations.length];
  return lapDurations[sectorIndex % lapDurations.length];
}

function getDeterministicBestLapIndex(totalLaps: number): number {
  let bestLapIndex = 0;
  let bestLapSeconds = Number.POSITIVE_INFINITY;
  for (let lapIndex = 0; lapIndex < totalLaps; lapIndex += 1) {
    let lapSeconds = 0;
    for (let sectorIndex = 0; sectorIndex < track.checkpoints.length; sectorIndex += 1) {
      lapSeconds += getDeterministicSectorSeconds(lapIndex, sectorIndex);
    }
    if (lapSeconds < bestLapSeconds) {
      bestLapSeconds = lapSeconds;
      bestLapIndex = lapIndex;
    }
  }
  return bestLapIndex;
}

function getHeadingBetweenPoints(start: TrackPoint, end: TrackPoint): number {
  return Math.atan2(end.x - start.x, end.z - start.z);
}

function readInput(): ControlInput {
  return mergeControlInputs(resolveInputFromKeys(keys), resolveTouchInput(touchState));
}

function resetRace(): void {
  keys.clear();
  clearAllTouchControls();
  vehicle = createVehicleAtStart();
  progress = createRaceProgress(track.checkpoints, 3);
  session = resetRaceSession(session);
  trackFeedback = createTrackFeedbackState();
  trackFeatures = createTrackFeatureDebugState();
  grossEffects = createGrossEffectsState();
  opponentBumps = createOpponentBumpState();
  opponents = createOpponentGrid(track, progress.totalLaps);
  ghostReplay = resetGhostReplayRecording(ghostReplay);
  ghostReplayStatus = createGhostReplayStatus(ghostReplay);
  ghostPose = null;
  ghostCar.visible = false;
  updateGhostVisualAid(false);
  elapsedSeconds = 0;
  speedEffects = computeSpeedEffects({
    speed: 0,
    drift: 0,
    boostActive: false,
    deltaSeconds: 0,
    previousIntensity: 0,
  });
  speedEffects = applyMotionSettings(settings, speedEffects);
  driftSmokeEffect = computeDriftSmokeEffect({
    speed: 0,
    drift: 0,
    handbrake: false,
    deltaSeconds: 0,
    previousIntensity: 0,
  });
  updateDriftSmoke(0);
  writeCurrentAudioSnapshot(currentAudioSnapshot);
  writeRaceAudioSnapshot(lastAudioSnapshot, currentAudioSnapshot);
  audioMixInput.phase = session.phase;
  audioMixInput.speed = 0;
  audioMixInput.drift = 0;
  audioMixInput.boostActive = false;
  audioEngine.update(writeSettingsAudioMix(writeRaceAudioMix(audioMix, audioMixInput)));
  running = false;
  hud.startPanel.classList.remove('hidden');
  updateGrossOverlay();
  updateResultsBoard();
  updateTouchControlsVisibility();
}

function updateRaceAudio(boostActive: boolean): void {
  audioMixInput.phase = session.phase;
  audioMixInput.speed = vehicle.speed;
  audioMixInput.drift = vehicle.drift;
  audioMixInput.boostActive = boostActive;
  audioEngine.update(writeSettingsAudioMix(writeRaceAudioMix(audioMix, audioMixInput)));

  writeCurrentAudioSnapshot(currentAudioSnapshot);
  const cues = collectRaceAudioCues(lastAudioSnapshot, currentAudioSnapshot);
  for (let index = 0; index < cues.length; index += 1) {
    audioEngine.playCue(cues[index]);
  }
  writeRaceAudioSnapshot(lastAudioSnapshot, currentAudioSnapshot);
}

function writeCurrentAudioSnapshot(target: RaceAudioSnapshotTarget): RaceAudioSnapshotTarget {
  const next = track.checkpoints[progress.nextCheckpointIndex];
  audioSnapshotInput.phase = session.phase;
  audioSnapshotInput.lap = progress.currentLap;
  audioSnapshotInput.checkpoint = next?.id ?? 'finish';
  return writeRaceAudioSnapshot(target, audioSnapshotInput);
}

function writeSettingsAudioMix(mix: RaceAudioMixTarget): RaceAudioMixTarget {
  mix.masterGain = settings.muted ? 0 : mix.masterGain * settings.masterVolume;
  return mix;
}

function createTrackFeatureDebugState(): TrackFeatureDebugState {
  return {
    activeBoostPadId: null,
    activeObstacleId: null,
    activeGrossHazardId: null,
    lastBoostPadId: null,
    lastObstacleId: null,
    boostIntensity: 0,
    obstacleSeverity: 0,
    lastObstacleSpeedDelta: 0,
    grossHazardKind: null,
  };
}

function createGrossEffectsState(): GrossEffectsState {
  return {
    activeEffect: 'none',
    peeOverlayOpacity: 0,
    poopOverlayOpacity: 0,
    jumpActive: false,
    jumpHeight: 0,
    peeSplashes: 0,
    poopFalls: 0,
    poopJumps: 0,
    lastPeeHazardId: null,
    lastPoopHazardId: null,
    lastPoopOutcome: 'none',
    peeOverlaySeconds: 0,
    poopOverlaySeconds: 0,
    poopFallSeconds: 0,
    jumpSeconds: 0,
    jumpCooldownSeconds: 0,
    grossHazardCooldownSeconds: 0,
    grossHazardCooldownId: null,
    previousJumpPressed: false,
  };
}

function stepGrossEffects(
  previous: GrossEffectsState,
  input: ControlInput,
  deltaSeconds: number,
  racing: boolean,
): GrossEffectsState {
  const delta = clamp(deltaSeconds, 0, 0.1);
  const jumpDurationSeconds = 0.72;
  const nextJumpCooldownSeconds = Math.max(0, previous.jumpCooldownSeconds - delta);
  const jumpStarts = racing && input.jump && !previous.previousJumpPressed && nextJumpCooldownSeconds === 0;
  const jumpSeconds = jumpStarts
    ? jumpDurationSeconds
    : Math.max(0, previous.jumpSeconds - delta);
  const jumpActive = jumpSeconds > 0;
  const jumpT = jumpActive ? 1 - jumpSeconds / jumpDurationSeconds : 1;
  const jumpHeight = jumpActive ? Math.sin(jumpT * Math.PI) * 6.4 : 0;
  const peeOverlaySeconds = Math.max(0, previous.peeOverlaySeconds - delta);
  const poopOverlaySeconds = Math.max(0, previous.poopOverlaySeconds - delta);
  const poopFallSeconds = Math.max(0, previous.poopFallSeconds - delta);
  const activeEffect = poopOverlaySeconds > 0 ? 'poop' : peeOverlaySeconds > 0 ? 'pee' : 'none';

  return {
    ...previous,
    activeEffect,
    peeOverlayOpacity: roundFeatureNumber(clamp(peeOverlaySeconds / 1.4, 0, 1) * 0.72),
    poopOverlayOpacity: roundFeatureNumber(clamp(poopOverlaySeconds / 1.8, 0, 1) * 0.82),
    jumpActive,
    jumpHeight: roundFeatureNumber(jumpHeight),
    peeOverlaySeconds,
    poopOverlaySeconds,
    poopFallSeconds,
    jumpSeconds,
    jumpCooldownSeconds: jumpStarts ? 0.86 : nextJumpCooldownSeconds,
    grossHazardCooldownSeconds: Math.max(0, previous.grossHazardCooldownSeconds - delta),
    grossHazardCooldownId: previous.grossHazardCooldownSeconds - delta > 0 ? previous.grossHazardCooldownId : null,
    previousJumpPressed: input.jump,
  };
}

function handleGrossHazard(previous: GrossEffectsState, hazard: TrackGrossHazard | null): GrossEffectsState {
  if (!hazard || (previous.grossHazardCooldownSeconds > 0 && previous.grossHazardCooldownId === hazard.id)) {
    return previous;
  }

  if (hazard.kind === 'peeSprayer') {
    return {
      ...previous,
      activeEffect: 'pee',
      peeOverlayOpacity: 0.72,
      peeOverlaySeconds: 1.4,
      peeSplashes: previous.peeSplashes + 1,
      lastPeeHazardId: hazard.id,
      grossHazardCooldownSeconds: 1,
      grossHazardCooldownId: hazard.id,
    };
  }

  const jumped = previous.jumpActive || previous.jumpHeight > 1.4;
  return {
    ...previous,
    activeEffect: jumped ? previous.activeEffect : 'poop',
    poopOverlayOpacity: jumped ? previous.poopOverlayOpacity : 0.82,
    poopOverlaySeconds: jumped ? previous.poopOverlaySeconds : 1.8,
    poopFallSeconds: jumped ? previous.poopFallSeconds : 0.78,
    poopFalls: jumped ? previous.poopFalls : previous.poopFalls + 1,
    poopJumps: jumped ? previous.poopJumps + 1 : previous.poopJumps,
    lastPoopHazardId: hazard.id,
    lastPoopOutcome: jumped ? 'jumped' : 'fell',
    grossHazardCooldownSeconds: 1,
    grossHazardCooldownId: hazard.id,
  };
}

function applyGrossFallPenalty(state: VehicleState, effects: GrossEffectsState, deltaSeconds: number): VehicleState {
  if (effects.poopFallSeconds <= 0 || Math.abs(state.speed) < 0.2) {
    return state;
  }

  const severity = clamp(effects.poopFallSeconds / 0.78, 0, 1);
  const speedLoss = Math.min(Math.abs(state.speed), 74 * severity * clamp(deltaSeconds, 0, 0.05));
  return {
    ...state,
    speed: state.speed - Math.sign(state.speed) * speedLoss,
    lateralVelocity: state.lateralVelocity * 0.88,
    drift: Math.max(state.drift, 0.22 * severity),
  };
}

function createGrossEffectsDebugState(state: GrossEffectsState): GrossEffectsDebugState {
  return {
    activeEffect: state.activeEffect,
    peeOverlayOpacity: state.peeOverlayOpacity,
    poopOverlayOpacity: state.poopOverlayOpacity,
    jumpActive: state.jumpActive,
    jumpHeight: state.jumpHeight,
    peeSplashes: state.peeSplashes,
    poopFalls: state.poopFalls,
    poopJumps: state.poopJumps,
    lastPeeHazardId: state.lastPeeHazardId,
    lastPoopHazardId: state.lastPoopHazardId,
    lastPoopOutcome: state.lastPoopOutcome,
  };
}

function updateGrossOverlay(): void {
  hud.grossOverlay.dataset.effect = grossEffects.activeEffect;
  hud.grossOverlay.style.setProperty('--pee-opacity', grossEffects.peeOverlayOpacity.toFixed(3));
  hud.grossOverlay.style.setProperty('--poop-opacity', grossEffects.poopOverlayOpacity.toFixed(3));
  hud.grossOverlayLabel.textContent =
    grossEffects.activeEffect === 'pee'
      ? 'Piddle splash!'
      : grossEffects.activeEffect === 'poop'
        ? 'Stinky splat!'
        : '';
}

function updateTrackFeatureDebugState(
  previous: TrackFeatureDebugState,
  effects: TrackFeatureEffects,
  lastObstacleSpeedDelta: number,
): TrackFeatureDebugState {
  const activeBoostPadId = effects.boostPad?.id ?? null;
  const activeObstacleId = effects.obstacle?.id ?? null;
  return {
    activeBoostPadId,
    activeObstacleId,
    activeGrossHazardId: effects.grossHazard?.id ?? null,
    lastBoostPadId: activeBoostPadId ?? previous.lastBoostPadId,
    lastObstacleId: activeObstacleId ?? previous.lastObstacleId,
    boostIntensity: roundFeatureNumber(effects.boostPad?.strength ?? 0),
    obstacleSeverity: roundFeatureNumber(effects.obstacle?.severity ?? 0),
    lastObstacleSpeedDelta: roundFeatureNumber(lastObstacleSpeedDelta),
    grossHazardKind: effects.grossHazard?.kind ?? null,
  };
}

function applyObstaclePenalty(
  state: VehicleState,
  obstacleSeverity: number,
  deltaSeconds: number,
): {
  readonly vehicle: VehicleState;
  readonly speedDelta: number;
} {
  const severity = clamp(obstacleSeverity, 0, 1);
  if (severity === 0 || Math.abs(state.speed) < 0.2) {
    return { vehicle: state, speedDelta: 0 };
  }

  const speedBefore = state.speed;
  const speedLoss = Math.min(Math.abs(state.speed), severity * 52 * clamp(deltaSeconds, 0, 0.05));
  const speed = state.speed - Math.sign(state.speed) * speedLoss;
  return {
    vehicle: {
      ...state,
      speed,
      lateralVelocity: state.lateralVelocity * (1 - severity * 0.08),
      drift: state.drift * (1 + severity * 0.12),
    },
    speedDelta: speed - speedBefore,
  };
}

function roundFeatureNumber(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function finishRemainingOpponents(
  currentOpponents: readonly OpponentState[],
  raceElapsedSeconds: number,
  playerDistance: number,
): readonly OpponentState[] {
  let simulatedOpponents = currentOpponents;
  let simulatedElapsedSeconds = raceElapsedSeconds;
  const simulationDeltaSeconds = 0.1;
  const maxSimulationSteps = 1600;

  for (let step = 0; step < maxSimulationSteps; step += 1) {
    if (simulatedOpponents.every((opponent) => opponent.finishedAtSeconds !== null)) {
      return simulatedOpponents;
    }
    simulatedElapsedSeconds += simulationDeltaSeconds;
    simulatedOpponents = stepOpponents(
      simulatedOpponents,
      track,
      simulationDeltaSeconds,
      true,
      simulatedElapsedSeconds,
      { playerDistance },
    );
  }

  return simulatedOpponents;
}

function updateResultsBoard(): void {
  splitSummaryDisplay = createRaceSplitSummary(progress);

  if (session.phase !== 'finished' || session.results.length === 0) {
    hud.resultsPanel.classList.add('hidden');
    hud.resultsPanel.hidden = true;
    document.body.classList.remove('race-results-visible');
    hideSplitSummary();
    if (renderedResultsKey !== '') {
      hud.resultsList.replaceChildren();
      renderedResultsKey = '';
    }
    return;
  }

  const resultsKey = [
    session.results.map((result) => `${result.id}:${result.finishSeconds.toFixed(3)}`).join('|'),
    `laps:${progress.completedLapSeconds.length}`,
    `sectors:${progress.completedSectorSplits.length}`,
  ].join('|');
  if (resultsKey === renderedResultsKey) {
    return;
  }

  const items = session.results.map((result, index) => {
    const item = document.createElement('li');
    const position = document.createElement('span');
    const name = document.createElement('strong');
    const time = document.createElement('span');

    position.textContent = String(index + 1).padStart(2, '0');
    name.textContent = result.name;
    time.textContent = formatSeconds(result.finishSeconds);
    item.append(position, name, time);
    return item;
  });

  hud.resultsList.replaceChildren(...items);
  renderSplitSummary(splitSummaryDisplay);
  hud.resultsPanel.hidden = false;
  hud.resultsPanel.classList.remove('hidden');
  document.body.classList.add('race-results-visible');
  renderedResultsKey = resultsKey;
}

function isResultsVisible(): boolean {
  return session.phase === 'finished' && session.results.length > 0;
}

function renderSplitSummary(summary: RaceSplitSummaryState): void {
  if (!summary.visible) {
    hideSplitSummary();
    return;
  }

  const lapRows = summary.lapRows.map((row) => {
    const item = document.createElement('div');
    const label = document.createElement('span');
    const time = document.createElement('strong');

    item.className = 'lap-split-row';
    item.dataset.tone = row.isBest ? 'best' : 'normal';
    label.textContent = row.lapLabel;
    time.textContent = row.timeLabel;
    item.append(label, time);

    if (row.isBest) {
      const badge = document.createElement('span');
      badge.className = 'lap-split-badge';
      badge.textContent = 'Best';
      item.append(badge);
    }

    return item;
  });

  const sectorRows = summary.sectorRows.map((row) => {
    const item = document.createElement('div');
    const label = document.createElement('span');
    const chips = document.createElement('div');

    item.className = 'sector-split-row';
    label.className = 'sector-split-lap';
    label.textContent = row.lapLabel;
    chips.className = 'sector-chip-list';

    for (const sector of row.sectors) {
      const chip = document.createElement('span');
      chip.className = 'sector-chip';
      chip.dataset.tone = sector.tone;
      chip.textContent = `${sector.sectorLabel} ${sector.timeLabel}`;
      chips.append(chip);
    }

    item.append(label, chips);
    return item;
  });

  hud.lapSplits.replaceChildren(...lapRows);
  hud.sectorSplits.replaceChildren(...sectorRows);
  hud.splitSummary.hidden = false;
  hud.splitSummary.classList.remove('hidden');
}

function hideSplitSummary(): void {
  hud.splitSummary.hidden = true;
  hud.splitSummary.classList.add('hidden');
  hud.lapSplits.replaceChildren();
  hud.sectorSplits.replaceChildren();
}

function getRaceStatusText(currentSession: RaceSession, feedback: TrackFeedbackState): string {
  if (currentSession.phase === 'idle') {
    return 'READY';
  }
  if (currentSession.phase === 'countdown') {
    return String(Math.max(1, Math.ceil(currentSession.countdownSeconds)));
  }
  if (currentSession.phase === 'racing') {
    return feedback.message ?? 'GO';
  }
  return 'FINISH';
}

function createVehicleAtStart(): VehicleState {
  return {
    ...createInitialVehicleState(),
    position: { x: startPose.x, z: startPose.z },
    heading: startPose.heading,
  };
}

function getStartPose(trackDefinition: TrackDefinition): TrackPoint & { heading: number } {
  const start = trackDefinition.centerline[0];
  const next = trackDefinition.centerline[1];
  return {
    x: start.x,
    z: start.z,
    heading: Math.atan2(next.x - start.x, next.z - start.z),
  };
}

function checkpointHeading(trackDefinition: TrackDefinition, checkpointId: string): number {
  const index = trackDefinition.checkpoints.findIndex((checkpoint) => checkpoint.id === checkpointId);
  const checkpoint = trackDefinition.checkpoints[index];
  const next = trackDefinition.checkpoints[(index + 1) % trackDefinition.checkpoints.length];
  if (!checkpoint || !next) {
    return 0;
  }
  return Math.atan2(next.x - checkpoint.x, next.z - checkpoint.z);
}

function segmentBox(
  start: TrackPoint,
  end: TrackPoint,
  width: number,
  height: number,
  y: number,
  material: THREE.Material,
  sideOffset = 0,
  lengthScale = 1,
): THREE.Mesh {
  const length = Math.hypot(end.x - start.x, end.z - start.z) * lengthScale;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), material);
  const midpoint = midpointOf(start, end);
  const heading = Math.atan2(end.x - start.x, end.z - start.z);
  const offset = perpendicularOffset(heading, sideOffset);
  mesh.position.set(midpoint.x + offset.x, y, midpoint.z + offset.z);
  mesh.rotation.y = heading;
  mesh.receiveShadow = true;
  return mesh;
}

function edgeRail(start: TrackPoint, end: TrackPoint, sideOffset: number, material: THREE.Material): THREE.Mesh {
  const rail = segmentBox(start, end, 0.44, 1.4, 0.92, material, sideOffset, 0.94);
  rail.castShadow = true;
  return rail;
}

function forEachSegment(
  points: readonly TrackPoint[],
  callback: (start: TrackPoint, end: TrackPoint, index: number) => void,
): void {
  for (let i = 0; i < points.length; i += 1) {
    callback(points[i], points[(i + 1) % points.length], i);
  }
}

function midpointOf(start: TrackPoint, end: TrackPoint): TrackPoint {
  return {
    x: (start.x + end.x) * 0.5,
    z: (start.z + end.z) * 0.5,
  };
}

function perpendicularOffset(heading: number, distance: number): TrackPoint {
  return {
    x: Math.cos(heading) * distance,
    z: -Math.sin(heading) * distance,
  };
}

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, graphicsProfile.pixelRatioCap));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function handleResize(): void {
  resize();
  updateTouchControlsVisibility();
}

function createDebugState(): DebugState {
  const next = track.checkpoints[progress.nextCheckpointIndex];
  return {
    running,
    phase: session.phase,
    countdownSeconds: session.countdownSeconds,
    frame,
    speed: vehicle.speed,
    character: createCharacterDebugState(),
    trackFeedback: { ...trackFeedback },
    trackFeatures: { ...trackFeatures },
    grossEffects: createGrossEffectsDebugState(grossEffects),
    lap: progress.currentLap,
    checkpoint: next?.id ?? 'finish',
    carX: vehicle.position.x,
    carZ: vehicle.position.z,
    carHeading: vehicle.heading,
    speedEffects: {
      intensity: speedEffects.intensity,
      cameraFov: speedEffects.cameraFov,
      vignetteOpacity: speedEffects.vignetteOpacity,
      streakOpacity: speedEffects.streakOpacity,
    },
    driftSmoke: { ...driftSmokeEffect },
    audio: audioEngine.getDebugState(),
    trackArt: {
      ...trackArt.debug,
      startLights: getStartLightDebug(session),
    },
    settings: { ...settings },
    graphics: {
      quality: graphicsProfile.quality,
      pixelRatioCap: graphicsProfile.pixelRatioCap,
      speedStreaksVisible: graphicsProfile.speedStreaksVisible,
      rendererPixelRatio: renderer.getPixelRatio(),
    },
    camera: {
      mode: cameraProfile.mode,
      chaseDistance: cameraProfile.chaseDistance,
      chaseHeight: cameraProfile.chaseHeight,
      lookAhead: cameraProfile.lookAhead,
      targetHeight: cameraProfile.targetHeight,
      fov: camera.fov,
    },
    controlHintsVisible: !settingsElements.controlHints.hidden,
    touchControls: {
      visible: touchControlsVisible,
      mode: settings.touchControlsMode,
      activeActions: getActiveTouchActions(touchState),
      input: resolveTouchInput(touchState),
    },
    racePosition: {
      position: racePosition.position,
      total: racePosition.total,
      participants: racePosition.participants.map((participant) => ({ ...participant })),
    },
    raceAwareness: { ...raceAwareness },
    timing: { ...timingDisplay },
    splitSummary: cloneSplitSummary(splitSummaryDisplay),
    ghostReplay: createGhostReplayDebugState(),
    minimap: {
      canvasWidth: minimapDebug.canvasWidth,
      canvasHeight: minimapDebug.canvasHeight,
      progressRatio: minimapDebug.progressRatio,
      markers: minimapDebug.markers.map((marker) => ({ ...marker })),
    },
    opponents: opponents.map((opponent) => ({
      id: opponent.id,
      x: opponent.position.x,
      z: opponent.position.z,
      lap: opponent.lap,
      speed: opponent.speed,
      targetSpeed: opponent.targetSpeed,
      pressureBonus: opponent.pressureBonus,
      peakPressureBonus: opponent.peakPressureBonus,
      racingLineOffset: opponent.racingLineOffset,
      passingLineOffset: opponent.passingLineOffset,
      finishedAtSeconds: opponent.finishedAtSeconds,
    })),
    opponentBumps: createOpponentBumpDebugState(opponentBumps),
    results: session.results.map((result) => ({ ...result })),
  };
}

function createCharacterDebugState(): CharacterDebugState {
  return {
    id: selectedCharacter.id,
    name: selectedCharacter.name,
    title: selectedCharacter.title,
    imageSrc: selectedCharacter.imageSrc,
    carColor: selectedCharacter.carColor,
    accentColor: selectedCharacter.accentColor,
    stats: { ...selectedCharacter.stats },
    performance: { ...getCharacterPerformance(selectedCharacter) },
  };
}

function createGhostReplayDebugState(): GhostReplayDebugState {
  return {
    status: { ...ghostReplayStatus },
    visible: ghostCar.visible,
    currentSampleCount: ghostReplay.currentSamples.length,
    bestSampleCount: ghostReplay.bestLap?.samples.length ?? 0,
    bestLapSeconds: ghostReplay.bestLap?.durationSeconds ?? null,
    x: ghostPose?.x ?? null,
    z: ghostPose?.z ?? null,
    heading: ghostPose?.headingRadians ?? null,
    visualAid: { ...ghostVisualAidState },
  };
}

function cloneSplitSummary(summary: RaceSplitSummaryState): RaceSplitSummaryState {
  return {
    visible: summary.visible,
    lapRows: summary.lapRows.map((row) => ({ ...row })),
    sectorRows: summary.sectorRows.map((row) => ({
      lapNumber: row.lapNumber,
      lapLabel: row.lapLabel,
      sectors: row.sectors.map((sector) => ({ ...sector })),
    })),
  };
}

function formatSeconds(value: number): string {
  return value.toFixed(2);
}

function seededNoise(value: number): number {
  const raw = Math.sin(value * 12.9898) * 43758.5453;
  return raw - Math.floor(raw);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mustGet<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }
  return element as T;
}

function getMinimapContext(): CanvasRenderingContext2D {
  const context = hud.minimapCanvas.getContext('2d');
  if (!context) {
    throw new Error('Missing minimap 2D context');
  }
  return context;
}
