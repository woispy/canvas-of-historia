# ADR-007: Country fills + explicit water overlays (historia-ai pattern)

Date: 2026-09-19
Status: Accepted. Forensic v2 + raster-MASK rejection inform this decision.

## Context

Two failed attempts taught the constraints: (1) OSM polygon assembly breaks
on shared-border landmasses (greedy walk merges across straits); (2) raster
flood-fill rejected by red-team (border seeding unsound, gap/strait tradeoff,
staircase). Forensic v2 revealed historia-ai's actual system: NE country
polygons as fill authority + EXPLICIT strait/sea water polygons (Marmara
17-pt, Bosporus 9-pt, Dardanelles 9-pt) + fixed render order, all under one
physical mask. No OSM consumption there at all.

## Decision

1. Theater land = NE admin-0 country polygons intersecting the expanded bbox
   (10 countries incl. islands), clipped, same style over the global base.
2. Water overlays (`seas.json`): open-water cores (Marmara, Bosphorus,
   Dardanelles) painted as flat sea BEFORE land fills — land restores any
   overlap, so cores are safe by order. OSM crisp strokes drawn last define
   the exact visible edge.
3. Render order (fixed): sea → seas → bands → NE fill → country fills →
   OSM-island overdraw → terrain → lakes → rivers → washes (land-clipped) →
   carve → waterways → crisp strokes → borders → markers → fade.
4. Uniform detail = uniform PIPELINE everywhere (country fills + OSM strokes
   where fetched); density follows data (planet OSM-HD is GBs — stated, not
   hidden). Regions upgrade with the same fetch scripts.
5. Political mask reuses the same land clip path — future-proof per brief.

## Consequences

- (+) No assembly, no flood, no parity risk in theater water; straits open by
      construction (water painted first, shores stroked last).
- (+) Bosphorus/Dardanelles visible correctness no longer depends on 700m
      features surviving 5km generalization.
- (-) Sea cores are hand-placed (documented per-file, verified by tests).
- (-) Country-clip border edges hidden by vignette (accepted, tested order).
