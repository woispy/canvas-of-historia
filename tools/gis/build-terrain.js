#!/usr/bin/env node
// Decodes Terrarium PNG tiles (minimal 8-bit RGB reader, node:zlib) → mosaics
// → samples an elevation grid over the scenario bounds → terrain-grid.json.
// Pure Node stdlib, zero dependencies.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

const COLS = 192;
const ROWS = 72;

function decodePngRgb(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47 || buffer.readUInt32BE(4) !== 0x0d0a1a0a) {
    throw new Error('not a PNG');
  }
  let offset = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  if (bitDepth !== 8 || colorType !== 2) throw new Error(`unsupported PNG: depth ${bitDepth}, type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 3;
  const pixels = Buffer.alloc(width * height * 3);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const row = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y === 0 ? Buffer.alloc(stride) : pixels.subarray((y - 1) * stride, y * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= 3 ? row[i - 3] : 0;
      const b = prev[i];
      const c = i >= 3 ? prev[i - 3] : 0;
      const v = raw[pos++];
      if (filter === 0) row[i] = v;
      else if (filter === 1) row[i] = (v + a) & 0xff;
      else if (filter === 2) row[i] = (v + b) & 0xff;
      else if (filter === 3) row[i] = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        row[i] = (v + pr) & 0xff;
      } else throw new Error(`unknown PNG filter ${filter}`);
    }
  }
  return { width, height, pixels };
}

function tileToLon(x, z) {
  return (x / 2 ** z) * 360 - 180;
}
function tileToLat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

const root = process.cwd();
const scenario = JSON.parse(readFileSync(path.join(root, 'data/scenarios/1326/scenario.json'), 'utf8'));
const { west, south, east, north } = scenario.mapScope.bounds;
const dir = path.join(root, 'data/sources/terrain/terrarium-z7');
const coverage = JSON.parse(readFileSync(path.join(dir, 'coverage.json'), 'utf8'));
const { z } = coverage;

// Mosaic tiles into tile-pixel space.
const tiles = new Map();
for (const file of readdirSync(dir)) {
  const m = file.match(/^(\d+)-(\d+)-(\d+)\.png$/);
  if (!m) continue;
  const [, , xs, ys] = m;
  const x = Number(xs);
  const y = Number(ys);
  const { width, height, pixels } = decodePngRgb(readFileSync(path.join(dir, file)));
  tiles.set(`${x},${y}`, { x, y, width, height, pixels });
}

function sampleTile(lon, lat) {
  const fx = ((lon + 180) / 360) * 2 ** z;
  const rad = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z;
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  const tile = tiles.get(`${x},${y}`);
  if (!tile) return null;
  const px = Math.min(tile.width - 1, Math.floor((fx - x) * tile.width));
  const py = Math.min(tile.height - 1, Math.floor((fy - y) * tile.height));
  const i = (py * tile.width + px) * 3;
  const r = tile.pixels[i];
  const g = tile.pixels[i + 1];
  const b = tile.pixels[i + 2];
  return r * 256 + g + b / 256 - 32768;
}

const values = new Array(COLS * ROWS);
let min = Infinity;
let max = -Infinity;
for (let row = 0; row < ROWS; row++) {
  const lat = north - ((row + 0.5) / ROWS) * (north - south);
  for (let col = 0; col < COLS; col++) {
    const lon = west + ((col + 0.5) / COLS) * (east - west);
    const e = sampleTile(lon, lat) ?? 0;
    values[row * COLS + col] = Math.round(e * 10) / 10;
    if (e < min) min = e;
    if (e > max) max = e;
  }
}

const grid = {
  scenarioId: scenario.id,
  source: 'AWS Terrarium DEM z7 mosaic',
  cols: COLS,
  rows: ROWS,
  bounds: { west, south, east, north },
  min: Math.round(min * 10) / 10,
  max: Math.round(max * 10) / 10,
  values,
};
const outDir = path.join(root, `data/scenarios/${scenario.id}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'terrain-grid.json'), `${JSON.stringify(grid)}\n`, 'utf8');
console.log(`Terrain grid: ${COLS}x${ROWS} cells, elev ${grid.min}..${grid.max}m → terrain-grid.json`);
