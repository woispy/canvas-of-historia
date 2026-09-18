// Canvas2D backend: executes display-list commands with the 2.5D style.
// Layout math lives in displayList.js — this file only paints.

import { STYLE_25D_V1 as S } from '../style.js';

// Elevation ramp stops: [meters, r, g, b]. Sea cells stay transparent
// (the tint is clipped to land polygons anyway; this avoids edge bleed).
const TERRAIN_RAMP = [
  [0, 122, 142, 96],
  [300, 148, 150, 110],
  [900, 172, 160, 128],
  [1800, 196, 182, 158],
  [2800, 224, 220, 206],
  [4000, 242, 243, 238],
];

function rampColor(elev) {
  for (let i = 1; i < TERRAIN_RAMP.length; i++) {
    if (elev <= TERRAIN_RAMP[i][0]) {
      const [e0, ...c0] = TERRAIN_RAMP[i - 1];
      const [e1, ...c1] = TERRAIN_RAMP[i];
      const t = (elev - e0) / (e1 - e0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + (c1[k] - c0[k]) * t));
    }
  }
  return TERRAIN_RAMP[TERRAIN_RAMP.length - 1].slice(1);
}

function paintTerrainTint(ctx, cmd) {
  const g = cmd.grid;
  const off = document.createElement('canvas');
  off.width = g.cols;
  off.height = g.rows;
  const octx = off.getContext('2d');
  const img = octx.createImageData(g.cols, g.rows);
  const cellLon = (g.bounds.east - g.bounds.west) / g.cols;
  const cellLat = (g.bounds.north - g.bounds.south) / g.rows;
  const at = (col, row) => {
    const c = Math.max(0, Math.min(g.cols - 1, col));
    const r = Math.max(0, Math.min(g.rows - 1, row));
    return g.values[r * g.cols + c];
  };
  for (let row = 0; row < g.rows; row++) {
    const lat = g.bounds.north - ((row + 0.5) / g.rows) * (g.bounds.north - g.bounds.south);
    const mx = 111320 * Math.cos((lat * Math.PI) / 180) * cellLon;
    const my = 110540 * cellLat;
    for (let col = 0; col < g.cols; col++) {
      const i = (row * g.cols + col) * 4;
      const e = at(col, row);
      if (e < 0) {
        img.data[i + 3] = 0;
        continue;
      }
      const dzdx = (at(col + 1, row) - at(col - 1, row)) / (2 * mx);
      const dzdy = (at(col, row + 1) - at(col, row - 1)) / (2 * my);
      const shade = Math.max(0, Math.min(1, (-dzdx * -0.5 + -dzdy * -0.5 + 0.707) / 1.414));
      const light = 0.55 + 0.45 * shade;
      const [r, gg, b] = rampColor(e);
      img.data[i] = Math.min(255, r * light);
      img.data[i + 1] = Math.min(255, gg * light);
      img.data[i + 2] = Math.min(255, b * light);
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  ctx.save();
  ctx.beginPath();
  for (const ring of cmd.landRings) {
    ctx.moveTo(ring[0][0], ring[0][1]);
    for (let k = 1; k < ring.length; k++) ctx.lineTo(ring[k][0], ring[k][1]);
    ctx.closePath();
  }
  ctx.clip('evenodd');
  ctx.globalAlpha = 0.55;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, cmd.x, cmd.y, cmd.w, cmd.h);
  ctx.restore();
}

function tracePath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function tracePolyline(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
}

export function renderCanvas2D(ctx, width, height, commands) {
  for (const cmd of commands) {
    switch (cmd.type) {
      case 'sea': {
        const g = ctx.createLinearGradient(0, 0, 0, height);
        g.addColorStop(0, S.sea.deep);
        g.addColorStop(1, S.sea.shallow);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
        break;
      }
      case 'coast-bands': {
        // Painted before land: the fill covers the land-side half, so the
        // shallow effect survives only seaward.
        for (const band of S.sea.bands) {
          ctx.strokeStyle = band.color;
          ctx.lineWidth = band.width;
          ctx.lineJoin = 'round';
          tracePolyline(ctx, cmd.points);
          ctx.stroke();
        }
        break;
      }
      case 'coastline': {
        // Crisp stroke on top of everything coastal. No glow: at HD zoom the
        // glow read as blur, not depth.
        ctx.strokeStyle = S.coastline.color;
        ctx.lineWidth = S.coastline.width;
        ctx.lineJoin = 'round';
        tracePolyline(ctx, cmd.points);
        ctx.stroke();
        break;
      }
      case 'land-fill': {
        ctx.save();
        ctx.shadowColor = S.land.shadow;
        ctx.shadowBlur = S.land.shadowBlur;
        ctx.shadowOffsetY = S.land.shadowOffsetY;
        const g = ctx.createLinearGradient(0, 0, width * 0.3, height);
        g.addColorStop(0, S.land.highlight);
        g.addColorStop(1, S.land.base);
        ctx.fillStyle = g;
        ctx.beginPath();
        for (const ring of cmd.rings) {
          ctx.moveTo(ring[0][0], ring[0][1]);
          for (let i = 1; i < ring.length; i++) ctx.lineTo(ring[i][0], ring[i][1]);
          ctx.closePath();
        }
        ctx.fill('evenodd');
        ctx.restore();
        break;
      }
      case 'terrain-tint': {
        paintTerrainTint(ctx, cmd);
        break;
      }
      case 'lake-fill': {
        ctx.fillStyle = S.lake.fill;
        ctx.beginPath();
        for (const ring of cmd.rings) {
          ctx.moveTo(ring[0][0], ring[0][1]);
          for (let i = 1; i < ring.length; i++) ctx.lineTo(ring[i][0], ring[i][1]);
          ctx.closePath();
        }
        ctx.fill('evenodd');
        ctx.strokeStyle = S.lake.edge;
        ctx.lineWidth = S.lake.edgeWidth;
        ctx.stroke();
        break;
      }
      case 'river': {
        ctx.strokeStyle = S.river.color;
        ctx.lineWidth = S.river.width;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        tracePolyline(ctx, cmd.points);
        ctx.stroke();
        break;
      }
      case 'province-fill': {
        // Political wash over terrain: translucent, no shadow (land owns depth).
        ctx.save();
        ctx.globalAlpha = S.provinceWashAlpha;
        ctx.fillStyle = cmd.color;
        tracePath(ctx, cmd.ring);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'province-border': {
        ctx.strokeStyle = S.border.outer;
        ctx.lineWidth = S.border.outerWidth;
        ctx.lineJoin = 'round';
        tracePath(ctx, cmd.ring);
        ctx.stroke();
        ctx.strokeStyle = S.border.inner;
        ctx.lineWidth = S.border.innerWidth;
        tracePath(ctx, cmd.ring);
        ctx.stroke();
        break;
      }
      case 'marker': {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = cmd.tier === 'capital' ? S.marker.capital : S.marker.city;
        ctx.beginPath();
        ctx.arc(cmd.at[0], cmd.at[1], S.marker.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#2b3438';
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText(cmd.name, cmd.at[0] + 7, cmd.at[1] + 4);
        break;
      }
      default:
        break;
    }
  }
}
