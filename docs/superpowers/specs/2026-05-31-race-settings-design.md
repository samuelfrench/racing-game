# Race Settings Design

## Intent

Add an in-game settings layer that makes Neon Harbor GP feel more like a finished browser game: players can tune performance, camera feel, audio, accessibility, and control hint visibility without leaving the race. The feature must be observable in runtime behavior and in Playwright debug state, not just reflected in form values.

## User Experience

- A compact `Settings` button sits above the canvas with pointer events enabled.
- `Escape` toggles the settings panel. The close button and outside reset flow are keyboard accessible.
- The panel is dense and utilitarian: grouped rows, native selects/ranges/checkboxes, no nested cards, no marketing copy.
- Controls:
  - Graphics quality: `High`, `Balanced`, `Low`.
  - Camera mode: `Chase`, `Far`, `Hood`.
  - Master volume range: `0` to `100`.
  - Audio muted checkbox.
  - Reduced motion checkbox.
  - High contrast checkbox.
  - Show control hints checkbox.
  - Reset button restores defaults and persists them.
- A compact control-hints strip lists the current keyboard controls while enabled.

## Runtime Behavior

- Settings persist in `localStorage` under one stable key.
- Invalid or stale stored values sanitize back to safe defaults.
- Graphics quality changes the renderer pixel-ratio cap and the number of active speed streaks:
  - `High`: pixel ratio cap `2`, 12 speed streaks.
  - `Balanced`: pixel ratio cap `1.5`, 8 speed streaks.
  - `Low`: pixel ratio cap `1`, 4 speed streaks.
- Camera mode changes chase rig values:
  - `Chase`: current baseline feel.
  - `Far`: higher and further back for easier track reading.
  - `Hood`: low forward camera for a faster in-car feel.
- Reduced motion keeps gameplay physics unchanged but dampens visual speed effects, FOV expansion, road pulse, and speed streak opacity.
- High contrast applies a body class and renderer clear/fog color variant so HUD and scene contrast increase together.
- Audio settings scale the existing WebAudio master gain without changing engine/skid/boost mix logic. Muted audio sets master gain to `0`.
- Keyboard input ignores key events originating from settings form controls, so editing settings cannot trigger reset or driving inputs.

## Architecture

- Create `src/game/settings.ts` for pure settings defaults, sanitization, storage helpers, graphics profile, camera profile, and motion-effect adjustment.
- Keep DOM creation in `index.html` and UI wiring in `src/main.ts`.
- Keep styling in `src/styles.css`, matching the current HUD visual language.
- Extend `src/game/audio-engine.ts` debug state with `masterGain` so tests can prove mute/volume changes reach the audio graph input.
- Extend `window.__racingGameDebug` with sanitized settings, graphics profile, camera profile, and control-hints visibility.

## Testing

- Vitest covers defaults, sanitization, storage failure fallback, profile selection, and reduced-motion effect damping.
- Playwright covers opening settings, changing graphics quality and camera mode, toggling reduced motion, high contrast, mute, and control hints, reset-to-default behavior, persisted settings across reload, and no console/page errors.
- Existing desktop/mobile drive smoke must continue to pass.

## Non-Goals

- No full key remapping in this slice.
- No mobile touch controls in this slice.
- No pause menu or race-state freeze while settings are open.
- No new paid services, analytics, or external assets.

## Self-Review

- No placeholders remain.
- The scope is one cohesive settings feature, not multiple independent systems.
- Runtime effects are explicit and testable through debug state and visible DOM classes.
- Mobile/touch controls are intentionally left for the next TODO item.
