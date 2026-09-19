# Historical Water Policy

Date: 2026-09-19
Status: Active.

## Rule

Modern water features that postdate the scenario are ERASED; historical
waters that modern data distorts are RESTORED. OSM/NE capture ~2026: every
scenario declares its date, and `era-edits.json` lists corrections with
cutoff dates. Application is a documented build step
(`tools/gis/apply-era-edits.js`), verified by tests — never a silent hack.

## Registry (1326)

| Feature | Status in 1326 | Action |
|---|---|---|
| Suez Canal (1869) | absent | removed from tiles + HD (rule `suez-canal`) |
| Don–Volga Canal (1952) | absent | backlog |
| Panama Canal (1914) | absent | backlog (pre-1900 scenarios) |
| Zuiderzee (closed 1932) | OPEN water | backlog: ADD, not remove |
| Aral Sea | full extent | backlog: modern shrinkage must not apply |
| Bosphorus/Dardanelles | open straits | protected waterways (already live) |
| Caspian Sea | present | NE-hole extraction (live, all zooms) |

## Notes

- Removal rule: lines FULLY inside the corridor box AND spanning > 0.1° go;
  harbor fragments stay. Counts are printed on every run.
- Restorations (Zuiderzee/Aral) need ADD pipelines — tracked, not implemented.
