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

  it('clean chain order: sea → coastline → markers → fade', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    const cmds = buildDisplayList(snap, createCamera({ scale: 100 }), W, H, [
      { key: 't', lines: [[[29, 40], [30, 41]]] },
    ]);
    const kinds = cmds.map((c) => c.type);
    assert.equal(cmds[0].type, 'sea');
    const coast = kinds.indexOf('coastline-batch');
    const marker = kinds.indexOf('marker');
    const fade = kinds.indexOf('edge-fade');
    assert.ok(coast !== -1 && marker !== -1 && fade !== -1, 'all stages present');
    assert.ok(coast < marker && marker < fade, 'fixed order');
    assert.equal(fade, kinds.length - 1, 'fade is the final command');
    for (const retired of ['land-fill', 'province-fill', 'province-border', 'coast-bands', 'coast-carve', 'coast-shore', 'waterway', 'sea-fill', 'terrain-tint', 'lake-fill', 'river', 'land-fill-osm', 'land-fill-country']) {
      assert.ok(!kinds.includes(retired), `retired absent: ${retired}`);
    }
  });

  it('fade feather grows with zoom (world degrees, not px)', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    const fadeAt = (scale) =>
      buildDisplayList(snap, createCamera({ scale }), W, H).find((c) => c.type === 'edge-fade').featherPx;
    assert.ok(fadeAt(800) > fadeAt(100), 'feather scales with zoom');
  });

  it('Pacific view draws sea, no theater strokes without tiles', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    const far = buildDisplayList(snap, createCamera({ center: [-150, 0], scale: 60 }), W, H, []);
    const farKinds = far.map((c) => c.type);
    assert.equal(far[0].type, 'sea');
    assert.ok(!farKinds.includes('coastline-batch'), 'no strokes without loaded tiles');
    assert.ok(farKinds.includes('edge-fade'), 'fade still applies');
  });
  it('parent underlay merges, fresh tiles fade individually', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    const parent = [{ key: 'p', lines: [[[29, 40], [30, 41]]] }];
    const child = [{ key: 'c', lines: [[[29, 40], [30, 41]]], arrivedAt: 900 }];
    const cmds = buildDisplayList(snap, createCamera({ scale: 800 }), W, H, { child, parent }, { nowMs: 1000 });
    const kinds = cmds.map((c) => c.type);
    assert.ok(kinds.includes('coastline-batch'), 'settled + parent merged');
    const fresh = cmds.find((c) => c.type === 'coastline-fresh');
    assert.ok(fresh, 'fresh tile gets its own command');
    assert.ok(fresh.alpha > 0 && fresh.alpha < 1, `mid-fade alpha, got ${fresh.alpha}`);
    const settled = buildDisplayList(snap, createCamera({ scale: 800 }), W, H, { child: [{ key: 'c', lines: [[[29, 40], [30, 41]]], arrivedAt: 100 }], parent: [] }, { nowMs: 1000 });
    assert.ok(!settled.some((c) => c.type === 'coastline-fresh'), 'old tiles merge silently');
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
  it('display list covers sea, coastline, markers', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    const cmds = buildDisplayList(snap, createCamera({ scale: 100 }), W, H, [
      { key: 't', lines: [[[29, 40], [30, 41]]] },
    ]);
    const kinds = cmds.map((c) => c.type);
    assert.equal(cmds[0].type, 'sea');
    assert.ok(kinds.filter((k) => k === 'coastline-batch').length >= 1, 'tile coastline present');
    assert.equal(kinds.filter((k) => k === 'marker').length, 6);
    const finite = (pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1]);
    for (const c of cmds) {
      if (c.ring) assert.ok(c.ring.every(finite), `${c.type} ${c.id}: finite coords`);
      if (c.points) assert.ok(c.points.every(finite), `${c.type} ${c.id}: finite coords`);
      if (c.at) assert.ok(finite(c.at), `${c.type} ${c.id}: finite coords`);
      if (c.rings) {
        for (const ring of c.rings) assert.ok(ring.every(finite), `${c.type} ${c.id}: finite coords`);
      }
      if (c.batches) {
        for (const batch of c.batches) assert.ok(batch.every(finite), `${c.type}: finite coords`);
      }
    }
  });
});
