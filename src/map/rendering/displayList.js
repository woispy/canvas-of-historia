// Display list: snapshot + camera → draw commands with screen coordinates.
// Pure and fully testable without a browser. Backends (Canvas2D now,
// WebGPU later) only execute commands; they never compute layout.

import { project, projectRing } from '../camera/camera.js';
import { smoothPolyline } from './smooth.js';
import { STYLE_25D_V1 as STYLE } from './style.js';

// LOD rule: the OSM high-detail twin takes over once points would land
// denser than ~4px apart. Below that the NE 10m base layer is identical
// on screen and far cheaper.
export const HD_MIN_SCALE = 250;

export function buildDisplayList(snapshot, camera, width, height) {
  const commands = [{ type: 'sea' }];
  const hd = camera.scale >= HD_MIN_SCALE && (snapshot.coastlineHd ?? []).length > 0;
  const coastSource = hd ? snapshot.coastlineHd : snapshot.coastline;
  const coastDetail = hd ? 'hd' : 'base';
  const refLat = (((camera.refLat ?? camera.center[1])) * Math.PI) / 180;
  const pxPerDeg = camera.scale * Math.cos(refLat);
  const bandWidths = STYLE.sea.bands.map((b) => Math.max(1, b.widthDeg * pxPerDeg));
  const carveWidth = Math.max(2, STYLE.carve.widthDeg * pxPerDeg);
  // Two Chaikin passes: HD data stays sharp enough to read, corners stop
  // looking drafted. Smoothing is render-time only; data is untouched.
  const smoothCoast = (seg) =>
    smoothPolyline(
      smoothPolyline(seg.points.map((pt) => project(camera, width, height, pt))),
    );
  // Paint order: sea → bands → land (covers bands' land half) → … → shore
  // ribbon (covers mismatch slivers both sides) → crisp stroke on top.
  for (const seg of coastSource) {
    commands.push({
      type: 'coast-bands',
      id: seg.id,
      detail: coastDetail,
      widths: bandWidths,
      points: smoothCoast(seg),
    });
  }
  for (const poly of snapshot.land ?? []) {
    commands.push({
      type: 'land-fill',
      id: poly.id,
      rings: poly.rings.map((ring) => projectRing(camera, width, height, ring)),
    });
  }
  for (const lake of snapshot.lakes ?? []) {
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
      landRings: (snapshot.land ?? []).flatMap((poly) =>
        poly.rings.map((ring) => projectRing(camera, width, height, ring)),
      ),
    });
  }
  for (const r of snapshot.rivers ?? []) {
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
    });
  }
  // Carve AFTER fills (trims boxes to shore) but BEFORE borders/markers.
  for (const seg of coastSource) {
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
  // Edge fade: scope vignette so truncated border geometry dissolves instead
  // of ending in hard cuts. Feather is geographic (0.6°) like the shallows.
  commands.push({ type: 'edge-fade', featherPx: Math.max(24, Math.min(160, 0.6 * pxPerDeg)) });
  return commands;
}
