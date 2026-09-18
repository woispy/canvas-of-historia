#!/usr/bin/env node
// Builds TWO authority layers from one NE 10m land source (always aligned):
//   land.json      — clipped+simplified polygons (fill)
//   coastline.json — outer rings as stroke segments (detail layer)
// Pure Node, zero dependencies.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const NE_REVISION = 'ca96624a56bd078437bca8184e78163e5039ad19';
const SIMPLIFY_EPSILON_DEG = 0.008;
const QUANTIZE_DECIMALS = 4;
const MIN_RING_POINTS = 4;

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

// Sutherland–Hodgman clip of a ring against the bbox. Closed-ring safe.
function clipRing(ring, west, south, east, north) {
  const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const pts = closed ? ring.slice(0, -1) : ring;
  const edges = [
    { inside: ([x]) => x >= west, cross: (a, b) => [west, a[1] + ((b[1] - a[1]) * (west - a[0])) / (b[0] - a[0])] },
    { inside: ([x]) => x <= east, cross: (a, b) => [east, a[1] + ((b[1] - a[1]) * (east - a[0])) / (b[0] - a[0])] },
    { inside: ([, y]) => y >= south, cross: (a, b) => [a[0] + ((b[0] - a[0]) * (south - a[1])) / (b[1] - a[1]), south] },
    { inside: ([, y]) => y <= north, cross: (a, b) => [a[0] + ((b[0] - a[0]) * (north - a[1])) / (b[1] - a[1]), north] },
  ];
  let output = pts;
  for (const edge of edges) {
    const input = output;
    output = [];
    if (input.length === 0) break;
    let s = input[input.length - 1];
    for (const e of input) {
      if (edge.inside(e)) {
        if (!edge.inside(s)) output.push(edge.cross(s, e));
        output.push(e);
      } else if (edge.inside(s)) {
        output.push(edge.cross(s, e));
      }
      s = e;
    }
  }
  if (output.length < 3) return [];
  output.push([...output[0]]);
  return output;
}

const root = process.cwd();
const scenario = JSON.parse(readFileSync(path.join(root, 'data/scenarios/1326/scenario.json'), 'utf8'));
const { west, south, east, north } = scenario.mapScope.bounds;
const geojson = JSON.parse(
  readFileSync(path.join(root, 'data/sources/natural-earth/ne_10m_land.geojson'), 'utf8'),
);

const q = (n) => Math.round(n * 10 ** QUANTIZE_DECIMALS) / 10 ** QUANTIZE_DECIMALS;

// A clipped ring point sitting exactly on the map border.
function onBorder([lon, lat], west, south, east, north) {
  return lon === west || lon === east || lat === south || lat === north;
}

// Drop runs that hug the map border: they are cut edges, not coastline.
// Returns open runs (no closing segment).
function borderlessRuns(closedRing, west, south, east, north) {
  const open = closedRing[0][0] === closedRing[closedRing.length - 1][0] &&
      closedRing[0][1] === closedRing[closedRing.length - 1][1]
    ? closedRing.slice(0, -1)
    : closedRing;
  const runs = [];
  let current = [];
  for (const pt of open) {
    if (onBorder(pt, west, south, east, north)) {
      if (current.length >= 2) runs.push(current);
      current = [];
    } else {
      current.push(pt);
    }
  }
  if (current.length >= 2) runs.push(current);
  return runs;
}

const clean = (ring) => {
  const clipped = clipRing(ring, west, south, east, north);
  if (clipped.length < MIN_RING_POINTS + 1) return [];
  const open = clipped.slice(0, -1);
  const simplified = rdp(open, SIMPLIFY_EPSILON_DEG);
  if (simplified.length < MIN_RING_POINTS) return [];
  simplified.push([...simplified[0]]);
  return simplified.map(([lon, lat]) => [q(lon), q(lat)]);
};

const land = [];
const coastline = [];
let polyIndex = 0;
for (const feature of geojson.features ?? []) {
  const g = feature.geometry;
  if (!g) continue;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  for (const rings of polys) {
    const cleanRings = rings.map(clean).filter((r) => r.length > 0);
    if (cleanRings.length === 0) continue;
    const id = `ne10m-land-${polyIndex++}`;
    land.push({
      id,
      scenarioId: scenario.id,
      source: `natural-earth 10m land @${NE_REVISION}`,
      confidence: 'HIGH',
      rings: cleanRings,
    });
    for (const run of borderlessRuns(cleanRings[0], west, south, east, north)) {
      coastline.push({
        id: `ne10m-coast-${id}-${coastline.length}`,
        scenarioId: scenario.id,
        source: `natural-earth 10m land outer ring @${NE_REVISION} (border runs removed)`,
        confidence: 'HIGH',
        points: run,
      });
    }
  }
}

const outDir = path.join(root, `data/scenarios/${scenario.id}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'land.json'), `${JSON.stringify(land, null, 2)}\n`, 'utf8');
writeFileSync(path.join(outDir, 'coastline.json'), `${JSON.stringify(coastline, null, 2)}\n`, 'utf8');
const landPts = land.reduce((n, p) => n + p.rings.reduce((m, r) => m + r.length, 0), 0);
const coastPts = coastline.reduce((n, s) => n + s.points.length, 0);
console.log(`Land authority: ${land.length} polygons, ${landPts} points.`);
console.log(`Coastline authority: ${coastline.length} segments, ${coastPts} points.`);
