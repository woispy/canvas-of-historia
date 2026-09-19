#!/usr/bin/env node
// Fetches Caspian Sea shoreline (ODbL) via Overpass: coastline ways in the
// Caspian bbox. NE lakes omits the Caspian, so it gets its own source.
// Raw JSON gitignored; build-lakes-world chains it in.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const query = `[out:json][timeout:180];(way["natural"="coastline"](37,46,47,55););out geom;`;
const endpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

let text = null;
for (const endpoint of endpoints) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'user-agent': 'Canvas-of-Historia/gis-fetch', 'content-type': 'text/plain' },
      body: query,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    text = await response.text();
    if (!text.includes('"elements"')) throw new Error('unexpected shape');
    console.log(`Overpass OK via ${endpoint} (${text.length} chars).`);
    break;
  } catch (err) {
    console.log(`Overpass failed via ${endpoint}: ${err.message}`);
  }
}
if (!text) throw new Error('all Overpass endpoints failed');

const outDir = path.resolve('data/sources/osm');
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'caspian.json'), text, 'utf8');
console.log('Saved Caspian shoreline response.');
