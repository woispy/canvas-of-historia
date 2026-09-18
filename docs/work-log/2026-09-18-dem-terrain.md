# Work log — 2026-09-18: DEM terrain (Phase 4 remainder)

## Goal

Real elevation: land gains relief tint + hillshade from DEM, not flat fill.

## Changes

- `tools/gis/fetch-dem.js`: 24 AWS Terrarium z7 tiles covering bounds (public,
  no key), gitignored.
- `tools/gis/build-terrain.js`: minimal 8-bit RGB PNG decoder (node:zlib,
  all 5 filters) → Terrarium elev → mosaic → 192x72 grid over bounds →
  `terrain-grid.json` (**elev -4120..3517m**).
- `docs/contracts/terrain.schema.json` + chain wiring
  (loader/validator/factory/snapshot) + `terrain-tint` display command
  (grid bbox projected, land rings attached for clipping).
- Backend `paintTerrainTint`: offscreen grid canvas, elevation ramp +
  NW-light hillshade, sea cells transparent, clipped to land polygons,
  drawn at 0.55 alpha under the political wash.
- `package.json`: `gis:fetch-dem`, `gis:build-terrain`, `gis:terrain`.
- Tests: terrain schema+dims+range+bounds, terrain-tint command, schema file
  registered in repo-structure test.

## Test results

- `npm test` → 44/44 pass. `npm run build` → clean (bundle 166 kB — grid
  inlined; packed binary assets arrive with the Phase 5 pipeline).
- One fix: `$title` typo in terrain.schema.json (recurring slip — ajv strict
  catches it every time, which is the system working).

## Open items

- z7 (~1.2 km/px) is smooth at close zoom; finer tiles Phase 5.
- Next per roadmap: Phase 5 WebGPU renderer or Phase 7 economy.
