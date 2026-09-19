import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createLayerRegistry } from '../../src/map/layers/registry.js';
import { createTileStore, visibleTileKeys, buildCoastLines } from '../../src/map/layers/coastline.js';
import { createCamera } from '../../src/map/camera/camera.js';

const W = 1200;
const H = 800;

describe('layer architecture (ADR-010)', () => {
  it('registry fixes paint order, extensions append', () => {
    const reg = createLayerRegistry();
    assert.deepEqual(reg.order, ['sea', 'coastline', 'markers', 'edge-fade']);
    const ext = createLayerRegistry(['terrain', 'coastline']);
    assert.equal(ext.order[ext.order.length - 1], 'terrain', 'extensions append');
    assert.equal(ext.order.filter((x) => x === 'coastline').length, 1, 'no duplicates');
    assert.ok(ext.has('terrain') && ext.has('sea'));
  });

  it('tile store caches, caps, and notifies', async () => {
    let calls = 0;
    let notified = 0;
    const store = createTileStore(
      async () => {
        calls++;
        return { lines: [[[0, 0], [1, 1]]] };
      },
      () => {
        notified++;
      },
    );
    const first = store.ensure(['1_1']);
    assert.equal(first.length, 0, 'fetch pending on first pass');
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(calls, 1);
    assert.equal(notified, 1);
    const second = store.ensure(['1_1']);
    assert.equal(second.length, 1, 'cache hit on second pass');
    assert.equal(calls, 1, 'no refetch');
  });

  it('visibleTileKeys covers the viewport', () => {
    const cam = createCamera({ center: [34, 39], scale: 100 });
    const keys = visibleTileKeys(cam, W, H);
    assert.ok(keys.length >= 4 && keys.length <= 60, `sane count, got ${keys.length}`);
  });

  it('buildCoastLines projects, culls, and strides', () => {
    const cam = createCamera({ center: [34, 39], scale: 100 });
    const tiles = [
      { key: 'a', lines: [[[33, 38], [34, 39], [35, 40]]] },
      { key: 'b', lines: [[[-150, 0], [-149, 1]]] },
    ];
    const out = buildCoastLines(tiles, cam, W, H, 1);
    assert.equal(out.length, 1, 'Pacific line culled');
    assert.equal(out[0].points.length, 3);
    const strided = buildCoastLines(tiles, cam, W, H, 2);
    assert.equal(strided[0].points.length, 2, 'stride skips + keeps endpoint');
  });
});
