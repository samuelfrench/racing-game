# Track Boundary Recovery and Wrong-Way Feedback Design

## Goal

Improve driving readability and prevent dead runs when the player leaves the track or drives against race direction.

## Problem

The current track surface model only lowers grip off-road. A player can keep driving deep into the terrain with no clear feedback and no recovery path except resetting the whole race. The game also has checkpoints, race position, and a minimap now, but it does not warn when the player is moving opposite the route.

## Design

Add a small pure gameplay layer that evaluates the player against the track centerline each racing frame:

- `OFF TRACK` when the car leaves the paved road.
- `WRONG WAY` after the car travels opposite the current centerline direction for a short grace period.
- `RECOVERING` when the car is far beyond the shoulder and gets snapped back to the nearest centerline point.

The warnings use the existing race status HUD so the player does not have to learn a new control surface. Priority is:

1. `RECOVERING`
2. `WRONG WAY`
3. `OFF TRACK`
4. normal race phase text

## Boundary Recovery

Track recovery should be forgiving, not punitive:

- road and shoulder driving keep existing grip behavior
- mild off-road driving only shows `OFF TRACK`
- deep off-road driving triggers automatic recovery
- recovery snaps the car to the nearest centerline sample
- heading aligns to race direction
- forward speed is reduced instead of zeroed
- lateral velocity and drift are cleared
- boost fuel is preserved

Recovery only runs during the `racing` phase. Countdown, idle, and finished states do not move the car.

## Wrong-Way Detection

Wrong-way feedback uses travel direction, not only car heading:

- forward movement compares the car heading to the projected centerline heading
- reverse movement compares `heading + PI`
- very low speeds do not count
- the warning requires sustained opposite travel to avoid flicker during spins
- wrong-way state resets when the player travels with the route again or leaves the racing phase

## Runtime Debug

Expose track feedback in `window.__racingGameDebug.trackFeedback`:

- `distanceFromCenter`
- `offTrack`
- `wrongWay`
- `recovering`
- `message`

This lets Playwright verify the behavior without relying only on visual text.

## Testing

Add Vitest coverage for the pure track feedback module:

- on-road driving returns normal state
- off-road-but-not-deep driving warns without recovery
- sustained reverse travel triggers wrong-way
- deep off-road driving returns a recovered vehicle pose
- non-racing phases suppress warnings and recovery

Add Playwright coverage:

- race status text can fit `OFF TRACK`, `WRONG WAY`, and `RECOVERING`
- reversing after launch shows `WRONG WAY`
- debug state exposes track feedback fields

Manual smoke should still cover desktop, tablet, and mobile rendering, controls, minimap, race position, and console cleanliness.
