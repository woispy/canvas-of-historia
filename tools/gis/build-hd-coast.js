#!/usr/bin/env node
// Builds the HIGH-DETAIL coastline authority from the Overpass response:
// ways → clip runs to bounds → light simplify (keeps bays/islets) → quantize.
// Output coastline-hd.json shares the coastline schema shape (LOD twin of the
// NE 10m base layer). Pure Node stdlib.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const SIMPLIFY_EPSILON_DEG = 0.0015;
const QUANTIZE_DECIMALS = 5;

function perpendicularDistance([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function rdp(points, eps) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist <= eps) return [points[0], points[points.length - 1]];
  return [...rdp(points.slice(0, index + 1), eps), ...rdp(points.slice(index), eps).slice(1)];
}

const root = process.cwd();
const scenario = JSON.parse(readFileSync(path.join(root, 'data/scenarios/1326/scenario.json'), 'utf8'));
const { west, south, east, north } = scenario.mapScope.bounds;
const raw = JSON.parse(
  readFileSync(path.join(root, 'data/sources/osm/coastline-1326.json'), 'utf8'),
);

const q = (n) => Math.round(n * 10 ** QUANTIZE_DECIMALS) / 10 ** QUANTIZE_DECIMALS;
const inside = ([lon, lat]) => lon >= west && lon <= east && lat >= south && lat <= north;

const segments = [];
for (const el of raw.elements ?? []) {
  if (el.type !== 'way' || !Array.isArray(el.geometry)) continue;
  const line = el.geometry.map((pt) => [pt.lon, pt.lat]);
  let current = [];
  const flush = () => {
    if (current.length >= 2) {
      const simplified = rdp(current, SIMPLIFY_EPSILON_DEG).map(([lon, lat]) => [q(lon), q(lat)]);
      if (simplified.length >= 2) {
        segments.push({
          id: `osm-hd-${segments.length}`,
          scenarioId: scenario.id,
          source: 'openstreetmap coastline (ODbL, © OpenStreetMap contributors)',
          confidence: 'HIGH',
          points: simplified,
        });
      }
    }
    current = [];
  };
  for (const pt of line) {
    if (inside(pt)) current.push(pt);
    else flush();
  }
  flush();
}

const outDir = path.join(root, `data/scenarios/${scenario.id}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'coastline-hd.json'), `${JSON.stringify(segments)}\n`, 'utf8');
const total = segments.reduce((n, s) => n + s.points.length, 0);
console.log(`HD coastline authority: ${segments.length} segments, ${total} points.`);
