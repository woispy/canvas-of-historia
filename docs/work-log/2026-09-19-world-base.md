# Work log — 2026-09-19: whole-world base (user call)

## User call

"Eksik harita yamayla kapanmaz — tüm dünyayı çizin." Accepted: land base is
global from here on; border clipping deleted as a concept.

## Changes

- `tools/gis/build-land.js`: global mode — no bbox clip, longitude unwrap
  (antimeridian), meter-space RDP (5km), pole excursions dropped from strokes.
- Deleted `tools/gis/build-osm-land.js` (+ border assembly, seed scoring,
  voting — 400 lines of cleverness replaced by completeness).
- Output: 2042 land polys / 2043 coast segs, ~1MB each.
- Tests re-scoped: world closure (Ankara in / Pacific out), global coverage,
  latitude-aware step tripwire (mid-lat < 3°, polar generalization allowed),
  theater-scoped HD density.
- ADR-005 accepted; ADR-004 marked superseded.

## Bugs caught while passing through

- RDP unit mix (scaled dx + unscaled base) silently disabled simplification —
  output was raw density. Fixed; 9.3MB → 1MB per file.
- Degree-space RDP near poles collapses traverses into 360° streaks (Antarctica).
  Meter-space RDP + pole-drop fixed it.

## Test results

- `npm test` → 53/53 pass. `npm run build` → clean (3.8MB bundle — Phase 5 debt).
