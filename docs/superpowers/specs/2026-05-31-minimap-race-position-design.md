# Minimap and Race Position Design

## Goal

Add a compact track minimap and live race-position display so players can understand where they are, where opponents are, and whether they are gaining or falling behind.

## Design

Use the existing HUD instead of adding another floating panel. The `split-card` becomes a compact race-awareness card:

- left side: checkpoint, best lap, and position (`1/4`, `2/4`, etc.)
- right side: a small canvas minimap

This keeps desktop dense and keeps mobile from adding another full-width card. On narrow screens the minimap stays fixed-size and the text column truncates safely.

## Race Position

Create shared track-distance helpers that project any world point onto the closed centerline:

- `getTrackLapLength(track)`
- `projectPointOntoTrack(track, point)`
- `sampleTrackCenterlineAtDistance(track, distance)`

Refactor AI opponents to use these helpers instead of private duplicated segment code. Add a separate race-position helper that ranks the player and opponents by finished time first, then by total distance traveled. The player distance is computed from current lap plus projected distance around the current lap.

Tie-breaking is deterministic: higher distance wins, lower finish time wins for completed racers, and the player wins exact distance ties so the start grid does not show the player behind an identical-distance opponent.

## Minimap

Draw the minimap on a 2D canvas each frame:

- closed track outline
- next checkpoint ring
- player marker
- opponent markers in their car colors

The canvas uses the track bounds, padded to preserve aspect ratio. The canvas drawing is independent of Three.js and does not affect game physics. The debug state exposes the normalized minimap marker data and race-position state for Playwright tests.

## Runtime Behavior

The HUD updates every animation frame after race state updates:

- position text shows the player's current rank out of all racers
- minimap markers follow player and AI positions during countdown and racing
- after finish, the position follows final classified results
- reset restores position and marker state to the starting grid

## Testing

Add Vitest coverage for:

- track projection and sampling around a closed centerline
- player/opponent ranking by distance and finish time
- deterministic tie-breaks

Add Playwright coverage for:

- visible position text with `1/4` style formatting
- minimap canvas visible and nonblank
- debug state exposing four ranked participants and minimap markers
- mobile layout keeps minimap visible without overlapping touch controls or settings
