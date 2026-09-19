# ADR-008: Clean-slate map rebuild (one layer at a time)

Date: 2026-09-19
Status: Accepted (owner order: strip it down, rebuild layer by layer).

## Context

Layered patches (carve, ribbons, overdraws, waterways) accumulated into visual
breakage worse than the defects they covered. Owner ordered: go back, clean
the whole map system, rebuild from zero — first step: whole world at uniform
coastline detail, no sea systems, no terrain.

## Decision

1. Render chain is exactly: sea → land-fill → province wash (land-clipped) →
   coastline → borders → markers → fade. Nothing else is emitted.
2. ONE land source (NE global), ONE coastline (the same rings), plain black
   1.2px stroke. Mismatch impossible by construction.
3. Retired layers stay as data + stubbed backend cases (explicit RETIRED
   markers), returning ONE AT A TIME, each gated by the owner AND by a test
   proving no spill/gap: (a) sea shallows, (b) terrain, (c) hydrography,
   (d) HD detail regions, (e) strait guarantees.
4. Uniform detail = uniform source everywhere (NE 10m). HD detail arrives per
   region through the same fetch→validate→clip→test pipeline — never as a
   second-class overlay with its own rules.

## Consequences

- (+) Debuggable: every pixel traces to one drawing.
- (+) Close-zoom coarseness is honest (same everywhere) until HD regions land.
- (-) Temporarily plainer map. Accepted explicitly.
