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

## Round 3 (same day — far-zoom lag + crash reports with numbers)

Perf overlay read `1518tiles` + 404 storm + 1254kpts/350ms at world zoom.
Root causes found by measurement (not guessing):

1. **404 storm:** viewport range requests ALL tiles incl. open ocean; each
   404s. Fix: manifest gate (only fetch tiles present in manifest.json).
2. **Unbounded cache (the crash):** resolved fetches re-added evicted keys —
   cache grew past cap with full tile data (memory balloon). Fix: drop
   results for evicted keys. Eviction regression test added (200 keys → ≤96).
3. **1.2M projections at far zoom:** new `world-outline.json` (NE coast RDP
   0.05°, 50k pts, 846KB, fetched once) replaces all tiles below scale 60.
4. **Fetch stampede:** max 12 new fetches per pass; deferred during drag.
5. **Raster cost:** sub-pixel segments skipped in the batch painter.

## Test results

- `npm test` → 67/67 pass. `npm run build` → clean, entry 26KB.
