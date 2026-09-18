# ADR-002: Real data boundary — what we take from where

Date: 2026-09-18
Status: Accepted

## Context

The slice started with a hand-traced coastline. The user asked to build on
real map data, pointing at Open-Historia (open source) and historia-ai
(previous work), targeting Open Historia visual quality.

## Investigation

- **Open-Historia/open-historia is AGPL-3.0-or-later** (plus a copyright-assignment
  CLA). Building CoH on its code would put CoH under AGPL, including the
  network-use source-offer clause. Its map binaries are not even in the repo
  (release assets: pmtiles + GADM-derived stock world). Verdict: ideas and
  public data sources only — **no code, no data files copied**.
- **Natural Earth is public domain.** historia-ai's verified approach (pinned
  `nvkelso/natural-earth-vector` revision, cleanliness gate) is reused as
  method, not as code.

## Decision

1. Coastline authority = Natural Earth 50m coastline @ pinned rev
   `ca96624…5039ad19`, clipped to scenario bounds, RDP-simplified (0.02°),
   quantized (4 decimals). Pipeline: `npm run gis:coastline`.
2. Raw sources live gitignored under `data/sources/`; only built authority
   files are committed, with provenance + confidence recorded per segment.
3. Hand-traced geometry is deleted, not kept in parallel (one authority).
4. 10m hydrography, DEM, and the full Phase 4 GIS pipeline stay on the roadmap;
   50m is the correct resolution for the current zoom range.

## Consequences

- (+) Real Marmara/Aegean/Black Sea coastline from the first data-driven render.
- (+) Reproducible: pinned revision + validation string in the fetch script.
- (-) 50m resolution is coarse at city zoom — recorded as known limit, fixed by
  Phase 4 (10m + DEM), not by hand edits.
