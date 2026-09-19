import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { enterGame } from '../../src/core/engine/boot.js';
import { createCamera, project } from '../../src/map/camera/camera.js';
import { extractSnapshot } from '../../src/map/rendering/snapshot.js';
import { buildDisplayList } from '../../src/map/rendering/displayList.js';
import { maxTurningAngle, smoothPolyline } from '../../src/map/rendering/smooth.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fsReader = async (rel) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));

const W = 1200;
const H = 800;

describe('rendering contract (S2)', () => {
  it('camera centers deterministically', () => {
    const cam = createCamera();
    assert.deepEqual(project(cam, W, H, [29.5, 40.6]), [W / 2, H / 2]);
    assert.deepEqual(project(cam, W, H, [30.0, 41.0]), project(cam, W, H, [30.0, 41.0]));
    const [x] = project(cam, W, H, [30.5, 40.6]);
    assert.ok(x > W / 2, 'east of center lands right of center');
  });

  it('snapshot is frozen and carries the coastline authority layer', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    assert.ok(Object.isFrozen(snap));
    assert.equal(snap.provinces.length, 6);
    assert.ok(snap.coastline.length >= 1, 'at least one coastline segment');
    const totalCoast = snap.coastline.reduce((n, s) => n + s.points.length, 0);
    assert.ok(totalCoast >= 100, `real coastline data expected, got ${totalCoast} points`);
    assert.equal(snap.markers.length, 6);
  });

  it('clean chain order: sea → land → wash → coastline → borders → markers → fade', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    const cmds = buildDisplayList(snap, createCamera({ scale: 100 }), W, H);
    const kinds = cmds.map((c) => c.type);
    assert.equal(cmds[0].type, 'sea');
    const land = kinds.indexOf('land-fill');
    const fill = kinds.indexOf('province-fill');
    const crisp = kinds.indexOf('coastline');
    const border = kinds.indexOf('province-border');
    const marker = kinds.indexOf('marker');
    const fade = kinds.indexOf('edge-fade');
    assert.ok([land, fill, crisp, border, marker, fade].every((i) => i !== -1), 'all stages present');
    assert.ok(land < fill && fill < crisp && crisp < border && border < marker && marker < fade, 'fixed order');
    assert.equal(fade, kinds.length - 1, 'fade is the final command');
    for (const retired of ['coast-bands', 'coast-carve', 'coast-shore', 'waterway', 'sea-fill', 'terrain-tint', 'lake-fill', 'river', 'land-fill-osm', 'land-fill-country']) {
      assert.ok(!kinds.includes(retired), `retired layer absent: ${retired}`);
    }
  });

  it('fade feather grows with zoom (world degrees, not px)', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    const fadeAt = (scale) =>
      buildDisplayList(snap, createCamera({ scale }), W, H).find((c) => c.type === 'edge-fade').featherPx;
    assert.ok(fadeAt(800) > fadeAt(100), 'feather scales with zoom');
  });

  it('Pacific view draws global base, culls theater detail', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    const far = buildDisplayList(snap, createCamera({ center: [-150, 0], scale: 60 }), W, H);
    const farKinds = far.map((c) => c.type);
    assert.ok(farKinds.includes('land-fill'), 'global base still draws');
    assert.ok(farKinds.includes('coastline'), 'global coastline still draws');
  });
  it('smoothing preserves endpoints and softens corners', () => {
    const jagged = [[0, 0], [10, 0], [10, 10], [20, 10]];
    const once = smoothPolyline(jagged);
    const twice = smoothPolyline(once);
    assert.deepEqual(twice[0], [0, 0]);
    assert.deepEqual(twice[twice.length - 1], [20, 10]);
    assert.ok(
      maxTurningAngle(twice) <= maxTurningAngle(once) &&
        maxTurningAngle(once) < maxTurningAngle(jagged),
      'each Chaikin pass softens corners',
    );
  });
  it('display list covers sea, coastline, fills, borders, markers', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    const cmds = buildDisplayList(snap, createCamera({ scale: 100 }), W, H);
    const kinds = cmds.map((c) => c.type);
    assert.equal(cmds[0].type, 'sea');
    assert.ok(kinds.filter((k) => k === 'land-fill').length >= 1, 'landmass rendered');
    assert.ok(kinds.filter((k) => k === 'coastline').length >= 1, 'single-source coastline present');
    assert.equal(kinds.filter((k) => k === 'province-fill').length, 6);
    const fills = cmds.filter((c) => c.type === 'province-fill');
    assert.ok(
      fills.every((c) => Array.isArray(c.landClip) && c.landClip.length > 0),
      'political washes carry the land clip (never enter the sea)',
    );
    assert.equal(kinds.filter((k) => k === 'province-border').length, 6);
    assert.equal(kinds.filter((k) => k === 'marker').length, 6);
    const finite = (pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1]);
    for (const c of cmds) {
      if (c.ring) assert.ok(c.ring.every(finite), `${c.type} ${c.id}: finite coords`);
      if (c.points) assert.ok(c.points.every(finite), `${c.type} ${c.id}: finite coords`);
      if (c.at) assert.ok(finite(c.at), `${c.type} ${c.id}: finite coords`);
      if (c.rings) {
        for (const ring of c.rings) assert.ok(ring.every(finite), `${c.type} ${c.id}: finite coords`);
      }
    }
  });
});
