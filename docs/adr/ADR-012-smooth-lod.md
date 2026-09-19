# ADR-012: Smooth LOD transitions (hysteresis + placeholder + fresh fade)

Date: 2026-09-19
Status: Accepted (team decision — red-team referee).

## Problem

Hard LOD switches pop; async tiles pop into emptiness; blending whole layers
ghosts (rejected, proven earlier).

## Decision (shipped set: placeholder + hysteresis + fresh fade)

- Hysteresis: in-thresholds 25/120, out-thresholds 22/108 (~12% band).
  Level frozen during gestures; recomputed on settle. Pure `selectLod`.
- Placeholder: on a miss, the parent level draws underneath, opaque. Never
  an empty hole. z2 miss → z1 parent; z1 miss → z0 outline.
- Fresh fade: only first-fetch tiles, cubic alpha over 200ms, per-tile
  strokes (≤12 concurrent). Cache hits draw instantly. `tileAlpha` pure.
- Explicitly NOT shipped: whole-layer crossfade (ghosts), geomorphing
  (CPU/test cost), blur/scale animations.

## Consequences

- (+) No pops, no holes, no ghosts. Transitions read as dissolve-in-place.
- (+) All three mechanisms unit-tested (75/75 green).
