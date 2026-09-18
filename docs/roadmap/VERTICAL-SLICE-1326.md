# 1326 Vertical Slice Roadmap

Source: brief §86. The slice is the foundation of the remaining architecture —
every step below must keep the DATA → SYSTEM → RUNTIME → UI → TEST chain
verifiable (brief §87; rendering/performance/memory links attach at Phase 5+).

## Slice definition (done = all green)

```text
7 April 1326 → world loads → Anatolia renders → Bursa visible
→ province selection → city panel → time advances → AI reacts → event appears
```

Note: minimal-3D city, army visuals, and full economy attach in later phases.
The slice proves the **chain**, not the full feature list.

## Steps

### S1 — Boot + scenario load (Phase 1)
`enterGame({scenarioId:'1326', countryId:'ottomans'})` runs the full chain
(load → validate → world → state → session) against hand-authored seed data:
3 states (ottomans, byzantines, karamanids), ~15 anchors (Bursa, Nicaea,
Nicomedia, …), ~10 canonical provinces. Tests: scenario-contract,
province-contract, city-contract, boot-handoff.

### S2 — World render, 2.5D styling from day one (Phase 3+5 minimal)
Canvas 2D (deliberate: WebGPU arrives Phase 5) renders from the runtime
snapshot: sea with depth bands, land with relief tint + drop shadow, provinces
with state colors + extruded borders, coastline from the independent authority
layer (hand-traced Marmara sample; GIS data Phase 4), anchor markers.
The 2.5D token set (`STYLE_25D_V1`) is backend-independent — WebGPU implements
the same language later. Architecture: session → frozen snapshot → display-list
commands → backend paints. Layout math is pure and headless-tested; only the
final paint needs a browser. Tests: rendering-contract (camera, snapshot,
display list).

### S3 — Selection + panels (Phase 6 minimal)
Click province → panel (owner, controller, population placeholder, terrain
placeholder). Click city → panel (tier, development). Read-only; values come
from queries, never direct state access. Tests: selection-handoff.

### S4 — Time + AI reaction + event (Phase 13/14 minimal)
Monthly tick advances date; one scripted AI reaction (e.g. Byzantines adjust
posture) + one systemic event (e.g. Bursa trade note) with a real state effect
(trade volume → tax base). Tests: tick-determinism (same seed → same state).

## Exit criteria
All S1–S4 tests green locally, repo-structure contract green, STATUS.md
updated, work-log entries per run. Only then do Phase 4 (terrain/coastline)
and Phase 5 (WebGPU) begin — the slice never waits for the GIS pipeline (D10).
