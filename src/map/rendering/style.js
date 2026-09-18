// 2.5D visual language v2 (Canvas2D backend) — tuned toward the
// open-sea legibility of the reference map: light sea, warm land,
// translucent political wash over terrain, crisp dark coastline.
// Tokens stay backend-independent: WebGPU (Phase 5) implements the same set.

export const STYLE_25D_V1 = Object.freeze({
  sea: Object.freeze({
    deep: '#5f97ba',
    shallow: '#cfe2ee',
    // depth bands drawn outward from the coastline authority layer
    bands: Object.freeze([
      { width: 6, color: 'rgba(235, 246, 252, 0.55)' },
      { width: 14, color: 'rgba(235, 246, 252, 0.30)' },
      { width: 28, color: 'rgba(235, 246, 252, 0.12)' },
    ]),
  }),
  land: Object.freeze({
    base: '#9a957e',
    highlight: '#c2bda4',
    shadow: 'rgba(20, 40, 55, 0.35)',
    shadowBlur: 12,
    shadowOffsetY: 4,
  }),
  provinceWashAlpha: 0.55,
  border: Object.freeze({
    // extruded look: dark outer edge + light inner edge
    outer: 'rgba(30, 30, 28, 0.85)',
    outerWidth: 2,
    inner: 'rgba(255, 255, 245, 0.4)',
    innerWidth: 1,
  }),
  coastline: Object.freeze({
    color: '#33494f',
    width: 1.3,
    glow: 'rgba(255, 255, 255, 0.45)',
  }),
  marker: Object.freeze({
    city: '#7a5c17',
    capital: '#a03d12',
    radius: 3.5,
  }),
});
