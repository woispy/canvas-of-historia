// Deterministic camera: pure functions, no DOM, no mutation.
// Canonical lon/lat in, screen px out. World-wrap (canonical vs render
// longitude) arrives with the world map phase; the split point is reserved here.

export function createCamera({ center = [29.5, 40.6], scale = 60, refLat = 39 } = {}) {
  return Object.freeze({ center: Object.freeze([...center]), scale, refLat });
}

// Fit a lon/lat bounding box into the viewport with a margin.
// Returns a new camera centered on the box.
export function fitCamera(bounds, width, height, margin = 0.92) {
  const cx = (bounds.west + bounds.east) / 2;
  const cy = (bounds.south + bounds.north) / 2;
  const latRef = (cy * Math.PI) / 180;
  const scaleLon = width / ((bounds.east - bounds.west) * Math.cos(latRef));
  const scaleLat = height / (bounds.north - bounds.south);
  const scale = Math.min(scaleLon, scaleLat) * margin;
  return createCamera({ center: [cx, cy], scale, refLat: cy });
}

const MIN_SCALE = 8;
const MAX_SCALE = 4000;

// Zoom keeping the world point under the cursor fixed. Immutable.
// Exact: projection uses the fixed standard parallel (refLat), so the anchor
// re-projects onto the cursor with zero drift.
export function zoomAt(camera, width, height, sx, sy, factor) {
  const [cx, cy] = camera.center;
  const refLat = camera.refLat ?? cy;
  const cosRef = Math.cos((refLat * Math.PI) / 180);
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, camera.scale * factor));
  const lon = cx + (sx - width / 2) / (camera.scale * cosRef);
  const lat = cy - (sy - height / 2) / camera.scale;
  const nCenter = [lon - (sx - width / 2) / (scale * cosRef), lat + (sy - height / 2) / scale];
  return createCamera({ center: nCenter, scale, refLat });
}

// Pan by screen-pixel deltas. Immutable.
export function panBy(camera, width, height, dxPx, dyPx) {
  const [cx, cy] = camera.center;
  const cosRef = Math.cos((((camera.refLat ?? cy)) * Math.PI) / 180);
  return createCamera({
    center: [cx - dxPx / (camera.scale * cosRef), cy + dyPx / camera.scale],
    scale: camera.scale,
    refLat: camera.refLat ?? cy,
  });
}

export function project(camera, width, height, [lon, lat]) {
  const [cx, cy] = camera.center;
  const latRef = ((camera.refLat ?? cy) * Math.PI) / 180;
  const x = width / 2 + (lon - cx) * camera.scale * Math.cos(latRef);
  const y = height / 2 - (lat - cy) * camera.scale;
  return [x, y];
}

export function projectRing(camera, width, height, ring) {
  return ring.map((pt) => project(camera, width, height, pt));
}
