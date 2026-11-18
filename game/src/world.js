// Solmar Bay — DOM-free simulation: city generation, driving and walking,
// traffic and pedestrian AI, police and the wanted level, missions and story,
// combat, particles, save state. Pure logic over a seeded RNG: the same seed
// replays the same city and the same traffic, with no Math.random or Date.now.

import {
  WORLD_W, WORLD_H, STREET_XS, STREET_YS, STREET_W, BLOCK_MARGIN,
  VIEW_W, VIEW_H, DISTRICTS, PLACES, WALK_SPEED, PLAYER_RADIUS,
  PLAYER_HEALTH, HEALTH_REGEN, REGEN_DELAY, CAR_ACCEL, CAR_BRAKE,
  CAR_REVERSE_MAX, CAR_MAX_SPEED, POLICE_MAX_SPEED, CAR_TURN_RATE,
  CAR_RADIUS, TRAFFIC_SPEED, PISTOL_DAMAGE, PISTOL_RANGE, PISTOL_INTERVAL,
  PISTOL_AMMO_START, BULLET_SPEED, MELEE_DAMAGE, MELEE_RANGE, MELEE_INTERVAL,
  ENEMY_HEALTH, ENEMY_BULLET_DAMAGE, ENEMY_BULLET_SPEED, ENEMY_SHOOT_INTERVAL,
  POLICE_HEALTH, MAX_WANTED, WANTED_DECAY_SECONDS, POLICE_SPAWN_DIST,
  POLICE_DESPAWN_DIST, POLICE_RAM_DAMAGE, POLICE_RAM_INTERVAL,
  MISSIONS, TOTAL_REWARD, CAR_COLORS,
} from './config.js';
import { makeRng } from './random.js';

export { TOTAL_REWARD };

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

// Smallest signed difference between two angles, in (-PI, PI].
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

function circleHitsRect(x, y, r, rect) {
  const cx = clamp(x, rect.x, rect.x + rect.w);
  const cy = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

// Push a circle out of every solid it overlaps. Returns true on any hit.
function resolveSolids(state, ent, r) {
  let hit = false;
  for (const s of state.solids) {
    if (!circleHitsRect(ent.x, ent.y, r, s)) continue;
    hit = true;
    const cx = clamp(ent.x, s.x, s.x + s.w);
    const cy = clamp(ent.y, s.y, s.y + s.h);
    let dx = ent.x - cx;
    let dy = ent.y - cy;
    let d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.001) {
      // Centre inside the rect: shove out along the smallest penetration.
      const left = ent.x - s.x;
      const right = s.x + s.w - ent.x;
      const top = ent.y - s.y;
      const bottom = s.y + s.h - ent.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) { ent.x = s.x - r; }
      else if (m === right) { ent.x = s.x + s.w + r; }
      else if (m === top) { ent.y = s.y - r; }
      else { ent.y = s.y + s.h + r; }
    } else {
      dx /= d;
      dy /= d;
      ent.x = cx + dx * r;
      ent.y = cy + dy * r;
    }
  }
  return hit;
}

function nearestNode(x, y) {
  let best = { col: 0, row: 0, d: Infinity };
  for (let c = 0; c < STREET_XS.length; c++) {
    for (let r = 0; r < STREET_YS.length; r++) {
      const d = dist(x, y, STREET_XS[c], STREET_YS[r]);
      if (d < best.d) best = { col: c, row: r, d };
    }
  }
  return best;
}

function nodePos(col, row) {
  return { x: STREET_XS[col], y: STREET_YS[row] };
}

// ---------------------------------------------------------------- city ---

function buildCity(state) {
  const rng = state.rng;
  state.buildings = [];
  state.parks = [];
  state.trees = [];
  state.solids = [];
  // Water: a sea strip down the west edge and along the south edge.
  state.solids.push({ x: -40, y: -40, w: 74, h: WORLD_H + 80, water: true });
  state.solids.push({ x: -40, y: WORLD_H - 34, w: WORLD_W + 80, h: 74, water: true });

  // Pick two park blocks and one port block for variety.
  const parkBlocks = new Set();
  while (parkBlocks.size < 2) {
    parkBlocks.add(rng.int(0, 6) + ',' + rng.int(0, 4));
  }
  for (let c = 0; c < STREET_XS.length - 1; c++) {
    for (let r = 0; r < STREET_YS.length - 1; r++) {
      const x0 = STREET_XS[c] + STREET_W / 2 + BLOCK_MARGIN;
      const x1 = STREET_XS[c + 1] - STREET_W / 2 - BLOCK_MARGIN;
      const y0 = STREET_YS[r] + STREET_W / 2 + BLOCK_MARGIN;
      const y1 = STREET_YS[r + 1] - STREET_W / 2 - BLOCK_MARGIN;
      // The first column is beach: no buildings west of the first street.
      if (c === 0) {
        state.parks.push({ x: x0 - 60, y: y0, w: x1 - x0 + 60, h: y1 - y0, beach: true });
        continue;
      }
      if (parkBlocks.has(c + ',' + r)) {
        state.parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, beach: false });
        const n = rng.int(4, 7);
        for (let i = 0; i < n; i++) {
          state.trees.push({ x: rng.range(x0 + 14, x1 - 14), y: rng.range(y0 + 14, y1 - 14) });
        }
        continue;
      }
      const downtown = c >= 2 && c <= 4 && r >= 1 && r <= 3;
      const port = c <= 2 && r >= 3;
      const bw = (x1 - x0) / 2;
      const bh = (y1 - y0) / 2;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          if (rng.chance(0.12)) continue; // occasional courtyard gap
          const bx = x0 + i * bw + 6;
          const by = y0 + j * bh + 6;
          const b = {
            x: bx,
            y: by,
            w: bw - 12,
            h: bh - 12,
            height: downtown ? rng.int(3, 6) : port ? 1 : rng.int(1, 3),
            downtown,
            warehouse: port && rng.chance(0.5),
          };
          state.buildings.push(b);
          state.solids.push(b);
        }
      }
    }
  }
  // The Harbor Warehouse itself: a big shed beside its street corner.
  const wh = { x: 2130, y: 1230, w: 150, h: 110, height: 1, downtown: false, warehouse: true };
  state.buildings.push(wh);
  state.solids.push(wh);
}

function districtAt(x, y) {
  let best = DISTRICTS[0];
  let bd = Infinity;
  for (const d of DISTRICTS) {
    const dd = dist(x, y, d.x, d.y);
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}

// ------------------------------------------------------------- entities ---

function makeCar(state, x, y, angle, color, kind) {
  return {
    id: state.nextCarId++,
    x, y, angle, speed: 0, color, kind: kind || 'traffic',
    // Traffic AI: the intersection this car is driving toward.
    node: nearestNode(x, y),
    targetNode: null,
    stuckTime: 0,
    reverseTime: 0,
    health: 100,
    smoke: 0,
    stolen: false,
  };
}

function spawnTraffic(state) {
  const rng = state.rng;
  state.cars = [];
  for (let i = 0; i < 11; i++) {
    const col = rng.int(0, STREET_XS.length - 1);
    const row = rng.int(0, STREET_YS.length - 1);
    const horizontal = rng.chance(0.5);
    const angle = horizontal ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(state, STREET_XS[col], STREET_YS[row], angle, rng.pick(CAR_COLORS), 'traffic');
    car.speed = rng.range(90, TRAFFIC_SPEED);
    car.targetNode = pickNextNode(state, car);
    state.cars.push(car);
  }
  // Parked cars along street edges, offset to the side so traffic can pass.
  state.parkedSpots = [
    { x: 450, y: 186, side: 1 }, { x: 750, y: 486, side: -1 },
    { x: 1350, y: 786, side: 1 }, { x: 1650, y: 1086, side: -1 },
    { x: 1950, y: 786, side: 1 }, { x: 750, y: 1386, side: -1 },
    { x: 1350, y: 1686, side: 1 }, { x: 2250, y: 486, side: -1 },
  ];
  for (const spot of state.parkedSpots) {
    const car = makeCar(state, spot.x, spot.y + spot.side * 36, spot.side > 0 ? 0 : Math.PI, rng.pick(CAR_COLORS), 'parked');
    car.parked = true;
    state.cars.push(car);
  }
  // The gold sedan the third mission wants stolen, parked downtown.
  const gold = makeCar(state, PLACES.downtown.x, PLACES.downtown.y + 36, 0, '#d9a521', 'gold');
  gold.id = 'gold';
  gold.parked = true;
  state.cars.push(gold);
  state.goldCar = gold;
}

function pickNextNode(state, car) {
  const rng = state.rng;
  const { col, row } = car.node;
  const options = [];
  if (col > 0) options.push({ col: col - 1, row, w: 1 });
  if (col < STREET_XS.length - 1) options.push({ col: col + 1, row, w: 1 });
  if (row > 0) options.push({ col, row: row - 1, w: 1 });
  if (row < STREET_YS.length - 1) options.push({ col, row: row + 1, w: 1 });
  // Prefer going straight: weight the node ahead of current heading.
  const ahead = { col, row };
  if (Math.abs(Math.cos(car.angle)) > 0.7) ahead.col += Math.cos(car.angle) > 0 ? 1 : -1;
  else ahead.row += Math.sin(car.angle) > 0 ? 1 : -1;
  for (const o of options) {
    if (o.col === ahead.col && o.row === ahead.row) o.w = 4;
  }
  let total = 0;
  for (const o of options) total += o.w;
  let roll = rng.next() * total;
  for (const o of options) {
    roll -= o.w;
    if (roll <= 0) return { col: o.col, row: o.row };
  }
  return options[0];
}

function spawnPeds(state) {
  const rng = state.rng;
  state.peds = [];
  for (let i = 0; i < 14; i++) {
    const col = rng.int(0, STREET_XS.length - 1);
    const row = rng.int(0, STREET_YS.length - 1);
    const p = {
      x: STREET_XS[col] + rng.range(-24, 24),
      y: STREET_YS[row] + rng.range(-24, 24),
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(52, 84),
      target: null,
      fleeX: 0, fleeY: 0, fleeTime: 0,
      color: rng.pick(['#5a7d4a', '#7d5a4a', '#4a6d7d', '#8a7d3a', '#6d4a7d']),
      walkPhase: rng.range(0, Math.PI * 2),
    };
    p.target = pickNextNode(state, { node: { col, row }, angle: 0, rng });
    state.peds.push(p);
  }
}

// -------------------------------------------------------------- create ---

export function createWorld(seed) {
  const state = {
    seed: seed >>> 0,
    rng: makeRng(seed >>> 0),
    time: 0,
    screen: 'title', // title | playing | paused | busted | wasted | victory
    player: {
      x: MISSIONS[0].start.x, y: MISSIONS[0].start.y,
      angle: 0, health: PLAYER_HEALTH, ammo: PISTOL_AMMO_START,
      inCar: false, car: null, lastDamage: -99,
      fireCooldown: 0, meleeCooldown: 0,
    },
    camera: { x: 0, y: 0 },
    cars: [],
    peds: [],
    police: [],
    enemies: [],
    bullets: [],
    particles: [],
    skids: [],
    buildings: [],
    parks: [],
    trees: [],
    solids: [],
    nextCarId: 1,
    goldCar: null,
    parkedSpots: [],
    mission: 0,
    stage: 0,
    enemiesSpawned: false,
    money: 0,
    score: 0,
    kills: 0,
    carsStolen: 0,
    shotsFired: 0,
    maxWanted: 0,
    wanted: 0,
    wantedTimer: 0,
    shake: 0,
    flash: 0,
    events: [],
    message: '',
    messageTime: 0,
    save: null,
  };
  buildCity(state);
  spawnTraffic(state);
  spawnPeds(state);
  updateCamera(state);
  return state;
}

export function missionStartPos(index) {
  return MISSIONS[index] ? { x: MISSIONS[index].start.x, y: MISSIONS[index].start.y } : { x: 450, y: 450 };
}

// The current objective: where the marker points and what the HUD says.
export function getObjective(state) {
  const m = state.mission;
  if (m >= MISSIONS.length) return { x: PLACES.pier.x, y: PLACES.pier.y, label: 'All missions complete', radius: 90 };
  const mission = MISSIONS[m];
  if (m === 0) return { x: PLACES.pier.x, y: PLACES.pier.y, label: mission.objective, radius: 80 };
  if (m === 1) {
    return state.stage === 0
      ? { x: PLACES.port.x, y: PLACES.port.y, label: mission.objective, radius: 80 }
      : { x: PLACES.garage.x, y: PLACES.garage.y, label: mission.objective2, radius: 90 };
  }
  if (m === 2) {
    return state.stage === 0
      ? { x: state.goldCar.x, y: state.goldCar.y, label: mission.objective, radius: 60, car: true }
      : { x: PLACES.garage.x, y: PLACES.garage.y, label: mission.objective2, radius: 90 };
  }
  if (m === 3) return { x: PLACES.safehouse.x, y: PLACES.safehouse.y, label: mission.objective, radius: 90 };
  // Mission 4 (index 4): warehouse crew, then extraction.
  return state.stage === 0
    ? { x: PLACES.warehouse.x, y: PLACES.warehouse.y, label: mission.objective, radius: 110 }
    : { x: PLACES.pier.x, y: PLACES.pier.y, label: mission.objective2, radius: 90 };
}

export function districtNameAt(x, y) {
  return districtAt(x, y).name;
}

// ------------------------------------------------------------- driving ---

function driveCar(state, car, input, dt, maxSpeed) {
  // Steering: right adds angle (clockwise on screen), left subtracts it.
  // Turn authority grows with speed but never vanishes at a crawl, so the
  // car can still swing around a tight intersection corner.
  const speedFrac = clamp(Math.abs(car.speed) / 260, 0.45, 1);
  const turn = CAR_TURN_RATE * speedFrac * dt;
  if (input.left) car.angle -= turn * (car.speed < 0 ? -1 : 1);
  if (input.right) car.angle += turn * (car.speed < 0 ? -1 : 1);
  if (input.up) car.speed += CAR_ACCEL * dt;
  else if (input.down) {
    if (car.speed > 40) car.speed -= CAR_BRAKE * dt;
    else car.speed -= CAR_ACCEL * 0.55 * dt;
  } else {
    car.speed -= car.speed * 1.4 * dt;
  }
  car.speed = clamp(car.speed, -CAR_REVERSE_MAX, maxSpeed);
  if (Math.abs(car.speed) < 4 && !input.up && !input.down) car.speed = 0;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Move axis by axis so the car slides along walls instead of wedging.
  const beforeX = car.x;
  car.x = nx;
  if (resolveSolids(state, car, CAR_RADIUS)) {
    if (Math.abs(car.speed) > 220) {
      state.events.push('crash');
      state.shake = Math.max(state.shake, 7);
      spawnSparks(state, car.x, car.y, 8);
    }
    car.speed *= 0.45;
  }
  car.y = ny;
  if (resolveSolids(state, car, CAR_RADIUS)) {
    if (Math.abs(car.speed) > 220) {
      state.events.push('crash');
      state.shake = Math.max(state.shake, 7);
      spawnSparks(state, car.x, car.y, 8);
    }
    car.speed *= 0.45;
  }
  car.x = clamp(car.x, CAR_RADIUS, WORLD_W - CAR_RADIUS);
  car.y = clamp(car.y, CAR_RADIUS, WORLD_H - CAR_RADIUS);
  void beforeX;
  // Skid marks when turning hard at speed.
  if (Math.abs(car.speed) > 260 && (input.left || input.right)) {
    state.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 5 });
    if (state.skids.length > 220) state.skids.shift();
  }
  if (car.health < 45 && Math.abs(car.speed) > 30) {
    car.smoke += dt;
    if (car.smoke > 0.12) {
      car.smoke = 0;
      state.particles.push({ x: car.x, y: car.y, vx: 0, vy: -30, life: 0.7, max: 0.7, size: 7, color: '#555' });
    }
  }
}

function separateCars(state) {
  const all = state.cars.concat(state.police);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const d = dist(a.x, a.y, b.x, b.y);
      const min = CAR_RADIUS * 2 - 2;
      if (d < min && d > 0.01) {
        const push = (min - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        a.speed *= 0.92;
        b.speed *= 0.92;
      }
    }
  }
}

function stepTraffic(state, dt) {
  for (const car of state.cars) {
    if (state.player.inCar && state.player.car === car) continue;
    if (car.kind === 'parked' || car.kind === 'gold') continue;
    if (!car.targetNode) car.targetNode = pickNextNode(state, car);
    const target = nodePos(car.targetNode.col, car.targetNode.row);
    const d = dist(car.x, car.y, target.x, target.y);
    if (d < 26) {
      car.node = car.targetNode;
      car.targetNode = pickNextNode(state, car);
    }
    const want = Math.atan2(target.y - car.y, target.x - car.x);
    const diff = angleDiff(want, car.angle);
    // Slow down for a car directly ahead.
    let blocked = false;
    for (const other of state.cars) {
      if (other === car) continue;
      const od = dist(car.x, car.y, other.x, other.y);
      if (od < 62) {
        const oa = angleDiff(Math.atan2(other.y - car.y, other.x - car.x), car.angle);
        if (Math.abs(oa) < 0.6) { blocked = true; break; }
      }
    }
    for (const cop of state.police) {
      const od = dist(car.x, car.y, cop.x, cop.y);
      if (od < 62) {
        const oa = angleDiff(Math.atan2(cop.y - car.y, cop.x - car.x), car.angle);
        if (Math.abs(oa) < 0.6) { blocked = true; break; }
      }
    }
    const input = {
      up: !blocked && Math.abs(diff) < 2.4,
      down: blocked,
      left: diff < -0.08,
      right: diff > 0.08,
    };
    driveCar(state, car, input, dt, TRAFFIC_SPEED + 40);
  }
}

function stepPeds(state, dt) {
  for (const p of state.peds) {
    p.walkPhase += dt * 7;
    if (p.fleeTime > 0) {
      p.fleeTime -= dt;
      const a = Math.atan2(p.y - p.fleeY, p.x - p.fleeX);
      p.x += Math.cos(a) * 135 * dt;
      p.y += Math.sin(a) * 135 * dt;
      p.angle = a;
    } else {
      // Flee a speeding car or a nearby gunshot.
      const playerCar = state.player.inCar ? state.player.car : null;
      let threat = null;
      if (playerCar && Math.abs(playerCar.speed) > 120 && dist(p.x, p.y, playerCar.x, playerCar.y) < 110) {
        threat = playerCar;
      }
      if (threat) {
        p.fleeX = threat.x;
        p.fleeY = threat.y;
        p.fleeTime = 1.2;
        continue;
      }
      const target = nodePos(p.target.col, p.target.row);
      const d = dist(p.x, p.y, target.x, target.y);
      if (d < 24) {
        p.target = pickNextNode(state, { node: p.target, angle: p.angle, rng: state.rng });
        continue;
      }
      const a = Math.atan2(target.y - p.y, target.x - p.x);
      p.angle = a;
      p.x += Math.cos(a) * p.speed * dt;
      p.y += Math.sin(a) * p.speed * dt;
    }
    p.x = clamp(p.x, 20, WORLD_W - 20);
    p.y = clamp(p.y, 20, WORLD_H - 20);
    resolveSolids(state, p, 10);
  }
}

// -------------------------------------------------------------- police ---

function setWanted(state, level) {
  state.wanted = clamp(level, 0, MAX_WANTED);
  if (state.wanted > state.maxWanted) state.maxWanted = state.wanted;
  state.wantedTimer = 0;
  syncPolice(state);
}

function syncPolice(state) {
  // Spawn police up to the wanted level, despawn the extras.
  while (state.police.length < state.wanted) {
    const spawn = pickPoliceSpawn(state);
    const cop = makeCar(state, spawn.x, spawn.y, 0, '#2b4fd8', 'police');
    cop.health = POLICE_HEALTH;
    cop.ramCooldown = 0;
    cop.sirenPhase = state.rng.range(0, Math.PI * 2);
    state.police.push(cop);
  }
  while (state.police.length > state.wanted) state.police.pop();
}

function pickPoliceSpawn(state) {
  const rng = state.rng;
  const p = state.player;
  for (let tries = 0; tries < 12; tries++) {
    const col = rng.int(0, STREET_XS.length - 1);
    const row = rng.int(0, STREET_YS.length - 1);
    const x = STREET_XS[col];
    const y = STREET_YS[row];
    const d = dist(x, y, p.x, p.y);
    if (d > POLICE_SPAWN_DIST * 0.8 && d < POLICE_SPAWN_DIST * 1.5) return { x, y };
  }
  const n = nearestNode(p.x + POLICE_SPAWN_DIST, p.y);
  const pos = nodePos(n.col, n.row);
  return pos;
}

function stepPolice(state, dt) {
  const p = state.player;
  const px = p.inCar ? p.car.x : p.x;
  const py = p.inCar ? p.car.y : p.y;
  for (const cop of state.police) {
    cop.ramCooldown = Math.max(0, (cop.ramCooldown || 0) - dt);
    const d = dist(cop.x, cop.y, px, py);
    const want = Math.atan2(py - cop.y, px - cop.x);
    const diff = angleDiff(want, cop.angle);
    // Stuck recovery: wedged on a building while chasing — reverse out.
    if (Math.abs(cop.speed) < 28) cop.stuckTime += dt;
    else cop.stuckTime = 0;
    if (cop.stuckTime > 1.2) {
      cop.reverseTime = 1.0;
      cop.stuckTime = 0;
    }
    let input;
    if (cop.reverseTime > 0) {
      cop.reverseTime -= dt;
      input = { up: false, down: true, left: diff > 0.08, right: diff < -0.08 };
    } else {
      input = {
        up: Math.abs(diff) < 2.6,
        down: false,
        left: diff < -0.08,
        right: diff > 0.08,
      };
    }
    driveCar(state, cop, input, dt, POLICE_MAX_SPEED);
    // Ram the player: damage on contact, with a cooldown. Ramming a car
    // mostly shoves it; ramming a person on foot hurts a lot more.
    if (d < CAR_RADIUS + PLAYER_RADIUS + 12 && cop.ramCooldown <= 0) {
      cop.ramCooldown = p.inCar ? 1.5 : POLICE_RAM_INTERVAL;
      damagePlayer(state, p.inCar ? 2 : POLICE_RAM_DAMAGE);
      state.events.push('crash');
      state.shake = Math.max(state.shake, 6);
      if (p.inCar && p.car) {
        p.car.speed *= 0.7;
        cop.speed *= 0.55;
      } else {
        // Shove the player away from the ram.
        const a = Math.atan2(p.y - cop.y, p.x - cop.x);
        p.x += Math.cos(a) * 26;
        p.y += Math.sin(a) * 26;
        resolveSolids(state, p, PLAYER_RADIUS);
      }
    }
  }
  // Despawn cops that fell far behind once the heat is off.
  if (state.wanted === 0) {
    state.police = state.police.filter((cop) => dist(cop.x, cop.y, px, py) < POLICE_DESPAWN_DIST);
  }
  // Wanted decays when no cop can see the player up close.
  let near = false;
  for (const cop of state.police) {
    if (dist(cop.x, cop.y, px, py) < 520) { near = true; break; }
  }
  if (!near && state.wanted > 0) {
    state.wantedTimer += dt;
    if (state.wantedTimer >= WANTED_DECAY_SECONDS) {
      state.wantedTimer = 0;
      setWanted(state, state.wanted - 1);
    }
  } else {
    state.wantedTimer = 0;
  }
}

// -------------------------------------------------------------- combat ---

function damagePlayer(state, amount) {
  const p = state.player;
  p.health -= amount;
  p.lastDamage = state.time;
  state.events.push('hurt');
  if (p.health <= 0) {
    p.health = 0;
    state.screen = state.wanted > 0 ? 'busted' : 'wasted';
    state.events.push('busted');
  }
}

function spawnSparks(state, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = state.rng.range(0, Math.PI * 2);
    const sp = state.rng.range(60, 220);
    state.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.4, max: 0.4, size: 3, color: '#ffd23e',
    });
  }
}

function playerShoot(state, input) {
  const p = state.player;
  if (p.inCar || p.fireCooldown > 0 || p.ammo <= 0) return;
  p.fireCooldown = PISTOL_INTERVAL;
  p.ammo -= 1;
  state.shotsFired += 1;
  state.events.push('shot');
  const aim = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  state.bullets.push({
    x: p.x + Math.cos(aim) * 20,
    y: p.y + Math.sin(aim) * 20,
    vx: Math.cos(aim) * BULLET_SPEED,
    vy: Math.sin(aim) * BULLET_SPEED,
    life: PISTOL_RANGE / BULLET_SPEED,
    damage: PISTOL_DAMAGE,
    friendly: true,
  });
  state.flash = 0.06;
  state.shake = Math.max(state.shake, 2);
}

function playerMelee(state, input) {
  const p = state.player;
  if (p.inCar || p.meleeCooldown > 0) return;
  p.meleeCooldown = MELEE_INTERVAL;
  state.events.push('punch');
  const aim = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  const hit = (e) => {
    const d = dist(p.x, p.y, e.x, e.y);
    if (d > MELEE_RANGE + 14) return false;
    return Math.abs(angleDiff(Math.atan2(e.y - p.y, e.x - p.x), aim)) < 1.2;
  };
  for (const e of state.enemies) {
    if (hit(e)) {
      e.health -= MELEE_DAMAGE;
      spawnSparks(state, e.x, e.y, 6);
      if (e.health <= 0) killEnemy(state, e);
    }
  }
  for (const cop of state.police) {
    if (hit(cop)) {
      cop.health -= MELEE_DAMAGE;
      spawnSparks(state, cop.x, cop.y, 6);
      if (cop.health <= 0) killPolice(state, cop);
    }
  }
}

function killEnemy(state, e) {
  e.dead = true;
  state.kills += 1;
  state.score += 100;
  spawnSparks(state, e.x, e.y, 14);
}

function killPolice(state, cop) {
  cop.dead = true;
  state.kills += 1;
  state.score += 100;
  spawnSparks(state, cop.x, cop.y, 14);
  setWanted(state, state.wanted + 1);
}

function stepEnemies(state, dt) {
  const p = state.player;
  const px = p.inCar ? p.car.x : p.x;
  const py = p.inCar ? p.car.y : p.y;
  for (const e of state.enemies) {
    if (e.dead) continue;
    e.shootCooldown = Math.max(0, (e.shootCooldown || 0) - dt);
    const d = dist(e.x, e.y, px, py);
    const home = dist(e.x, e.y, PLACES.warehouse.x, PLACES.warehouse.y);
    if (d < 430 && home < 560) {
      const a = Math.atan2(py - e.y, px - e.x);
      e.angle = a;
      if (d > 250) {
        e.x += Math.cos(a) * 95 * dt;
        e.y += Math.sin(a) * 95 * dt;
        resolveSolids(state, e, 12);
      }
      if (d < 420 && e.shootCooldown <= 0 && !p.inCar) {
        e.shootCooldown = ENEMY_SHOOT_INTERVAL;
        const spread = state.rng.range(-0.32, 0.32);
        const ba = a + spread;
        state.bullets.push({
          x: e.x + Math.cos(ba) * 18, y: e.y + Math.sin(ba) * 18,
          vx: Math.cos(ba) * ENEMY_BULLET_SPEED, vy: Math.sin(ba) * ENEMY_BULLET_SPEED,
          life: 1.6, damage: ENEMY_BULLET_DAMAGE, friendly: false,
        });
        state.events.push('shot');
      }
    }
  }
  state.enemies = state.enemies.filter((e) => !e.dead);
}

function stepBullets(state, dt) {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    // Buildings stop bullets.
    let blocked = false;
    for (const s of state.solids) {
      if (b.x >= s.x && b.x <= s.x + s.w && b.y >= s.y && b.y <= s.y + s.h) { blocked = true; break; }
    }
    if (blocked) {
      b.life = 0;
      spawnSparks(state, b.x, b.y, 4);
      continue;
    }
    if (b.friendly) {
      for (const e of state.enemies) {
        if (!e.dead && dist(b.x, b.y, e.x, e.y) < 16) {
          e.health -= b.damage;
          b.life = 0;
          spawnSparks(state, b.x, b.y, 6);
          if (e.health <= 0) killEnemy(state, e);
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const cop of state.police) {
        if (!cop.dead && dist(b.x, b.y, cop.x, cop.y) < 18) {
          cop.health -= b.damage;
          b.life = 0;
          spawnSparks(state, b.x, b.y, 6);
          if (cop.health <= 0) killPolice(state, cop);
          break;
        }
      }
    } else {
      const p = state.player;
      if (!p.inCar && dist(b.x, b.y, p.x, p.y) < PLAYER_RADIUS + 4) {
        damagePlayer(state, b.damage);
        b.life = 0;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  state.police = state.police.filter((c) => !c.dead);
}

// ------------------------------------------------------------ missions ---

function showMessage(state, text, seconds) {
  state.message = text;
  state.messageTime = seconds || 3;
}

function completeMission(state) {
  const mission = MISSIONS[state.mission];
  state.money += mission.reward;
  state.score += mission.reward;
  state.events.push('sting');
  showMessage(state, mission.name + ' complete  +$' + mission.reward, 3.5);
  state.mission += 1;
  state.stage = 0;
  state.enemiesSpawned = false;
  state.enemies = [];
  state.player.ammo += 24;
  // Checkpoint for save / restart.
  state.save = saveGame(state);
  if (state.mission >= MISSIONS.length) {
    state.screen = 'victory';
    state.events.push('victory');
  }
}

function checkMissions(state) {
  const m = state.mission;
  if (m >= MISSIONS.length) return;
  const p = state.player;
  const px = p.inCar ? p.car.x : p.x;
  const py = p.inCar ? p.car.y : p.y;
  const obj = getObjective(state);
  if (m === 2 && state.stage === 0) {
    // Stealing the gold sedan is handled in tryEnterCar.
    return;
  }
  if (m === 4 && state.stage === 0) {
    // Spawn the warehouse crew before checking them down: an empty list
    // must never read as "crew cleared".
    if (!state.enemiesSpawned && dist(px, py, PLACES.warehouse.x, PLACES.warehouse.y) < 520) {
      state.enemiesSpawned = true;
      const rng = state.rng;
      const spots = [
        { x: PLACES.warehouse.x - 90, y: PLACES.warehouse.y - 40 },
        { x: PLACES.warehouse.x + 40, y: PLACES.warehouse.y - 70 },
        { x: PLACES.warehouse.x - 40, y: PLACES.warehouse.y + 60 },
        { x: PLACES.warehouse.x + 90, y: PLACES.warehouse.y + 30 },
      ];
      for (const s of spots) {
        state.enemies.push({
          x: s.x + rng.range(-16, 16), y: s.y + rng.range(-16, 16),
          angle: 0, health: ENEMY_HEALTH, shootCooldown: rng.range(0.4, 1.2), dead: false,
        });
      }
      showMessage(state, 'Warehouse crew ahead — take them down!', 3.5);
    }
    if (state.enemiesSpawned && state.enemies.length === 0) {
      state.stage = 1;
      state.events.push('sting');
      showMessage(state, 'Crew cleared — get to the pier extraction!', 3.5);
    }
    return;
  }
  if (m === 2 && state.stage === 1) {
    // Must arrive in the gold sedan itself.
    if (p.inCar && p.car && p.car.id === 'gold' && dist(px, py, obj.x, obj.y) < obj.radius) {
      completeMission(state);
    }
    return;
  }
  if (dist(px, py, obj.x, obj.y) < obj.radius) {
    if (m === 1 && state.stage === 0) {
      state.stage = 1;
      state.events.push('pickup');
      showMessage(state, 'Package secured — deliver it to the garage', 3);
      return;
    }
    if (m === 3) {
      setWanted(state, 0);
      completeMission(state);
      return;
    }
    completeMission(state);
  }
}

// -------------------------------------------------------------- player ---

function nearestCar(state, x, y, maxD) {
  let best = null;
  let bd = maxD;
  for (const car of state.cars) {
    const d = dist(x, y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function tryEnterCar(state) {
  const p = state.player;
  if (p.inCar) {
    // Exit: step out beside the car, keep the car parked where it stops.
    const car = p.car;
    car.speed = 0;
    // A car that was parked before the player took it goes back to being
    // a parked car (traffic never drives it); a traffic car stays traffic.
    if (car.parked) car.kind = car.id === 'gold' ? 'gold' : 'parked';
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    resolveSolids(state, p, PLAYER_RADIUS);
    p.inCar = false;
    p.car = null;
    p.angle = car.angle;
    return;
  }
  // Mission target car takes priority: when the gold sedan is the job, E
  // always means the gold sedan while it is in reach, never a bystander
  // car parked closer by chance.
  let car = null;
  if (state.mission === 2 && state.stage === 0) {
    const gd = dist(p.x, p.y, state.goldCar.x, state.goldCar.y);
    if (gd < 52) car = state.goldCar;
  }
  if (!car) car = nearestCar(state, p.x, p.y, 52);
  if (!car) return;
  p.inCar = true;
  p.car = car;
  if (car.kind !== 'gold') car.kind = 'player';
  p.x = car.x;
  p.y = car.y;
  // Stealing a car raises the heat — but only the first time per car.
  if (!car.stolen) {
    car.stolen = true;
    state.carsStolen += 1;
    setWanted(state, state.wanted + 1);
    state.events.push('pickup');
  }
  if (car.id === 'gold' && state.mission === 2 && state.stage === 0) {
    state.stage = 1;
    setWanted(state, 2);
    state.events.push('sting');
    showMessage(state, 'Gold sedan taken — bring it to the garage', 3.5);
  }
}

function stepPlayer(state, input, dt) {
  const p = state.player;
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.meleeCooldown = Math.max(0, p.meleeCooldown - dt);
  if (p.inCar && p.car) {
    driveCar(state, p.car, input, dt, CAR_MAX_SPEED);
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    // Bumping pedestrians at speed scares them off; no gore, just a flee.
    for (const ped of state.peds) {
      if (dist(ped.x, ped.y, p.x, p.y) < 46 && Math.abs(p.car.speed) > 60) {
        ped.fleeX = p.x;
        ped.fleeY = p.y;
        ped.fleeTime = 1.6;
      }
    }
  } else {
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.sqrt(mx * mx + my * my);
    if (len > 0) {
      mx /= len;
      my /= len;
      p.x += mx * WALK_SPEED * dt;
      resolveSolids(state, p, PLAYER_RADIUS);
      p.y += my * WALK_SPEED * dt;
      resolveSolids(state, p, PLAYER_RADIUS);
      p.angle = Math.atan2(my, mx);
    }
    p.x = clamp(p.x, PLAYER_RADIUS, WORLD_W - PLAYER_RADIUS);
    p.y = clamp(p.y, PLAYER_RADIUS, WORLD_H - PLAYER_RADIUS);
    p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  }
  if (input.enter) tryEnterCar(state);
  if (input.shoot || input.mouseDown) playerShoot(state, input);
  if (input.melee) playerMelee(state, input);
  // Health regen after a quiet stretch.
  if (state.time - p.lastDamage > REGEN_DELAY && p.health > 0 && p.health < PLAYER_HEALTH) {
    p.health = Math.min(PLAYER_HEALTH, p.health + HEALTH_REGEN * dt);
  }
}

function stepParticles(state, dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += 40 * dt;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  for (const s of state.skids) s.life -= dt;
  state.skids = state.skids.filter((s) => s.life > 0);
  state.shake = Math.max(0, state.shake - dt * 22);
  state.flash = Math.max(0, state.flash - dt);
  if (state.messageTime > 0) state.messageTime -= dt;
}

function updateCamera(state) {
  const p = state.player;
  const tx = clamp(p.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
  const ty = clamp(p.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  // Ease toward the player so the view never jumps.
  state.camera.x += (tx - state.camera.x) * 0.14;
  state.camera.y += (ty - state.camera.y) * 0.14;
  state.camera.x = clamp(state.camera.x, 0, WORLD_W - VIEW_W);
  state.camera.y = clamp(state.camera.y, 0, WORLD_H - VIEW_H);
}

// ---------------------------------------------------------------- step ---

export function stepWorld(state, input, dt) {
  state.events = [];
  state.time += dt;
  if (state.screen !== 'playing') return;
  stepPlayer(state, input, dt);
  stepTraffic(state, dt);
  stepPeds(state, dt);
  stepPolice(state, dt);
  stepEnemies(state, dt);
  stepBullets(state, dt);
  separateCars(state);
  checkMissions(state);
  stepParticles(state, dt);
  updateCamera(state);
}

// --------------------------------------------------------------- save ----

export function saveGame(state) {
  return {
    seed: state.seed,
    mission: state.mission,
    stage: state.stage,
    money: state.money,
    score: state.score,
    kills: state.kills,
    carsStolen: state.carsStolen,
    ammo: state.player.ammo,
    health: state.player.health,
    wanted: state.wanted,
  };
}

export function applySave(state, save) {
  state.mission = save.mission;
  state.stage = save.stage;
  state.money = save.money;
  state.score = save.score;
  state.kills = save.kills;
  state.carsStolen = save.carsStolen;
  state.player.ammo = save.ammo;
  state.player.health = save.health;
  state.wanted = 0;
  state.police = [];
  state.enemies = [];
  state.enemiesSpawned = false;
  const start = missionStartPos(save.mission);
  state.player.x = start.x;
  state.player.y = start.y;
  state.player.inCar = false;
  state.player.car = null;
  state.camera.x = clamp(start.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
  state.camera.y = clamp(start.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
}

export function restartMission(state) {
  const save = state.save || {
    seed: state.seed, mission: 0, stage: 0, money: 0, score: 0,
    kills: 0, carsStolen: 0, ammo: PISTOL_AMMO_START, health: PLAYER_HEALTH, wanted: 0,
  };
  const fresh = createWorld(state.seed);
  fresh.screen = 'playing';
  // Keep the money/score earned up to the checkpoint, not the failed run.
  applySave(fresh, save);
  // Carry the checkpoint over so a second failure restarts the same way.
  fresh.save = save;
  return fresh;
}

// Small deterministic snapshot for tests: same seed twice must match.
export function keyState(state) {
  const r = (v) => Math.round(v * 100) / 100;
  return {
    x: r(state.player.x),
    y: r(state.player.y),
    mission: state.mission,
    stage: state.stage,
    money: state.money,
    score: state.score,
    kills: state.kills,
    stolen: state.carsStolen,
    wanted: state.wanted,
    maxWanted: state.maxWanted,
    screen: state.screen,
    traffic0: state.cars.length ? { x: r(state.cars[0].x), y: r(state.cars[0].y) } : null,
    police: state.police.length,
    enemies: state.enemies.length,
  };
}
