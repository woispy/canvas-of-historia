#!/usr/bin/env node
// Fetches AWS Terrarium DEM tiles (public, no key) covering the scenario
// bounds at zoom 7. Raw PNGs are gitignored source data.

import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const Z = 7;
const OUT_DIR = path.resolve('data/sources/terrain/terrarium-z7');

function lonToX(lon, z) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
function latToY(lat, z) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z,
  );
}

const root = process.cwd();
const scenario = JSON.parse(readFileSync(path.join(root, 'data/scenarios/1326/scenario.json'), 'utf8'));
const { west, south, east, north } = scenario.mapScope.bounds;

const x0 = lonToX(west, Z);
const x1 = lonToX(east, Z);
const y0 = latToY(north, Z);
const y1 = latToY(south, Z);

await mkdir(OUT_DIR, { recursive: true });
let count = 0;
for (let x = x0; x <= x1; x++) {
  for (let y = y0; y <= y1; y++) {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`;
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Canvas-of-Historia/gis-fetch' },
    });
    if (!response.ok) throw new Error(`tile ${Z}/${x}/${y}: HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer[0] !== 0x89 || buffer[1] !== 0x50) throw new Error(`tile ${Z}/${x}/${y}: not a PNG`);
    await writeFile(path.join(OUT_DIR, `${Z}-${x}-${y}.png`), buffer);
    count++;
  }
}
await writeFile(
  path.join(OUT_DIR, 'coverage.json'),
  JSON.stringify({ z: Z, x0, x1, y0, y1, count }, null, 2),
  'utf8',
);
console.log(`DEM tiles: ${count} PNGs (z${Z} x${x0}-${x1} y${y0}-${y1}) → ${OUT_DIR}`);
