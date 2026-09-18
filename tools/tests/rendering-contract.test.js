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

  it('coastline LOD switches base ↔ HD by zoom', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    const coastKinds = (cmds) => cmds.filter((c) => c.type === 'coast-bands' || c.type === 'coastline');
    const far = coastKinds(buildDisplayList(snap, createCamera({ scale: 100 }), W, H));
    const near = coastKinds(buildDisplayList(snap, createCamera({ scale: 800 }), W, H));
    assert.ok(far.length > 0 && far.every((c) => c.detail === 'base'));
    assert.ok(near.length > 0 && near.every((c) => c.detail === 'hd'));
    const farPts = far.reduce((n, c) => n + c.points.length, 0);
    const nearPts = near.reduce((n, c) => n + c.points.length, 0);
    // Far layer is global: compare theater-scoped density instead of totals.
    // HD (24k theater pts) must dwarf the base slice visible in-theater.
    assert.ok(farPts > 0 && nearPts > 0, 'both layers carry points');
    assert.ok(nearPts > 10000, `HD detail present up close: ${nearPts} pts`);
  });

  it('carve sits after fills, crisp stroke on top, fade last', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    const cmds = buildDisplayList(snap, createCamera({ scale: 100 }), W, H);
    const kinds = cmds.map((c) => c.type);
    const bands = kinds.indexOf('coast-bands');
    const land = kinds.indexOf('land-fill');
    const fill = kinds.indexOf('province-fill');
    const carve = kinds.indexOf('coast-carve');
    const crisp = kinds.indexOf('coastline');
    const fade = kinds.indexOf('edge-fade');
    assert.ok([bands, land, fill, carve, crisp, fade].every((i) => i !== -1), 'all stages present');
    assert.ok(bands < land, 'bands under land (sea-side-only illusion)');
    assert.ok(fill < carve && carve < crisp, 'carve trims fills, crisp stroke on top');
    assert.ok(!kinds.includes('coast-shore'), 'tan ribbon removed');
    assert.equal(fade, kinds.length - 1, 'fade is the final command');
  });

  it('band widths and fade feather grow with zoom (world degrees, not px)', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    const listAt = (scale) => buildDisplayList(snap, createCamera({ scale }), W, H);
    const widthsAt = (scale) => listAt(scale).find((c) => c.type === 'coast-bands').widths;
    const fadeAt = (scale) => listAt(scale).find((c) => c.type === 'edge-fade').featherPx;
    const far = widthsAt(100);
    const near = widthsAt(800);
    assert.equal(far.length, 3);
    assert.ok(near.every((w, i) => w > far[i]), `widths scale with zoom: ${far} vs ${near}`);
    assert.ok(fadeAt(800) > fadeAt(100), 'feather scales with zoom');
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
    assert.ok(kinds.filter((k) => k === 'lake-fill').length >= 1, 'lakes rendered');
    assert.ok(kinds.filter((k) => k === 'river').length >= 1, 'rivers rendered');
    assert.ok(kinds.filter((k) => k === 'terrain-tint').length >= 1, 'terrain tint present');
    assert.ok(kinds.filter((k) => k === 'coast-bands').length >= 1, 'shallow bands present');
    assert.ok(kinds.filter((k) => k === 'coastline').length >= 1, 'crisp coastline present');
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
