# Data credits — Canvas of Historia

Map and geography data sources. Provenance is also recorded per file
(`source` field in `data/scenarios/1326/*.json`).

- **OpenStreetMap coastline** (`coastline-hd.json`, via Overpass) —
  © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
  Used for high-detail coastline strokes in the Anatolia theater. ODbL note:
  derived databases are shared on request; game code is NOT affected.
  (Removed from the map corner per owner decision 2026-09-19; restore with one
  line in `index.html` `#credit` div if the game is published.)
- **Natural Earth 10m land** (`land.json`, `coastline.json`) — public domain
  (https://www.naturalearthdata.com). Global land base.
- **Natural Earth 10m rivers + lakes** (`rivers.json`, `lakes.json`) —
  public domain. Theater hydrography.
- **AWS Terrarium DEM z7** (`terrain-grid.json`) — public terrain tiles
  (https://s3.amazonaws.com/elevation-tiles-prod/). Elevation tint.
