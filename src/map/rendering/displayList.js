// Display list: snapshot + camera → draw commands with screen coordinates.
// Pure and fully testable without a browser. Backends (Canvas2D now,
// WebGPU later) only execute commands; they never compute layout.
//
// Masking rule (ADR-004/006): fills come from closed land polygons, strokes
// from the same lines. NE global is the complete base; verified OSM theater
// polygons overdraw it in the SAME style (seamless). Washes clip to land.

import { project, projectRing } from '../camera/camera.js';
import { smoothPolyline } from './smooth.js';
import { STYLE_25D_V1 as STYLE } from './style.js';

// LOD: the OSM high-detail twin takes over once points would land denser
// than ~4px apart. Strokes hard-swap (no ghosting); fills overdraw identical.
export const HD_MIN_SCALE = 250;

// Cull margin in px (stroke widths + smoothing stay inside).
const CULL_PAD = 48;

function shiftNear(lon, centerLon) {
  let x = lon;
  while (x - centerLon > 180) x -= 360;
  while (centerLon - x > 180) x += 360;
  return x;
}

// World-bbox of points, normalized near the camera center (antimeridian-safe).
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
  // Project bbox corners; pad for strokes. Conservative by design.
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

export function buildDisplayList(snapshot, camera, width, height) {
  const commands = [{ type: 'sea' }];
  const hd = camera.scale >= HD_MIN_SCALE && (snapshot.coastlineHd ?? []).length > 0;
  const coastSource = hd ? snapshot.coastlineHd : snapshot.coastline;
  const coastDetail = hd ? 'hd' : 'base';
  const refLat = ((camera.refLat ?? camera.center[1]) * Math.PI) / 180;
  const pxPerDeg = camera.scale * Math.cos(refLat);
  const bandWidths = STYLE.sea.bands.map((b) => Math.max(1, b.widthDeg * pxPerDeg));
  const carveWidth = Math.max(2, STYLE.carve.widthDeg * pxPerDeg);
  // Two Chaikin passes for strokes. Smoothing is render-time only.
  const smoothCoast = (seg) =>
    smoothPolyline(smoothPolyline(seg.points.map((pt) => project(camera, width, height, pt))));
  // Paint order: sea → bands → land (+OSM overdraw) → … → carve →
  // waterways → crisp stroke → provinces → markers → fade.
  for (const seg of coastSource) {
    if (!visiblePoints(seg.points, camera, width, height)) continue;
    commands.push({
      type: 'coast-bands',
      id: seg.id,
      detail: coastDetail,
      widths: bandWidths,
      points: smoothCoast(seg),
    });
  }
  // Projected NE land rings (global base). OSM overlay below re-uses them.
  const landScreen = [];
  for (const poly of snapshot.land ?? []) {
    if (!visibleRings(poly.rings, camera, width, height)) continue;
    const rings = poly.rings.map((ring) => projectRing(camera, width, height, ring));
    landScreen.push(...rings);
    commands.push({ type: 'land-fill', id: poly.id, rings });
  }
  // Verified OSM theater overdraw: same style, exact island/mainland edges.
  const osmScreen = [];
  for (const poly of snapshot.landOsm ?? []) {
    if (!visibleRings(poly.rings, camera, width, height)) continue;
    const rings = poly.rings.map((ring) => projectRing(camera, width, height, ring));
    osmScreen.push(...rings);
    commands.push({ type: 'land-fill-osm', id: poly.id, rings });
  }
  for (const lake of snapshot.lakes ?? []) {
    if (!visibleRings(lake.rings, camera, width, height)) continue;
    commands.push({
      type: 'lake-fill',
      id: lake.id,
      rings: lake.rings.map((ring) => projectRing(camera, width, height, ring)),
    });
  }
  if (snapshot.terrain) {
    const t = snapshot.terrain;
    const [tx0, ty0] = project(camera, width, height, [t.bounds.west, t.bounds.north]);
    const [tx1, ty1] = project(camera, width, height, [t.bounds.east, t.bounds.south]);
    commands.push({
      type: 'terrain-tint',
      grid: t,
      x: tx0,
      y: ty0,
      w: tx1 - tx0,
      h: ty1 - ty0,
      landRings: landScreen,
    });
  }
  for (const r of snapshot.rivers ?? []) {
    if (!visiblePoints(r.points, camera, width, height)) continue;
    commands.push({
      type: 'river',
      id: r.id,
      points: r.points.map((pt) => project(camera, width, height, pt)),
    });
  }
  for (const p of snapshot.provinces) {
    commands.push({
      type: 'province-fill',
      id: p.id,
      color: p.color,
      ring: projectRing(camera, width, height, p.ring),
      landClip: landScreen,
    });
  }
  // Protected waterways BEFORE crisp strokes: guaranteed open straits with
  // their shores redrawn on top.
  for (const w of snapshot.waterways ?? []) {
    commands.push({
      type: 'waterway',
      id: w.id,
      width: Math.max(2, w.widthDeg * pxPerDeg),
      points: w.points.map((pt) => project(camera, width, height, pt)),
    });
  }
  // Carve AFTER fills (trims boxes to shore) but BEFORE borders/markers.
  for (const seg of coastSource) {
    if (!visiblePoints(seg.points, camera, width, height)) continue;
    const pts = smoothCoast(seg);
    commands.push({ type: 'coast-carve', id: seg.id, detail: coastDetail, width: carveWidth, points: pts });
    commands.push({ type: 'coastline', id: seg.id, detail: coastDetail, points: pts });
  }
  for (const p of snapshot.provinces) {
    commands.push({ type: 'province-border', id: p.id, ring: projectRing(camera, width, height, p.ring) });
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
