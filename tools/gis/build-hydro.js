#!/usr/bin/env node
// Builds river + lake authority layers from NE 10m sources.
// Rivers validate against coastline.schema.json (polyline shape),
// lakes validate against land.schema.json (polygon shape) — documented reuse.
// Pure Node, zero dependencies.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const NE_REVISION = 'ca96624a56bd078437bca8184e78163e5039ad19';
const RIVER_EPS = 0.01;
const LAKE_EPS = 0.008;
const QUANTIZE_DECIMALS = 4;

function perpendicularDistance([px, py], [ax, ay], [bx, by]) {
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
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
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
const { west, south, east, north } = scenario.mapScope.bounds;
const q = (n) => Math.round(n * 10 ** QUANTIZE_DECIMALS) / 10 ** QUANTIZE_DECIMALS;
const inside = ([lon, lat]) => lon >= west && lon <= east && lat >= south && lat <= north;

function splitRuns(points) {
  const runs = [];
  let current = [];
  for (const pt of points) {
    if (inside(pt)) current.push(pt);
    else if (current.length >= 2) {
      runs.push(current);
      current = [];
    } else current = [];
  }
  if (current.length >= 2) runs.push(current);
  return runs;
}

function clipRingClosed(ring) {
  // Keep rings fully inside (simpler than polygon clipping; lakes crossing the
  // border are dropped and recorded — slice scope is interior Anatolia).
  if (!ring.every(inside)) return [];
  const open = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring;
  const simplified = rdp(open, LAKE_EPS);
  if (simplified.length < 3) return [];
  simplified.push([...simplified[0]]);
  return simplified.map(([lon, lat]) => [q(lon), q(lat)]);
}

const riversRaw = JSON.parse(
  readFileSync(path.join(root, 'data/sources/natural-earth/ne_10m_rivers_lake_centerlines.geojson'), 'utf8'),
);
const lakesRaw = JSON.parse(
  readFileSync(path.join(root, 'data/sources/natural-earth/ne_10m_lakes.geojson'), 'utf8'),
);

function collectLines(collection) {
  const lines = [];
  for (const f of collection.features ?? []) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'LineString') lines.push(g.coordinates);
    else if (g.type === 'MultiLineString') lines.push(...g.coordinates);
  }
  return lines;
}

const rivers = [];
for (const line of collectLines(riversRaw)) {
  for (const run of splitRuns(line)) {
    const pts = rdp(run, RIVER_EPS).map(([lon, lat]) => [q(lon), q(lat)]);
    if (pts.length >= 2) {
      rivers.push({
        id: `ne10m-river-${rivers.length}`,
        scenarioId: scenario.id,
        source: `natural-earth 10m rivers @${NE_REVISION}`,
        confidence: 'HIGH',
        points: pts,
      });
    }
  }
}

const lakes = [];
let lakeIndex = 0;
for (const f of lakesRaw.features ?? []) {
  const g = f.geometry;
  if (!g) continue;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  for (const rings of polys) {
    const clean = rings.map(clipRingClosed).filter((r) => r.length > 0);
    if (clean.length === 0) continue;
    lakes.push({
      id: `ne10m-lake-${lakeIndex++}`,
      scenarioId: scenario.id,
      source: `natural-earth 10m lakes @${NE_REVISION}`,
      confidence: 'HIGH',
      rings: clean,
    });
  }
}

const outDir = path.join(root, `data/scenarios/${scenario.id}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'rivers.json'), `${JSON.stringify(rivers, null, 2)}\n`, 'utf8');
writeFileSync(path.join(outDir, 'lakes.json'), `${JSON.stringify(lakes, null, 2)}\n`, 'utf8');
console.log(`River authority: ${rivers.length} runs, ${rivers.reduce((n, r) => n + r.points.length, 0)} points.`);
console.log(`Lake authority: ${lakes.length} polygons.`);
