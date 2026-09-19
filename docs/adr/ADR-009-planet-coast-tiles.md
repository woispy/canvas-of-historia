# ADR-009: Planet coastline tile store, strokes-only step

Date: 2026-09-19
Status: Accepted (owner order: coastlines only, ~100m detail, worldwide).

## Context

Layered patches outgrew their defects. Owner ordered a clean slate: whole
world at uniform coastline detail, no sea systems, no terrain — look first.

## Decision

1. Source: OSM planet coastline (`coastlines-split-4326.zip`, 923MB, ODbL —
   credit in CREDITS.md), the same family as the future land polygons, so
   fills later align by construction.
2. Build (`build-coast-tiles.js`): streaming shapefile parse (PolyLine 3/13),
   meter-space RDP at 50m (~100m visual detail), overlap-tile assignment onto
   a 4° grid (segment bbox → all touched tiles; seamless for strokes, no
   clipping math). 878k records → 1246 tiles, 7.55M points. Output gitignored
   under `public/tiles/coast/` + manifest.
3. Render: flat sea → tile strokes (plain black 1.2px) → city markers → fade.
   No fills, no boxes, no bands, no terrain. Tile fetch on demand (LRU 96),
   redraw on arrival. Viewport culling per line.
4. Uniform detail = uniform SOURCE everywhere (one planet file). Regions do
   not get second-class pipelines.

## Consequences

- (+) Zero mismatch class: single drawing worldwide.
- (+) Close zoom stays crisp (no smoothing pass on tile data).
- (-) 3.9MB bundle unchanged until Phase 5 pack; tile store rebuilt via
      `npm run gis:coast-tiles` (fetch ~10–20 min once).
- (-) Fills/washes/terrain return only as gated phases per ADR-008.
