# ADR-010: Isolated layers + render performance

Date: 2026-09-19
Status: Accepted (owner order: decouple coastline, fix the lag).

## Layer isolation

- `src/map/layers/registry.js`: fixed paint order (`sea → coastline →
  markers → edge-fade`); future sea/land/terrain register without touching
  coastline code. Layers never import each other.
- `src/map/layers/coastline.js`: TileStore (injected fetch, LRU 96),
  viewport key computation, project+cull+stride builder. Pure + tested.
- displayList orchestrates; backend dispatches. No cross-layer calls.

## Performance (measured problems → fixes)

1. 11.9MB entry parse → dynamic `import()` per dataset: entry is now 25KB,
   big JSONs stream as separate chunks (build output proves the split).
2. Thousands of canvas subpaths per frame → ONE `coastline-batch` path.
3. Every event re-stroked everything → rAF coalescing + offscreen pan-blit
   (drag blits cached frame; release re-renders once).
4. Full-detail projection at far zoom → adaptive stride (4/2/1 by scale;
   sub-pixel safe, tested endpoint preservation).
5. Tile fetch per frame → LRU cache + redraw-on-arrival only.

## Consequences

- (+) Pan is a blit (60fps territory); zoom re-renders once per gesture.
- (+) Coverage: registry/layers/store/stride/culling tests (layers.test.js).
- (-) Blit leaves stale edges mid-drag (repaint on release — standard).
- (-) Bundle still large in total; Phase 5 binary pack remains.
