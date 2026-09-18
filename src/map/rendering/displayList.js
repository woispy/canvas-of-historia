// Display list: snapshot + camera → draw commands with screen coordinates.
// Pure and fully testable without a browser. Backends (Canvas2D now,
// WebGPU later) only execute commands; they never compute layout.

import { project, projectRing } from '../camera/camera.js';

export function buildDisplayList(snapshot, camera, width, height) {
  const commands = [{ type: 'sea' }];
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
  for (const seg of snapshot.coastline) {
    commands.push({
      type: 'coastline',
      id: seg.id,
      points: seg.points.map((pt) => project(camera, width, height, pt)),
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
  return commands;
}
