# Neon Harbor GP

Three.js arcade racing prototype with deterministic vehicle physics, countdown starts, visible AI opponents, ordered checkpoints, lap timing, boost, drift input, synthesized race audio, finish results, speed-responsive camera effects, animated trackside art, and browser-level gameplay verification.

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

Pushes to `main` run the GitHub Actions deploy workflow and publish the built game to GitHub Pages.

## Controls

- `W` / `ArrowUp`: throttle
- `S` / `ArrowDown`: brake
- `A` / `ArrowLeft`: steer left
- `D` / `ArrowRight`: steer right
- `Space`: handbrake drift
- `Shift`: boost
- `R`: reset race
- `Escape`: open or close race settings
- Touch controls: on mobile, use the fixed on-screen buttons for left, right, gas, brake, drift, and boost.

## Settings

Use the in-game `Settings` button to tune graphics quality, camera mode, touch controls (`Auto`, `On`, `Off`), master volume, mute, reduced motion, high contrast, and control hints. Keyboard control hints are hidden while touch controls are active. Settings persist in browser storage and can be reset from the settings panel.

## Verify

```bash
npm test
npm run build
npm run test:e2e
```
