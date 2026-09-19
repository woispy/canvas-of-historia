// Canvas of Historia — boot entry.
//
// Data: small scenario files import statically; the megabyte-scale payloads
// (land, coastlines, terrain) lazy-load via dynamic import so first paint is
// fast (Phase 5 packs them into binary assets).
// Render: rAF-throttled draws + offscreen pan-blit (drag pans blit, zoom
// re-renders). Tile coastline store lives in the coastline layer module.

import { enterGame } from './core/engine/boot.js';
import { advanceMonth } from './core/engine/tick.js';
import { fitCamera, panBy, zoomAt } from './map/camera/camera.js';
import { createTileStore, visibleTileKeys } from './map/layers/coastline.js';
import { extractSnapshot } from './map/rendering/snapshot.js';
import { buildDisplayList } from './map/rendering/displayList.js';
import { renderCanvas2D } from './map/rendering/canvas2d/backend.js';
import { pickMarker, pickProvince } from './map/selection/pick.js';
import { renderCityPanel, renderProvincePanel } from './app/panels.js';

export const COH_VERSION = '0.1.0';
export const COH_PHASE = 2;

async function loadSeed() {
  // Literal dynamic imports: Vite code-splits each into its own chunk,
  // loaded in parallel after boot starts (fast first paint).
  const mods = await Promise.all([
    import('../data/scenarios/1326/scenario.json'),
    import('../data/scenarios/1326/provinces.json'),
    import('../data/scenarios/1326/cities.json'),
    import('../data/scenarios/1326/coastline.json'),
    import('../data/scenarios/1326/coastline-hd.json'),
    import('../data/scenarios/1326/land.json'),
    import('../data/scenarios/1326/land-osm.json'),
    import('../data/scenarios/1326/land-countries.json'),
    import('../data/scenarios/1326/rivers.json'),
    import('../data/scenarios/1326/lakes.json'),
    import('../data/scenarios/1326/terrain-grid.json'),
    import('../data/scenarios/1326/waterways.json'),
    import('../data/scenarios/1326/seas.json'),
  ]);
  const names = [
    'scenario.json', 'provinces.json', 'cities.json', 'coastline.json',
    'coastline-hd.json', 'land.json', 'land-osm.json', 'land-countries.json',
    'rivers.json', 'lakes.json', 'terrain-grid.json', 'waterways.json', 'seas.json',
  ];
  const byName = {};
  names.forEach((n, i) => {
    byName[n] = mods[i].default;
  });
  return async (rel) => {
    const name = rel.split('/').pop();
    if (byName[name] !== undefined) return byName[name];
    throw new Error(`unknown asset: ${rel}`);
  };
}

export async function boot(rootElement, opts = {}) {
  const el = rootElement ?? (typeof document !== 'undefined' ? document.getElementById('app') : null);
  if (!el) throw new Error('coh: #app root element missing');
  try {
    return await bootInner(el, opts);
  } catch (err) {
    // Visible diagnostics: never fail silent in the browser.
    const hud = typeof document !== 'undefined' ? document.getElementById('hud') : null;
    if (hud) hud.innerHTML = `<strong>boot error</strong><span>${String(err?.message ?? err)}</span>`;
    throw err;
  }
}

async function bootInner(el, opts = {}) {
  const readJson = await loadSeed();
  if (typeof document === 'undefined') {
    return enterGame(readJson, { scenarioId: '1326', countryId: opts.countryId ?? 'ottomans' });
  }
  const session = await enterGame(readJson, {
    scenarioId: '1326',
    countryId: opts.countryId ?? 'ottomans',
  });
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
  // Camera fits the scenario bounds, so the full theater is centered on boot.
  let camera = fitCamera(session.scenario.mapScope.bounds, width, height);
  const snapshot = extractSnapshot(session);

  // Offscreen layer cache: full re-render on zoom/tile-arrival; pan blits.
  const off = document.createElement('canvas');
  off.width = canvas.width;
  off.height = canvas.height;
  const offCtx = off.getContext('2d');
  offCtx.scale(dpr, dpr);
  let renderedScale = -1;
  let panDx = 0;
  let panDy = 0;
  let frameEma = 0;
  let lastPts = 0;

  const store = createTileStore(
    async (url) => {
      const r = await fetch(url);
      return r.ok ? r.json() : null;
    },
    () => {
      // Tile arrivals never interrupt an active drag (deferred to release).
      if (!drag) scheduleFull();
      else pendingTiles = true;
    },
  );
  const draw = (s) => {
    const t0 = performance.now();
    const tiles = store.ensure(visibleTileKeys(camera, width, height));
    const cmds = buildDisplayList(extractSnapshot(s), camera, width, height, tiles);
    renderCanvas2D(offCtx, width, height, cmds);
    renderedScale = camera.scale;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(off, 0, 0, width, height);
    const dt = performance.now() - t0;
    frameEma = frameEma === 0 ? dt : frameEma * 0.9 + dt * 0.1;
    lastPts = cmds.reduce((n, c) => n + (c.batches ? c.batches.reduce((m, b) => m + b.length, 0) : 0), 0);
    if (perfEl) perfEl.textContent = `${frameEma.toFixed(1)}ms ${Math.round(lastPts / 1000)}kpts ${store.size()}tiles`;
  };
  // rAF coalescing: bursts of events render once per frame. Drag pans only
  // blit the cached frame (fast path); release re-renders crisply once.
  let queued = null;
  function scheduleFull() {
    if (queued) return;
    queued = 'full';
    requestAnimationFrame(() => {
      queued = null;
      draw(current);
    });
  }
  function schedulePan() {
    if (queued) return;
    queued = 'pan';
    requestAnimationFrame(() => {
      queued = null;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(off, panDx, panDy, width, height);
      panDx = 0;
      panDy = 0;
    });
  }
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
      `<button id="advance">+1 month</button>` +
      `<button id="zin" title="Zoom in">+</button><button id="zout" title="Zoom out">−</button>`;
    feed.innerHTML = current.state.log
      .map((e) => `<div><span>${e.date}</span><p>${e.text}</p></div>`)
      .join('');
    hud.querySelector('#advance').addEventListener('click', () => {
      current = advanceMonth(current);
      scheduleFull();
      renderHud();
    });
    const zoomCenter = (factor) => {
      camera = zoomAt(camera, width, height, width / 2, height / 2, factor);
      scheduleFull();
    };
    hud.querySelector('#zin').addEventListener('click', () => zoomCenter(1.5));
    hud.querySelector('#zout').addEventListener('click', () => zoomCenter(1 / 1.5));
  };
  renderHud();
  canvas.style.cursor = 'grab';

  const toLocal = (event) => {
    const rect = canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };

  // Wheel zoom: instant approximate blit about the cursor, crisp re-render
  // debounced 120ms after the gesture ends.
  let wheelTimer = null;
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const [x, y] = toLocal(event);
      const prevScale = camera.scale;
      camera = zoomAt(camera, width, height, x, y, event.deltaY < 0 ? 1.25 : 1 / 1.25);
      const k = camera.scale / prevScale;
      // Approximate: scale cached frame about the cursor, then sharpen.
      ctx.clearRect(0, 0, width, height);
      const sw = width / k;
      const sh = height / k;
      ctx.drawImage(off, 0, 0, off.width, off.height, x - sw / 2, y - sh / 2, sw, sh);
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => scheduleFull(), 120);
    },
    { passive: false },
  );

  // Drag pans (blit fast path). A click without drag still selects (< 4px).
  let drag = null;
  let suppressClick = false;
  let pendingTiles = false;
  // Perf overlay (?perf=1): EMA frame ms + projected points + cached tiles.
  const perfOn = typeof location !== 'undefined' && location.search.includes('perf=1');
  const perfEl = perfOn ? (() => { const d = document.createElement('div'); d.id = 'perf'; document.body.appendChild(d); return d; })() : null;
  canvas.addEventListener('pointerdown', (event) => {
    drag = { x: event.clientX, y: event.clientY, moved: false };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 4) drag.moved = true;
    if (drag.moved) {
      camera = panBy(camera, width, height, dx, dy);
      drag.x = event.clientX;
      drag.y = event.clientY;
      if (camera.scale === renderedScale) {
        panDx += dx;
        panDy += dy;
        schedulePan();
      } else {
        scheduleFull();
      }
    }
  });
  const endDrag = () => {
    suppressClick = drag?.moved === true;
    drag = null;
    canvas.style.cursor = 'grab';
    scheduleFull();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('click', (event) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const [x, y] = toLocal(event);
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
