# Mobile Touch Controls Design

## Goal

Make Neon Harbor GP playable on phones and tablets without a keyboard while keeping the existing desktop keyboard controls unchanged.

## Approach

Add a first-class touch input layer instead of wiring buttons directly into vehicle physics. Touch controls will produce the same `ControlInput` shape as keyboard controls, then merge with keyboard input before physics runs. This keeps input behavior testable and lets desktop, mobile, and forced touch modes share the same driving code.

## Controls

The mobile overlay uses large fixed-position buttons:

- Left side: `Left` and `Right` steering buttons.
- Right side: `Throttle`, `Brake`, `Drift`, and `Boost` buttons.
- Buttons support multi-touch holds with Pointer Events.
- Pointer cleanup happens on `pointerup`, `pointercancel`, lost capture, `blur`, `visibilitychange`, and race reset.

## Settings

Add `touchControlsMode` to game settings:

- `auto`: show touch controls on coarse-pointer devices or narrow viewports.
- `on`: force touch controls visible.
- `off`: hide touch controls.

The setting persists with the rest of the settings and falls back to `auto` when storage is missing, blocked, or invalid.

## Runtime Behavior

The overlay is visible only when resolved touch controls are enabled. It sits below the start/settings panels but above the canvas, avoids the HUD, and uses `touch-action: none` so held buttons do not scroll or zoom the page. Keyboard control hints remain governed by the existing `showControlHints` setting.

## Debug And Testing

Browser debug state exposes:

- `touchControls.visible`
- `touchControls.mode`
- `touchControls.activeActions`
- `touchControls.input`

Unit tests cover the pure touch state, input merging, mode resolution, and settings sanitization. Playwright covers mobile overlay visibility, pointer-hold driving, forced desktop visibility, and forced mobile hiding.
