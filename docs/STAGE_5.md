# Stage 5 — World Map / Rust Valley

Stage 5 adds the first real world layer above an individual mine.

## Implemented

- Full-screen Rust Valley map available from the bottom navigation.
- Five independent mining sites:
  1. RV-01 — Scrapline Quarry / Ferrite Ore
  2. RV-02 — Cinder Cut / Copper Shale
  3. RV-03 — Iron Mesa / Cobalt Ore
  4. RV-04 — Redline Chasm / Tungsten Rock
  5. RV-05 — Forge Crater / Iridium Matrix
- Sequential site unlock conditions based on lifetime earnings of the previous site.
- Independent mine state for every site:
  - cash;
  - 30 Deck progression;
  - barriers;
  - Lift / Logistics levels;
  - managers;
  - cooldowns;
  - local buffers;
  - lifetime production.
- Switching between unlocked sites without losing progress.
- Background income for automated inactive sites.
- Per-site timestamps so inactive mines continue to progress while another mine is open.
- Aggregated offline reward after returning to the game.
- Per-site economy tuning: resource price, mining yield and logistics capacity modifiers.
- Per-site temporary visual theme for the Phaser mine scene.
- Data-driven world configuration in `client/src/game/core/worldConfig.ts`.
- Save schema v3 with migration from the old single-mine Stage 1–4 save.

## Save migration

Old saves are automatically placed into `rust-01` (`Scrapline Quarry`). Existing Deck, manager, cash, barrier and upgrade progress is retained.

The new save stores:

```text
world.activeMineId
world.unlockedMines
world.mines[mineId]
world.lastSimulatedAt[mineId]
```

## Unlock progression

The next site becomes available after the required lifetime earnings have been reached in the previous site. Unlocking a site does not reset the previous one.

## Background simulation

Only the currently visible mine runs frame-by-frame. Inactive unlocked mines use analytical idle calculations during autosave, switching, tab resume and game restore. This keeps CPU usage low on mobile while preserving progression.

## Mobile UX

- Map is a full-screen overlay.
- On phones: map above, selected-site card below.
- On desktop/tablet landscape: map on the left, site details on the right.
- Nodes use large touch targets and do not require hover.

## Next stage

Stage 6 — Multi-Sector Economy: additional sector slots, sector currencies, sector unlock rules and world navigation above Rust Valley.
