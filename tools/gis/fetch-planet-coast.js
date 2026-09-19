#!/usr/bin/env node
// Downloads the planet OSM coastline shapefile (923MB, ODbL — credit in
// CREDITS.md). One-time; output gitignored. Rebuild tiles after with
// npm run gis:coast-tiles.

import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const SOURCE_URL = 'https://osmdata.openstreetmap.de/download/coastlines-split-4326.zip';
const OUT_DIR = path.resolve('data/sources/osm/planet');
const OUT_FILE = path.join(OUT_DIR, 'coastlines-split-4326.zip');

await mkdir(OUT_DIR, { recursive: true });
const response = await fetch(SOURCE_URL, {
  redirect: 'follow',
  headers: { 'user-agent': 'Canvas-of-Historia/gis-fetch' },
});
if (!response.ok || !response.body) throw new Error(`planet coast download failed: HTTP ${response.status}`);
await pipeline(response.body, createWriteStream(OUT_FILE));
console.log(`Downloaded planet coastline → ${OUT_FILE}`);
