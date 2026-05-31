# Mobile Touch Ergonomics Design

## Goal

Improve mobile playability by reducing bottom-of-screen clutter and making the touch controls easier to hit during active racing.

## Problem

The current mobile layout shows keyboard control hints above the touch buttons. Those hints are useful on desktop, but they are redundant on touch screens and consume vertical track visibility. The touch buttons also work, but the smallest mobile layout leaves only 60 x 58 pixel targets, which is functional but cramped for a game where users hold controls while steering.

## Design

When touch controls are visible, hide the keyboard control hints even if the stored `showControlHints` setting is enabled. The setting still applies normally on desktop and when touch controls are off. Touch buttons remain self-labeled, so mobile users still have visible control affordances without the keyboard hint strip.

Increase mobile touch target sizes while keeping the two-bank layout:

- Default touch buttons: 76 x 68 pixels.
- Narrow phones (`max-width: 420px`): 70 x 64 pixels.
- At 320px width, both banks must still fit in the viewport and avoid the settings and results surfaces.

## Runtime Behavior

Control hint visibility becomes a derived runtime state:

- show hints when `settings.showControlHints === true` and `touchControlsVisible === false`
- hide hints otherwise

Changing the touch mode, resizing the viewport, resetting settings, or loading persisted settings updates both the touch overlay and hint visibility in the same frame.

## Testing

Add Playwright coverage proving:

- desktop auto mode still shows keyboard hints
- mobile auto mode hides keyboard hints while touch controls are visible
- forcing touch controls on desktop hides keyboard hints
- mobile touch buttons meet the larger minimum hit-target size and still avoid settings/results overlays at 320px and 390px
