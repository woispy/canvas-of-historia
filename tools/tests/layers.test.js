import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createLayerRegistry } from '../../src/map/layers/registry.js';
import { createTileStore, visibleTileKeys, buildCoastLines, useOutline, levelFor, createDrawThrottle } from '../../src/map/layers/coastline.js';
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

  it('manifest gates ocean tiles, eviction caps the cache', async () => {
    let calls = 0;
    const store = createTileStore(
      async () => {
        calls++;
        return { lines: [[[0, 0], [1, 1]]] };
      },
      () => {},
      new Set(['kept']),
    );
    store.ensure(['ocean']);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(calls, 0, 'known-ocean never fetched (no 404 storm)');
    const open = createTileStore(
      async () => ({ lines: [[[0, 0], [1, 1]]] }),
      () => {},
    );
    for (let i = 0; i < 200; i++) open.ensure([`k${i}`]);
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(open.size() <= 96, `LRU capped, got ${open.size()}`);
  });

  it('far zoom uses the outline, near zoom uses tiles', () => {
    assert.equal(useOutline(10), true);
    assert.equal(useOutline(800), false);
  });

  it('pyramid levels step with zoom, z1 manifest on disk', () => {
    assert.equal(levelFor(10), 0);
    assert.equal(levelFor(24), 0);
    assert.equal(levelFor(25), 1);
    assert.equal(levelFor(66), 1);
    assert.equal(levelFor(119), 1);
    assert.equal(levelFor(120), 2);
    assert.equal(levelFor(800), 2);
  });

  it('visibleTileKeys covers the viewport', () => {
    const cam = createCamera({ center: [34, 39], scale: 100 });
    const keys = visibleTileKeys(cam, W, H);
    assert.ok(keys.length >= 4 && keys.length <= 60, `sane count, got ${keys.length}`);
  });

  it('draw throttle fires at most once per window, trailing wins', () => {
    let now = 0;
    let fires = 0;
    const timers = [];
    const origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn, ms) => {
      timers.push({ fn, at: now + ms });
      return timers.length;
    };
    const origClear = globalThis.clearTimeout;
    globalThis.clearTimeout = () => {};
    try {
      const go = createDrawThrottle(120, () => now, () => {
        fires++;
      });
      go();
      assert.equal(fires, 1, 'first call immediate');
      go();
      go();
      assert.equal(fires, 1, 'burst coalesced');
      assert.equal(timers.length, 1, 'one trailing timer');
      now = 200;
      timers[0].fn();
      assert.equal(fires, 2, 'trailing fires once');
    } finally {
      globalThis.setTimeout = origSetTimeout;
      globalThis.clearTimeout = origClear;
    }
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
