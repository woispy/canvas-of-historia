#!/usr/bin/env node
// Far-zoom world outline: NE global coastline RDP'd to ~0.05° (few thousand
// points). One tiny file replaces 1246 tiles below scale 60. Pure Node stdlib.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const EPSILON_DEG = 0.05;

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
const coast = JSON.parse(readFileSync(path.join(root, 'data/scenarios/1326/coastline.json'), 'utf8'));
const q = (n) => Math.round(n * 1000) / 1000;
const lines = [];
for (const seg of coast) {
  const simple = rdp(seg.points, EPSILON_DEG).map(([lon, lat]) => [q(lon), q(lat)]);
  if (simple.length >= 2) lines.push(simple);
}
const outDir = path.join(root, 'public/data');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'world-outline.json'), JSON.stringify({ lines }));
const pts = lines.reduce((n, l) => n + l.length, 0);
console.log(`world outline: ${lines.length} lines, ${pts} points.`);
