#!/usr/bin/env node
// World lakes from NE 10m (global, public domain): RDP + emit strokes.
// Lakes render at every zoom (culled) — Caspian included. Pure Node stdlib.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const EPSILON_DEG = 0.01;
const QUANTIZE_DECIMALS = 4;
// Only notable lakes render: bbox area ≥ this (km²) or theater allowlist.
// Micro-lakes are visual noise + parse/render cost, never gameplay.
const MIN_LAKE_KM2 = 1500;
const THEATER_ALLOWLIST = [
  { id: 'van', x0: 42.2, x1: 44.0, y0: 38.2, y1: 38.9 },
  { id: 'tuz', x0: 32.8, x1: 33.9, y0: 38.3, y1: 39.0 },
];

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
const lakes = JSON.parse(
  readFileSync(path.join(root, 'data/sources/natural-earth/ne_10m_lakes.geojson'), 'utf8'),
);
const q = (n) => Math.round(n * 10 ** QUANTIZE_DECIMALS) / 10 ** QUANTIZE_DECIMALS;
function bboxAreaKm2(ring) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y] of ring) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const latRef = (((y0 + y1) / 2) * Math.PI) / 180;
  return (x1 - x0) * 111.32 * Math.cos(latRef) * ((y1 - y0) * 110.54);
}
function allowlisted(ring) {
  return THEATER_ALLOWLIST.some((box) =>
    ring.some(([x, y]) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1),
  );
}
const out = [];
for (const f of lakes.features ?? []) {
  const g = f.geometry;
  if (!g) continue;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  for (const rings of polys) {
    // Outer ring only as stroke (lakes render as outlines in this phase).
    const ring = rings[0];
    if (!ring || ring.length < 4) continue;
    if (bboxAreaKm2(ring) < MIN_LAKE_KM2 && !allowlisted(ring)) continue;
    const open = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring;
    const simple = rdp(open, EPSILON_DEG).map(([lon, lat]) => [q(lon), q(lat)]);
    if (simple.length >= 4) out.push(simple);
  }
}
const outDir = path.join(root, 'public/data');
mkdirSync(outDir, { recursive: true });

// Caspian Sea: NE lakes omits it, but it survives as a HOLE in the NE land
// polygon — extract it whole (no fragile chaining needed).
try {
  const land = JSON.parse(readFileSync(path.join(root, 'data/scenarios/1326/land.json'), 'utf8'));
  let found = 0;
  for (const p of land) {
    for (let ri = 1; ri < p.rings.length; ri++) {
      const r = p.rings[ri];
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const [x, y] of r) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      if (x0 > 45 && x1 < 57 && y0 > 36 && y1 < 48) {
        const open = r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r;
        const simple = rdp(open, EPSILON_DEG).map(([lon, lat]) => [q(lon), q(lat)]);
        if (simple.length >= 4) {
          simple.push([...simple[0]]);
          out.push(simple);
          found++;
        }
      }
    }
  }
  console.log(`caspian holes extracted: ${found}`);
  if (found === 0) throw new Error('Caspian hole missing from NE land');
} catch (err) {
  console.log(`caspian skipped: ${err.message}`);
  process.exit(1);
}
writeFileSync(path.join(outDir, 'lakes-world.json'), JSON.stringify({ rings: out }));
const pts = out.reduce((n, r) => n + r.length, 0);
console.log(`world lakes: ${out.length} rings, ${pts} points.`);
// Caspian sanity: must be present.
const caspian = out.filter((r) => r.some(([x, y]) => x > 48 && x < 55 && y > 38 && y < 44));
console.log(`caspian rings: ${caspian.length}`);
if (caspian.length === 0) throw new Error('Caspian missing from world lakes');
