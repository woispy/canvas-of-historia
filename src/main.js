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
import { createTileStore, visibleTileKeys, useOutline, levelFor, LEVEL_DEG, createDrawThrottle, selectLod } from './map/layers/coastline.js';
import { extractSnapshot } from './map/rendering/snapshot.js';
import { buildDisplayList } from './map/rendering/displayList.js';
import { renderCanvas2D } from './map/rendering/canvas2d/backend.js';
import { pickMarker, pickProvince, unproject } from './map/selection/pick.js';
import { tileRangeForView } from './map/tiles.js';
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

  // Direct render: no offscreen, no blits. Progressive stride (see draw)
  // keeps gestures fast; release sharpens.
  let frameEma = 0;
  let lastPts = 0;
  const perfOn = typeof location !== 'undefined' && location.search.includes('perf=1');
  const perfEl = perfOn ? (() => { const d = document.createElement('div'); d.id = 'perf'; document.body.appendChild(d); return d; })() : null;

  let lastFetchError = '';
  // Pyramid: z0 world outline, z1 8° tiles, z2 4° tiles. Manifests gate ocean.
  const manifests = {};
  for (const [level, url] of [[1, '/tiles/coast1/manifest.json'], [2, '/tiles/coast/manifest.json']]) {
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (m?.tiles) {
          manifests[level] = new Set(Object.keys(m.tiles));
          stores[level].knownTiles = manifests[level];
          scheduleDraw();
        }
      })
      .catch(() => {});
  }
  const fetchTile = async (url) => {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (err) {
      lastFetchError = `${url.split('/').pop()}: ${err?.message ?? err}`;
      return null;
    }
  };
  const onTile = () => {
    throttledTileDraw();
  };
  const stores = {
    1: createTileStore(fetchTile, onTile, null, (key) => `/tiles/coast1/${key}.json`),
    2: createTileStore(fetchTile, onTile, null, (key) => `/tiles/coast/${key}.json`),
  };
  let outline = null;
  // Shown level freezes during gestures (hysteresis); settle recomputes.
  let shownLevel = levelFor(camera.scale);
  let gesturing = false;
  const draw = (s) => {
    const t0 = performance.now();
    // Pyramid level by zoom with hysteresis; parent level underneath while
    // children stream in (never an empty hole).
    const level = gesturing ? shownLevel : selectLod(camera.scale, shownLevel);
    if (!gesturing) shownLevel = level;
    let tiles;
    if (level === 0) {
      if (!outline) {
        outline = { pending: true };
        fetch('/data/world-outline.json')
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            outline = data && Array.isArray(data.lines) ? { lines: data.lines } : { lines: [] };
            scheduleDraw();
          })
          .catch(() => {
            outline = { lines: [] };
          });
        tiles = [];
      } else if (outline.lines) {
        tiles = [{ key: 'world', lines: outline.lines }];
      } else {
        tiles = [];
      }
    } else {
      const keys = visibleTileKeys(camera, width, height, LEVEL_DEG[level]);
      tiles = stores[level].ensure(keys);
      // Parent underlay: same viewport at the coarser level (stale but
      // present — never an empty hole while children stream in).
      let parent = [];
      if (level > 1) {
        parent = stores[level - 1].ensure(visibleTileKeys(camera, width, height, LEVEL_DEG[level - 1]));
      }
      tiles.parentTiles = parent;
    }
    const cmds = buildDisplayList(extractSnapshot(s), camera, width, height, tiles, { gesturing, emaMs: frameEma, parentTiles: tiles.parentTiles ?? [] });
    renderCanvas2D(ctx, width, height, cmds);
    const dt = performance.now() - t0;
    frameEma = frameEma === 0 ? dt : frameEma * 0.9 + dt * 0.1;
    lastPts = cmds.reduce((n, c) => n + (c.batches ? c.batches.reduce((m, b) => m + b.length, 0) : 0), 0);
    if (perfEl) {
      perfEl.textContent = `${frameEma.toFixed(1)}ms ${Math.round(lastPts / 1000)}kpts L${levelFor(camera.scale)}${gesturing ? ' gesto' : ''} t${stores[1].size() + stores[2].size()}${lastFetchError ? ' FETCH:' + lastFetchError : ''}`;
    }
  };
  // One rAF coalescer: every frame at most one draw, always the latest state.
  // Gesture progressiveness lives in draw (stride), not in approximations.
  // (gesturing flag declared above, TDZ-safe ordering.)
  let queued = false;
  function scheduleDraw() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      try {
        draw(current);
      } catch (err) {
        const hud = document.getElementById('hud');
        if (hud) hud.innerHTML = `<strong>draw error</strong><span>${String(err?.message ?? err)}</span>`;
        throw err;
      }
    });
  }
  // Tile arrivals use the trailing throttle (background, never urgent).
  const throttledTileDraw = createDrawThrottle(300, () => performance.now(), scheduleDraw);
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
      scheduleDraw();
      renderHud();
    });
    const zoomCenter = (factor) => {
      camera = zoomAt(camera, width, height, width / 2, height / 2, factor);
      scheduleDraw();
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

  // Gesture state helpers (flag declared above for TDZ safety).
  let gestureTimer = null;
  const beginGesture = () => {
    gesturing = true;
    if (gestureTimer) {
      clearTimeout(gestureTimer);
      gestureTimer = null;
    }
  };
  const endGesture = () => {
    if (gestureTimer) clearTimeout(gestureTimer);
    gestureTimer = setTimeout(() => {
      gesturing = false;
      prefetchNeighbors();
      scheduleDraw();
    }, 90);
  };
  // Warm the tile ring around the viewport so pans reveal loaded tiles.
  const prefetchNeighbors = () => {
    const level = levelFor(camera.scale);
    if (level === 0) return;
    const pad = 0.5;
    const [ax, ay] = unproject(camera, width, height, [-width * pad, -height * pad]);
    const [bx, by] = unproject(camera, width, height, [width * (1 + pad), height * (1 + pad)]);
    stores[level].ensure(
      tileRangeForView(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), LEVEL_DEG[level]),
    );
  };
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const [x, y] = toLocal(event);
      camera = zoomAt(camera, width, height, x, y, event.deltaY < 0 ? 1.25 : 1 / 1.25);
      beginGesture();
      scheduleDraw();
      endGesture();
    },
    { passive: false },
  );

  // Drag pans synchronously (no blit tricks). A click without drag still
  // selects (< 4px).
  let drag = null;
  let suppressClick = false;
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
      scheduleDraw();
    }
  });
  const endDrag = () => {
    suppressClick = drag?.moved === true;
    drag = null;
    canvas.style.cursor = 'grab';
    endGesture();
    scheduleDraw();
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
