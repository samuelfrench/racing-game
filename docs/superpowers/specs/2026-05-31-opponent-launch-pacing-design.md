# Opponent Launch Pacing Design

## Goal

Make the opening seconds of each race feel competitive now that the position HUD exposes race order.

## Problem

Opponents currently move at their configured top speed as soon as the race phase changes to `racing`. The player starts from zero speed and accelerates through vehicle physics. In browser smoke tests, holding throttle cleanly for the first second still drops the player to 4th because the AI cars have already traveled roughly five times farther.

## Design

Keep the simple centerline AI, but give opponents a real launch phase:

- opponents start with `speed: 0`
- each opponent has a `targetSpeed` and `acceleration`
- `stepOpponents` ramps current speed toward `targetSpeed` while racing
- distance advances from current speed, not instant top speed
- non-racing phases still freeze opponent positions

The player should be able to hold throttle through the countdown and remain in the fight during the first second. The fastest opponent should still become competitive once it reaches top speed, so this is not a passive-AI nerf.

## Data Model

Extend `OpponentState`:

- `speed`: current speed used for movement and debug
- `targetSpeed`: steady-state pace
- `acceleration`: launch acceleration in world units per second squared

The existing `speed` field remains current speed so runtime debug continues to mean what it says. Config speed becomes `targetSpeed`.

## Testing

Add Vitest coverage proving:

- newly-created opponents have zero current speed and configured target speeds
- countdown/frozen phases do not advance speed or distance
- the first second of racing advances less than instant-top-speed behavior
- repeated racing steps ramp toward target speed
- finish interpolation uses current speed safely

Add Playwright coverage proving:

- after race start and roughly one second of held throttle, the player is not immediately last
- debug opponent speeds are finite and at least one opponent is still below target speed during the launch window
