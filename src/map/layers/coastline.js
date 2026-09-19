// Coastline layer: planet tile store + command builder. Self-contained:
// no imports from sea/land/terrain/marker systems. Fetch is injected so the
// store is testable without a browser.

import { TILE_DEG, tileRangeForView } from '../tiles.js';
import { project } from '../camera/camera.js';
import { unproject } from '../selection/pick.js';

export const TILE_CACHE_MAX = 96;
export const MAX_FETCH_PER_PASS = 12;
// Pyramid levels: 0 = world outline, 1 = 8° tiles, 2 = 4° tiles.
export const LEVEL_DEG = { 1: 8, 2: 4 };

export function levelFor(scale) {
  if (scale < 25) return 0;
  if (scale < 120) return 1;
  return 2;
}

// Hysteresis LOD select: switch up immediately at 25/120, switch down only
// below 22/108. Kills oscillation flicker at thresholds. Pure + tested.
// During gestures the caller freezes the level; this runs on settle.
export function selectLod(scale, prev) {
  if (prev === 0) return scale >= 25 ? 1 : 0;
  if (prev === 1) {
    if (scale >= 120) return 2;
    if (scale < 22) return 0;
    return 1;
  }
  if (scale < 108) return 1;
  return 2;
}

// Fresh-tile fade alpha: cubic ease over 200ms. Only first-fetch tiles fade;
// cache hits draw instantly. Pure + tested.
export function tileAlpha(nowMs, arrivedAtMs) {
  const t = Math.max(0, Math.min(1, (nowMs - arrivedAtMs) / 200));
  return 1 - (1 - t) ** 3;
}

export function coastTileUrl(level, key) {
  return level === 1 ? `/tiles/coast1/${key}.json` : `/tiles/coast/${key}.json`;
}

export function useOutline(scale) {
  return levelFor(scale) === 0;
}

export function createTileStore(fetchJson, onChange, knownTiles = null, urlFor = (key) => `/tiles/coast/${key}.json`) {
  const cache = new Map();
  const api = {
    get: (key) => cache.get(key),
    ensure: null,
    size: () => cache.size,
    knownTiles,
  };
  const get = (key) => cache.get(key);
  const ensure = (keys) => {
    const ready = [];
    let started = 0;
    const known = api.knownTiles;
    for (const key of keys) {
      // Manifest gate: never fetch known-ocean tiles (the 404 storm).
      if (known && !known.has(key)) continue;
      const hit = cache.get(key);
      if (hit?.lines) {
        ready.push({ key, lines: hit.lines, bboxes: hit.bboxes, arrivedAt: hit.arrivedAt });
      } else if (!hit && started < MAX_FETCH_PER_PASS) {
        started++;
        cache.set(key, { pending: true });
        if (cache.size > TILE_CACHE_MAX) cache.delete(cache.keys().next().value);
        fetchJson(urlFor(key))
          .then((data) => {
            // Drop results for entries evicted while in flight (cap holds).
            if (!cache.has(key)) return;
            const lines = data && Array.isArray(data.lines) ? data.lines : [];
            cache.set(key, { lines, bboxes: lines.map(lineBbox), arrivedAt: Date.now() });
            onChange?.();
          })
          .catch(() => {
            if (cache.has(key)) cache.set(key, { lines: [], bboxes: [], arrivedAt: 0 });
          });
      }
    }
    return ready;
  };
  api.ensure = ensure;
  return api;
}

// Per-line world bbox, computed ONCE at load (not per frame).
function lineBbox(line) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [lon, lat] of line) {
    if (lon < x0) x0 = lon;
    if (lon > x1) x1 = lon;
    if (lat < y0) y0 = lat;
    if (lat > y1) y1 = lat;
  }
  return [x0, y0, x1, y1];
}

// Viewport world bbox → visible tile keys at the given grid size.
export function visibleTileKeys(camera, width, height, tileDeg = 4) {
  const corners = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ].map(([x, y]) => unproject(camera, width, height, [x, y]));
  const lons = corners.map(([lo]) => lo);
  const lats = corners.map(([, la]) => la);
  return tileRangeForView(Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats), tileDeg);
}

// Pure: tile lines + camera → projected screen polylines.
// Tiles may carry precomputed bboxes (from the store); otherwise computed.
// Trailing-edge throttle for full redraws: at most one per minMs, the last
// request always wins. Pure (injected clock + scheduler) — unit-tested.
export function createDrawThrottle(minMs, nowFn, scheduleFn) {
  let last = -Infinity;
  let timer = null;
  let pending = false;
  const fire = () => {
    timer = null;
    last = nowFn();
    pending = false;
  };
  return () => {
    const now = nowFn();
    if (now - last >= minMs) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pending = false;
      last = now;
      scheduleFn();
    } else if (!pending) {
      pending = true;
      timer = setTimeout(() => {
        fire();
        scheduleFn();
      }, minMs - (now - last));
    }
  };
}
// Pure: tile lines + camera → projected screen polylines.
// Tiles may carry precomputed bboxes (from the store); otherwise computed.
// Adaptive stride by zoom + measured cost. ONE geometry everywhere: no
// gesture-vs-release stride change, so transitions never pop. The governor
// alone protects slow machines. Pure and unit-tested.
export function strideForScale(scale, emaMs = 0) {
  let s = scale < 30 ? 4 : scale < 100 ? 2 : 1;
  if (emaMs > 40) s *= 2;
  if (emaMs > 80) s *= 2;
  return Math.min(s, 32);
}

// Clip a screen-space polyline to the viewport (+pad). Segments fully
// outside vanish; crossing segments are cut at the border. Pure, tested.
// This is what makes full-detail gestures affordable: the rasterizer never
// sees off-screen geometry.
export function clipPolylineToRect(points, width, height, pad = 2) {
  const out = [];
  let current = [];
  const intersect = (a, b) => {
    // Liang-Barsky against the padded rect.
    const [x0, y0] = a;
    const [x1, y1] = b;
    const dx = x1 - x0;
    const dy = y1 - y0;
    let t0 = 0;
    let t1 = 1;
    const xMin = -pad;
    const xMax = width + pad;
    const yMin = -pad;
    const yMax = height + pad;
    for (const [p, q] of [[-dx, x0 - xMin], [dx, xMax - x0], [-dy, y0 - yMin], [dy, yMax - y0]]) {
      if (Math.abs(p) < 1e-12) {
        if (q < 0) return null;
      } else {
        const t = q / p;
        if (p < 0) {
          if (t > t1) return null;
          if (t > t0) t0 = t;
        } else {
          if (t < t0) return null;
          if (t < t1) t1 = t;
        }
      }
    }
    if (t0 > t1) return null;
    return [[x0 + dx * t0, y0 + dy * t0], [x0 + dx * t1, y0 + dy * t1]];
  };
  for (let i = 0; i < points.length - 1; i++) {
    const seg = intersect(points[i], points[i + 1]);
    if (!seg) {
      if (current.length >= 2) out.push(current);
      current = [];
      continue;
    }
    const [p, q] = seg;
    if (current.length === 0) current.push(p);
    else {
      const last = current[current.length - 1];
      if (Math.abs(last[0] - p[0]) > 1e-9 || Math.abs(last[1] - p[1]) > 1e-9) {
        if (current.length >= 2) out.push(current);
        current = [p];
      }
    }
    current.push(q);
  }
  if (current.length >= 2) out.push(current);
  return out;
}

// Pure: tile lines + camera → projected screen polylines.
// Tiles may carry precomputed bboxes (from the store); otherwise computed.
export function buildCoastLines(tiles, camera, width, height, stride = 1) {
  const out = [];
  for (const tile of tiles) {
    const lines = tile.lines ?? [];
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const bbox = tile.bboxes?.[li] ?? lineBbox(line);
      if (!bboxVisibleWorld(bbox, camera, width, height)) continue;
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

function shiftNear(lon, centerLon) {
  let x = lon;
  while (x - centerLon > 180) x -= 360;
  while (centerLon - x > 180) x += 360;
  return x;
}

function bboxVisibleWorld([x0, y0, x1, y1], camera, width, height) {
  // Normalize near the camera center (antimeridian-safe), then project.
  const cx = camera.center[0];
  const nx0 = shiftNear(x0, cx);
  const nx1 = shiftNear(x1, cx);
  return bboxVisible([nx0, y0, nx1, y1], camera, width, height);
}

const CULL_PAD = 48;

function bboxVisible([x0, y0, x1, y1], camera, width, height) {
  let sx0 = Infinity;
  let sx1 = -Infinity;
  let sy0 = Infinity;
  let sy1 = -Infinity;
  for (const [lon, lat] of [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ]) {
    const [x, y] = project(camera, width, height, [lon, lat]);
    if (x < sx0) sx0 = x;
    if (x > sx1) sx1 = x;
    if (y < sy0) sy0 = y;
    if (y > sy1) sy1 = y;
  }
  return sx1 >= -CULL_PAD && sx0 <= width + CULL_PAD && sy1 >= -CULL_PAD && sy0 <= height + CULL_PAD;
}

export { TILE_DEG };
