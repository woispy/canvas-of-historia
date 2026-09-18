# Canvas of Historia — System Architecture (v1)

Date: 2026-09-18 · Phase: 0 · Source brief: `docs/vision/MASTER-BRIEF-v1.md`
Forensic input: historia-ai analysis (`docs/work-log/2026-09-18-brief.md` sonrası işlenecek —
bulgular aşağıda kararlara gömüldü).

## 1. Layer model

```text
app (UI)          — observes, never mutates; progressive disclosure
  ↓ reads snapshots
rendering         — WebGPU-first, WebGL2 fallback; snapshot → GPU buffers
  ↓ reads snapshots
core/engine       — stateless command surface + tick; simulation ≠ frame
core/world        — repositories + queries (computed, side-effect free)
core/state        — mutable runtime state, save/load target
core/scenario     — immutable definitions (load → validate → freeze)
map/*             — physical authority + HGE + topology + camera
systems/*         — population, economy, trade, tech, diplomacy, military,
                    religion, culture, characters, ai, events
data/scenarios    — source data + evidence (never loaded directly at runtime)
tools             — offline GIS import, validation, binary packing, tests
```

Dependency rule: **downward only**. UI never mutates. Renderer never mutates
simulation state. Queries never have side effects; all mutation goes through
engine commands. (Keeps historia-ai's intended layering; fixes its drift where
35 flat `src/` dirs contradicted the docs.)

## 2. Bootstrap chain (single orchestrator, single session)

```text
enterGame({scenarioId, countryId})
  → loadScenario      (core/scenario, immutable, frozen)
  → validateScenario  (throws on violation — no best-effort boot)
  → bootstrapWorld    (repositories + map runtime)
  → createRuntimeState (derived from scenario + player)
  → createGameSession (single frozen root {id, version, scenario, world, state})
```

Kept from historia-ai (`GameBootstrap.createGame` + frozen `GameSession`).
Fixed: pure `createGame` is separated from side-effecting `enterGame`
(historia-ai's second entry point did validation+logging+save+reset in one
place — that split is enforced here from day one).

## 3. Folder structure

```text
canvas-of-historia/
├── .opencode/agents/        coder, analyst, reviewer, local-assist
├── docs/
│   ├── vision/              MASTER-BRIEF-v1.md (taslak vizyon)
│   ├── architecture/        this file + rendering/webgpu/test arch (Phase 0–5)
│   ├── contracts/           JSON schemas (scenario, province, city, …)
│   ├── adr/                 architecture decision records
│   ├── roadmap/             vertical slice roadmap
│   └── work-log/            dated run records
├── data/scenarios/1326/     source data + evidence (hand-authored first)
├── tools/
│   ├── gis/                 offline import + validators (Phase 2+)
│   ├── build/               binary packing (Phase 5+)
│   └── tests/               node:test suites, mirrors src/ layout
├── src/
│   ├── core/scenario/       loader, validator, definition
│   ├── core/world/          factory, repositories, queries/, mutations/
│   ├── core/engine/         session, commands, tick
│   ├── core/state/          runtime state, save/load
│   ├── map/data/            physical authority (coastline, hydro, dem)
│   ├── map/historical/      HGE (evidence, anchors, political candidates)
│   ├── map/topology/        adjacency, costs, pathfinding data
│   ├── map/rendering/       webgpu/, webgl2/, terrain/, political/, city/, army/
│   ├── map/camera/          deterministic camera, canonical vs render lon
│   ├── systems/<domain>/    one folder per simulation domain
│   └── app/                 shell, panels, layers, entry (UI last per slice)
├── public/                  static + packed binary assets (never source data)
├── index.html
├── package.json
└── vite.config.js
```

`queries/` vs `mutations/` split is mandatory (historia-ai lacked it and domain
entities leaked to top level).

## 4. Data pipeline (source → runtime, never direct)

```text
Historical Sources → Evidence → Normalized → Validated → Canonical Dataset
  → Runtime Assets (JSON, small) → GPU Assets (binary, packed, streamed)
```

Rules: source JSON is never loaded at runtime. Generated artifacts are
content-hashed, cached, and **never committed** (cleanliness gate, kept from
historia-ai). `dev`/`build` never regenerate the full chain (historia-ai's
pain: every `vite` run re-fetched + rebuilt GIS) — layered, incremental builds.

## 5. Render pipeline

```text
CPU simulation → visible state extraction → render snapshot (frozen)
  → GPU buffers → GPU culling → instanced rendering → LOD
```

WebGPU-first, WebGL2 fallback. Simulation tick and render frame are
independent clocks. Renderer disposes everything (see §7).

## 6. Critical decisions (with rationale)

| # | Decision | Why |
|---|----------|-----|
| D1 | Vanilla ESM + Vite, no UI framework in engine; UI lib deferred to Phase 6 | Engine-first. Framework coupling blurred engine/UI boundaries in the reference project; UI choice must not constrain simulation data shapes. |
| D2 | JSDoc-typed JS, no TypeScript yet (revisit Phase 6) | Zero build friction for vertical slice; contracts are enforced by JSON Schema + runtime validators instead. TS migration stays an option, not a blocker. |
| D3 | Single orchestrator + single frozen session root | Proven in reference (`createGame` + `GameSession`); gives clear errors and a save/load target. |
| D4 | Immutable scenario → derived mutable world/state | Enables modding + future eras (1350, 1453…) without re-architecting. Typed schemas + defaults from day one (reference scraped deep optional fields). |
| D5 | SoA / typed-array province store from the start | Brief principle 2 (15k is a day-one constraint). Heavy class instances are banned for province-scale data. |
| D6 | Simulation → snapshot → GPU; renderer never mutates | Brief principle 3. Determinism + replay + AI tests depend on it. |
| D7 | Layered cached asset builds; cleanliness gate | Reference built correct artifacts (runtime.json → mapbin) but regenerated everything on every run. Cache + content hash + gate. |
| D8 | Plain `node:test`, zero test deps | Reference ran ~70 suites on Node asserts with no runner — keep that until real parallelism is needed. |
| D9 | Local-first now, layered CI later (ADR-001) | Speed + quota. Fast local gate with first scaffold; GitHub Actions (fast PR + slow nightly) once structure stabilizes. |
| D10 | Hand-authored 1326 seed data first, GIS pipeline later | Vertical slice needs Bursa + ~15 anchors, not Natural Earth. Full coastline/DEM pipeline arrives Phase 4; slice must not wait for it. |

## 7. Performance budget (v1, slice → 15k scale)

| Area | Slice budget | 15k budget |
|------|--------------|------------|
| Boot → interactive | < 3 s (seed data) | < 8 s (streamed) |
| Sim tick (1 month) | < 50 ms | < 250 ms |
| Frame (render) | 60 FPS min | 144 FPS target |
| Draw calls (map) | < 100 | < 300 (instanced/batched) |
| Province memory | SoA, < 1 KB/prov | packed, < 512 B/prov |
| GPU residency | snapshot only | visible tiles + LRU |

Benchmark ladder (1k/5k/10k/15k/20k) is added Phase 16; the harness shape
(synthetic province generator + CPU/GPU/memory metrics) is defined Phase 0 test
arch so later phases just plug in.

## 8. Memory lifecycle

Every ownable resource implements `create → initialize → attach → update →
detach → dispose`. Applies to: renderer, terrain, camera, workers, simulation
subscriptions, GPU buffers, texture caches, city/army instances. Lifecycle tests
are mandatory for each (brief §24); first lifecycle test lands with the first
renderer (Phase 5), harness convention is fixed now: `tools/tests/*lifecycle*`.

## 9. Test architecture

| Type | Where | From phase |
|------|-------|------------|
| Repo-structure contract | `tools/tests/repo-structure.test.js` | 0 (first green) |
| Unit | `tools/tests/<domain>/*.test.js` | 1+ |
| Contract (schema/data) | validators + `*-contract.test.js` | 1+ |
| Integration (slice chain) | `*-handoff.test.js` | 1+ |
| Regression (graphics) | headless-driven, Phase 5+ | 5+ |
| Performance/benchmark | harness Phase 0, suites Phase 16 | 16 |
| Determinism (seed replay) | engine tick replay | 6+ |

Rule (brief §87): a feature is done only when DATA → SYSTEM → RUNTIME → UI →
RENDERING → TEST → PERFORMANCE → MEMORY is verified. Slice phases verify the
prefix that exists; nothing is called "done" on screen appearance alone.

## 10. What is deliberately NOT decided yet

UI framework, multiplayer, modding API shape, full 1326 dataset, DEM source
selection, save format versioning details. Each gets an ADR at its phase —
deciding them now would be premature architecture.
