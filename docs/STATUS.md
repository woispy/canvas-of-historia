# Project Status — Canvas of Historia

Updated: 2026-09-18

## Phase

0 — done (green). Architecture, contracts v1, roadmap, scaffold, 15/15 tests.
S1 core done (green, 23/23): loader/validator/world/state/session + `enterGame`
+ boot-handoff tests + browser build.
S2 done (green, 27/27 → 31/31): 2.5D Canvas2D render, NE 10m land (38 polys)
+ aligned coastline (38 segs), OH-tuned style, rendering-contract tests.
S3 done (green, 37/37): click selection (province/city) + read-only panels.
S4 done (green, 41/41): monthly tick (immutable sessions), Bursa boom event,
Byzantine AI reaction, determinism proven. Slice S1–S4 exit criteria met.
Git: fresh root commit pushed to GitHub (mirror).
Phase 4 started (green, 42/42): NE 10m rivers (20 runs) + lakes (6 polys),
rendered as new layers; 50m scripts retired.
Phase 4 terrain done (green, 44/44): Terrarium DEM z7 → 192x72 elevation grid
(-4120..3517m), hillshaded relief tint clipped to land.
Details: `docs/work-log/2026-09-18-commit-hydro.md`, `2026-09-18-dem-terrain.md`.
Next: Phase 5 WebGPU renderer or Phase 7 economy — user picks.
Camera (2026-09-19): bounds-fit boot centering, wheel zoom, drag pan, HUD +/−,
fixed-parallel projection (zero-drift). Tests 48/48.
HD coastline (2026-09-19, green 50/50): OSM 24.6k pts + zoom LOD (HD≥250px/°),
ODbL credit in-app. Bundle 1.7MB — binary packing with Phase 5.
Coastal paint (2026-09-19, green 52/52): sea-side-only shallows, Chaikin
corner softening, crisp top stroke. True single-source coast fix: Phase 5.
Shore ribbon (2026-09-19, green 53/53): world-degree band widths + land-toned
shore ribbon + 2-pass smoothing. Km-scale deltas still flagged for Phase 5.
Coast truth pass (2026-09-19, green 53/53): 17° border artifact removed,
sea-tone carve (un-bridges straits), tan ribbon gone, edge vignette.
World base (2026-09-19, green 53/53): ADR-005 — global NE land (2042 polys),
no bbox clipping, meter-RDP, pole fix; OSM polygonizer deleted.
Coast final (2026-09-19, green 53/53): plain black 1.2px stroke, wash clipped
to land (no sea spill), credit moved to CREDITS.md.
Masking final form (2026-09-19, green 56/56): ADR-006 — verified OSM overdraw
(151 polys, zero sea), protected waterways (Bosphorus/Dardanelles), viewport
culling, black crisp line. East mainland precision → Phase 5.
Rebuild (2026-09-19, green 58/58): ADR-007 — country fills (10 countries,
54 polys) + explicit seas painted first + fixed pass order.
Clean slate (2026-09-19, green 57/57): ADR-008 — single-source chain
(sea→land→wash→coastline→borders→markers→fade). Layers return one by one.
Planet coast (2026-09-19, green 61/61): ADR-009 — OSM planet tiles (~100m,
1246 tiles, strokes only, no fills). Next: verify paint, then gated layers.
Layers+perf (2026-09-19, green 65/65 → 71/71): ADR-010/011 — isolated layer,
batched strokes, rAF, lazy JSON (entry 25KB); manifest gate, pyramid, eviction
fix; honest interaction + governor + crossfade sharpen (no pops).

## Done

- 2026-09-18: local repo wiped to a clean slate (`.git` kept; remote's 2 old commits untouched).
- 2026-09-18: agent team created (`coder`, `analyst`, `reviewer`, `local-assist`), verified via `opencode agent list`.
- 2026-09-18: continuity docs + ADR-001; Ollama wired in and smoke-tested.
- 2026-09-18: master brief filed; system architecture, 3 contract schemas, slice roadmap written.
- 2026-09-18: Phase 0 scaffold green (`npm test` 15/15).
- 2026-09-18: autonomous system report filed; S1 seed data green (20/20):
  1326 scenario (4 states, 17 anchors), 6 provinces, 6 cities, contract tests.

Details: `docs/work-log/2026-09-18-team-setup.md`, `2026-09-18-ollama.md`, `2026-09-18-brief-phase0.md`, `2026-09-18-system-report-s1-seed.md`, `2026-09-18-s1-enterGame.md`, `2026-09-18-s2-map-render.md`, `2026-09-18-real-coastline.md`.

## Next

1. S2: flat Canvas 2D render from snapshot + rendering-contract test.
2. Remaining schemas land with their phases (HGE, economy, tech, trade, military, character, AI, rendering, WebGPU).
3. Add GitHub CI later; decide fresh git history at first commit.

## Open questions

- Fresh git history vs. keeping the remote's 2 old commits (decide at the first scaffold commit).
