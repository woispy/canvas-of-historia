# Work log — 2026-09-19: country fills + explicit seas (rebuild)

## Goal

Rebuild the map fill system from scratch on the researched pattern
(historia-ai forensic v2): country polygons + explicit water overlays +
fixed pass order, all under one land mask.

## Changes

- `tools/gis/fetch-ne-admin.js` + `build-theater-land.js`: 10 admin-0
  countries → 54 clipped theater polygons (`land-countries.json`).
- `data/scenarios/1326/seas.json`: Marmara/Bosphorus/Dardanelles open-water
  cores. Painted BEFORE land fills (land restores overlaps by order);
  OSM crisp strokes drawn last define exact edges.
- Chain: `land-countries.json` through loader/validator/factory/snapshot/
  displayList (`land-fill-country`, same style) + main.js.
- Render order now: sea → seas → bands → NE fill → country fills → OSM
  overdraw → terrain → lakes → rivers → washes (land-clipped) → carve →
  waterways → crisp → borders → markers → fade.
- Deleted nothing else; `land-osm.json` overdraw stays for verified islands.
- Land schema allows optional `country`.

## Test results

- `npm test` → 58/58 pass. `npm run build` → clean.
