#!/usr/bin/env node
// Planet OSM coastline → 4° tile store (~100m detail).
// Streams the 1.3GB shapefile (PolyLine) without loading it: RDP each ≤100pt
// record in meter-space, then assigns every SEGMENT to all tiles it touches
// (bbox overlap — seamless for strokes, no clipping math, no gaps).
// Output: public/tiles/coast/{tx}_{ty}.json + manifest.json (gitignored).
// Pure Node stdlib.

import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TILE_DEG = 4;
const RDP_EPS_M = 50;
const QUANTIZE_DECIMALS = 5;

const txOf = (lon) => Math.floor((lon + 180) / TILE_DEG);
const tyOf = (lat) => Math.floor((lat + 90) / TILE_DEG);

function perpDistM([px, py], [ax, ay], [bx, by]) {
  const latRef = (((ay + by) / 2) * Math.PI) / 180;
  const kx = 111320 * Math.cos(latRef);
  const ky = 110540;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = (dx * kx) ** 2 + (dy * ky) ** 2;
  if (len2 === 0) return Math.hypot((px - ax) * kx, (py - ay) * ky);
  const t = Math.max(0, Math.min(1, (((px - ax) * kx) * (dx * kx) + ((py - ay) * ky) * (dy * ky)) / len2));
  return Math.hypot((px - (ax + t * dx)) * kx, (py - (ay + t * dy)) * ky);
}

function rdp(points, epsM) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDistM(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist <= epsM) return [points[0], points[points.length - 1]];
  return [...rdp(points.slice(0, index + 1), epsM), ...rdp(points.slice(index), epsM).slice(1)];
}

const root = process.cwd();
const shpPath = path.join(root, 'data/sources/osm/planet/shp/coastlines-split-4326/lines.shp');
const outDir = path.join(root, 'public/tiles/coast');
mkdirSync(outDir, { recursive: true });

const tiles = new Map(); // "tx_ty" -> array of lines
const q = (n) => Math.round(n * 10 ** QUANTIZE_DECIMALS) / 10 ** QUANTIZE_DECIMALS;

function emitLine(points) {
  if (points.length < 2) return;
  const simple = rdp(points, RDP_EPS_M).map(([lon, lat]) => [q(lon), q(lat)]);
  if (simple.length < 2) return;
  // Tile range from segment bboxes (overlap: no clipping, no gaps).
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [lon, lat] of simple) {
    const tx = txOf(lon);
    const ty = tyOf(lat);
    if (tx < x0) x0 = tx;
    if (tx > x1) x1 = tx;
    if (ty < y0) y0 = ty;
    if (ty > y1) y1 = ty;
  }
  for (let tx = x0; tx <= x1; tx++) {
    for (let ty = y0; ty <= y1; ty++) {
      const k = `${tx}_${ty}`;
      if (!tiles.has(k)) tiles.set(k, []);
      tiles.get(k).push(simple);
    }
  }
}

async function build() {
  const stream = createReadStream(shpPath, { highWaterMark: 1 << 20 });
  let buf = Buffer.alloc(0);
  let headerDone = false;
  let records = 0;
  let skipped = 0;
  for await (const chunk of stream) {
    buf = Buffer.concat([buf, chunk]);
    if (!headerDone) {
      if (buf.length < 100) continue;
      const shapeType = buf.readInt32LE(32);
      if (shapeType !== 13 && shapeType !== 3) throw new Error(`expected PolyLine (13/3), got ${shapeType}`);
      buf = buf.subarray(100);
      headerDone = true;
    }
    while (buf.length >= 8) {
      const contentWords = buf.readUInt32BE(4);
      const contentBytes = contentWords * 2;
      if (buf.length < 8 + contentBytes) break;
      const content = buf.subarray(8, 8 + contentBytes);
      const type = content.readInt32LE(0);
      if (type === 13 || type === 3) {
        const numParts = content.readInt32LE(36);
        const numPoints = content.readInt32LE(40);
        const parts = [];
        for (let i = 0; i < numParts; i++) parts.push(content.readInt32LE(44 + i * 4));
        const pts = [];
        const base = 44 + numParts * 4;
        for (let i = 0; i < numPoints; i++) {
          pts.push([content.readDoubleLE(base + i * 16), content.readDoubleLE(base + i * 16 + 8)]);
        }
        for (let i = 0; i < numParts; i++) {
          const end = i + 1 < numParts ? parts[i + 1] : numPoints;
          emitLine(pts.slice(parts[i], end));
        }
        records++;
      } else if (type !== 0) {
        skipped++;
      }
      buf = buf.subarray(8 + contentBytes);
    }
    if (records % 200000 === 0 && records > 0) console.log(`...${records} records, ${tiles.size} tiles`);
  }
  console.log(`records=${records} skipped=${skipped} tiles=${tiles.size}`);
  const manifest = {};
  let totalLines = 0;
  let totalPts = 0;
  for (const [k, lines] of tiles) {
    const pts = lines.reduce((n, l) => n + l.length, 0);
    totalLines += lines.length;
    totalPts += pts;
    writeFileSync(path.join(outDir, `${k}.json`), JSON.stringify({ lines }));
    manifest[k] = { lines: lines.length, points: pts };
  }
  writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ tileDeg: TILE_DEG, tiles: manifest }));
  console.log(`tiles written: ${tiles.size}, lines=${totalLines}, points=${totalPts}`);
}

await build();
