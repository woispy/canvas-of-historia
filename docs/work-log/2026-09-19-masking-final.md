# Work log — 2026-09-19: masking final form (ADR-006)

## Goal

Re-apply the full masking systematics from scratch + uniform detail + optimize.

## Changes

- `tools/gis/build-osm-land.js` (rewritten): Liang-Barsky clip → exact interior
  stitching (orientation bug fixed) → islands + border assembly → STRICT
  keepRing (zero sea, land seeds or tiny+vote) → `land-osm.json`
  (151 verified polys) + build-time gate (sea dry required, land advisory).
- `tools/gis/fetch-osm-coast.js`: +1° buffer bbox so close-zoom strokes
  continue past the view edge.
- Chain: `land-osm.json` + `waterways.json` (Bosphorus, Dardanelles) through
  loader/validator/factory/snapshot/main.
- Render: NE base fill + OSM overdraw (same style) + wash land-clips +
  waterway sea strokes + black 1.2px crisp + slim bands + carve + vignette.
- Culling: world-bbox reject with 48px pad + antimeridian shift, before
  smoothing/projection. Pacific view draws base only (tested).
- Credit: corner div removed → CREDITS.md (ODbL note + restore instruction).
- Tests: OSM strict (no sea, Buyukada), waterway shape/order, overdraw +
  culling, wash landClip. 56/56 green.

## Known limits (honest)

- OSM mainland assembly east of ~36E unverified → NE + carve hold those
  shores until Phase 5 (diagnostics preserved in git history).
- Waterway centerlines are hand-placed (documented in-file, visually verified).
- Bundle 3.9MB → Phase 5 binary pack.
