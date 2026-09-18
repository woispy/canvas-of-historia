# ADR-005: Whole-world land base (no scenario clipping)

Date: 2026-09-19
Status: Accepted — supersedes ADR-004's OSM polygonizer (deleted).

## Context

Coastlines clipped at scenario bounds cannot complete each other (missing
Sinop-type neighbors break assembly), and border closures fabricate straight
"coasts". The user ruled: draw the whole world for land/sea/coast.

## Decision

1. Land + base coastline come from global NE 10m land, unclipped. Only
   transforms: unwrap longitudes (no antimeridian streak), meter-space RDP
   (5km — degree-RDP collapses polar traverses into 360° streaks), pole
   excursions dropped from strokes only.
2. OSM HD stays as the theater's close-zoom stroke twin + LOD (unchanged).
3. `build-osm-land.js` deleted; border assembly, seed scoring, and voting
   machinery removed with it. Simpler system, fewer failure modes.
4. Camera still boots fitted to scenario bounds (theater-first UX); world
   expansion later = wider bounds + rebuild, no architecture change.

## Consequences

- (+) No border artifacts by construction; coordinates stay clean; future
      world scopes need no rework.
- (+) NE-vs-OSM mismatch inside the theater remains handled by carve + LOD.
- (-) Global base ≈ 2MB JSON; bundle 3.8MB — binary packing + streaming with
      Phase 5 (flagged, tracked).
