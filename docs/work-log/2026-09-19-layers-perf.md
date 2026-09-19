# Work log — 2026-09-19: layers + perf (2 rounds)

## Owner orders

1. Coastline system fully isolated from future sea/land/terrain.
2. Fix the lag (twice — second round after first wasn't enough).

## Round 1 (ADR-010)

- `src/map/layers/registry.js` + `src/map/layers/coastline.js` (TileStore
  moved out of main.js, injected fetch, pure builders).
- `displayList.js`: single `coastline-batch` command; adaptive stride.
- `backend.js`: batched single-path stroke.
- `main.js`: dynamic JSON imports (lazy chunks), rAF scheduleFull/schedulePan,
  offscreen pan-blit, TileStore wiring, click selection kept.
- Entry 11.9MB → 25KB.

## Round 2 (same day, lag persisted)

Measured remaining costs: per-frame full-point bbox scans, zoom re-stroke
per wheel tick, tile-arrival redraws mid-drag, mask rebuild per frame.
- Bboxes precomputed once at tile load; cull reads them (no point scans).
- Wheel: instant zoom-blit about cursor + 120ms-debounced crisp render.
- Tile arrivals deferred during active drag (repaint on release).
- Edge-fade mask cached by size+feather (cap 4).
- `?perf=1` overlay: EMA frame ms + projected kpts + cached tiles.

## Test results

- `npm test` → 65/65 pass. `npm run build` → clean, entry 26KB.
