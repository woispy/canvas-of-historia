#!/usr/bin/env node
// Tile pyramid, upper levels:
//   z1: 8° tiles re-simplified from z2 (~300m) — mid zoom.
//   z0: single world file (~0.03°) — far zoom.
// Tile-border micro-seams accepted (≤ tolerance, documented); strokes overlap
// so no gaps. Pure Node stdlib.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const Z1_DEG = 8;
const Z1_EPS = 0.0015;
const Z0_EPS = 0.015;

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
const z2dir = path.join(root, 'public/tiles/coast');
const z1dir = path.join(root, 'public/tiles/coast1');
mkdirSync(z1dir, { recursive: true });

const txOf = (lon) => Math.floor((lon + 180) / Z1_DEG);
const tyOf = (lat) => Math.floor((lat + 90) / Z1_DEG);

const z1 = new Map();
let z2files = 0;
for (const file of readdirSync(z2dir)) {
  if (!file.endsWith('.json') || file === 'manifest.json') continue;
  z2files++;
  const data = JSON.parse(readFileSync(path.join(z2dir, file), 'utf8'));
  for (const line of data.lines ?? []) {
    const simple = rdp(line, Z1_EPS);
    if (simple.length < 2) continue;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [lon, lat] of simple) {
      const tx = txOf(lon);
      const ty = tyOf(lat);
      if (tx < x0) x0 = tx;
      if (tx > x1) x1 = tx;
      if (ty < y0) y0 = ty;
      if (ty > y1) y1 = ty;
    }
    for (let tx = x0; tx <= x1; tx++) {
      for (let ty = y0; ty <= y1; ty++) {
        const k = `${tx}_${ty}`;
        if (!z1.has(k)) z1.set(k, []);
        z1.get(k).push(simple);
      }
    }
  }
}

const manifest1 = {};
let pts1 = 0;
for (const [k, lines] of z1) {
  pts1 += lines.reduce((n, l) => n + l.length, 0);
  writeFileSync(path.join(z1dir, `${k}.json`), JSON.stringify({ lines }));
  manifest1[k] = { lines: lines.length };
}
writeFileSync(path.join(z1dir, 'manifest.json'), JSON.stringify({ tileDeg: Z1_DEG, tiles: manifest1 }));
console.log(`z1: ${z1.size} tiles from ${z2files} z2 files.`);

// z0 world outline from NE global coastline (single file, far zoom).
// Deliberately NE, not OSM: at far zoom NE-vs-OSM deltas are sub-pixel, and
// OSM at any honest tolerance is megabytes (measured: 34MB @0.015°).
const coast = JSON.parse(readFileSync(path.join(root, 'data/scenarios/1326/coastline.json'), 'utf8'));
const q = (n) => Math.round(n * 1000) / 1000;
const lines0 = [];
for (const seg of coast) {
  const simple = rdp(seg.points, Z0_EPS).map(([lon, lat]) => [q(lon), q(lat)]);
  if (simple.length >= 2) lines0.push(simple);
}
const outDir = path.join(root, 'public/data');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'world-outline.json'), JSON.stringify({ lines: lines0 }));
console.log(`z0: ${lines0.length} lines, ${lines0.reduce((n, l) => n + l.length, 0)} points.`);
