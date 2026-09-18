// Panel content builders: session + id → HTML string. DOM-free and pure,
// so tests assert content without a browser. Read-only: queries only.
// Fields that need later phases are marked with their phase (no fake data).

import { getState, getProvince, getCity, citiesOfProvince } from '../core/world/queries.js';

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

export function renderProvincePanel(session, provinceId) {
  const province = getProvince(session.world, provinceId);
  if (!province) return '<section class="panel"><p>Unknown province.</p></section>';
  const owner = getState(session.world, province.ownerStateId);
  const controller = getState(session.world, province.controllerStateId ?? province.ownerStateId);
  const cities = citiesOfProvince(session.world, provinceId);
  const rows = [
    ['Owner', owner?.name ?? province.ownerStateId],
    ['Controller', controller?.name ?? province.ownerStateId],
    ['Boundary', province.boundaryStatus],
    ['Confidence', province.confidence ?? '—'],
    ['Cities', cities.length > 0 ? cities.map((c) => `${c.name} (${c.tier})`).join(', ') : '—'],
    ['Population', 'Phase 7+'],
    ['Terrain', 'Phase 4+'],
    ['Resources', 'Phase 7+'],
    ['Unrest', 'Phase 10+'],
  ];
  return (
    `<section class="panel"><h2>${esc(province.name ?? province.id)}</h2><dl>` +
    rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('') +
    '</dl></section>'
  );
}

export function renderCityPanel(session, cityId) {
  const city = getCity(session.world, cityId);
  if (!city) return '<section class="panel"><p>Unknown city.</p></section>';
  const province = getProvince(session.world, city.provinceId);
  const anchor = session.world.anchors.get(city.anchorId);
  const rows = [
    ['Tier', city.tier],
    ['Development', String(city.development ?? '—')],
    ['Province', province?.name ?? city.provinceId],
    ['Confidence', city.confidence ?? '—'],
    ['Coordinates', anchor ? `${anchor.lon.toFixed(2)}, ${anchor.lat.toFixed(2)}` : '—'],
    ['Buildings', 'Phase 8+'],
    ['Production', 'Phase 7+'],
    ['Trade', 'Phase 9+'],
  ];
  return (
    `<section class="panel"><h2>${esc(city.name ?? city.id)}</h2><dl>` +
    rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('') +
    '</dl></section>'
  );
}
