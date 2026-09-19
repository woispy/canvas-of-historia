# Work log — 2026-09-19: planet coastline tiles (~100m)

## Owner order

Only ultra-detailed coastlines worldwide; no land fill; 100m (not 500m).

## Changes

- Downloaded OSM planet coastline (923MB, ODbL, gitignored).
- `tools/gis/build-coast-tiles.js`: streaming PolyLine 3/13 parse (no full
  load), meter-RDP at 50m, overlap-tile assignment onto 4° grid →
  `public/tiles/coast/` (1246 tiles, 882k lines, 7.55M pts) + manifest.
  One shape-type fix on the way (file is type 3, not 13).
- `src/map/tiles.js`: tile math (gap-free globe, antimeridian wrap).
- `main.js`: TileStore (fetch on demand, LRU 96, redraw on arrival).
- `displayList.js`: sea → tile strokes (black, unsmoothed raw detail) →
  markers → fade. Fills/boxes/bands/terrain retired from emission.
- `tools/gis/fetch-planet-coast.js` for reproducibility.
- Tests: tile math, manifest (1000+ tiles, Bursa tile live), stroke-only
  chain, Pacific behavior. 61/61 green.

## Known limits (honest)

- Bundle 11.9MB (seed JSON inlined) → Phase 5 lazy-load.
- Tile pop-in on fast pan (async fetch); LRU may evict aggressively.
- Detail = OSM planet (varies by region); pipeline identical everywhere.
