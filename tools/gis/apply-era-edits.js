#!/usr/bin/env node
// Applies era-edits.json: drops coastline lines fully inside removeInBox
// regions (modern artifacts absent at the scenario date). Runs over the tile
// store + HD theater file. Reports exactly what was removed. Idempotent.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scenario = JSON.parse(readFileSync(path.join(root, 'data/scenarios/1326/scenario.json'), 'utf8'));
const edits = JSON.parse(readFileSync(path.join(root, `data/scenarios/${scenario.id}/era-edits.json`), 'utf8'));

const inBox = ([lon, lat], [w, s, e, n]) => lon >= w && lon <= e && lat >= s && lat <= n;

function filterLines(lines, source) {
  let removed = 0;
  const kept = lines.filter((line) => {
    const rule = edits.removeInBox.find((r) => line.every((pt) => inBox(pt, r.bbox)));
    if (!rule) return true;
    // Only long artificial-looking runs: harbor fragments (<0.1° span) stay.
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
    if (Math.max(x1 - x0, y1 - y0) < (rule.minSpanDeg ?? 0.1)) return true;
    removed++;
    return false;
  });
  if (removed > 0) console.log(`${source}: removed ${removed} modern-artifact lines.`);
  return kept;
}

// Tiles.
const coastDir = path.join(root, 'public/tiles/coast');
let tileTotal = 0;
for (const file of readdirSync(coastDir)) {
  if (!file.endsWith('.json') || file === 'manifest.json') continue;
  const p = path.join(coastDir, file);
  const data = JSON.parse(readFileSync(p, 'utf8'));
  const before = data.lines.length;
  data.lines = filterLines(data.lines, file);
  if (data.lines.length !== before) {
    tileTotal += before - data.lines.length;
    writeFileSync(p, JSON.stringify(data));
  }
}

// z1 tiles.
const coast1Dir = path.join(root, 'public/tiles/coast1');
try {
  for (const file of readdirSync(coast1Dir)) {
    if (!file.endsWith('.json') || file === 'manifest.json') continue;
    const p = path.join(coast1Dir, file);
    const data = JSON.parse(readFileSync(p, 'utf8'));
    const before = data.lines.length;
    data.lines = filterLines(data.lines, `z1/${file}`);
    if (data.lines.length !== before) {
      tileTotal += before - data.lines.length;
      writeFileSync(p, JSON.stringify(data));
    }
  }
} catch {
  console.log('z1 store absent, skipping.');
}

// HD theater file.
const hdPath = path.join(root, `data/scenarios/${scenario.id}/coastline-hd.json`);
try {
  const hd = JSON.parse(readFileSync(hdPath, 'utf8'));
  const before = hd.length;
  const kept = filterLines(hd.map((s) => s.points), 'coastline-hd.json');
  if (kept.length !== before) {
    const keptSet = new Set(kept);
    writeFileSync(hdPath, JSON.stringify(hd.filter((s) => keptSet.has(s.points))));
    tileTotal += before - kept.length;
  }
} catch {
  console.log('HD file absent, skipping.');
}

console.log(`era-edits applied: ${tileTotal} lines removed total.`);
