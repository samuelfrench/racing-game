import type { TrackDefinition } from './track';
import { projectPointOntoTrack, sampleTrackCenterlineAtDistance } from './track-progress';
import type { VehicleState } from './vehicle';

export type TrackFeedbackMessage = 'OFF TRACK' | 'WRONG WAY' | 'RECOVERING';

export type TrackFeedbackState = {
  readonly distanceFromCenter: number;
  readonly offTrack: boolean;
  readonly wrongWay: boolean;
  readonly recovering: boolean;
  readonly wrongWaySeconds: number;
  readonly recoveryFlashSeconds: number;
  readonly message: TrackFeedbackMessage | null;
};

export type TrackFeedbackInput = {
  readonly track: TrackDefinition;
  readonly vehicle: VehicleState;
  readonly deltaSeconds: number;
  readonly racing: boolean;
};

export type TrackFeedbackResult = {
  readonly state: TrackFeedbackState;
  readonly vehicle: VehicleState;
};

const recoveryExtraDistance = 28;
const recoveryFlashSeconds = 1.15;
const recoveredSpeedFactor = 0.35;
const recoveredSpeedCap = 18;
const wrongWayMinimumSpeed = 5;
const wrongWayReverseSpeed = -5;
const wrongWayAngleRadians = 2.1;
const wrongWayGraceSeconds = 0.45;

export function createTrackFeedbackState(): TrackFeedbackState {
  return {
    distanceFromCenter: 0,
    offTrack: false,
    wrongWay: false,
    recovering: false,
    wrongWaySeconds: 0,
    recoveryFlashSeconds: 0,
    message: null,
  };
}

export function updateTrackFeedback(
  previous: TrackFeedbackState,
  input: TrackFeedbackInput,
): TrackFeedbackResult {
  const deltaSeconds = sanitizeDeltaSeconds(input.deltaSeconds);

  if (!input.racing) {
    return {
      state: createTrackFeedbackState(),
      vehicle: input.vehicle,
    };
  }

  const projection = projectPointOntoTrack(input.track, input.vehicle.position);
  const centerlineSample = sampleTrackCenterlineAtDistance(input.track, projection.distanceAlongLap);
  const halfRoadWidth = input.track.roadWidth / 2;
  const offTrack = projection.distanceFromCenter > halfRoadWidth;
  const recoveryDistance = halfRoadWidth + input.track.shoulderWidth + recoveryExtraDistance;
  const recovering = projection.distanceFromCenter > recoveryDistance;

  if (recovering) {
    const recoveredVehicle: VehicleState = {
      ...input.vehicle,
      position: { ...centerlineSample.position },
      heading: centerlineSample.heading,
      speed: Math.min(Math.abs(input.vehicle.speed) * recoveredSpeedFactor, recoveredSpeedCap),
      lateralVelocity: 0,
      drift: 0,
    };

    return {
      state: {
        distanceFromCenter: projection.distanceFromCenter,
        offTrack: true,
        wrongWay: false,
        recovering: true,
        wrongWaySeconds: 0,
        recoveryFlashSeconds,
        message: 'RECOVERING',
      },
      vehicle: recoveredVehicle,
    };
  }

  const wrongWayCandidate = isWrongWayCandidate(input.vehicle, centerlineSample.heading);
  const wrongWaySeconds = wrongWayCandidate ? previous.wrongWaySeconds + deltaSeconds : 0;
  const wrongWay = wrongWaySeconds >= wrongWayGraceSeconds;
  const remainingRecoveryFlashSeconds = Math.max(0, previous.recoveryFlashSeconds - deltaSeconds);
  const flashingRecovery = remainingRecoveryFlashSeconds > 0;
  const message = getTrackFeedbackMessage({
    recovering: flashingRecovery,
    wrongWay,
    offTrack,
  });

  return {
    state: {
      distanceFromCenter: projection.distanceFromCenter,
      offTrack,
      wrongWay,
      recovering: flashingRecovery,
      wrongWaySeconds,
      recoveryFlashSeconds: remainingRecoveryFlashSeconds,
      message,
    },
    vehicle: input.vehicle,
  };
}

function isWrongWayCandidate(vehicle: VehicleState, trackHeading: number): boolean {
  if (Math.abs(vehicle.speed) < wrongWayMinimumSpeed) {
    return false;
  }

  const travelHeading = vehicle.speed < wrongWayReverseSpeed ? vehicle.heading + Math.PI : vehicle.heading;
  return getAngleDelta(travelHeading, trackHeading) >= wrongWayAngleRadians;
}

function getTrackFeedbackMessage(input: {
  readonly recovering: boolean;
  readonly wrongWay: boolean;
  readonly offTrack: boolean;
}): TrackFeedbackMessage | null {
  if (input.recovering) {
    return 'RECOVERING';
  }

  if (input.wrongWay) {
    return 'WRONG WAY';
  }

  if (input.offTrack) {
    return 'OFF TRACK';
  }

  return null;
}

function getAngleDelta(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function sanitizeDeltaSeconds(deltaSeconds: number): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return 0;
  }

  return deltaSeconds;
}
