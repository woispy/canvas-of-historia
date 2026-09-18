# Work log — 2026-09-19: geographic shallows + shore ribbon

## User report

Terrain spills past the coastline; inner (land) side still white in places.

## Diagnosis

Two compounding causes: (1) bands had fixed px widths — mismatch measured in
meters outgrows any px width as you zoom; (2) 10m land edge vs OSM stroke can
differ by hundreds of meters, so land-side coverage by the fill alone fails.

## Changes

- Band widths now in **world degrees** (0.008/0.018/0.035°), converted to px
  per frame from `camera.scale` — shallows keep constant geographic width at
  every zoom and always dwarf source mismatch.
- New `coast-shore` command: land-toned ribbon (0.006°) hugging the OSM line,
  painted after rivers, before the crisp stroke. Hides mismatch slivers on
  both sides; reads as beach/surf. Tokens in style.js (backend-independent).
- Chaikin passes 1 → 2 for coastline strokes (data untouched).
- Backend: `coast-bands` reads per-command widths; new `coast-shore` case.
- Tests: band widths grow with zoom; order bands < land < … < shore < crisp;
  two-pass smoothing monotonic softer.

## Test results

- `npm test` → 53/53 pass. `npm run build` → clean.

## Known limits (honest)

- Km-scale source disagreements (deltas, estuaries) can still peek through —
  no px trick fixes data; single-source OSM land polygons are the Phase 5 cure.
- Piers/breakwaters stay sharp by nature (they are man-made right-angle structures).
