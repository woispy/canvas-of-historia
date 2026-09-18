# Work log — 2026-09-18: OH-grade coastline (NE 10m land)

## Goal

Reach Open Historia coastline detail: real landmass fill, crisp coasts, islands.

## Diagnosis (from user screenshots)

Our render had no landmass — neon strokes floating on sea. OH renders filled
land + thin coasts + bathymetry. Root causes: (1) no land polygons, only
coastline polylines; (2) NE 50m too coarse; (3) dark neon styling.

## Changes

- `tools/gis/fetch-ne-land.js` + `build-land.js`: NE 10m land @ pinned rev →
  Sutherland–Hodgman clip → RDP 0.008° → quantize → **38 land polygons
  (islands included), 1402 pts** + coastline derived from the same outer rings
  (**38 segments, 1364 pts**) — fill and stroke always aligned. Old 50m scripts
  deleted. `npm run gis:land`.
- Renderer order now: sea → land-fill → coast bands+stroke → translucent
  province wash (0.55) → extruded borders → markers.
- Style v2: light legible sea, warm terrain land, dark crisp coastline, dark
  labels. Tokens stay backend-independent (WebGPU inherits).
- `docs/contracts/land.schema.json` + chain wiring (loader/validator/factory/
  snapshot/displayList/main) + tests (land schema+bounds, land-fill commands).

## Test results

- `npm test` → 31/31 pass. `npm run build` → clean (bundle 75 kB — land.json
  inlined; packed binary assets arrive with the Phase 5 pipeline).
- Fixes on the way: one misplaced edit in backend.js (repaired after read),
  one orphaned test block (re-wrapped), one `$title` schema typo.

## Open items

- 10m still coarser than OH's tiled data at street zoom — acceptable to Phase 4/5.
- S3: selection + panels. User verifies paint in browser (dev server HMR).
