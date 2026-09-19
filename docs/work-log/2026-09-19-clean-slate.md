# Work log — 2026-09-19: clean-slate map reset

## Owner order

"Üzerinde çalıştıkça bozuyoruz — birkaç adım geri, harita sistemini temizle,
baştan kur. İlk adım: tüm dünya, tek-tip kıyı detayı, deniz yok, terrain yok."

## Changes

- `displayList.js` rewritten: sea → land-fill → province-fill (land-clipped) →
  coastline (same rings) → borders → markers → fade. Culling kept.
- `backend.js`: retired layers stubbed with explicit RETIRED markers
  (sea-fill, bands, carve, waterway, OSM/country overdraws, terrain, lakes,
  rivers). Data files untouched for the rebuild.
- Rendering tests rewritten for the clean chain (order, retired-absent,
  culling, smoothing, clip).
- ADR-008 records the rebuild protocol: layers return one at a time,
  owner-gated, each with a no-spill/no-gap test.

## Test results

- `npm test` → 57/57 pass. `npm run build` → clean.
