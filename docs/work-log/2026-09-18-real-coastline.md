# Work log — 2026-09-18: real coastline data (NE 50m)

## Goal

Replace the hand-traced coastline with real data, staying license-clean.

## Investigation

- Open-Historia/open-historia is **AGPL-3.0-or-later** (+ copyright-assignment
  CLA); its map binaries are release assets, not repo content. Verdict: ideas
  and public sources only — no code or data copied. Recorded in ADR-002.
- historia-ai's verified method reused: pinned NE revision + validation string
  + gitignored raw sources (approach, not code).

## Changes

- `tools/gis/fetch-ne-coastline.js`: downloads NE 50m coastline @ pinned rev
  to gitignored `data/sources/` (1.64 MB).
- `tools/gis/build-coastline.js`: clip to scenario bounds → RDP simplify
  (0.02°) → quantize (4dp) → authority format. Result: **17 segments,
  262 points**, all HIGH confidence with recorded provenance.
- `package.json`: `gis:fetch`, `gis:build-coastline`, `gis:coastline`.
- `.gitignore`: `data/sources/`, `dev-server.log`.
- Tests now assert real-data properties (NE source, in-bounds points).
- `docs/adr/ADR-002-real-data-boundary.md`.

## Test results

- `npm test` → 28/28 pass. `npm run build` → clean.
- One fix: display-list test assumed 1 coastline command; now asserts ≥1.

## Open items

- 50m is coarse at city zoom (known limit, Phase 4 fixes with 10m + DEM).
- S3: selection + panels.
