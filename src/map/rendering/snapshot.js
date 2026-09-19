// Render snapshot: frozen, viewport-independent extraction from a session.
// The renderer reads ONLY this. Simulation state is never touched by drawing.

export function extractSnapshot(session) {
  const stateColors = new Map(
    [...session.world.states.values()].map((s) => [s.id, s.color ?? '#888888']),
  );
  const provinces = [...session.world.provinces.values()].map((p) => ({
    id: p.id,
    ring: p.ring,
    color: stateColors.get(p.ownerStateId) ?? '#888888',
  }));
  const coastline = (session.world.coastline ?? []).map((seg) => ({
    id: seg.id,
    points: seg.points,
  }));
  const coastlineHd = (session.world.coastlineHd ?? []).map((seg) => ({
    id: seg.id,
    points: seg.points,
  }));
  const markers = [...session.world.cities.values()].map((c) => {
    const anchor = session.world.anchors.get(c.anchorId);
    return { id: c.id, name: c.name, tier: c.tier, lon: anchor.lon, lat: anchor.lat };
  });
  const land = (session.world.land ?? []).map((poly) => ({ id: poly.id, rings: poly.rings }));
  const landOsm = (session.world.landOsm ?? []).map((poly) => ({ id: poly.id, rings: poly.rings }));
  const landCountries = (session.world.landCountries ?? []).map((poly) => ({ id: poly.id, country: poly.country, rings: poly.rings }));
  const waterways = (session.world.waterways ?? []).map((w) => ({ id: w.id, widthDeg: w.widthDeg, points: w.points }));
  const seas = (session.world.seas ?? []).map((s) => ({ id: s.id, rings: s.rings }));
  const rivers = (session.world.rivers ?? []).map((r) => ({ id: r.id, points: r.points }));
  const lakes = (session.world.lakes ?? []).map((lake) => ({ id: lake.id, rings: lake.rings }));
  const terrain = session.world.terrain ?? null;
  return Object.freeze({ provinces, coastline, coastlineHd, markers, land, landOsm, landCountries, rivers, lakes, terrain, waterways, seas });
}
