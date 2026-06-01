# Ghost Replay Plan

## Task 1: Pure Ghost Replay Module

- Add `src/game/ghost-replay.ts` and `src/game/ghost-replay.test.ts`.
- Model current-lap recording, best-lap storage, interpolation, status labels, and reset behavior.
- Follow TDD: write failing tests before production module code.

## Task 2: Runtime Integration

- Import the ghost replay module in `src/main.ts`.
- Record car samples while racing.
- Complete the current recording when a new lap is detected.
- Update the ghost only when the completed lap is a new personal best.
- Preserve the stored best ghost on normal race reset so the next race can replay it; page reload still starts with no ghost.
- Render a translucent ghost car and expose debug state.

## Task 3: HUD and Browser Verification

- Add a compact HUD line in `index.html` and styles in `src/styles.css`.
- Extend `tests/game.spec.ts` debug typing and add a ghost replay test using the deterministic finish control plus the real restart flow.
- Run `npm test`, `npm run build`, `CI=1 npm run test:e2e`, local browser checks, push, wait for deploy, and live-smoke the GitHub Pages build.
