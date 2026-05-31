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
import { createDefaultTrack, sampleTrackSurface, type TrackDefinition, type TrackPoint } from './game/track';
import { computeSpeedEffects, type SpeedEffectState } from './game/speed-effects';
import { createInitialVehicleState, stepVehicle, type VehicleState } from './game/vehicle';

type HudElements = {
  lap: HTMLElement;
  boostMeter: HTMLElement;
  speed: HTMLElement;
  checkpoint: HTMLElement;
  bestLap: HTMLElement;
  raceStatus: HTMLElement;
  resultsPanel: HTMLElement;
  resultsList: HTMLOListElement;
  startPanel: HTMLElement;
  startButton: HTMLButtonElement;
  speedVignette: HTMLElement;
};

type DebugState = {
  running: boolean;
  phase: RacePhase;
  countdownSeconds: number;
  frame: number;
  speed: number;
  lap: number;
  checkpoint: string;
  carX: number;
  carZ: number;
  speedEffects: Pick<SpeedEffectState, 'intensity' | 'cameraFov' | 'vignetteOpacity' | 'streakOpacity'>;
  trackArt: TrackArtDebug;
  opponents: readonly DebugOpponent[];
  results: readonly RaceResult[];
};

type DebugOpponent = {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly lap: number;
  readonly finishedAtSeconds: number | null;
};

type TrackArtDebug = {
  readonly chevrons: number;
  readonly crowdPanels: number;
  readonly lightMasts: number;
  readonly speedStreaks: number;
};

type TrackArtMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

type AnimatedTrackArt = {
  readonly crowdPanels: readonly TrackArtMesh[];
  readonly lightMasts: readonly TrackArtMesh[];
  readonly speedStreaks: readonly TrackArtMesh[];
  readonly debug: TrackArtDebug;
};

declare global {
  interface Window {
    __racingGameDebug?: DebugState;
  }
}

const canvas = mustGet<HTMLCanvasElement>('game-canvas');
const hud = {
  lap: mustGet('lap'),
  boostMeter: mustGet('boost-meter'),
  speed: mustGet('speed'),
  checkpoint: mustGet('checkpoint'),
  bestLap: mustGet('best-lap'),
  raceStatus: mustGet('race-status'),
  resultsPanel: mustGet('results-panel'),
  resultsList: mustGet<HTMLOListElement>('results-list'),
  startPanel: mustGet('start-panel'),
  startButton: mustGet<HTMLButtonElement>('start-button'),
  speedVignette: mustGet('speed-vignette'),
} satisfies HudElements;

const track = createDefaultTrack();
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.debug.checkShaderErrors = false;
renderer.shadowMap.enabled = false;
renderer.setClearColor(0x071017, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071017);
scene.fog = new THREE.FogExp2(0x071017, 0.0048);

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 950);
const keys = new Set<string>();
const checkpointMeshes = new Map<string, THREE.Object3D>();
const startPose = getStartPose(track);
let vehicle = createVehicleAtStart();
let progress = createRaceProgress(track.checkpoints, 3);
let session: RaceSession = createRaceSession();
let opponents: readonly OpponentState[] = createOpponentGrid(track, progress.totalLaps);
let running = false;
let elapsedSeconds = 0;
let frame = 0;
let lastFrameTimestamp = performance.now();
let renderedResultsKey = '';
let speedEffects: SpeedEffectState = computeSpeedEffects({
  speed: 0,
  drift: 0,
  boostActive: false,
  deltaSeconds: 0,
  previousIntensity: 0,
});

const world = buildWorld(track);
const trackArt = addTracksideObjects(world, track);
scene.add(world);
const car = buildCar();
scene.add(car);
const opponentMeshes = opponents.map((opponent) => {
  const opponentCar = buildCar(opponent.color);
  opponentCar.scale.setScalar(0.92);
  scene.add(opponentCar);
  return opponentCar;
});
const followTarget = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const cameraPosition = new THREE.Vector3(startPose.x, 38, startPose.z - 58);

window.__racingGameDebug = createDebugState();
setupInput();
setupStartButton();
resize();
window.addEventListener('resize', resize);
requestAnimationFrame(loop);

function loop(timestamp = performance.now()): void {
  const deltaSeconds = Math.min((timestamp - lastFrameTimestamp) / 1000, 0.05);
  lastFrameTimestamp = timestamp;
  frame += 1;

  if (session.phase === 'countdown') {
    session = stepRaceSession(session, deltaSeconds);
  }

  const input = readInput();
  const boostActive = session.phase === 'racing' && input.boost && input.throttle > 0 && vehicle.boostFuel > 0;
  speedEffects = computeSpeedEffects({
    speed: vehicle.speed,
    drift: vehicle.drift,
    boostActive,
    deltaSeconds,
    previousIntensity: speedEffects.intensity,
  });

  if (session.phase === 'racing') {
    elapsedSeconds += deltaSeconds;
    const surface = sampleTrackSurface(track, vehicle.position.x, vehicle.position.z);
    vehicle = stepVehicle(vehicle, {
      ...input,
      deltaSeconds,
      trackGrip: surface.grip,
    });
    progress = updateRaceProgress(progress, track.checkpoints, vehicle.position, elapsedSeconds);
    opponents = stepOpponents(opponents, track, deltaSeconds, true, elapsedSeconds);

    if (progress.finished) {
      const playerResult: RaceResult = {
        id: 'player',
        name: 'You',
        finishSeconds: elapsedSeconds,
      };
      opponents = finishRemainingOpponents(opponents, elapsedSeconds);
      session = finishRace(session, [playerResult, ...getOpponentResults(opponents)]);
      running = false;
    }
  }

  updateCarMesh(car, vehicle);
  updateOpponentMeshes();
  updateCheckpoints(progress);
  updateCamera(deltaSeconds);
  updateSpeedEffects();
  animateTrackArt(deltaSeconds);
  updateHud(progress, vehicle);
  updateResultsBoard();
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
    debug: {
      chevrons,
      crowdPanels: crowdPanels.length,
      lightMasts: lightMasts.length,
      speedStreaks: speedStreaks.length,
    },
  };
}

function buildCar(bodyColor: THREE.ColorRepresentation = 0xff335f): THREE.Group {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshBasicMaterial({ color: bodyColor });
  const cockpitMaterial = new THREE.MeshBasicMaterial({
    color: 0x132d36,
  });
  const lightMaterial = new THREE.MeshBasicMaterial({ color: 0x36f1ff });
  const wheelMaterial = new THREE.MeshBasicMaterial({ color: 0x050607 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(4.3, 1.15, 6.6), bodyMaterial);
  body.position.y = 1.4;
  body.castShadow = true;
  group.add(body);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.55, 2.4), bodyMaterial);
  nose.position.set(0, 1.08, 3.35);
  nose.castShadow = true;
  group.add(nose);

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.95, 2.1), cockpitMaterial);
  cockpit.position.set(0, 2.2, -0.55);
  cockpit.castShadow = true;
  group.add(cockpit);

  const splitter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 0.28), lightMaterial);
  splitter.position.set(0, 0.78, 3.95);
  group.add(splitter);

  for (const x of [-1.35, 1.35]) {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.22, 0.34), lightMaterial);
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
  wing.position.set(0, 2.12, -3.45);
  wing.castShadow = true;
  group.add(wing);

  return group;
}

function updateCarMesh(carMesh: THREE.Group, state: VehicleState): void {
  carMesh.position.set(state.position.x, 0.12, state.position.z);
  carMesh.rotation.set(0, state.heading, -state.lateralVelocity * 0.016);
}

function updateOpponentMeshes(): void {
  opponents.forEach((opponent, index) => {
    const opponentMesh = opponentMeshes[index];
    if (!opponentMesh) {
      return;
    }
    const laneOffset = getOpponentLaneOffset(index, opponent.heading);
    opponentMesh.position.set(opponent.position.x + laneOffset.x, 0.1, opponent.position.z + laneOffset.z);
    opponentMesh.rotation.set(0, opponent.heading, 0);
  });
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
  const chaseDistance = 58;
  const chaseHeight = 28;
  const forward = new THREE.Vector3(Math.sin(vehicle.heading), 0, Math.cos(vehicle.heading));
  const desiredPosition = new THREE.Vector3(vehicle.position.x, chaseHeight, vehicle.position.z).addScaledVector(forward, -chaseDistance);
  cameraPosition.lerp(desiredPosition, clamp(deltaSeconds * 5.5, 0, 1));
  followTarget.set(vehicle.position.x, 3.6, vehicle.position.z).addScaledVector(forward, 30);
  cameraTarget.lerp(followTarget, clamp(deltaSeconds * 7, 0, 1));
  camera.position.copy(cameraPosition);
  camera.lookAt(cameraTarget);
}

function updateSpeedEffects(): void {
  camera.fov = speedEffects.cameraFov;
  camera.updateProjectionMatrix();
  hud.speedVignette.style.opacity = speedEffects.vignetteOpacity.toFixed(3);
  trackArt.speedStreaks.forEach((streak, index) => {
    streak.visible = speedEffects.intensity > 0.12;
    streak.material.opacity = speedEffects.streakOpacity * (index % 3 === 0 ? 0.82 : 1);
  });
}

function animateTrackArt(deltaSeconds: number): void {
  const pulse = 1 + Math.sin(elapsedSeconds * 8) * 0.045 * speedEffects.roadPulse;
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
    const forward = new THREE.Vector3(Math.sin(vehicle.heading), 0, Math.cos(vehicle.heading));
    const sideOffset = perpendicularOffset(vehicle.heading, laneOffset * side);
    streak.position.set(
      vehicle.position.x + sideOffset.x + forward.x * travel * speedEffects.intensity,
      0.35 + (index % 2) * 0.08,
      vehicle.position.z + sideOffset.z + forward.z * travel * speedEffects.intensity,
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
  hud.bestLap.textContent = raceProgress.bestLapSeconds === null ? '--' : formatSeconds(raceProgress.bestLapSeconds);
  hud.raceStatus.textContent = getRaceStatusText(session);
  hud.boostMeter.style.transform = `scaleX(${state.boostFuel.toFixed(3)})`;
}

function setupInput(): void {
  window.addEventListener('keydown', (event) => {
    keys.add(event.key.toLowerCase());
    if (event.key.toLowerCase() === 'r') {
      resetRace();
    }
  });

  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
  });
}

function setupStartButton(): void {
  hud.startButton.addEventListener('click', () => {
    const nextSession = requestRaceStart(session);
    if (nextSession.phase !== session.phase) {
      session = nextSession;
      running = true;
      hud.startPanel.classList.add('hidden');
    }
  });
}

function readInput(): ControlInput {
  return resolveInputFromKeys(keys);
}

function resetRace(): void {
  keys.clear();
  vehicle = createVehicleAtStart();
  progress = createRaceProgress(track.checkpoints, 3);
  session = resetRaceSession(session);
  opponents = createOpponentGrid(track, progress.totalLaps);
  elapsedSeconds = 0;
  speedEffects = computeSpeedEffects({
    speed: 0,
    drift: 0,
    boostActive: false,
    deltaSeconds: 0,
    previousIntensity: 0,
  });
  running = false;
  hud.startPanel.classList.remove('hidden');
  updateResultsBoard();
}

function finishRemainingOpponents(currentOpponents: readonly OpponentState[], raceElapsedSeconds: number): readonly OpponentState[] {
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
    );
  }

  return simulatedOpponents;
}

function updateResultsBoard(): void {
  if (session.phase !== 'finished' || session.results.length === 0) {
    hud.resultsPanel.classList.add('hidden');
    hud.resultsPanel.hidden = true;
    if (renderedResultsKey !== '') {
      hud.resultsList.replaceChildren();
      renderedResultsKey = '';
    }
    return;
  }

  const resultsKey = session.results.map((result) => `${result.id}:${result.finishSeconds.toFixed(3)}`).join('|');
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
  hud.resultsPanel.hidden = false;
  hud.resultsPanel.classList.remove('hidden');
  renderedResultsKey = resultsKey;
}

function getRaceStatusText(currentSession: RaceSession): string {
  if (currentSession.phase === 'idle') {
    return 'READY';
  }
  if (currentSession.phase === 'countdown') {
    return String(Math.max(1, Math.ceil(currentSession.countdownSeconds)));
  }
  if (currentSession.phase === 'racing') {
    return 'GO';
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

function getOpponentLaneOffset(index: number, heading: number): TrackPoint {
  const laneOffsets = [-6.2, 6.2, -2.2] as const;
  return perpendicularOffset(heading, laneOffsets[index % laneOffsets.length]);
}

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function createDebugState(): DebugState {
  const next = track.checkpoints[progress.nextCheckpointIndex];
  return {
    running,
    phase: session.phase,
    countdownSeconds: session.countdownSeconds,
    frame,
    speed: vehicle.speed,
    lap: progress.currentLap,
    checkpoint: next?.id ?? 'finish',
    carX: vehicle.position.x,
    carZ: vehicle.position.z,
    speedEffects: {
      intensity: speedEffects.intensity,
      cameraFov: speedEffects.cameraFov,
      vignetteOpacity: speedEffects.vignetteOpacity,
      streakOpacity: speedEffects.streakOpacity,
    },
    trackArt: trackArt.debug,
    opponents: opponents.map((opponent) => ({
      id: opponent.id,
      x: opponent.position.x,
      z: opponent.position.z,
      lap: opponent.lap,
      finishedAtSeconds: opponent.finishedAtSeconds,
    })),
    results: session.results.map((result) => ({ ...result })),
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
