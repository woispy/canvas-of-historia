#!/usr/bin/env node
// Fetches Natural Earth 10m land polygons (public domain) at a pinned revision.
// Land polygons serve two layers from one source (guaranteed alignment):
// fill (landmass) + outer rings (coastline strokes).

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const NE_REVISION = 'ca96624a56bd078437bca8184e78163e5039ad19';
const SOURCE_URL = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_REVISION}/geojson/ne_10m_land.geojson`;
const OUTPUT_PATH = path.resolve('data/sources/natural-earth/ne_10m_land.geojson');

const response = await fetch(SOURCE_URL, {
  redirect: 'follow',
  headers: { 'user-agent': 'Canvas-of-Historia/gis-fetch' },
});
if (!response.ok) throw new Error(`NE land download failed: HTTP ${response.status}`);

const source = await response.text();
if (!source.includes('ne_10m_land')) {
  throw new Error('NE land download failed validation: unexpected dataset name.');
}

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, source, 'utf8');
console.log(`Downloaded NE 10m land (${NE_REVISION}) to ${OUTPUT_PATH} (${source.length} chars).`);
