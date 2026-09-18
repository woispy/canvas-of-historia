// Structural validator for scenario definitions.
// Mirrors docs/contracts/*.schema.json without bundling a schema library
// (the ajv-based contract tests in tools/tests guard the schemas themselves).
// Throws ScenarioError listing every violation — boot never half-succeeds.

export class ScenarioError extends Error {
  constructor(stage, violations) {
    super(`scenario ${stage} failed: ${violations.join('; ')}`);
    this.name = 'ScenarioError';
    this.stage = stage;
    this.violations = violations;
  }
}

const CONFIDENCES = ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'SPECULATIVE'];
const BOUNDARIES = ['confirmed-core', 'frontier', 'influence', 'uncertain-extent'];
const ANCHOR_KINDS = ['city', 'fortress', 'geographic'];
const CITY_TIERS = ['village', 'town', 'city', 'large-city', 'capital', 'metropolis'];

function isId(v) {
  return typeof v === 'string' && /^[a-z0-9-]+$/.test(v);
}

export function validateScenario(def) {
  const violations = [];
  const need = (cond, msg) => {
    if (!cond) violations.push(msg);
  };

  if (!def || typeof def !== 'object') throw new ScenarioError('validate', ['empty definition']);
  const { scenario, provinces, cities, coastline, land } = def;
  need(scenario && typeof scenario === 'object', 'scenario: missing object');
  need(Array.isArray(provinces) && provinces.length > 0, 'provinces: non-empty array required');
  need(Array.isArray(cities), 'cities: array required');
  need(coastline === undefined || Array.isArray(coastline), 'coastline: array when present');
  if (violations.length > 0) throw new ScenarioError('validate', violations);

  need(isId(scenario.id), 'scenario.id: invalid');
  need(typeof scenario.name === 'string' && scenario.name.length > 0, 'scenario.name: required');
  const d = scenario.startDate || {};
  need(Number.isInteger(d.year) && d.month >= 1 && d.month <= 12 && d.day >= 1 && d.day <= 31, 'scenario.startDate: invalid');

  const stateIds = new Set();
  for (const s of scenario.states ?? []) {
    need(isId(s.id), `state.id invalid: ${s.id}`);
    need(typeof s.name === 'string' && s.name.length > 0, `state.name required: ${s.id}`);
    stateIds.add(s.id);
  }
  need(stateIds.size > 0, 'states: at least one required');

  const anchorIds = new Set();
  for (const a of scenario.anchors ?? []) {
    need(isId(a.id), `anchor.id invalid: ${a.id}`);
    need(ANCHOR_KINDS.includes(a.kind), `anchor.kind invalid: ${a.id}`);
    need(typeof a.lon === 'number' && a.lon >= -180 && a.lon <= 180, `anchor.lon invalid: ${a.id}`);
    need(typeof a.lat === 'number' && a.lat >= -90 && a.lat <= 90, `anchor.lat invalid: ${a.id}`);
    anchorIds.add(a.id);
  }
  for (const s of scenario.states ?? []) {
    need(anchorIds.has(s.capitalAnchorId), `state ${s.id}: missing capital anchor ${s.capitalAnchorId}`);
  }

  const provinceIds = new Set();
  for (const p of provinces) {
    need(isId(p.id), `province.id invalid: ${p.id}`);
    need(p.scenarioId === scenario.id, `province ${p.id}: scenario mismatch`);
    need(stateIds.has(p.ownerStateId), `province ${p.id}: unknown owner ${p.ownerStateId}`);
    need(BOUNDARIES.includes(p.boundaryStatus), `province ${p.id}: bad boundaryStatus`);
    if (p.confidence !== undefined) need(CONFIDENCES.includes(p.confidence), `province ${p.id}: bad confidence`);
    need(Array.isArray(p.ring) && p.ring.length >= 4, `province ${p.id}: ring needs 4+ points`);
    provinceIds.add(p.id);
  }

  for (const seg of coastline ?? []) {
    need(isId(seg.id), `coastline.id invalid: ${seg.id}`);
    need(seg.scenarioId === scenario.id, `coastline ${seg.id}: scenario mismatch`);
    need(
      Array.isArray(seg.points) &&
        seg.points.length >= 2 &&
        seg.points.every((pt) => Array.isArray(pt) && typeof pt[0] === 'number' && typeof pt[1] === 'number'),
      `coastline ${seg.id}: points must be [lon, lat] pairs`,
    );
  }

  for (const poly of land ?? []) {
    need(isId(poly.id), `land.id invalid: ${poly.id}`);
    need(poly.scenarioId === scenario.id, `land ${poly.id}: scenario mismatch`);
    need(
      Array.isArray(poly.rings) &&
        poly.rings.length >= 1 &&
        poly.rings.every(
          (ring) =>
            Array.isArray(ring) &&
            ring.length >= 4 &&
            ring.every((pt) => Array.isArray(pt) && typeof pt[0] === 'number' && typeof pt[1] === 'number'),
        ),
      `land ${poly.id}: rings must be closed [lon, lat] loops`,
    );
  }

  for (const c of cities) {    need(isId(c.id), `city.id invalid: ${c.id}`);
    need(anchorIds.has(c.anchorId), `city ${c.id}: unknown anchor ${c.anchorId}`);
    need(provinceIds.has(c.provinceId), `city ${c.id}: unknown province ${c.provinceId}`);
    need(CITY_TIERS.includes(c.tier), `city ${c.id}: bad tier`);
  }

  if (violations.length > 0) throw new ScenarioError('validate', violations);
  return true;
}
