# Work log — 2026-09-19: layers + perf

## Owner orders

1. Coastline system fully isolated from future sea/land/terrain.
2. Fix the lag.

## Changes

- `src/map/layers/registry.js` + `src/map/layers/coastline.js` (TileStore
  moved out of main.js, injected fetch, pure builders).
- `displayList.js`: single `coastline-batch` command; adaptive stride.
- `backend.js`: batched single-path stroke.
- `main.js`: dynamic JSON imports (lazy chunks), rAF scheduleFull/schedulePan,
  offscreen pan-blit, TileStore wiring, click selection kept.
- Tests: `tools/tests/layers.test.js` (registry, store cache/cap/notify,
  viewport keys, cull+stride); rendering tests updated to batch commands.

## Test results

- `npm test` → 65/65 pass. `npm run build` → clean, entry 25KB (was 11.9MB).
