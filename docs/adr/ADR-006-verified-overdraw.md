# ADR-006: Verified overdraw + protected waterways (masking, final form)

Date: 2026-09-19
Status: Accepted. Builds on ADR-004 (technique) + ADR-005 (world base) +
red-team review (findings integrated below).

## System

1. NE global land = complete base (no holes, ever). OSM theater polygons pass
   STRICT verification (zero sea seeds inside; land seeds or tiny+vote) and
   overdraw the base in the IDENTICAL style — shared edges invisible, islands
   exact. Doubtful rings drop; NE covers.
2. Strokes from the same rings as their fills, per layer. Single black 1.2px
   crisp line on top, hard-swapped at LOD 275 (no ghosting).
3. Washes clip to land (evenodd); terrain tint likewise. Bands paint under
   land (sea-side only). Carve trims spill. Waterways (hand centerlines,
   visually verified) guarantee Bosphorus + Dardanelles.
4. Culling in world space with padding + antimeridian shift BEFORE smoothing
   and projection. Edge vignette stays.
5. ODbL: credit moved to CREDITS.md + per-file provenance per owner order
   (red-team objection recorded: on-map credit is the safer reading; restore
   one line in index.html before publishing).

## Red-team findings integrated

- Far LOD keeps NE everywhere (no theater hole) — overdraw only ADDS.
- No boolean ops: overdraw same-style instead of union-clip; washes clip to
  the complete NE set (no evenodd-union hazard).
- Fills-only blending considered; dropped as unnecessary (identical styles).
- Stroke hard-swap kept; Chaikin after cull (convex, no expansion needed).

## Open (Phase 5)

Full OSM mainland assembly (east precision), binary pack + streaming
(bundle 3.9MB), WebGPU port of the same command list.
