# Work log — 2026-09-18: S3 selection + panels

## Goal

Click province → panel. Click city → panel. Read-only, queries only.

## Changes

- `src/map/selection/pick.js`: `unproject` (inverse projection), `pointInRing`
  (ray casting), `pickProvince` (topmost wins), `pickMarker` (nearest in 12px).
  All pure, headless-tested.
- `src/app/panels.js`: `renderProvincePanel` / `renderCityPanel` → HTML strings,
  DOM-free. Shows real query data (owner, controller, status, cities, tier,
  development); unbuilt systems labeled with their phase (`Phase 7+`), never faked.
- `src/main.js`: canvas click → marker first, then province, else clear.
- `index.html`: `#panel` container + minimal slice styling (real UI system: Phase 6+).
- `tools/tests/selection.test.js`: 6 tests (projection round-trip, Bursa pick,
  sea null, marker pick, both panels).

## Test results

- `npm test` → 37/37 pass. `npm run build` → clean.
- One fix: panels.js import was `../../core`, correct `../core`.

## Open items

- S4: monthly tick + one AI reaction + one systemic event + determinism test.
- Panels grow with phases (population → Phase 7, terrain → Phase 4, ...).
