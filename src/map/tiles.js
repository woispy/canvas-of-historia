// Tile math for the planet coastline store (4° grid, WGS84).
// Pure helpers — headless-testable. Fetching lives in main.js (browser).

export const TILE_DEG = 4;

export function tileKey(tx, ty) {
  return `${tx}_${ty}`;
}

export function tileOf(lon, lat) {
  return [Math.floor((lon + 180) / TILE_DEG), Math.floor((lat + 90) / TILE_DEG)];
}

// Tile range covering a viewport, given its world-space bbox corners.
export function tileRangeForView(west, south, east, north) {
  // Normalize antimeridian crossings for the range computation.
  let w = west;
  let e = east;
  if (e - w > 360) {
    w = -180;
    e = 180;
  } else if (e < w) {
    e += 360;
  }
  const [tx0] = [Math.floor((w + 180) / TILE_DEG)];
  const [tx1] = [Math.floor((e + 180) / TILE_DEG)];
  const ty0 = Math.max(0, Math.floor((south + 90) / TILE_DEG));
  const ty1 = Math.min(44, Math.floor((north + 90) / TILE_DEG));
  const keys = [];
  for (let tx = tx0; tx <= tx1; tx++) {
    // Wrap tile x around the antimeridian (90 tiles span 360°).
    const wrapped = ((tx % 90) + 90) % 90;
    for (let ty = ty0; ty <= ty1; ty++) keys.push(tileKey(wrapped, ty));
  }
  return keys;
}
