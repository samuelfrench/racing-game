# Post-Race Split Summary Design

## Goal

Add a post-race lap and sector split summary to the existing results panel so a finished race shows not only the finishing order, but also how the player built the final time.

## Current Gap

The game now records live lap and sector timing in the HUD, but the results panel only lists classified finishers. Once the race ends, the player cannot review per-lap consistency or where sectors were faster or slower.

## Design

Keep the feature inside the existing results panel. Do not add a modal, route, settings panel, or separate overlay.

When the race finishes, the results panel shows:

- the existing classified result list
- a compact `Splits` block for the player
- one lap row per completed player lap
- sector chips grouped by lap, using `S1`, `S2`, etc.
- a best-lap tone for the fastest player lap
- a best-sector tone for sector chips that match the player's best time for that sector

Before the race finishes, the split summary remains hidden. Resetting the race clears the summary.

## Race State

Extend `RaceProgress` as the authoritative timing source. Checkpoint crossing already owns lap and sector timing, so it should also append completed split history.

Add:

- `completedLapSeconds`: one entry per finished player lap
- `completedSectorSplits`: one entry per completed sector

Each sector split records:

- `lapNumber`
- `sectorNumber`
- `checkpointId`
- `seconds`
- `deltaSeconds`
- `personalBest`

The existing `bestSectorSeconds` array remains the source for best-sector comparisons.

## Display Helper

Add a pure helper module that converts completed race progress into display-ready summary state:

- `visible`
- `lapRows`
- `sectorRows`

Lap rows include:

- `lapNumber`
- `timeLabel`
- `isBest`

Sector rows include:

- `lapNumber`
- `sectors`, each with `sectorLabel`, `timeLabel`, `tone`

Tone values:

- `best`: sector is first/best for that sector number
- `normal`: no best highlight

The helper should return `visible: false` until the race is finished and at least one lap has been completed.

## Runtime And Debug

Add results panel elements:

- `#split-summary`
- `#lap-splits`
- `#sector-splits`

Update the results board render path to render the summary when `session.phase === "finished"`.

Expose the display helper output in `window.__racingGameDebug.splitSummary`.

For Playwright, add dev-only test controls that can finish a race using real `RaceProgress`/`RaceSession` state without adding production controls or network endpoints. The controls must only exist when `import.meta.env.DEV` is true.

## Visual Direction

The summary should match the quiet, dense racing HUD style already used by the panel. It should feel like a timing sheet, not a celebration modal:

- tabular numerals
- compact rows
- restrained border lines
- yellow best-lap highlight
- cyan/green sector chip accents
- mobile-safe wrapping without covering touch controls

## Testing

Add Vitest coverage for:

- `RaceProgress` appends completed lap history
- `RaceProgress` appends sector split history with lap numbers
- the summary helper hides before finish
- the summary helper renders lap rows and sector rows after finish
- best lap and best sector tones are assigned deterministically

Add Playwright coverage for:

- forcing a finished race in dev/test mode shows `#split-summary`
- lap and sector split text is visible
- debug `splitSummary` matches the DOM
- summary fits in desktop, tablet, narrow tablet, and mobile viewports
- reset hides and clears the summary
