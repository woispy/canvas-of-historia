# ADR-003: OSM high-detail coastline (ODbL)

Date: 2026-09-19
Status: Accepted

## Context

NE 10m coastline (38 segments / 1364 pts) looks chunky at city zoom. The user
asked for Open Historia-grade shore detail, which needs survey-scale geometry.

## Decision

1. High-detail twin: OpenStreetMap coastline ways via Overpass, clipped to
   scenario bounds, lightly simplified (0.0015°), quantized (5dp) →
   `coastline-hd.json` (7311 segments / 24626 pts, ~18x base).
2. LOD rule in displayList: HD at `camera.scale >= 250`, NE 10m below.
   Same contract shape — LOD differs, validation does not.
3. License: OSM data is **ODbL** (share-alike on the database, attribution
   required). Unlike AGPL, ODbL does not infect game code. Compliance:
   visible "© OpenStreetMap contributors" credit in-app (index.html) +
   source recorded per segment + this ADR. If we ever publish a *modified*
   coastline database, that file is shared under ODbL.

## Consequences

- (+) OH-grade bays, islets, straits at close zoom.
- (+) Raw 30MB Overpass response stays gitignored; committed HD file is ~2MB.
- (-) HD band cost at far zoom avoided by LOD switch (tested).
