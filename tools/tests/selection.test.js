import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { enterGame } from '../../src/core/engine/boot.js';
import { createCamera, project } from '../../src/map/camera/camera.js';
import { extractSnapshot } from '../../src/map/rendering/snapshot.js';
import { unproject, pointInRing, pickProvince, pickMarker } from '../../src/map/selection/pick.js';
import { renderProvincePanel, renderCityPanel } from '../../src/app/panels.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fsReader = async (rel) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));

const W = 1200;
const H = 800;
const cam = createCamera({ scale: 100 });

describe('selection (S3)', () => {
  it('unproject inverts project', () => {
    const world = [29.05, 40.2];
    const screen = project(cam, W, H, world);
    const back = unproject(cam, W, H, screen);
    assert.ok(Math.abs(back[0] - world[0]) < 1e-9 && Math.abs(back[1] - world[1]) < 1e-9);
  });

  it('picks Bursa province by world point', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    assert.ok(pointInRing([29.05, 40.2], snap.provinces.find((p) => p.id === 'bursa').ring));
    const [sx, sy] = project(cam, W, H, [29.05, 40.2]);
    assert.equal(pickProvince(snap, cam, W, H, sx, sy)?.id, 'bursa');
  });

  it('returns null on open sea', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    const [sx, sy] = project(cam, W, H, [27.0, 38.0]);
    assert.equal(pickProvince(snap, cam, W, H, sx, sy), null);
  });

  it('picks the Bursa city marker near its anchor', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    const [sx, sy] = project(cam, W, H, [29.06, 40.19]);
    assert.equal(pickMarker(snap, cam, W, H, sx + 3, sy - 2)?.id, 'bursa-city');
    assert.equal(pickMarker(snap, cam, W, H, 5, 5)?.id ?? null, null);
  });

  it('province panel shows owner, controller, cities', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const html = renderProvincePanel(session, 'bursa');
    assert.ok(html.includes('Bursa'));
    assert.ok(html.includes('Ottoman Beylik'));
    assert.ok(html.includes('confirmed-core'));
    assert.ok(html.includes('Phase 7+'), 'unbuilt systems are labeled, not faked');
  });

  it('city panel shows tier and development', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const html = renderCityPanel(session, 'bursa-city');
    assert.ok(html.includes('Bursa'));
    assert.ok(html.includes('city'));
    assert.ok(html.includes('45'));
  });
});
