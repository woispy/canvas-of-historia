// Canvas2D backend: executes display-list commands with the 2.5D style.
// Layout math lives in displayList.js — this file only paints.

import { STYLE_25D_V1 as S } from '../style.js';

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
      case 'coastline': {
        for (const band of S.sea.bands) {
          ctx.strokeStyle = band.color;
          ctx.lineWidth = band.width;
          ctx.lineJoin = 'round';
          tracePolyline(ctx, cmd.points);
          ctx.stroke();
        }
        ctx.save();
        ctx.shadowColor = S.coastline.glow;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = S.coastline.color;
        ctx.lineWidth = S.coastline.width;
        ctx.lineJoin = 'round';
        tracePolyline(ctx, cmd.points);
        ctx.stroke();
        ctx.restore();
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
