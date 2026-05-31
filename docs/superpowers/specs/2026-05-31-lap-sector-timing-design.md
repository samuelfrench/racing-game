# Lap Sector Timing Design

## Goal

Add readable lap split and sector timing feedback so the race HUD feels closer to a production time-trial/racing instrument.

## Current Gap

The game tracks current lap, last lap, and best lap internally, but the HUD only shows the lap number and best lap. The player cannot see current lap pace, current sector time, or whether a completed sector improved on the previous best for that sector.

## Design

Keep the feature inside the existing HUD. Do not add a modal, side panel, or separate overlay.

The existing split-card text column becomes:

- checkpoint label and current checkpoint
- lap timing row: current lap time and best lap
- sector timing row: current sector label, current sector timer, and last sector delta
- compact race position and gap rows

The timing row format is compact and scannable:

- `Lap 12.34 Best 34.56`
- `Sector S2 03.21 -0.18`

Before the race clock starts, timers show `--`. After the race finishes, the current lap and sector timers hold the final known completed values instead of counting further.

## Race Progress State

Extend `RaceProgress` rather than creating a second timing store. Checkpoint crossing is already handled in `updateRaceProgress`, so that is the authoritative place to record splits.

Add sector fields to `RaceProgress`:

- `sectorStartedAtSeconds`
- `lastSectorNumber`
- `lastSectorCheckpointId`
- `lastSectorSeconds`
- `lastSectorDeltaSeconds`
- `lastSectorPersonalBest`
- `bestSectorSeconds`

Sector numbers are one-based and map to track segments:

- `S1`: start to checkpoint 1
- `S2`: checkpoint 1 to checkpoint 2
- final sector: last checkpoint back to start

The first start checkpoint starts the lap and sector clocks without recording a completed sector. Every later checkpoint crossing records a sector split. A new sector starts immediately after each completed sector unless the race is finished.

## Display Helper

Add a pure helper module that consumes `RaceProgress`, checkpoint count, and elapsed race seconds, then returns display-ready state:

- `currentLapSeconds`
- `currentLapLabel`
- `bestLapLabel`
- `currentSectorNumber`
- `currentSectorLabel`
- `currentSectorSeconds`
- `currentSectorLabelText`
- `lastSectorLabel`
- `lastSectorTimeLabel`
- `sectorDeltaLabel`
- `sectorDeltaTone`

Delta tone values:

- `neutral`: no completed sector yet
- `best`: first sector completion or new personal best
- `faster`: improved versus the previous best sector time
- `slower`: slower than best sector time
- `matched`: equal to best sector time within formatting precision

## HUD And Debug

Add HUD elements:

- `#lap-time`
- `#sector-label`
- `#sector-time`
- `#sector-delta`

Update these every frame from the display helper. Use tabular numbers, restrained high-contrast color, and stable widths so labels do not resize the split card.

Expose the display helper output in `window.__racingGameDebug.timing`.

## Testing

Add Vitest coverage for race progress sector recording:

- first start checkpoint starts timing without recording a split
- non-start checkpoints record sector split seconds
- final sector records before lap completion
- repeated sector on later lap records delta against previous best
- final lap finishing stops sector timing

Add Vitest coverage for the display helper:

- idle state shows placeholder timers and `S1`
- active lap shows current lap and current sector seconds
- completed sector displays sector label, split time, delta label, and tone
- finished state uses final lap/sector values without counting past finish

Add Playwright coverage:

- timing HUD fields are visible across desktop, tablet, and mobile
- current lap/sector timers become numeric after race launch
- debug timing matches HUD timing
- timing text stays in the viewport and does not overlap the minimap/settings/touch controls
