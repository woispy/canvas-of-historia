// World repositories: indexed, read-only views over a validated definition.
// Queries are side-effect free. Mutation arrives with engine commands (later phase).

export function bootstrapWorld(def) {
  const states = new Map(def.scenario.states.map((s) => [s.id, Object.freeze({ ...s })]));
  const anchors = new Map(def.scenario.anchors.map((a) => [a.id, Object.freeze({ ...a })]));
  const provinces = new Map(
    def.provinces.map((p) => [p.id, Object.freeze({ ...p, ring: Object.freeze(p.ring.map((pt) => Object.freeze([...pt]))) })]),
  );
  const cities = new Map(def.cities.map((c) => [c.id, Object.freeze({ ...c })]));
  // Coastline is an independent authority layer, never derived from rings.
  // The HD twin shares the shape; LOD selection happens in displayList.
  const freezePts = (pts) => Object.freeze(pts.map((pt) => Object.freeze([...pt])));
  const freezeSegments = (list) =>
    Object.freeze((list ?? []).map((seg) => Object.freeze({ ...seg, points: freezePts(seg.points) })));
  const coastline = freezeSegments(def.coastline);
  const coastlineHd = freezeSegments(def.coastlineHd);
  const land = Object.freeze(
    (def.land ?? []).map((poly) =>
      Object.freeze({ ...poly, rings: Object.freeze(poly.rings.map((ring) => Object.freeze(ring.map((pt) => Object.freeze([...pt]))))) }),
    ),
  );
  const rivers = Object.freeze(
    (def.rivers ?? []).map((r) => Object.freeze({ ...r, points: freezePts(r.points) })),
  );
  const lakes = Object.freeze(
    (def.lakes ?? []).map((lake) =>
      Object.freeze({ ...lake, rings: Object.freeze(lake.rings.map((ring) => freezePts(ring))) }),
    ),
  );
  const terrain = def.terrain
    ? Object.freeze({ ...def.terrain, values: Object.freeze([...def.terrain.values]) })
    : null;
  // Verified OSM theater overlay (strict, may be partial — NE covers all).
  const landOsm = Object.freeze(
    (def.landOsm ?? []).map((poly) =>
      Object.freeze({ ...poly, rings: Object.freeze(poly.rings.map((ring) => freezePts(ring))) }),
    ),
  );
  const waterways = Object.freeze(
    (def.waterways ?? []).map((w) => Object.freeze({ ...w, points: freezePts(w.points) })),
  );
  return Object.freeze({ scenarioId: def.scenario.id, states, anchors, provinces, cities, coastline, coastlineHd, land, landOsm, rivers, lakes, terrain, waterways });
}
