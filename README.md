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

## Verify

```bash
npm test
npm run build
npm run test:e2e
```
