# ADR-011: Coastline tile pyramid (uniform quality, bounded cost)

Date: 2026-09-19
Status: Accepted (owner order: one quality system, no far-zoom collapse).

## Context

Single-level tiles forced a bad trade: full detail everywhere (1.2M pts,
350ms, crash risk) or coarse outline (ugly far zoom). LOD switches also
popped visually.

## Decision

Three levels from one planet source, density-appropriate per zoom:
- z0 (scale < 25): single world file, RDP 0.03° (~72k pts, 1.2MB, one fetch).
- z1 (25–120): 8° tiles re-simplified from z2 (~300m), 505 tiles.
- z2 (≥ 120): 4° tiles, RDP 50m (~100m detail), 1246 tiles.
Same black stroke at every level; adjacent levels differ little, so switches
don't pop. Boot lands on z1 (fast middle). Tile-border micro-seams accepted
(≤ tolerance, documented in build script).

## Consequences

- (+) Bounded per-frame cost at every zoom; far zoom never touches tiles.
- (+) No quality cliff: gradual density steps.
- (-) 3 builds to maintain (one script each, same pipeline shape).
- (-) z1 derived from z2 (not re-parsed): micro-seams possible at 8° borders.
