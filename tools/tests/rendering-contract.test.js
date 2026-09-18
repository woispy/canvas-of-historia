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
    assert.ok(nearPts > farPts * 5, `HD denser up close: ${nearPts} vs ${farPts}`);
  });

  it('shallow bands paint before land, crisp stroke after rivers', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    const kinds = buildDisplayList(snap, createCamera({ scale: 100 }), W, H).map((c) => c.type);
    const bands = kinds.indexOf('coast-bands');
    const land = kinds.indexOf('land-fill');
    const crisp = kinds.indexOf('coastline');
    const river = kinds.indexOf('river');
    assert.ok(bands !== -1 && land !== -1 && crisp !== -1, 'all coastal stages present');
    assert.ok(bands < land, 'bands under land (sea-side-only illusion)');
    assert.ok(river < crisp, 'crisp stroke on top');
  });

  it('smoothing preserves endpoints and softens corners', () => {
    const jagged = [[0, 0], [10, 0], [10, 10], [20, 10]];
    const smooth = smoothPolyline(jagged);
    assert.deepEqual(smooth[0], [0, 0]);
    assert.deepEqual(smooth[smooth.length - 1], [20, 10]);
    assert.ok(
      maxTurningAngle(smooth) < maxTurningAngle(jagged),
      'corners are softer after Chaikin',
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
