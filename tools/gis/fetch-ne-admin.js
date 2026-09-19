#!/usr/bin/env node
// Fetches Natural Earth 10m admin-0 countries (public domain) at the pinned
// revision shared with the other NE sources. Raw file is gitignored.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const NE_REVISION = 'ca96624a56bd078437bca8184e78163e5039ad19';
const SOURCE_URL = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_REVISION}/geojson/ne_10m_admin_0_countries.geojson`;
const OUTPUT_PATH = path.resolve('data/sources/natural-earth/ne_10m_admin_0_countries.geojson');

const response = await fetch(SOURCE_URL, {
  redirect: 'follow',
  headers: { 'user-agent': 'Canvas-of-Historia/gis-fetch' },
});
if (!response.ok) throw new Error(`NE admin-0 download failed: HTTP ${response.status}`);
const source = await response.text();
if (!source.includes('FeatureCollection')) throw new Error('NE admin-0 failed validation.');
await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, source, 'utf8');
console.log(`Downloaded NE 10m admin-0 (${source.length} chars).`);
