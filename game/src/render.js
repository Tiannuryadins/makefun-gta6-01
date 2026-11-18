// Canvas renderer for Solmar Bay: the city, its cars and people, effects,
// the HUD with its minimap, and every menu screen. Everything is drawn
// procedurally — no images, no external assets. The scene stays bright:
// a light sunset wash over warm ground, never a dark overlay.

import {
  WORLD_W, WORLD_H, STREET_XS, STREET_YS, STREET_W, VIEW_W, VIEW_H,
  DISTRICTS, PLACES, PLAYER_RADIUS, CAR_RADIUS, PALETTE,
} from './config.js';
import { getObjective, districtNameAt } from './world.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, x, y, angle, color, isPolice, isGold) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  roundRect(ctx, -19, -11, 40, 24, 6);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, -20, -12, 40, 24, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(200, 225, 240, 0.9)';
  roundRect(ctx, -6, -10, 12, 20, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(30, 30, 40, 0.85)';
  roundRect(ctx, 8, -10, 6, 20, 2);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#fff6b0';
  ctx.fillRect(18, -9, 3, 4);
  ctx.fillRect(18, 5, 3, 4);
  if (isPolice) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
    ctx.fillStyle = '#ff2e2e';
    ctx.fillRect(-14, -12, 6, 4);
    ctx.fillStyle = '#2e7bff';
    ctx.fillRect(-14, 8, 6, 4);
  }
  if (isGold) {
    ctx.strokeStyle = '#fff3c4';
    ctx.lineWidth = 1.5;
    roundRect(ctx, -20, -12, 40, 24, 6);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCity(ctx, state) {
  // Sea along the west and south edges, sand beside it.
  ctx.fillStyle = PALETTE.seaDeep;
  ctx.fillRect(0, 0, 34, WORLD_H);
  ctx.fillRect(0, WORLD_H - 34, WORLD_W, 34);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(30, 0, 12, WORLD_H);
  ctx.fillRect(0, WORLD_H - 38, WORLD_W, 6);
  // Animated wave lines, driven by the deterministic sim clock.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const wy = 120 + i * 210 + Math.sin(state.time * 1.4 + i) * 6;
    ctx.beginPath();
    ctx.moveTo(6, wy);
    ctx.lineTo(30, wy + 14);
    ctx.stroke();
  }
  // Ground: district tints.
  ctx.fillStyle = '#e2d5b0';
  ctx.fillRect(34, 0, WORLD_W - 34, WORLD_H - 34);
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 560, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Beach sand.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(34, 0, 116, WORLD_H - 34);
  ctx.fillRect(34, WORLD_H - 150, WORLD_W - 34, 116);
  // Parks.
  for (const park of state.parks) {
    ctx.fillStyle = park.beach ? PALETTE.sand : PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }
  // Trees.
  for (const t of state.trees) {
    ctx.fillStyle = '#2f6b2f';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a8f3a';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Streets.
  ctx.fillStyle = PALETTE.road;
  for (const x of STREET_XS) ctx.fillRect(x - STREET_W / 2, 0, STREET_W, WORLD_H);
  for (const y of STREET_YS) ctx.fillRect(0, y - STREET_W / 2, WORLD_W, STREET_W);
  // Sidewalks.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const x of STREET_XS) {
    ctx.fillRect(x - STREET_W / 2 - 8, 0, 8, WORLD_H);
    ctx.fillRect(x + STREET_W / 2, 0, 8, WORLD_H);
  }
  for (const y of STREET_YS) {
    ctx.fillRect(0, y - STREET_W / 2 - 8, WORLD_W, 8);
    ctx.fillRect(0, y + STREET_W / 2, WORLD_W, 8);
  }
  // Lane dashes.
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (const x of STREET_XS) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD_H);
    ctx.stroke();
  }
  for (const y of STREET_YS) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_W, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(240, 235, 220, 0.85)';
  for (const x of STREET_XS) {
    for (const y of STREET_YS) {
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(x + i * 12 - 4, y - STREET_W / 2 - 6, 8, 10);
        ctx.fillRect(x + i * 12 - 4, y + STREET_W / 2 - 4, 8, 10);
      }
    }
  }
  // Buildings with a shaded roof edge for height.
  for (const b of state.buildings) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(b.x + 4, b.y + 4, b.w, b.h);
    ctx.fillStyle = b.warehouse ? PALETTE.warehouse : b.downtown ? PALETTE.downtown : PALETTE.building;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = PALETTE.buildingRoof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    if (b.height > 2) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 6);
    }
    // Windows.
    ctx.fillStyle = 'rgba(60, 80, 110, 0.55)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 10 + i * 26, b.y + 10 + j * 26, 12, 9);
      }
    }
  }
  // Landmarks: the pier jutting into the sea, the port cranes, the garage.
  ctx.fillStyle = '#8a6f52';
  ctx.fillRect(34, PLACES.pier.y - 26, 92, 52);
  ctx.fillStyle = '#a8875f';
  ctx.fillRect(40, PLACES.pier.y - 20, 80, 40);
  ctx.strokeStyle = '#5a4630';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(52 + i * 16, PLACES.pier.y - 26);
    ctx.lineTo(52 + i * 16, PLACES.pier.y + 26);
    ctx.stroke();
  }
  ctx.fillStyle = '#c65a3a';
  ctx.fillRect(PLACES.port.x - 70, PLACES.port.y + 60, 140, 40);
  ctx.fillStyle = '#e8b23a';
  ctx.fillRect(PLACES.port.x - 60, PLACES.port.y + 40, 10, 60);
  ctx.fillRect(PLACES.port.x + 50, PLACES.port.y + 40, 10, 60);
  // District name labels.
  ctx.fillStyle = 'rgba(40, 35, 25, 0.5)';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  for (const d of DISTRICTS) ctx.fillText(d.name.toUpperCase(), d.x, d.y);
}

function drawSkids(ctx, state) {
  ctx.strokeStyle = 'rgba(20, 16, 12, 0.4)';
  ctx.lineWidth = 4;
  for (const s of state.skids) {
    ctx.globalAlpha = Math.min(1, s.life / 2);
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 14, s.y - Math.sin(s.angle) * 14);
    ctx.lineTo(s.x + Math.cos(s.angle) * 14, s.y + Math.sin(s.angle) * 14);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawCars(ctx, state) {
  for (const car of state.cars) {
    if (state.player.inCar && state.player.car === car) continue;
    drawCarShape(ctx, car.x, car.y, car.angle, car.color, false, car.id === 'gold');
  }
  for (const cop of state.police) {
    drawCarShape(ctx, cop.x, cop.y, cop.angle, '#2b4fd8', true, false);
  }
}

function drawPedestrians(ctx, state) {
  for (const p of state.peds) {
    const bob = Math.sin(p.walkPhase) * 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 8, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c9a0';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 8 + bob, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.inCar && p.car) {
    drawCarShape(ctx, p.car.x, p.car.y, p.car.angle, '#e8452c', false, p.car.id === 'gold');
    return;
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 9, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rico Vega: red jacket, dark jeans.
  ctx.fillStyle = '#e8452c';
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 2, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 4, 6, Math.PI, Math.PI * 2);
  ctx.fill();
  // Aim direction tick.
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.angle) * 12, p.y + Math.sin(p.angle) * 12);
  ctx.lineTo(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22);
  ctx.stroke();
}

function drawEnemies(ctx, state) {
  for (const e of state.enemies) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + 9, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a2e8f';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(e.x, e.y - 2, 6, 0, Math.PI * 2);
    ctx.fill();
    // Health bar.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(e.x - 16, e.y - 26, 32, 5);
    ctx.fillStyle = '#e8452c';
    ctx.fillRect(e.x - 16, e.y - 26, 32 * Math.max(0, e.health / 60), 5);
  }
}

function drawBullets(ctx, state) {
  for (const b of state.bullets) {
    ctx.strokeStyle = b.friendly ? '#ffe066' : '#ff7a5c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(ctx, state) {
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (state.flash > 0) {
    ctx.fillStyle = 'rgba(255, 240, 180, ' + (state.flash * 2.4) + ')';
    ctx.fillRect(state.camera.x, state.camera.y, VIEW_W, VIEW_H);
  }
}

function drawObjectiveMarker(ctx, state) {
  const obj = getObjective(state);
  if (state.mission >= 5) return;
  const pulse = 1 + Math.sin(state.time * 4) * 0.15;
  const r = 26 * pulse;
  ctx.strokeStyle = PALETTE.marker;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 210, 62, 0.25)';
  ctx.beginPath();
  ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2);
  ctx.fill();
  // A beacon column so the marker reads from far away.
  ctx.fillStyle = 'rgba(255, 210, 62, 0.16)';
  ctx.fillRect(obj.x - 5, obj.y - 160, 10, 160);
  // Off-screen arrow at the viewport edge pointing at the objective.
  const p = state.player;
  const dx = obj.x - p.x;
  const dy = obj.y - p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 420) {
    const a = Math.atan2(dy, dx);
    const ex = p.x + Math.cos(a) * 300;
    const ey = p.y + Math.sin(a) * 300;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawHud(ctx, state) {
  const p = state.player;
  const obj = getObjective(state);
  ctx.fillStyle = PALETTE.hudBg;
  roundRect(ctx, 12, 12, 300, 156, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('$' + state.money.toLocaleString('en-US'), 26, 44);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#c9c2ae';
  ctx.fillText('SCORE ' + state.score.toLocaleString('en-US'), 26, 66);
  ctx.fillText(districtNameAt(p.x, p.y), 26, 88);
  // Health bar.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  roundRect(ctx, 26, 116, 180, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.health > 35 ? '#5ec95e' : '#e8452c';
  roundRect(ctx, 26, 116, 180 * Math.max(0, p.health / 100), 12, 6);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '12px sans-serif';
  ctx.fillText('HEALTH ' + Math.ceil(p.health), 214, 126);
  // Ammo.
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(p.inCar ? 'DRIVING' : 'PISTOL  ' + p.ammo, 26, 150);
  // Wanted stars, top right, on their own dark pill so they read on sand.
  ctx.fillStyle = PALETTE.hudBg;
  roundRect(ctx, VIEW_W - 268, 12, 256, 60, 10);
  ctx.fill();
  const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = state.wanted > 0 ? PALETTE.star : PALETTE.starEmpty;
  ctx.fillText(stars, VIEW_W - 24, 44);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText(state.wanted > 0 ? 'WANTED — lose the cops!' : 'No heat', VIEW_W - 24, 64);
  // Mission banner, top centre.
  const label = state.mission >= 5 ? 'SOLMAR BAY IS YOURS' : 'MISSION ' + (state.mission + 1) + '/5 — ' + obj.label;
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = PALETTE.hudBg;
  roundRect(ctx, VIEW_W / 2 - tw / 2 - 14, 12, tw + 28, 34, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd23e';
  ctx.fillText(label, VIEW_W / 2, 35);
  // Distance to objective, on its own dark pill under the banner.
  const d = Math.round(Math.sqrt((obj.x - p.x) ** 2 + (obj.y - p.y) ** 2));
  if (state.mission < 5) {
    const dText = '◈ ' + d + ' m';
    ctx.font = '13px sans-serif';
    const dw = ctx.measureText(dText).width;
    ctx.fillStyle = PALETTE.hudBg;
    roundRect(ctx, VIEW_W / 2 - dw / 2 - 10, 50, dw + 20, 24, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.textAlign = 'center';
    ctx.fillText(dText, VIEW_W / 2, 67);
  }
  // Speed and controls hint, bottom left, on one dark pill.
  const hint = 'WASD move/drive · E enter car · Click shoot · F melee · P pause · M mute';
  ctx.font = '12px sans-serif';
  const hw = ctx.measureText(hint).width;
  ctx.fillStyle = PALETTE.hudBg;
  roundRect(ctx, 12, VIEW_H - 92, Math.max(hw, 190) + 24, 80, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(245, 239, 224, 0.9)';
  ctx.textAlign = 'left';
  ctx.fillText(hint, 24, VIEW_H - 52);
  if (p.inCar && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = PALETTE.hudText;
    ctx.fillText(kmh + ' km/h', 24, VIEW_H - 20);
  }
  // Transient message.
  if (state.messageTime > 0) {
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(12, 18, 28, 0.8)';
    const mw = ctx.measureText(state.message).width;
    roundRect(ctx, VIEW_W / 2 - mw / 2 - 12, 84, mw + 24, 32, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(state.message, VIEW_W / 2, 106);
  }
}

function drawMinimap(ctx, state) {
  const mw = 216;
  const mh = 162;
  const mx = VIEW_W - mw - 14;
  const my = VIEW_H - mh - 14;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(12, 18, 28, 0.78)';
  roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#3f6d8f';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#c9b98a';
  ctx.fillRect(mx, my, mw, mh);
  // Streets.
  ctx.strokeStyle = '#6f6a60';
  ctx.lineWidth = 5;
  for (const x of STREET_XS) {
    ctx.beginPath();
    ctx.moveTo(mx + x * sx, my);
    ctx.lineTo(mx + x * sx, my + mh);
    ctx.stroke();
  }
  for (const y of STREET_YS) {
    ctx.beginPath();
    ctx.moveTo(mx, my + y * sy);
    ctx.lineTo(mx + mw, my + y * sy);
    ctx.stroke();
  }
  // Buildings as dots.
  ctx.fillStyle = 'rgba(90, 70, 50, 0.7)';
  for (const b of state.buildings) ctx.fillRect(mx + b.x * sx, my + b.y * sy, 3, 3);
  // Objective marker.
  const obj = getObjective(state);
  if (state.mission < 5) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(mx + obj.x * sx, my + obj.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Traffic cars, police, player.
  ctx.fillStyle = '#4a7fb5';
  for (const car of state.cars) {
    ctx.fillRect(mx + car.x * sx - 1, my + car.y * sy - 1, 3, 3);
  }
  ctx.fillStyle = '#2b4fd8';
  for (const cop of state.police) {
    ctx.beginPath();
    ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = state.player;
  ctx.fillStyle = '#e8452c';
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Viewport rectangle, from the same clamped camera the world uses.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(mx + state.camera.x * sx, my + state.camera.y * sy, VIEW_W * sx, VIEW_H * sy);
  ctx.restore();
  // Label inside the minimap, on a dark pill so it reads over the streets.
  ctx.fillStyle = 'rgba(12, 18, 28, 0.8)';
  roundRect(ctx, mx + 4, my + 4, 82, 16, 5);
  ctx.fill();
  ctx.fillStyle = '#f5efe0';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR BAY', mx + 9, my + 16);
}

function overlayPanel(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(10, 14, 22, 0.62)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(16, 22, 34, 0.92)';
  roundRect(ctx, VIEW_W / 2 - 330, 120, 660, 440, 16);
  ctx.fill();
  ctx.strokeStyle = accent || '#ffd23e';
  ctx.lineWidth = 3;
  roundRect(ctx, VIEW_W / 2 - 330, 120, 660, 440, 16);
  ctx.stroke();
  ctx.fillStyle = accent || '#ffd23e';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW_W / 2, 190);
  ctx.fillStyle = '#f5efe0';
  ctx.font = '17px sans-serif';
  let y = 232;
  for (const line of lines) {
    ctx.fillText(line, VIEW_W / 2, y);
    y += 27;
  }
  return y;
}

function drawTitleScreen(ctx, state) {
  overlayPanel(ctx, 'SOLMAR BAY', [
    'An open-world crime story on the sun-soaked coast.',
    '',
    'Rico Vega owes fixer Mara a debt. Five jobs stand between',
    'him and freedom — if the Solmar Bay police let him finish them.',
    'WASD — walk / drive      E — steal & enter cars',
    'Mouse — aim      Click — shoot      F — melee',
    'P — pause      M — mute      R — restart mission',
    '',
    state.bestScore > 0 ? 'BEST SCORE  ' + state.bestScore.toLocaleString('en-US') : 'No saved game yet — good luck out there.',
    '',
    state.hasSave ? 'Press ENTER to CONTINUE your saved game' : 'Press ENTER to START',
  ]);
}

function drawPauseScreen(ctx, state) {
  const y = overlayPanel(ctx, 'PAUSED', [
    'Mission ' + (state.mission + 1) + ' of 5 — ' + (state.mission < 5 ? state.mission + 1 : 'done'),
    'Money $' + state.money.toLocaleString('en-US') + '   Score ' + state.score.toLocaleString('en-US'),
    '',
    'P or Esc — resume      R — restart this mission',
    'M — mute sound',
  ], '#9ecfff');
  ctx.fillStyle = '#f5efe0';
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Progress saves automatically at every mission.', VIEW_W / 2, y + 10);
}

function drawEndScreen(ctx, state, busted) {
  const y = overlayPanel(ctx, busted ? 'BUSTED!' : 'WASTED!', [
    busted ? 'The Solmar Bay police caught up with Rico.' : 'Rico went down in the streets of Solmar Bay.',
    '',
    'Mission ' + (state.mission + 1) + ' of 5   ·   Money $' + state.money.toLocaleString('en-US'),
    '',
    'Press R to restart the mission, or ENTER for the title screen.',
  ], '#e8452c');
  void y;
}

function drawVictoryScreen(ctx, state) {
  const y = overlayPanel(ctx, 'SOLMAR BAY IS YOURS', [
    'All five jobs done. Mara is paid, the crew is scattered,',
    'and Rico Vega drives off into the sunset a free man.',
    '',
    'MONEY EARNED   $' + state.money.toLocaleString('en-US'),
    'FINAL SCORE   ' + state.score.toLocaleString('en-US'),
    'CREW DOWN   ' + state.kills + '      CARS STOLEN   ' + state.carsStolen,
    'TOP WANTED LEVEL   ' + '★'.repeat(Math.max(1, state.maxWanted)),
    'TIME   ' + Math.floor(state.time / 60) + ':' + String(Math.floor(state.time % 60)).padStart(2, '0'),
    '',
    'Press ENTER to play again.',
  ]);
  void y;
}

// --------------------------------------------------------------- main ----

export function renderGame(ctx, state, canvasW, canvasH) {
  const scale = canvasW / VIEW_W;
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.save();
  ctx.scale(scale, scale);
  const shX = state.shake > 0 ? Math.sin(state.time * 91) * state.shake * 0.4 : 0;
  const shY = state.shake > 0 ? Math.cos(state.time * 83) * state.shake * 0.4 : 0;
  ctx.save();
  ctx.translate(-state.camera.x + shX, -state.camera.y + shY);
  drawCity(ctx, state);
  drawSkids(ctx, state);
  drawCars(ctx, state);
  drawPedestrians(ctx, state);
  drawPlayer(ctx, state);
  drawEnemies(ctx, state);
  drawBullets(ctx, state);
  drawParticles(ctx, state);
  drawObjectiveMarker(ctx, state);
  ctx.restore();
  // A light sunset wash: warm, but thin enough that the city stays readable.
  ctx.fillStyle = 'rgba(255, 176, 92, 0.05)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(255, 214, 140, 0.04)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (state.screen === 'playing' || state.screen === 'paused') {
    drawHud(ctx, state);
    drawMinimap(ctx, state);
  }
  if (state.screen === 'title') drawTitleScreen(ctx, state);
  if (state.screen === 'paused') drawPauseScreen(ctx, state);
  if (state.screen === 'busted') drawEndScreen(ctx, state, true);
  if (state.screen === 'wasted') drawEndScreen(ctx, state, false);
  if (state.screen === 'victory') drawVictoryScreen(ctx, state);
  ctx.restore();
}
