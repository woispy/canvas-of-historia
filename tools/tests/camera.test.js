import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCamera, fitCamera, panBy, project, zoomAt } from '../../src/map/camera/camera.js';

const W = 1600;
const H = 900;
const BOUNDS = { west: 26, south: 36, east: 42, north: 42 };

describe('camera controls', () => {
  it('fitCamera centers the bounds', () => {
    const cam = fitCamera(BOUNDS, W, H);
    assert.deepEqual(cam.center, [34, 39]);
    const [x0] = project(cam, W, H, [26, 39]);
    const [x1] = project(cam, W, H, [42, 39]);
    assert.ok(x0 >= 0 && x1 <= W, `bounds fit horizontally: ${x0}..${x1}`);
  });

  it('zoomAt keeps the cursor-anchored world point fixed', () => {
    const cam = createCamera({ center: [34, 39], scale: 100 });
    const sx = 1000;
    const sy = 300;
    // World point under cursor before zoom…
    const latRef = (39 * Math.PI) / 180;
    const lon = 34 + (sx - W / 2) / (100 * Math.cos(latRef));
    const lat = 39 - (sy - H / 2) / 100;
    const zoomed = zoomAt(cam, W, H, sx, sy, 2);
    assert.ok(zoomed.scale > cam.scale);
    // …projects back onto the cursor after zoom (within float tolerance).
    const [px, py] = project(zoomed, W, H, [lon, lat]);
    assert.ok(Math.abs(px - sx) < 1e-6 && Math.abs(py - sy) < 1e-6, `anchor drifted: ${px},${py}`);
  });

  it('zoom clamps to sane limits', () => {
    const cam = createCamera({ center: [34, 39], scale: 100 });
    assert.equal(zoomAt(cam, W, H, W / 2, H / 2, 1e9).scale, 4000);
    assert.equal(zoomAt(cam, W, H, W / 2, H / 2, 1e-9).scale, 8);
  });

  it('panBy moves the view by pixel deltas', () => {
    const cam = createCamera({ center: [34, 39], scale: 100 });
    const panned = panBy(cam, W, H, 100, 0);
    assert.ok(panned.center[0] < 34, 'drag right moves view east→center shifts west');
    const [x] = project(panned, W, H, [34, 39]);
    assert.ok(Math.abs(x - (W / 2 + 100)) < 1e-6);
  });
});
