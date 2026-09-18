# Work log — 2026-09-19: black coast, wash clip, credit move

## User orders

1. Plain black coastline (current styling reads buggy).
2. Political wash must never enter the sea (screenshot: Nicomedia box over water).
3. Remove the OSM corner credit entirely.
4. Definitive mask solution worldwide (standing demand; technique record ADR-004).

## Changes

- `style.js`: coastline `#14181a` / 1.2px, glow token removed; bands slimmer
  and fainter (shallow hint stays, user-approved effect).
- `index.html`: corner credit div + CSS removed. Attribution moved to
  `CREDITS.md` + per-file provenance (ODbL note kept there). Owner was told:
  restore one line before publishing (documented in CREDITS.md).
- `displayList.js`: `province-fill` commands carry projected `landClip` rings
  (shared `landScreen`, computed once).
- `backend.js`: `province-fill` clips to land via evenodd path before painting —
  wash physically cannot enter the sea. Lakes excluded by the same rule.
- Tests: every fill carries a non-empty landClip.

## Standing technique position (minnak debate, ADR-004)

Forensic + research minnaks agree: single polygon source + clip everything to
it + stroke the same path. Current implementation: NE-global fill, OSM HD
theater strokes, carve, clips. Full OSM polygonization stays the Phase 5
upgrade (strait-exact fills); carve holds straits until then.

## Test results

- `npm test` → 53/53 pass. `npm run build` → clean.
