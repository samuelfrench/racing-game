# Ghost Replay Design

## Goal

Add a best-lap ghost car that gives the player a visible benchmark after they complete at least one timed lap. The ghost should be lightweight, deterministic, and useful during normal racing without changing vehicle physics, opponent behavior, or race progression.

## Player Experience

- Before the first completed lap, no ghost is shown.
- After a completed lap becomes the personal best, the next lap shows a translucent cyan ghost following that best-lap path.
- If the player improves the best lap later, the ghost updates to that faster lap.
- The HUD shows a compact ghost status line with `No ghost`, `Best ghost`, or `New best ghost`.
- Resetting after a finish preserves the best ghost for the next race. Reloading the page starts a fresh session with no ghost.

## Architecture

- Add a pure `ghost-replay` module that records time-stamped pose samples for the current lap, stores the best completed lap, and interpolates a ghost pose for the current lap time.
- Keep replay data as small immutable arrays of `{ elapsedSeconds, x, z, heading }`.
- Integrate the module in `main.ts` at the race loop boundary: record samples while racing, complete or discard the current-lap recording when `RaceProgress` adds a new completed lap, and sample the best lap for rendering.
- Render the ghost as a reused car mesh with transparent cyan material, hidden until a best lap is available and the race is active.
- Add ghost debug state for Playwright verification instead of relying on screenshots alone.

## Testing

- Unit-test the pure recorder/sampler first: no ghost before a lap is completed, best lap updates only when faster, interpolation works between samples, and reset clears state.
- Add a browser test using the existing dev-only deterministic finish hook to verify the ghost is created, normal restart preserves and renders it, page reload clears it, and the HUD text matches debug state.
