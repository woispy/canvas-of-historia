// Tile math for the planet coastline store (4°/8° grids, WGS84).
// Pure helpers — headless-testable. Fetching lives in main.js (browser).

export const TILE_DEG = 4;

export function tileKey(tx, ty) {
  return `${tx}_${ty}`;
}

export function tileOf(lon, lat, tileDeg = TILE_DEG) {
  return [Math.floor((lon + 180) / tileDeg), Math.floor((lat + 90) / tileDeg)];
}

// Viewport range includes neighbors and wraps the antimeridian.
export function tileRangeForView(west, south, east, north, tileDeg = TILE_DEG) {
  // Normalize antimeridian crossings for the range computation.
  let w = west;
  let e = east;
  if (e - w > 360) {
    w = -180;
    e = 180;
  } else if (e < w) {
    e += 360;
  }
  const perRow = Math.round(360 / tileDeg);
  const maxTy = Math.round(180 / tileDeg) - 1;
  const [tx0] = [Math.floor((w + 180) / tileDeg)];
  const [tx1] = [Math.floor((e + 180) / tileDeg)];
  const ty0 = Math.max(0, Math.floor((south + 90) / tileDeg));
  const ty1 = Math.min(maxTy, Math.floor((north + 90) / tileDeg));
  const keys = [];
  for (let tx = tx0; tx <= tx1; tx++) {
    // Wrap tile x around the antimeridian.
    const wrapped = ((tx % perRow) + perRow) % perRow;
    for (let ty = ty0; ty <= ty1; ty++) keys.push(tileKey(wrapped, ty));
  }
  return keys;
}
