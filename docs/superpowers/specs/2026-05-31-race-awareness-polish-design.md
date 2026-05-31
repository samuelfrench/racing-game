# Race Awareness Polish Design

## Goal

Make the existing race-position and minimap HUD feel like a production racing game instrument instead of a basic debug widget.

## Current Gap

The current HUD shows `Position 1/4` and a small minimap with a track outline, checkpoint ring, and dots. It works, but it does not show whether the player is leading or chasing, it does not make rank readable at a glance, and the minimap markers do not convey heading or classification.

## Design

Keep the work inside the existing race-awareness card. Do not add a new overlay or a larger panel.

The left text column becomes:

- checkpoint label and current checkpoint
- best lap
- a compact position label such as `P1/4`
- a gap label such as `LEAD 12m`, `GAP 8m`, or `FINISH`

The position text gets a tone derived from race state:

- `leader` when the player is first
- `chasing` when the player is in the front half but not first
- `midfield` for the back half
- `last` when the player is last

## Pure Race Awareness Helper

Add a pure helper module that consumes `RacePositionState` and returns display-ready race awareness:

- `positionLabel`
- `gapLabel`
- `gapMeters`
- `tone`

The helper uses the already-ranked participant list. If the player is first, it measures the lead to the next car behind. If the player is behind, it measures the gap to the next car ahead. Finished player state returns `FINISH`.

## Minimap Polish

Keep the 2D canvas path, but draw richer information:

- a start/finish stripe on the start segment
- a cyan progress ribbon along the current lap up to the player projection
- a brighter next-checkpoint ring
- player marker as a heading arrow
- opponent markers as ranked dots with small rank numbers

Expose the same information in debug state:

- each minimap marker has `rank`, `heading`, and `label`
- minimap debug has `progressRatio`
- debug state exposes `raceAwareness`

## Layout

The existing card stays compact:

- desktop keeps the current one-card HUD row
- tablet keeps fixed minimap dimensions and avoids status-card overlap
- mobile keeps the card full-width and prevents the minimap from overlapping settings or touch controls

The typography should stay arcade-instrumental: high-contrast yellow/cyan/red, tabular numeric labels, no marketing copy, no instructional text.

## Testing

Add Vitest coverage for the pure race-awareness helper:

- leading player displays `P1/4` and a lead gap
- chasing player displays a gap to the next car ahead
- finished player displays `FINISH`
- missing player falls back safely

Add Playwright coverage:

- position uses `P1/4` style formatting
- gap readout is visible and non-empty
- `raceAwareness` debug state matches the HUD
- minimap markers expose rank, heading, and labels
- minimap remains nonblank and visible across desktop, tablet, and mobile
