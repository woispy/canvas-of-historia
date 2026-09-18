# ADR-004: Single-source coastline (the definitive fix)

> SUPERSEDED by ADR-005 (2026-09-19). The OSM polygonizer is deleted; the
> whole-world NE base + OSM stroke twin + carve is the standing answer.
> Kept for the debate record (forensic + technique survey stay valid).

Date: 2026-09-19
Status: Accepted (after team debate — see below)

## Problem

Fills (NE 10m land) and strokes (OSM lines) come from different sources.
No px trick can align them at all zooms: spill, gaps, bridged straits.

## Team debate (2026-09-19)

- **Forensic minnak (historia-ai, read-only):** no stencil/SDF/magic found.
  Their guarantee is architectural: ONE land authority
  (`WorldPhysicalAtlas` / `WORLD_LAND_POLYGONS`) → coastline stroke derived
  from the identical path → political fills clipped to land via SVG clipPath +
  offscreen `destination-in` + GPU `discard`. Rule: fill and stroke are the
  same drawing (positive/negative use) — exactly what the user remembered.
- **Research minnak (technique survey):** ranked (1) polygonize OSM coastline
  closing along bbox → single polygon source (zoom-independent, exact,
  Bosphorus-safe); (2) raster mask hybrid (not zoom-independent — rejected as
  the guarantee mechanism); (3) SDF (WebGPU later, needs (1) first);
  (4) render-time stencil tricks on open lines (fundamentally unable — canvas
  closes open paths with straight chords).
- **Verdict:** both agree — (1), the historia-ai rule. No dissent.

## Decision

1. Build `land.json` FROM the OSM coastline itself (`build-osm-land.js`):
   stitch clipped runs by shared endpoints → closed island rings kept as land →
   open border-to-border chains closed along the bbox, winner picked by
   land/sea seed scoring → NE 10m land retired from the chain.
2. Everything clips to the same polygons: land fill, terrain tint,
   political washes (backend clip on `province-fill`), shallow bands stay
   seaward by paint order. Crisp OSM stroke on top, unchanged.
3. Straits: polygonization leaves sub-seed water open (Bosphorus by
   construction, not by eraser width). The `coast-carve` hack is REMOVED.
4. ODbL: derived polygons are a Derivative Database — credit stays in-app
   (already present), source per file, share-on-request noted here.

## Consequences

- (+) Spill/gap impossible by construction at every zoom, islands included.
- (+) Political wash can never enter the sea (clipped to land).
- (-) Polygonizer bugs would corrupt fills visibly — guarded by seed tests
      (Ankara in / Black Sea out / Bosphorus water / Büyükada in) + visual check.
- (-) Base far-zoom strokes (NE 10m) may deviate sub-pixel from OSM edges —
      accepted, invisible below LOD switch.
