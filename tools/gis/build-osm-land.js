#!/usr/bin/env node
// OSM coastline → VERIFIED theater land polygons (ADR-006).
// Stitched runs + border assembly + STRICT per-ring verification. Anything
// doubtful is dropped: NE global underneath guarantees no holes (overdraw,
// same style). Emits land-osm.json. Build FAILS if seeds don't verify.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const BUFFER_DEG = 1.0;
const SIMPLIFY_EPSILON_DEG = 0.0015;
const QUANTIZE_DECIMALS = 5;
const MIN_AREA_DEG2 = 1e-6;
const GAP_REPAIR_DEG = 0.05;

const LAND_SEEDS = [
  [32.86, 39.93], [37.02, 39.75], [32.48, 37.87], [29.06, 40.19],
  [39.7, 41.0], [40.2, 37.9], [28.5, 41.1], [27.1, 38.4],
  [30.7, 36.9], [35.3, 37.0],
];
const SEA_SEEDS = [
  [34.0, 41.75], [26.6, 37.6], [29.3, 40.72], [33.0, 36.15], [27.0, 36.3],
  [29.0, 41.15], [29.02, 41.08], [29.03, 41.02],
];

function pointInRing([lon, lat], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return Math.abs(a / 2);
}

function perpDist([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function rdp(points, eps) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist <= eps) return [points[0], points[points.length - 1]];
  return [...rdp(points.slice(0, index + 1), eps), ...rdp(points.slice(index), eps).slice(1)];
}

const root = process.cwd();
const scenario = JSON.parse(readFileSync(path.join(root, 'data/scenarios/1326/scenario.json'), 'utf8'));
const sb = scenario.mapScope.bounds;
const west = sb.west - BUFFER_DEG;
const south = sb.south - BUFFER_DEG;
const east = sb.east + BUFFER_DEG;
const north = sb.north + BUFFER_DEG;
const terrainGrid = JSON.parse(readFileSync(path.join(root, 'data/scenarios/1326/terrain-grid.json'), 'utf8'));

const EPS = 1e-9;
const onBorder = ([lon, lat]) =>
  Math.abs(lon - west) < EPS || Math.abs(lon - east) < EPS ||
  Math.abs(lat - south) < EPS || Math.abs(lat - north) < EPS;
const inside = ([lon, lat]) => lon >= west && lon <= east && lat >= south && lat <= north;

function clipSegment(a, b) {
  const [x0, y0] = a;
  const [x1, y1] = b;
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  for (const [p, qv] of [[-dx, x0 - west], [dx, east - x0], [-dy, y0 - south], [dy, north - y0]]) {
    if (Math.abs(p) < 1e-12) {
      if (qv < 0) return null;
    } else {
      const t = qv / p;
      if (p < 0) {
        if (t > t1) return null;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return null;
        if (t < t1) t1 = t;
      }
    }
  }
  if (t0 > t1 || t1 - t0 < 1e-12) return null;
  const at = (t) => (t === 0 ? a : t === 1 ? b : [x0 + dx * t, y0 + dy * t]);
  return [at(t0), at(t1)];
}

function clipWayToRuns(line) {
  const runs = [];
  let current = [];
  const pushPt = (pt) => {
    if (current.length === 0 || current[current.length - 1] !== pt) current.push(pt);
  };
  for (let i = 0; i < line.length - 1; i++) {
    const piece = clipSegment(line[i], line[i + 1]);
    if (!piece) continue;
    const [p, q] = piece;
    if (current.length > 0 && current[current.length - 1] !== p) {
      if (current.length >= 2) runs.push(current);
      current = [];
    }
    pushPt(p);
    pushPt(q);
  }
  if (current.length >= 2) runs.push(current);
  return runs;
}

const raw = JSON.parse(readFileSync(path.join(root, 'data/sources/osm/coastline-1326.json'), 'utf8'));
const key = ([lon, lat]) => `${lon},${lat}`;
const runs = [];
for (const el of raw.elements ?? []) {
  if (el.type !== 'way' || !Array.isArray(el.geometry)) continue;
  runs.push(...clipWayToRuns(el.geometry.map((pt) => [pt.lon, pt.lat])));
}
console.log(`clipped runs: ${runs.length}`);

const endIndex = new Map();
runs.forEach((run, i) => {
  for (const end of [0, run.length - 1]) {
    if (onBorder(run[end])) continue;
    const k = key(run[end]);
    if (!endIndex.has(k)) endIndex.set(k, []);
    endIndex.get(k).push({ run: i, end });
  }
});
const used = new Array(runs.length).fill(false);
const chains = [];
for (let i = 0; i < runs.length; i++) {
  if (used[i]) continue;
  used[i] = true;
  let chain = [...runs[i]];
  let extended = true;
  while (extended) {
    extended = false;
    for (const side of ['start', 'end']) {
      const pt = side === 'start' ? chain[0] : chain[chain.length - 1];
      if (onBorder(pt)) continue;
      const cands = (endIndex.get(key(pt)) ?? []).filter((c) => !used[c.run]);
      if (cands.length === 0) continue;
      const { run: j, end } = cands[0];
      used[j] = true;
      let other = [...runs[j]];
      if ((side === 'start') === (end === 0)) other = other.reverse();
      chain = side === 'start' ? [...other, ...chain] : [...chain, ...other];
      extended = true;
    }
  }
  chains.push(chain);
}

function borderPosition([lon, lat]) {
  const w = east - west;
  const h = north - south;
  if (Math.abs(lat - south) < EPS) return lon - west;
  if (Math.abs(lon - east) < EPS) return w + (lat - south);
  if (Math.abs(lat - north) < EPS) return w + h + (east - lon);
  return 2 * w + h + (north - lat);
}
const PERIMETER = 2 * (east - west + (north - south));
function borderWalk(from, to) {
  const cornerS = [0, east - west, east - west + (north - south), 2 * (east - west) + (north - south)];
  const cornerPts = [[west, south], [east, south], [east, north], [west, north]];
  const cur = borderPosition(from);
  const end = borderPosition(to) <= cur ? borderPosition(to) + PERIMETER : borderPosition(to);
  const marks = [];
  for (let i = 0; i < 4; i++) {
    let cs = cornerS[i];
    if (cs <= cur + EPS) cs += PERIMETER;
    if (cs < end - EPS) marks.push({ s: cs, pt: cornerPts[i] });
  }
  marks.sort((a, b) => a.s - b.s);
  return marks.map((m) => m.pt);
}

function assembleBorderRings(openChains) {
  const endPoint = (ci, end) => (end === 'start' ? openChains[ci][0] : openChains[ci][openChains[ci].length - 1]);
  const usedC = new Array(openChains.length).fill(false);
  const rings = [];
  for (let ci = 0; ci < openChains.length; ci++) {
    if (usedC[ci]) continue;
    usedC[ci] = true;
    const ring = [];
    let curChain = ci;
    let curEnd = 'start';
    for (;;) {
      const chain = openChains[curChain];
      const pts = curEnd === 'start' ? [...chain].reverse() : [...chain];
      for (const pt of pts) {
        if (ring.length === 0 || key(ring[ring.length - 1]) !== key(pt)) ring.push(pt);
      }
      const farPt = curEnd === 'start' ? chain[chain.length - 1] : chain[0];
      const curS = borderPosition(farPt);
      let best = null;
      const consider = (targetPt, close, ei, eend) => {
        let d = borderPosition(targetPt) - curS;
        if (d < -EPS) d += PERIMETER;
        if (d < 0) d = 0;
        if (!best || d < best.d) best = { targetPt, close, ei, eend, d };
      };
      consider(ring[0], true, -1, null);
      for (let i = 0; i < openChains.length; i++) {
        if (usedC[i]) continue;
        consider(endPoint(i, 'start'), false, i, 'start');
        consider(endPoint(i, 'end'), false, i, 'end');
      }
      if (!best) break;
      if (best.d > EPS) {
        for (const pt of borderWalk(farPt, best.targetPt)) ring.push(pt);
        ring.push(best.targetPt);
      }
      if (best.close) break;
      usedC[best.ei] = true;
      curChain = best.ei;
      curEnd = best.eend;
    }
    rings.push(ring);
  }
  return rings;
}

function terrainAt(lon, lat) {
  const { cols, rows, bounds, values } = terrainGrid;
  const col = Math.max(0, Math.min(cols - 1, Math.floor(((lon - bounds.west) / (bounds.east - bounds.west)) * cols)));
  const row = Math.max(0, Math.min(rows - 1, Math.floor(((bounds.north - lat) / (bounds.north - bounds.south)) * rows)));
  return values[row * cols + col];
}

function voteLand(ring) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < x0) x0 = lon;
    if (lon > x1) x1 = lon;
    if (lat < y0) y0 = lat;
    if (lat > y1) y1 = lat;
  }
  let land = 0;
  let sea = 0;
  const N = 10;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const pt = [x0 + ((i + 0.5) / N) * (x1 - x0), y0 + ((j + 0.5) / N) * (y1 - y0)];
      if (!pointInRing(pt, [...ring, ring[0]])) continue;
      if (terrainAt(pt[0], pt[1]) >= 0) land++;
      else sea++;
    }
  }
  if (land + sea === 0) return null;
  return land >= sea;
}

// STRICT verification: no sea seed inside; ≥1 land seed, or tiny + vote-land.
function keepRing(ring) {
  const closed = [...ring, ring[0]];
  let landIn = 0;
  let seaIn = 0;
  for (const seed of LAND_SEEDS) if (pointInRing(seed, closed)) landIn++;
  for (const seed of SEA_SEEDS) if (pointInRing(seed, closed)) seaIn++;
  if (seaIn > 0) return false;
  if (landIn > 0) return true;
  if (ringArea(closed) > 0.05) return false;
  return voteLand(ring) === true;
}

const q = (n) => Math.round(n * 10 ** QUANTIZE_DECIMALS) / 10 ** QUANTIZE_DECIMALS;
const finishRing = (points) => {
  const simplified = rdp(points, SIMPLIFY_EPSILON_DEG);
  simplified.push([...simplified[0]]);
  if (simplified.length < 4 || ringArea(simplified) < MIN_AREA_DEG2) return null;
  return simplified.map(([lon, lat]) => [q(lon), q(lat)]);
};

const land = [];
const stats = { closed: 0, border: 0, repaired: 0, dropped: 0 };
const borderChains = [];
for (const chain of chains) {
  const first = chain[0];
  const last = chain[chain.length - 1];
  if (key(first) === key(last) && chain.length >= 4) {
    stats.closed++;
    const done = finishRing(chain.slice(0, -1));
    if (done && keepRing(done)) land.push({ points: done, kind: 'island' });
    else stats.dropped++;
    continue;
  }
  const aOn = onBorder(first);
  const bOn = onBorder(last);
  if (aOn && bOn) {
    stats.border++;
    borderChains.push(chain);
    continue;
  }
  const gap = Math.hypot(last[0] - first[0], last[1] - first[1]);
  if (gap < GAP_REPAIR_DEG) {
    stats.repaired++;
    const done = finishRing([...chain, first]);
    if (done && keepRing(done)) land.push({ points: done, kind: 'repaired' });
    else stats.dropped++;
    continue;
  }
  stats.dropped++;
}

for (const ring of assembleBorderRings(borderChains)) {
  const done = finishRing(ring);
  if (done && keepRing(done)) land.push({ points: done, kind: 'mainland' });
  else stats.dropped++;
}

// BUILD-TIME GATE: no sea may hide inside OSM land (strict). Land-seed
// coverage is advisory — NE global underneath guarantees no holes.
const inAny = (pt) => land.some((l) => pointInRing(pt, [...l.points, l.points[0]]));
const failures = [];
for (const [lon, lat] of SEA_SEEDS) {
  if (inAny([lon, lat])) failures.push(`water seed flooded: ${lon},${lat}`);
}
if (failures.length > 0) {
  console.error(`OSM land verification FAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
const dryLand = LAND_SEEDS.filter(([lon, lat]) => !inAny([lon, lat]));
if (dryLand.length > 0) {
  console.log(`OSM advisory (NE fallback covers): ${dryLand.map(([lo, la]) => `${lo},${la}`).join(' ')}`);
}

const polys = land.map((l, i) => ({
  id: `osm-land-${i}`,
  scenarioId: scenario.id,
  source: 'openstreetmap coastline polygonized (ODbL, © OpenStreetMap contributors)',
  confidence: 'HIGH',
  rings: [l.points],
}));
const outDir = path.join(root, `data/scenarios/${scenario.id}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'land-osm.json'), `${JSON.stringify(polys)}\n`, 'utf8');
console.log(`OSM land: ${polys.length} verified polygons. dropped=${stats.dropped} closed=${stats.closed} border=${stats.border} repaired=${stats.repaired}`);
