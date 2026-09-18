# Work log — 2026-09-19: camera fit + pan/zoom

## Goal

Center Anatolia on boot; add wheel zoom, drag pan, HUD zoom buttons.

## Changes

- `src/map/camera/camera.js`: `fitCamera` (bounds → centered camera),
  `zoomAt` (cursor-anchored, clamped 8–4000), `panBy` (pixel deltas).
  All immutable (new frozen camera per gesture).
- Projection fix: scale previously used the moving center latitude as the
  cosine reference, so zoom drifted ~2px and pan distorted. Projection now
  uses a fixed standard parallel (`refLat`, set from bounds center). Caught
  by the new anchor test — the test chain working as designed.
- `src/map/selection/pick.js`: `unproject` uses the same `refLat`.
- `src/main.js`: boot fits scenario bounds; wheel zoom (cursor-anchored),
  pointer-drag pan, +/− HUD buttons, drag-vs-click disambiguation
  (suppressClick flag).
- `tools/tests/camera.test.js`: fit centers [34,39], zero-drift anchor,
  clamp limits, pan math.

## Test results

- `npm test` → 48/48 pass. `npm run build` → clean.

## Open items

- Touch pinch zoom not yet implemented (pointer drag works on touch).
- World-wrap (canonical vs render longitude) still reserved for world-map phase.
