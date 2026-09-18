# Work log — 2026-09-19: coastal paint fixes

## User report (screenshots)

1. Land fill bleeds into sea / gaps vs coastline strokes.
2. Some shore segments too sharp/angular at close zoom.
3. White bands on the land side look wrong; sea-side white (= shallows) liked.

## Diagnosis

1. Fill (NE 10m) and stroke (OSM) are different sources — edges can never match
   exactly. Fix is compositing, not data: bands now paint before land, so the
   opaque fill hides their land-side half. True single-source fix (OSM land
   polygons) recorded for Phase 5.
2. RDP + raw OSM nodes make sharp corners. Fix: Chaikin corner-cutting at
   render time (`src/map/rendering/smooth.js`) — styling only, data untouched.
3. Same compositing fix: whiteness now survives only seaward. Crisp stroke
   paints last with no glow (glow read as blur at HD zoom).

## Changes

- displayList order: sea → coast-bands → land → lake → terrain → river →
  coastline-crisp → provinces → borders → markers. `detail` flag on both
  coastal command types.
- backend: `coast-bands` (bands only), `coastline` (crisp only).
- `smooth.js` + tests (endpoints preserved, max turning angle reduced).
- One real bug caught by the new test: `maxTurningAngle` returned π for
  straight lines (inverted formula) — fixed to acos.

## Test results

- `npm test` → 52/52 pass. `npm run build` → clean (chunk-size warning is the
  known 1.7MB HD-JSON debt, Phase 5).
