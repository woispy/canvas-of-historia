#!/usr/bin/env node
// Builds TWO authority layers from one NE 10m land source (always aligned):
//   land.json      — global polygons (fill), antimeridian-split, NO bbox clip
//   coastline.json — outer rings as stroke segments
// Rule (ADR-005): the land base is the WHOLE WORLD. Regional detail (OSM HD
// strokes) overlays the theater; nothing is ever cut at scenario bounds.
// Pure Node, zero dependencies.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const NE_REVISION = 'ca96624a56bd078437bca8184e78163e5039ad19';
const QUANTIZE_DECIMALS = 4;
const MIN_RING_POINTS = 4;

// RDP in METERS, not degrees: near the poles a degree of longitude collapses
// to ~0m, and degree-space RDP "straightens" the pole traverse into a 360°
// streak across the map. cos(latitude) weighting keeps it honest everywhere.
const SIMPLIFY_EPSILON_M = 500;

function perpDistM([px, py], [ax, ay], [bx, by]) {
  const latRef = (((ay + by) / 2) * Math.PI) / 180;
  const kx = 111320 * Math.cos(latRef);
  const ky = 110540;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = (dx * kx) ** 2 + (dy * ky) ** 2;
  if (len2 === 0) return Math.hypot((px - ax) * kx, (py - ay) * ky);
  const t = Math.max(
    0,
    Math.min(1, (((px - ax) * kx) * (dx * kx) + ((py - ay) * ky) * (dy * ky)) / len2),
  );
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  return Math.hypot((px - qx) * kx, (py - qy) * ky);
}

function rdp(points, epsM) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDistM(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist <= epsM) return [points[0], points[points.length - 1]];
  return [...rdp(points.slice(0, index + 1), epsM), ...rdp(points.slice(index), epsM).slice(1)];
}

// Unwrap longitudes so rings crossing the antimeridian stay continuous
// (179 → 181 instead of jumping to -179). No streak across the map, no fake
// closing chords; values beyond ±180 project off-screen until world-wrap
// arrives. Schema allows any finite number.
function unwrapRing(ring) {
  const out = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    let [x, y] = ring[i];
    const prev = out[out.length - 1][0];
    while (x - prev > 180) x -= 360;
    while (prev - x > 180) x += 360;
    out.push([x, y]);
  }
  return out;
}

const root = process.cwd();
const scenario = JSON.parse(readFileSync(path.join(root, 'data/scenarios/1326/scenario.json'), 'utf8'));
const geojson = JSON.parse(
  readFileSync(path.join(root, 'data/sources/natural-earth/ne_10m_land.geojson'), 'utf8'),
);

const q = (n) => Math.round(n * 10 ** QUANTIZE_DECIMALS) / 10 ** QUANTIZE_DECIMALS;
const cleanRing = (ring) => {
  const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const open = closed ? ring.slice(0, -1) : ring;
  const simplified = rdp(open, SIMPLIFY_EPSILON_M);
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
    const cleanRings = rings.map((r) => cleanRing(unwrapRing(r))).filter((r) => r.length > 0);
    if (cleanRings.length === 0) continue;
    const id = `ne10m-land-${polyIndex++}`;
    land.push({
      id,
      scenarioId: scenario.id,
      source: `natural-earth 10m land @${NE_REVISION} (global)`,
      confidence: 'HIGH',
      rings: cleanRings,
    });
    // Outer ring as coastline strokes (open path, no fake closing chord).
    // Pole excursions (|lat| > 89.5) are dropped from strokes: near the pole
    // a longitude degree is ~0m, so the excursion is physically a point but
    // renders as a streak. (Fill keeps the full ring — zero-area, harmless.)
    const outer = cleanRing(unwrapRing(rings[0]));
    const open = outer.length >= 2 &&
        outer[0][0] === outer[outer.length - 1][0] && outer[0][1] === outer[outer.length - 1][1]
      ? outer.slice(0, -1)
      : outer;
    let run = [];
    const runs = [];
    for (const pt of open) {
      if (Math.abs(pt[1]) > 89.5) {
        if (run.length >= 2) runs.push(run);
        run = [];
      } else {
        run.push(pt);
      }
    }
    if (run.length >= 2) runs.push(run);
    for (const r of runs) {
      coastline.push({
        id: `ne10m-coast-${id}-${coastline.length}`,
        scenarioId: scenario.id,
        source: `natural-earth 10m land outer ring @${NE_REVISION} (global)`,
        confidence: 'HIGH',
        points: r,
      });
    }
  }
}

const outDir = path.join(root, `data/scenarios/${scenario.id}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'land.json'), `${JSON.stringify(land)}\n`, 'utf8');
writeFileSync(path.join(outDir, 'coastline.json'), `${JSON.stringify(coastline)}\n`, 'utf8');
const landPts = land.reduce((n, p) => n + p.rings.reduce((m, r) => m + r.length, 0), 0);
const coastPts = coastline.reduce((n, s) => n + s.points.length, 0);
console.log(`Land authority (global): ${land.length} polygons, ${landPts} points.`);
console.log(`Coastline authority (global): ${coastline.length} segments, ${coastPts} points.`);
