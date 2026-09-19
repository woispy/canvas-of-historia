import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TILE_DEG, tileKey, tileOf, tileRangeForView } from '../../src/map/tiles.js';
import { enterGame } from '../../src/core/engine/boot.js';
import { createCamera } from '../../src/map/camera/camera.js';
import { extractSnapshot } from '../../src/map/rendering/snapshot.js';
import { buildDisplayList } from '../../src/map/rendering/displayList.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fsReader = async (rel) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));

const W = 1200;
const H = 800;

describe('planet tile store', () => {
  it('tile math covers the globe without gaps', () => {
    assert.equal(TILE_DEG, 4);
    assert.deepEqual(tileOf(-180, -90), [0, 0]);
    assert.deepEqual(tileOf(179.9, 89.9), [89, 44]);
    assert.equal(tileKey(73, 32), '73_32');
  });

  it('viewport range includes neighbors and wraps the antimeridian', () => {
    const keys = tileRangeForView(26, 36, 42, 42);
    assert.ok(keys.length >= 10 && keys.length <= 40, `sane range, got ${keys.length}`);
    const [tx, ty] = tileOf(29.06, 40.19);
    assert.ok(keys.includes(tileKey(tx, ty)), 'Bursa tile present');
    const wrapped = tileRangeForView(170, -10, 190, 10);
    assert.ok(wrapped.every((k) => {
      const tx = Number(k.split('_')[0]);
      return tx >= 0 && tx < 90;
    }), 'tile x wraps to 0..89');
  });

  it('manifest exists with tiles on disk', () => {
    const manifestPath = path.join(root, 'public/tiles/coast/manifest.json');
    assert.ok(existsSync(manifestPath), 'run npm run gis:coast-tiles first');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const ids = Object.keys(manifest.tiles);
    assert.ok(ids.length >= 1000, `planet coverage, got ${ids.length} tiles`);
    const [tx, ty] = tileOf(29.06, 40.19);
    assert.ok(manifest.tiles[tileKey(tx, ty)]?.lines > 0, 'Bursa tile has lines');
  });

  it('display list strokes tile lines, hides fills and boxes', async () => {
    const session = await enterGame(fsReader, { scenarioId: '1326', countryId: 'ottomans' });
    const snap = extractSnapshot(session);
    const [tx, ty] = tileOf(29.06, 40.19);
    const tilePath = path.join(root, `public/tiles/coast/${tileKey(tx, ty)}.json`);
    const tile = JSON.parse(readFileSync(tilePath, 'utf8'));
    const cmds = buildDisplayList(snap, createCamera({ scale: 800 }), W, H, [
      { key: tileKey(tx, ty), lines: tile.lines.slice(0, 50) },
    ]);
    const kinds = cmds.map((c) => c.type);
    assert.equal(cmds[0].type, 'sea');
    assert.ok(kinds.filter((k) => k === 'coastline').length >= 1, 'tile strokes drawn');
    for (const retired of ['land-fill', 'province-fill', 'province-border', 'coast-bands', 'terrain-tint']) {
      assert.ok(!kinds.includes(retired), `retired absent: ${retired}`);
    }
    assert.ok(kinds.includes('marker'), 'city markers stay');
  });
});
