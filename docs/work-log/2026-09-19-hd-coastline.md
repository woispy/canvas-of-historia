# Work log — 2026-09-19: HD coastline LOD (OSM)

## Goal

OH-grade shore detail at close zoom: bays, islets, straits.

## Changes

- `tools/gis/fetch-osm-coast.js`: Overpass bbox query (240s timeout, 2-endpoint
  fallback) → 29.7MB raw response, gitignored. One fix: `readFileSync` is not
  exported from `node:fs/promises`.
- `tools/gis/build-hd-coast.js`: ways → clip runs → RDP 0.0015° → 5dp →
  `coastline-hd.json` (**7311 segments / 24626 pts, ~18x base**).
- LOD in displayList (`HD_MIN_SCALE = 250`): close = OSM HD, far = NE 10m.
  Same contract shape; `detail` flag on commands.
- Chain wiring: loader/validator (shared polyline checker)/factory/snapshot/main.
- ODbL compliance: in-app "© OpenStreetMap contributors" credit + per-segment
  source + ADR-003 (ODbL does not infect game code; modified DB would be shared).
- `package.json`: `gis:fetch-osm-coast`, `gis:build-hd-coast`, `gis:hd-coast`.
- Tests: HD dwarfs base (>5x) + in-bounds + schema; LOD switch base↔HD with
  density assertion.

## Test results

- `npm test` → 50/50 pass. `npm run build` → clean.
- Known debt: bundle 1.7MB (HD JSON inlined). Packed binary + streaming with
  Phase 5 — flagged, not hidden.

## Open items

- Strategy answer for user: yes, Anatolia-first, then world (see chat summary).
- Test-edit discipline: 3 header-swap slips repaired after reads — rule going
  forward: read the region right before editing test files.
