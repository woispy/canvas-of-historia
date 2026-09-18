// Render-time polyline smoothing (Chaikin corner cutting).
// Styling only: source data is never modified (brief §73 — no fake precision
// in data; pixels may be kind). Endpoints are always preserved.

export function smoothPolyline(points, iterations = 1) {
  let current = points;
  for (let n = 0; n < iterations; n++) {
    if (current.length < 3) return current;
    const next = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const [x0, y0] = current[i];
      const [x1, y1] = current[i + 1];
      next.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25]);
      next.push([x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

// Maximum turning angle (radians) along a polyline — smoothness metric.
// 0 = perfectly straight, π = full reversal.
export function maxTurningAngle(points) {
  let max = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const [cx, cy] = points[i + 1];
    const v1x = bx - ax;
    const v1y = by - ay;
    const v2x = cx - bx;
    const v2y = cy - by;
    const m1 = Math.hypot(v1x, v1y);
    const m2 = Math.hypot(v2x, v2y);
    if (m1 === 0 || m2 === 0) continue;
    const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (m1 * m2)));
    const angle = Math.acos(cos);
    if (angle > max) max = angle;
  }
  return max;
}
