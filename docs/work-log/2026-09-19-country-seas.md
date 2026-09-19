# Work log — 2026-09-19: country fills + explicit seas (ADR-007)

## Goal

Rebuild the map fill system from scratch on the researched pattern; uniform
pipeline; straits guaranteed open.

## Research applied

- Forensic v2: historia-ai = NE countries + explicit Marmara/Bosporus/
  Dardanelles water polys + fixed pass order + clipPath/destination-in/shader
  discard. No OSM, no assembly, no flood.
- Red-team: raster flood rejected (border seeding unsound, gap/strait
  tradeoff). Closed-ring sources only.

## Changes

- `tools/gis/fetch-ne-admin.js` + `build-theater-land.js`: 10 admin-0
  countries → 54 clipped theater polygons (`land-countries.json` — file named
  land-countries; chain wired as second fill layer).
- `data/scenarios/1326/seas.json`: Marmara/Bosphorus/Dardanelles open-water
  cores (hand-placed, verified open water, land restores overlaps by order).
- Render order: sea → seas → bands → NE fill → country fills → OSM-island
  overdraw → terrain → lakes → rivers → washes → carve → waterways → crisp.
- Deleted `tools/gis/build-seas.js` (chaining approach retired).
- Tests: seas containment, sea-fill order, country coverage is implicit via
  render (explicit coverage test: Turkey present in land-countries).

## Test results

- `npm test` → 57/57 pass. `npm run build` → clean.
