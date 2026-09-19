// Display list: snapshot + camera → draw commands with screen coordinates.
// Pure and fully testable without a browser.
//
// CLEAN-SLATE PROTOCOL (ADR-008): ONE land source (NE global), ONE coastline
// (the same rings), flat sea. No depth bands, no carve, no waterways, no
// terrain, no overlays. New layers return ONE AT A TIME, user-gated, each
// with its own test proving no spill/gap.

import { project, projectRing } from '../camera/camera.js';
import { smoothPolyline } from './smooth.js';

// Cull margin in px (strokes stay inside).
const CULL_PAD = 48;

function shiftNear(lon, centerLon) {
  let x = lon;
  while (x - centerLon > 180) x -= 360;
  while (centerLon - x > 180) x += 360;
  return x;
}

function worldBbox(points, centerLon) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [lon, lat] of points) {
    const x = shiftNear(lon, centerLon);
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (lat < y0) y0 = lat;
    if (lat > y1) y1 = lat;
  }
  return [x0, y0, x1, y1];
}

function bboxVisible([x0, y0, x1, y1], camera, width, height) {
  const corners = [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ];
  let sx0 = Infinity;
  let sx1 = -Infinity;
  let sy0 = Infinity;
  let sy1 = -Infinity;
  for (const [lon, lat] of corners) {
    const [x, y] = project(camera, width, height, [lon, lat]);
    if (x < sx0) sx0 = x;
    if (x > sx1) sx1 = x;
    if (y < sy0) sy0 = y;
    if (y > sy1) sy1 = y;
  }
  return sx1 >= -CULL_PAD && sx0 <= width + CULL_PAD && sy1 >= -CULL_PAD && sy0 <= height + CULL_PAD;
}

const visiblePoints = (points, camera, width, height) =>
  bboxVisible(worldBbox(points, camera.center[0]), camera, width, height);

const visibleRings = (rings, camera, width, height) =>
  bboxVisible(
    worldBbox(
      rings.flatMap((r) => r),
      camera.center[0],
    ),
    camera,
    width,
    height,
  );

export function buildDisplayList(snapshot, camera, width, height, coastTiles = []) {
  const commands = [{ type: 'sea' }];
  const refLat = ((camera.refLat ?? camera.center[1]) * Math.PI) / 180;
  const pxPerDeg = camera.scale * Math.cos(refLat);
  // Coastlines-only step: NO land fills, NO washes, NO borders.
  // Tile strokes from the planet store (same black line everywhere).
  for (const tile of coastTiles) {
    for (const line of tile.lines ?? []) {
      if (!visiblePoints(line, camera, width, height)) continue;
      commands.push({
        type: 'coastline',
        id: tile.key,
        points: line.map((pt) => project(camera, width, height, pt)),
      });
    }
  }
  for (const m of snapshot.markers) {
    commands.push({
      type: 'marker',
      id: m.id,
      name: m.name,
      tier: m.tier,
      at: project(camera, width, height, [m.lon, m.lat]),
    });
  }
  commands.push({ type: 'edge-fade', featherPx: Math.max(24, Math.min(160, 0.6 * pxPerDeg)) });
  return commands;
}
