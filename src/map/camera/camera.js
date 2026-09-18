// Deterministic camera: pure functions, no DOM, no mutation.
// Canonical lon/lat in, screen px out. World-wrap (canonical vs render
// longitude) arrives with the world map phase; the split point is reserved here.

export function createCamera({ center = [29.5, 40.6], scale = 60 } = {}) {
  return Object.freeze({ center: Object.freeze([...center]), scale });
}

export function project(camera, width, height, [lon, lat]) {
  const [cx, cy] = camera.center;
  const latRef = (cy * Math.PI) / 180;
  const x = width / 2 + (lon - cx) * camera.scale * Math.cos(latRef);
  const y = height / 2 - (lat - cy) * camera.scale;
  return [x, y];
}

export function projectRing(camera, width, height, ring) {
  return ring.map((pt) => project(camera, width, height, pt));
}
