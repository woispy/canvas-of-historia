import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Ajv from 'ajv/dist/2020.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (rel) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));

const ajv = new Ajv({ allErrors: true }); const compiled = new Map();
const scenarioSchema = load('docs/contracts/scenario.schema.json');
const provinceSchema = load('docs/contracts/province.schema.json');
const citySchema = load('docs/contracts/city.schema.json');

const scenario = load('data/scenarios/1326/scenario.json');
const provinces = load('data/scenarios/1326/provinces.json');
const cities = load('data/scenarios/1326/cities.json');
const coastline = load('data/scenarios/1326/coastline.json');
const coastlineHd = load('data/scenarios/1326/coastline-hd.json');
const land = load('data/scenarios/1326/land.json');
const rivers = load('data/scenarios/1326/rivers.json');
const lakes = load('data/scenarios/1326/lakes.json');
const terrain = load('data/scenarios/1326/terrain-grid.json');

function check(schema, data, label) {
  let valid = compiled.get(schema.$id); if (!valid) { valid = ajv.compile(schema); compiled.set(schema.$id, valid); }
  const ok = valid(data);
  assert.ok(ok, `${label}: ${JSON.stringify(valid.errors)}`);
}

describe('1326 seed contracts', () => {
  it('scenario matches schema', () => check(scenarioSchema, scenario, 'scenario'));
  it('all provinces match schema', () => {
    for (const p of provinces) check(provinceSchema, p, `province ${p.id}`);
  });
  it('all cities match schema', () => {
    for (const c of cities) check(citySchema, c, `city ${c.id}`);
  });
  it('coastline segments match schema', () => {
    const coastlineSchema = load('docs/contracts/coastline.schema.json');
    for (const seg of coastline) check(coastlineSchema, seg, `coastline ${seg.id}`);
  });
  it('land polygons match schema and stay in bounds', () => {
    const landSchema = load('docs/contracts/land.schema.json');
    const { west, south, east, north } = scenario.mapScope.bounds;
    assert.ok(land.length >= 1, 'at least one land polygon (islands included)');
    for (const poly of land) {
      check(landSchema, poly, `land ${poly.id}`);
      for (const ring of poly.rings) {
        for (const [lon, lat] of ring) {
          assert.ok(lon >= west && lon <= east && lat >= south && lat <= north, `out of bounds: ${lon},${lat}`);
        }
      }
    }
  });
  it('terrain grid matches schema with sane dimensions and range', () => {
    const terrainSchema = load('docs/contracts/terrain.schema.json');
    check(terrainSchema, terrain, 'terrain');
    assert.equal(terrain.values.length, terrain.cols * terrain.rows);
    assert.ok(terrain.min < 0 && terrain.max > 2000, `expected sea floor + high peaks, got ${terrain.min}..${terrain.max}`);
    assert.deepEqual(terrain.bounds, scenario.mapScope.bounds);
  });
  it('rivers reuse the coastline polyline shape, lakes the land polygon shape', () => {
    const coastlineSchema = load('docs/contracts/coastline.schema.json');
    const landSchema = load('docs/contracts/land.schema.json');
    const { west, south, east, north } = scenario.mapScope.bounds;
    assert.ok(rivers.length >= 1, 'at least one river run');
    assert.ok(lakes.length >= 1, 'at least one lake');
    for (const r of rivers) {
      check(coastlineSchema, r, `river ${r.id}`);
      for (const [lon, lat] of r.points) {
        assert.ok(lon >= west && lon <= east && lat >= south && lat <= north, `out of bounds: ${lon},${lat}`);
      }
    }
    for (const lake of lakes) check(landSchema, lake, `lake ${lake.id}`);
  });
  it('HD coastline dwarfs the base layer and stays in bounds', () => {
    const coastlineSchema = load('docs/contracts/coastline.schema.json');
    const { west, south, east, north } = scenario.mapScope.bounds;
    const basePts = coastline.reduce((n, s) => n + s.points.length, 0);
    const hdPts = coastlineHd.reduce((n, s) => n + s.points.length, 0);
    assert.ok(hdPts > basePts * 5, `HD should dwarf base: ${hdPts} vs ${basePts}`);
    for (const seg of coastlineHd) {
      check(coastlineSchema, seg, `hd ${seg.id}`);
      for (const [lon, lat] of seg.points) {
        assert.ok(lon >= west && lon <= east && lat >= south && lat <= north, `out of bounds: ${lon},${lat}`);
      }
    }
  });
  it('coastline is real data inside scenario bounds', () => {
    const { west, south, east, north } = scenario.mapScope.bounds;
    assert.ok(coastline.length >= 1, 'at least one segment');
    let maxStep = 0;    assert.ok(
      coastline.every((seg) => seg.source.includes('natural-earth')),
      'no hand-traced segments allowed anymore',
    );
    for (const seg of coastline) {
      for (let i = 0; i < seg.points.length; i++) {
        const [lon, lat] = seg.points[i];
        assert.ok(lon >= west && lon <= east && lat >= south && lat <= north, `out of bounds: ${lon},${lat}`);
        if (i > 0) {
          const step = Math.hypot(lon - seg.points[i - 1][0], lat - seg.points[i - 1][1]);
          if (step > maxStep) maxStep = step;
        }
      }
    }
    assert.ok(maxStep < 1.0, `no border-artifact jumps allowed, max step ${maxStep}`);
  });
  it('cross-references resolve', () => {
    const stateIds = new Set(scenario.states.map((s) => s.id));
    const anchorIds = new Set(scenario.anchors.map((a) => a.id));
    const provinceIds = new Set(provinces.map((p) => p.id));
    for (const s of scenario.states) {
      assert.ok(anchorIds.has(s.capitalAnchorId), `state ${s.id}: missing capital anchor`);
    }
    for (const p of provinces) {
      assert.ok(stateIds.has(p.ownerStateId), `province ${p.id}: unknown owner`);
      assert.equal(p.scenarioId, '1326');
    }
    for (const c of cities) {
      assert.ok(anchorIds.has(c.anchorId), `city ${c.id}: unknown anchor`);
      assert.ok(provinceIds.has(c.provinceId), `city ${c.id}: unknown province`);
    }
  });
  it('Bursa starts under Ottoman control on 7 April 1326', () => {
    assert.deepEqual(scenario.startDate, { year: 1326, month: 4, day: 7 });
    const bursa = provinces.find((p) => p.id === 'bursa');
    assert.equal(bursa.ownerStateId, 'ottomans');
    assert.equal(bursa.controllerStateId, 'ottomans');
  });
});
