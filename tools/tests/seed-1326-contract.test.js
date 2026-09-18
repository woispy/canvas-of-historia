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
const landOsm = load('data/scenarios/1326/land-osm.json');
const waterways = load('data/scenarios/1326/waterways.json');
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
  it('land base is the whole world: closed rings, Ankara in, Pacific out', () => {
    const landSchema = load('docs/contracts/land.schema.json');
    assert.ok(land.length >= 1000, `global base expected, got ${land.length} polygons`);
    const inRing = ([lon, lat], ring) => {
      let ins = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) ins = !ins;
      }
      return ins;
    };
    const covers = ([lon, lat]) => land.some((poly) => poly.rings.some((r) => inRing([lon, lat], r)));
    let checked = 0;
    for (const poly of land) {
      if (checked++ < 50) check(landSchema, poly, `land ${poly.id}`);
      for (const ring of poly.rings) {
        assert.ok(ring.length >= 4, 'ring minimum');
        assert.deepEqual(ring[0], ring[ring.length - 1], 'rings stay closed (no fake chords)');
        for (const [lon, lat] of ring) {
          assert.ok(Number.isFinite(lon) && Number.isFinite(lat), 'finite coords');
          assert.ok(lat >= -90 && lat <= 90, 'valid latitude');
        }
      }
    }
    assert.ok(covers([32.86, 39.93]), 'Ankara is land');
    assert.ok(!covers([-150, 0]), 'mid-Pacific is sea');
  });
  it('verified OSM overlay holds no sea, covers Buyukada', () => {
    const landSchema = load('docs/contracts/land.schema.json');
    const inRing = ([lon, lat], ring) => {
      let ins = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) ins = !ins;
      }
      return ins;
    };
    const covers = ([lon, lat]) => landOsm.some((poly) => poly.rings.some((r) => inRing([lon, lat], r)));
    assert.ok(landOsm.length >= 50, `verified overlay expected, got ${landOsm.length}`);
    for (const poly of landOsm.slice(0, 30)) check(landSchema, poly, `osm ${poly.id}`);
    assert.ok(covers([29.12, 40.86]), 'Buyukada covered by verified OSM land');
    for (const [lon, lat] of [[34.0, 41.75], [29.3, 40.72], [29.02, 41.08]]) {
      assert.ok(!covers([lon, lat]), `no sea inside OSM land: ${lon},${lat}`);
    }
  });
  it('waterways are shaped and guarded', () => {
    assert.equal(waterways.length, 2);
    for (const w of waterways) {
      assert.ok(w.points.length >= 2 && w.widthDeg > 0, `waterway ${w.id} shaped`);
    }
    assert.deepEqual(
      waterways.map((w) => w.id).sort(),
      ['bosphorus', 'dardanelles'],
    );
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
  it('HD coastline dwarfs the base layer inside the theater', () => {
    const coastlineSchema = load('docs/contracts/coastline.schema.json');
    const { west, south, east, north } = scenario.mapScope.bounds;
    const inTheater = ([lon, lat]) => lon >= west && lon <= east && lat >= south && lat <= north;
    const basePts = coastline.reduce(
      (n, s) => n + s.points.filter(inTheater).length,
      0,
    );
    const hdPts = coastlineHd.reduce((n, s) => n + s.points.length, 0);
    assert.ok(hdPts > basePts * 5, `HD should dwarf base in theater: ${hdPts} vs ${basePts}`);
    for (const seg of coastlineHd) {
      check(coastlineSchema, seg, `hd ${seg.id}`);
      for (const [lon, lat] of seg.points) {
        assert.ok(lon >= west && lon <= east && lat >= south && lat <= north, `out of bounds: ${lon},${lat}`);
      }
    }
  });
  it('base coastline is global real data (whole world drawn)', () => {
    assert.ok(coastline.length >= 100, 'global base has many segments');
    let maxStep = 0;
    let maxStepMid = 0;
    let outside = 0;
    let total = 0;
    assert.ok(
      coastline.every((seg) => seg.source.includes('natural-earth')),
      'no hand-traced segments allowed anymore',
    );
    for (const seg of coastline) {
      for (let i = 0; i < seg.points.length; i++) {
        const [lon, lat] = seg.points[i];
        total++;
        if (lon < 26 || lon > 42 || lat < 36 || lat > 42) outside++;
        if (i > 0) {
          const step = Math.hypot(lon - seg.points[i - 1][0], lat - seg.points[i - 1][1]);
          if (step > maxStep) maxStep = step;
          // Polar generalization is honest (meters, not degrees); the tripwire
          // that matters is at inhabited latitudes.
          if (Math.abs(lat) < 60 && step > maxStepMid) maxStepMid = step;
        }
      }
    }
    assert.ok(outside > total / 2, 'most base points lie outside the theater (world drawn)');
    assert.ok(maxStep < 12, `no artifact jumps allowed, max step ${maxStep}`);
    assert.ok(maxStepMid < 3.0, `no coarse chords at inhabited latitudes, max ${maxStepMid}`);
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
