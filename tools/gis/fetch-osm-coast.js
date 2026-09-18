#!/usr/bin/env node
// Fetches OpenStreetMap coastline ways (ODbL — credit in CREDITS.md) for the
// scenario bounds PLUS a buffer, so close-zoom strokes continue past the view
// edge instead of ending mid-screen. Raw JSON is gitignored.

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const BUFFER_DEG = 1.0;

const root = process.cwd();
const scenario = JSON.parse(await readFile(path.join(root, 'data/scenarios/1326/scenario.json'), 'utf8'));
const { west, south, east, north } = scenario.mapScope.bounds;
const w = west - BUFFER_DEG;
const s = south - BUFFER_DEG;
const e = east + BUFFER_DEG;
const n = north + BUFFER_DEG;

const query = `[out:json][timeout:240];(way["natural"="coastline"](${s},${w},${n},${e}););out geom;`;

const endpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

let text = null;
let lastError = null;
for (const endpoint of endpoints) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'user-agent': 'Canvas-of-Historia/gis-fetch', 'content-type': 'text/plain' },
      body: query,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    text = await response.text();
    if (!text.includes('"elements"')) throw new Error('unexpected response shape');
    console.log(`Overpass OK via ${endpoint} (${text.length} chars).`);
    break;
  } catch (err) {
    lastError = err;
    console.log(`Overpass failed via ${endpoint}: ${err.message}`);
  }
}
if (!text) throw lastError ?? new Error('all Overpass endpoints failed');

const outDir = path.join(root, 'data/sources/osm');
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'coastline-1326.json'), text, 'utf8');
console.log(`Saved OSM coastline response → ${outDir}/coastline-1326.json`);
