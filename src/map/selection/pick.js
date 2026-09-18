// Map selection: screen px → world → province / city marker.
// Pure functions, headless-testable. Read-only: never touches session state.

import { project } from '../camera/camera.js';

export function unproject(camera, width, height, [x, y]) {
  const [cx, cy] = camera.center;
  const latRef = (cy * Math.PI) / 180;
  const lon = cx + (x - width / 2) / (camera.scale * Math.cos(latRef));
  const lat = cy - (y - height / 2) / camera.scale;
  return [lon, lat];
}

export function pointInRing([lon, lat], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function pickProvince(snapshot, camera, width, height, x, y) {
  const pt = unproject(camera, width, height, [x, y]);
  const provinces = snapshot.provinces;
  for (let i = provinces.length - 1; i >= 0; i--) {
    if (pointInRing(pt, provinces[i].ring)) return provinces[i];
  }
  return null;
}

export function pickMarker(snapshot, camera, width, height, x, y, radiusPx = 12) {
  let best = null;
  let bestDist = radiusPx;
  for (const m of snapshot.markers) {
    const [sx, sy] = project(camera, width, height, [m.lon, m.lat]);
    const dist = Math.hypot(sx - x, sy - y);
    if (dist <= bestDist) {
      best = m;
      bestDist = dist;
    }
  }
  return best;
}
