// Coastline layer: planet tile store + command builder. Self-contained:
// no imports from sea/land/terrain/marker systems. Fetch is injected so the
// store is testable without a browser.

import { TILE_DEG, tileRangeForView } from '../tiles.js';
import { project } from '../camera/camera.js';
import { unproject } from '../selection/pick.js';

export const COAST_TILE_URL = (key) => `/tiles/coast/${key}.json`;
export const TILE_CACHE_MAX = 96;

export function createTileStore(fetchJson, onChange) {
  const cache = new Map();
  const get = (key) => cache.get(key);
  const ensure = (keys) => {
    const ready = [];
    for (const key of keys) {
      const hit = cache.get(key);
      if (hit?.lines) {
        ready.push({ key, lines: hit.lines });
      } else if (!hit) {
        cache.set(key, { pending: true });
        if (cache.size > TILE_CACHE_MAX) cache.delete(cache.keys().next().value);
        fetchJson(COAST_TILE_URL(key))
          .then((data) => {
            cache.set(key, data && Array.isArray(data.lines) ? { lines: data.lines } : { lines: [] });
            onChange?.();
          })
          .catch(() => cache.set(key, { lines: [] }));
      }
    }
    return ready;
  };
  return { get, ensure, size: () => cache.size };
}

// Viewport world bbox → visible tile keys.
export function visibleTileKeys(camera, width, height) {
  const corners = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ].map(([x, y]) => unproject(camera, width, height, [x, y]));
  const lons = corners.map(([lo]) => lo);
  const lats = corners.map(([, la]) => la);
  return tileRangeForView(Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats));
}

// Pure: tile lines + camera → projected screen polylines (culled).
export function buildCoastLines(tiles, camera, width, height, stride = 1) {
  const out = [];
  for (const tile of tiles) {
    for (const line of tile.lines ?? []) {
      if (!lineVisible(line, camera, width, height)) continue;
      const pts = [];
      for (let i = 0; i < line.length; i += stride) pts.push(project(camera, width, height, line[i]));
      if (line.length > 1 && (line.length - 1) % stride !== 0) {
        pts.push(project(camera, width, height, line[line.length - 1]));
      }
      if (pts.length >= 2) out.push({ id: tile.key, points: pts });
    }
  }
  return out;
}

function lineVisible(line, camera, width, height) {
  const [cx] = camera.center;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [lon, lat] of line) {
    let x = lon;
    while (x - cx > 180) x -= 360;
    while (cx - x > 180) x += 360;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (lat < y0) y0 = lat;
    if (lat > y1) y1 = lat;
  }
  const pad = 48;
  const corners = [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ];
  let sx0 = Infinity;
  let sx1 = -Infinity;
  let sy0 = Infinity;
  let sy1 = -Infinity;
  for (const [lon, lat] of corners) {
    const [x, y] = project(camera, width, height, [lon, lat]);
    if (x < sx0) sx0 = x;
    if (x > sx1) sx1 = x;
    if (y < sy0) sy0 = y;
    if (y > sy1) sy1 = y;
  }
  return sx1 >= -pad && sx0 <= width + pad && sy1 >= -pad && sy0 <= height + pad;
}

export { TILE_DEG };
