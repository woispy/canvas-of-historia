#!/usr/bin/env node
// Fetches Natural Earth 10m rivers + lakes (public domain) at a pinned revision.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const NE_REVISION = 'ca96624a56bd078437bca8184e78163e5039ad19';
const FILES = ['ne_10m_rivers_lake_centerlines.geojson', 'ne_10m_lakes.geojson'];
const OUT_DIR = path.resolve('data/sources/natural-earth');

async function fetchOne(name) {
  const url = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_REVISION}/geojson/${name}`;
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'Canvas-of-Historia/gis-fetch' },
  });
  if (!response.ok) throw new Error(`${name} download failed: HTTP ${response.status}`);
  const source = await response.text();
  if (!source.includes('"FeatureCollection"') || !source.includes('"features"')) {
    throw new Error(`${name} failed validation: not a GeoJSON FeatureCollection.`);
  }
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, name), source, 'utf8');
  console.log(`Downloaded ${name} (${source.length} chars).`);
}

for (const name of FILES) await fetchOne(name);
