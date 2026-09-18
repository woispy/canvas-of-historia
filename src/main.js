// Canvas of Historia — boot entry.
// SLICE SCAFFOLDING: seed JSON is imported directly so the browser can boot
// without an asset pipeline. Phase 5 replaces this with packed runtime assets
// loaded from public/ (see SYSTEM-ARCHITECTURE.md §4). Source data stays in
// data/ and is never fetched raw in production.

import scenario from '../data/scenarios/1326/scenario.json';
import provinces from '../data/scenarios/1326/provinces.json';
import cities from '../data/scenarios/1326/cities.json';
import coastline from '../data/scenarios/1326/coastline.json';
import land from '../data/scenarios/1326/land.json';
import rivers from '../data/scenarios/1326/rivers.json';
import lakes from '../data/scenarios/1326/lakes.json';
import { enterGame } from './core/engine/boot.js';
import { advanceMonth } from './core/engine/tick.js';
import { createCamera } from './map/camera/camera.js';
import { extractSnapshot } from './map/rendering/snapshot.js';
import { buildDisplayList } from './map/rendering/displayList.js';
import { renderCanvas2D } from './map/rendering/canvas2d/backend.js';
import { pickMarker, pickProvince } from './map/selection/pick.js';
import { renderCityPanel, renderProvincePanel } from './app/panels.js';

export const COH_VERSION = '0.1.0';
export const COH_PHASE = 2;

const seedReader = async (rel) => {
  if (rel.endsWith('scenario.json')) return scenario;
  if (rel.endsWith('provinces.json')) return provinces;
  if (rel.endsWith('cities.json')) return cities;
  if (rel.endsWith('coastline.json')) return coastline;
  if (rel.endsWith('land.json')) return land;
  if (rel.endsWith('rivers.json')) return rivers;
  if (rel.endsWith('lakes.json')) return lakes;
  throw new Error(`unknown asset: ${rel}`);
};

function fitScale(width, height) {
  return Math.min(width, height) / 9;
}

export async function boot(rootElement, opts = {}) {
  const el = rootElement ?? (typeof document !== 'undefined' ? document.getElementById('app') : null);
  if (!el) throw new Error('coh: #app root element missing');
  const session = await enterGame(seedReader, {
    scenarioId: '1326',
    countryId: opts.countryId ?? 'ottomans',
  });
  if (typeof document === 'undefined') return session;
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = el.clientWidth || window.innerWidth;
  const height = el.clientHeight || window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  el.textContent = '';
  el.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const camera = createCamera({ scale: opts.scale ?? fitScale(width, height) });
  const snapshot = extractSnapshot(session);
  const draw = (s) =>
    renderCanvas2D(ctx, width, height, buildDisplayList(extractSnapshot(s), camera, width, height));
  draw(session);
  let current = session;
  const panel = document.getElementById('panel');
  const hud = document.getElementById('hud');
  const feed = document.getElementById('feed');

  const fmtDate = (t) => `${t.day}.${t.month}.${t.year}`;
  const renderHud = () => {
    hud.innerHTML =
      `<strong>${fmtDate(current.state.time)}</strong>` +
      `<span>Tick ${current.state.tick} · Treasury ${current.state.treasury}</span>` +
      `<button id="advance">+1 month</button>`;
    feed.innerHTML = current.state.log
      .map((e) => `<div><span>${e.date}</span><p>${e.text}</p></div>`)
      .join('');
    hud.querySelector('#advance').addEventListener('click', () => {
      current = advanceMonth(current);
      draw(current);
      renderHud();
    });
  };
  renderHud();
  canvas.style.cursor = 'crosshair';
  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // Markers win over provinces (cities sit on top of land).
    const marker = pickMarker(snapshot, camera, width, height, x, y);
    if (marker) {
      panel.innerHTML = renderCityPanel(session, marker.id);
      return;
    }
    const province = pickProvince(snapshot, camera, width, height, x, y);
    panel.innerHTML = province ? renderProvincePanel(session, province.id) : '';
  });
  return session;
}

if (typeof document !== 'undefined') boot();
