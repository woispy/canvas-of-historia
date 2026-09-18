# Work log — 2026-09-18: S2 2.5D map render

## Goal

Render the 1326 world with the 2.5D visual language from day one, with the
coastline as an independent authority layer — no waiting for GIS/WebGPU.

## Changes

- `src/map/camera/camera.js`: deterministic pure projection (center/scale,
  world-wrap split reserved).
- `src/map/rendering/style.js`: `STYLE_25D_V1` tokens (sea bands, land relief,
  extruded borders, coastline glow, markers) — backend-independent, WebGPU
  inherits the same language.
- `src/map/rendering/snapshot.js`: frozen session → snapshot (renderer never
  touches simulation state).
- `src/map/rendering/displayList.js`: snapshot + camera → draw commands (pure,
  headless-testable). Backends only paint.
- `src/map/rendering/canvas2d/backend.js`: gradients, depth bands, shadows,
  extruded borders, glowing coastline, labeled city markers.
- `data/scenarios/1326/coastline.json`: hand-traced 48-point Marmara loop
  (MEDIUM confidence, provenance recorded) + `docs/contracts/coastline.schema.json`.
- Chain wiring: loader/validator/factory carry `coastline` as independent layer.
- `src/main.js`: full-window canvas, DPR-aware, renders on boot.
- `tools/tests/rendering-contract.test.js`: camera math, snapshot shape,
  display-list coverage + finite-coords check.

## Test results

- `npm test` → 27/27 pass. `npm run build` → clean (13.9 kB).
- Browser paint verified by user via dev server HMR (pixel-diff harness: Phase 5).

## Open items

- S3: selection + province/city panels (read-only queries).
- Real coastline/DEM data: Phase 4 GIS pipeline. Province rings still rough
  boxes — geometry refinement tracked, confidences recorded.
