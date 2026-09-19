#!/usr/bin/env node
// Theater country fills (ADR-007): all admin-0 polygons intersecting the
// expanded theater bbox, clipped to it, simplified, quantized.
// Same fill style as the global base → seamless overdraw. Cut edges run along
// the expanded border, hidden under the vignette. Pure Node stdlib.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const NE_REVISION = 'ca96624a56bd078437bca8184e78163e5039ad19';
const BUFFER_DEG = 1.0;
const SIMPLIFY_EPSILON_DEG = 0.004;
const QUANTIZE_DECIMALS = 4;
const MIN_RING_POINTS = 4;

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

// Sutherland–Hodgman clip of a CLOSED ring against the bbox (keeps closure).
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
const sb = scenario.mapScope.bounds;
const west = sb.west - BUFFER_DEG;
const south = sb.south - BUFFER_DEG;
const east = sb.east + BUFFER_DEG;
const north = sb.north + BUFFER_DEG;
const admin = JSON.parse(
  readFileSync(path.join(root, 'data/sources/natural-earth/ne_10m_admin_0_countries.geojson'), 'utf8'),
);

const q = (n) => Math.round(n * 10 ** QUANTIZE_DECIMALS) / 10 ** QUANTIZE_DECIMALS;
const nameOf = (props) => props.NAME_EN ?? props.NAME ?? props.ADM0_A3 ?? 'unknown';

const polys = [];
let polyIndex = 0;
for (const feature of admin.features ?? []) {
  const g = feature.geometry;
  if (!g) continue;
  const all = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  // Quick bbox reject against the expanded theater.
  let keep = false;
  const kept = [];
  for (const rings of all) {
    const clean = [];
    for (const ring of rings) {
      const clipped = clipRing(ring, west, south, east, north);
      if (clipped.length < MIN_RING_POINTS + 1) continue;
      const open = clipped.slice(0, -1);
      const simplified = rdp(open, SIMPLIFY_EPSILON_DEG);
      if (simplified.length < MIN_RING_POINTS) continue;
      simplified.push([...simplified[0]]);
      clean.push(simplified.map(([lon, lat]) => [q(lon), q(lat)]));
    }
    if (clean.length > 0) {
      keep = true;
      kept.push(clean);
    }
  }
  if (!keep) continue;
  for (const clean of kept) {
    polys.push({
      id: `ne10m-cty-${polyIndex++}`,
      scenarioId: scenario.id,
      source: `natural-earth 10m admin-0 @${NE_REVISION}`,
      confidence: 'HIGH',
      country: nameOf(feature.properties ?? {}),
      rings: clean,
    });
  }
}

const countries = [...new Set(polys.map((p) => p.country))];
const outDir = path.join(root, `data/scenarios/${scenario.id}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'land-countries.json'), `${JSON.stringify(polys)}\n`, 'utf8');
console.log(`Theater countries (${countries.join(', ')}): ${polys.length} polygons.`);
