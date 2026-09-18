# Work log — 2026-09-19: border artifacts + sea carve + vignette

## User report

Wrong coastlines (far zoom), terrain/coast mismatch, inner white persists,
latest tan shoreline disliked.

## Diagnosis (measured, not guessed)

- Base layer held a **17° segment** with both ends on the south border: the
  clipped giant land polygon's border run was derived as "coastline".
  Confirmed via step-length scan, then fixed.
- Tan ribbon correctly removed per feedback; the "sea inside coastline" and
  Bosphorus bridging need an eraser, not a cover.

## Changes

- `tools/gis/build-land.js`: `borderlessRuns` drops map-border-hugging runs
  from coastline derivation (fill rings unchanged). Rebuilt: 45 base segments,
  max step 0.66° (honest straight Black Sea shore), monster gone.
- New `coast-carve` command (sea-tone, 0.006°): painted after province fills,
  before borders/markers — trims terrain/land/box spill and un-bridges
  sub-660m straits. Reads as water.
- Slimmer bands (0.004/0.010/0.022°).
- New `edge-fade` command (0.6° feather, 24–160px): scope vignette dissolving
  truncated border geometry via destination-in mask.
- Tests: max base step < 1.0° (regression tripwire), carve order, fade last +
  feather scaling, tan ribbon asserted absent.

## Test results

- `npm test` → 53/53 pass. `npm run build` → clean.

## Known limits

- Km-scale delta disagreements and >660m bridged waterways still need the
  Phase 5 single-source (OSM land polygons).
