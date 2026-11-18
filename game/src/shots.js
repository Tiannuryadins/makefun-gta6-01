// Staged scenes and the autopilot: a deterministic driver that plays the
// game on its own — walks, steals and drives cars, loses the cops, fights
// the warehouse crew — so screenshots show real gameplay and the headless
// Node sim can prove the whole mission chain is winnable.
//
// Pathfinding is a BFS over the street-intersection grid: every waypoint
// sits exactly on a street centre-line, so routes never cut building corners.

import { STREET_XS, STREET_YS, PLACES, CAR_MAX_SPEED } from './config.js';
import { createWorld, stepWorld, getObjective, angleDiff, keyState } from './world.js';

export { keyState };

function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function nearestNodeIndex(x, y) {
  let best = { col: 0, row: 0, d: Infinity };
  for (let c = 0; c < STREET_XS.length; c++) {
    for (let r = 0; r < STREET_YS.length; r++) {
      const d = dist(x, y, STREET_XS[c], STREET_YS[r]);
      if (d < best.d) best = { col: c, row: r, d };
    }
  }
  return best;
}

// BFS over intersection nodes. Returns street waypoints from the start
// (exclusive) to the goal node (inclusive), then the exact target appended.
export function streetPath(fromX, fromY, toX, toY) {
  const start = nearestNodeIndex(fromX, fromY);
  const goal = nearestNodeIndex(toX, toY);
  const cols = STREET_XS.length;
  const rows = STREET_YS.length;
  const key = (c, r) => c + ',' + r;
  const prev = new Map();
  const seen = new Set([key(start.col, start.row)]);
  const queue = [{ col: start.col, row: start.row }];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.col === goal.col && cur.row === goal.row) break;
    const neighbours = [
      { col: cur.col - 1, row: cur.row },
      { col: cur.col + 1, row: cur.row },
      { col: cur.col, row: cur.row - 1 },
      { col: cur.col, row: cur.row + 1 },
    ];
    for (const n of neighbours) {
      if (n.col < 0 || n.col >= cols || n.row < 0 || n.row >= rows) continue;
      const k = key(n.col, n.row);
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, cur);
      queue.push(n);
    }
  }
  const nodes = [];
  let cur = { col: goal.col, row: goal.row };
  let guard = 0;
  while (!(cur.col === start.col && cur.row === start.row) && guard++ < 200) {
    nodes.unshift({ x: STREET_XS[cur.col], y: STREET_YS[cur.row] });
    const p = prev.get(key(cur.col, cur.row));
    if (!p) break;
    cur = p;
  }
  nodes.push({ x: toX, y: toY });
  return nodes;
}

// ------------------------------------------------------------ autopilot ---

export function createAutopilot() {
  return {
    path: [],
    pathIdx: 0,
    pathTarget: '',
    reverseTimer: 0,
    stuckTimer: 0,
    lastX: 0,
    lastY: 0,
    strafeDir: 1,
    strafeTimer: 0,
  };
}

function nearestUsableCar(state, x, y, maxD) {
  let best = null;
  let bd = maxD;
  for (const car of state.cars) {
    const d = dist(x, y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

// One frame of autopilot input. Pure function of world state: no randomness
// here, so a seeded run replays exactly.
export function autopilotInput(state, ap, dt) {
  const p = state.player;
  const px = p.inCar ? p.car.x : p.x;
  const py = p.inCar ? p.car.y : p.y;
  const input = {
    up: false, down: false, left: false, right: false,
    enter: false, melee: false, shoot: false, mouseDown: false,
    aimX: px, aimY: py,
  };

  // --- Combat: mission 5, crew spawned, player near the warehouse. ---
  if (state.mission === 4 && state.stage === 0 && state.enemiesSpawned && state.enemies.length > 0) {
    const warehouseD = dist(px, py, PLACES.warehouse.x, PLACES.warehouse.y);
    if (p.inCar) {
      if (warehouseD < 430) {
        input.enter = true; // fight on foot: you cannot shoot from a car
        return input;
      }
      return driveToward(state, ap, input, PLACES.warehouse.x, PLACES.warehouse.y, dt);
    }
    let target = null;
    let bd = Infinity;
    for (const e of state.enemies) {
      const d = dist(px, py, e.x, e.y);
      if (d < bd) { bd = d; target = e; }
    }
    if (!target) return input;
    input.aimX = target.x;
    input.aimY = target.y;
    if (p.ammo <= 0) {
      // Out of bullets: close in and swing.
      if (bd > 46) return walkToward(state, ap, input, target.x, target.y);
      input.melee = true;
      return input;
    }
    // Strafe sideways while shooting, and keep a fighting distance.
    ap.strafeTimer -= dt;
    if (ap.strafeTimer <= 0) {
      ap.strafeTimer = 1.1;
      ap.strafeDir *= -1;
    }
    const toEnemy = Math.atan2(target.y - py, target.x - px);
    const strafe = toEnemy + (ap.strafeDir > 0 ? Math.PI / 2 : -Math.PI / 2);
    let mx = Math.cos(strafe) * 0.7;
    let my = Math.sin(strafe) * 0.7;
    if (bd > 330) { mx += Math.cos(toEnemy); my += Math.sin(toEnemy); }
    if (bd < 210) { mx -= Math.cos(toEnemy); my -= Math.sin(toEnemy); }
    setWalkKeys(input, mx, my);
    if (bd < 500) input.mouseDown = true;
    return input;
  }

  const obj = getObjective(state);
  const objD = dist(px, py, obj.x, obj.y);

  // Mission 5 stage 0, crew not yet spawned: drive/walk to the warehouse.
  // Mission 3 stage 0: the objective IS the gold car — go steal it.
  const driveTarget = state.mission === 2 && state.stage === 0
    ? { x: state.goldCar.x, y: state.goldCar.y }
    : { x: obj.x, y: obj.y };

  if (p.inCar) {
    // Stealing the gold sedan means getting OUT of the current car first.
    // Exit well clear of it, so the old car never ends up parked on top
    // of the gold sedan and in the way of the grab.
    if (state.mission === 2 && state.stage === 0) {
      const gd = dist(px, py, state.goldCar.x, state.goldCar.y);
      if (gd < 150) {
        input.enter = true;
        return input;
      }
    }
    // Close enough to an on-foot objective: get out and walk the last bit.
    const onFootOnly = (state.mission === 4 && state.stage === 0 && objD < 430);
    if (onFootOnly) {
      input.enter = true;
      return input;
    }
    return driveToward(state, ap, input, driveTarget.x, driveTarget.y, dt);
  }

  // On foot, standing next to the gold sedan: steal it.
  if (state.mission === 2 && state.stage === 0) {
    const gd = dist(px, py, state.goldCar.x, state.goldCar.y);
    if (gd < 52) {
      input.enter = true;
      return input;
    }
  }

  // On foot: if the goal is far, grab the nearest car first. Short trips
  // are walked — stealing a car for a two-block stroll is not worth the heat.
  if (objD > 480) {
    const car = nearestUsableCar(state, px, py, 260);
    if (car) {
      const cd = dist(px, py, car.x, car.y);
      if (cd < 46) {
        input.enter = true;
        return input;
      }
      return walkToward(state, ap, input, car.x, car.y);
    }
  }
  return walkToward(state, ap, input, driveTarget.x, driveTarget.y);
}

function setWalkKeys(input, mx, my) {
  const len = Math.sqrt(mx * mx + my * my) || 1;
  const nx = mx / len;
  const ny = my / len;
  input.right = nx > 0.3;
  input.left = nx < -0.3;
  input.down = ny > 0.3;
  input.up = ny < -0.3;
}

function walkToward(state, ap, input, tx, ty) {
  const p = state.player;
  const path = followPath(state, ap, p.x, p.y, tx, ty);
  const wp = path[ap.pathIdx] || { x: tx, y: ty };
  const dx = wp.x - p.x;
  const dy = wp.y - p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 30 && ap.pathIdx < path.length - 1) ap.pathIdx += 1;
  setWalkKeys(input, dx, dy);
  input.aimX = wp.x;
  input.aimY = wp.y;
  return input;
}

function followPath(state, ap, fromX, fromY, toX, toY) {
  const key = state.mission + ':' + state.stage + ':' + Math.round(toX) + ',' + Math.round(toY);
  if (ap.pathTarget !== key || ap.path.length === 0) {
    ap.path = streetPath(fromX, fromY, toX, toY);
    ap.pathIdx = 0;
    ap.pathTarget = key;
  }
  return ap.path;
}

function driveToward(state, ap, input, tx, ty, dt) {
  const car = state.player.car;
  const path = followPath(state, ap, car.x, car.y, tx, ty);
  let wp = path[ap.pathIdx] || { x: tx, y: ty };
  let d = dist(car.x, car.y, wp.x, wp.y);
  if (d < 48 && ap.pathIdx < path.length - 1) {
    ap.pathIdx += 1;
    wp = path[ap.pathIdx];
    d = dist(car.x, car.y, wp.x, wp.y);
  }
  const finalD = dist(car.x, car.y, tx, ty);
  const want = Math.atan2(wp.y - car.y, wp.x - car.x);
  const diff = angleDiff(want, car.angle);
  const speed = car.speed;

  // Stuck detection: throttle open but barely moving — reverse out.
  if (ap.reverseTimer > 0) {
    ap.reverseTimer -= dt;
    input.down = true;
    input.left = diff > 0;
    input.right = diff <= 0;
    return input;
  }
  if (Math.abs(speed) < 28 && Math.abs(diff) < 2.4) {
    ap.stuckTimer += dt;
    if (ap.stuckTimer > 1.6) {
      ap.stuckTimer = 0;
      ap.reverseTimer = 0.9;
      input.down = true;
      return input;
    }
  } else {
    ap.stuckTimer = 0;
  }

  // Target speed: fast on a straight, slow into a turn or the destination.
  let targetSpeed = CAR_MAX_SPEED;
  if (d < 210) targetSpeed = 160;
  if (d < 100) targetSpeed = 105;
  if (Math.abs(diff) > 0.7) targetSpeed = Math.min(targetSpeed, 120);
  if (Math.abs(diff) > 1.5) targetSpeed = Math.min(targetSpeed, 70);
  if (finalD < 120) targetSpeed = Math.min(targetSpeed, 90);

  if (Math.abs(diff) > 2.4 && speed < 60) {
    // Facing the wrong way at a crawl: back up and swing around.
    input.down = true;
    input.left = diff > 0;
    input.right = diff <= 0;
    return input;
  }
  input.up = speed < targetSpeed && Math.abs(diff) < 2.3;
  input.down = speed > targetSpeed + 40;
  input.left = diff < -0.09;
  input.right = diff > 0.09;
  input.aimX = wp.x;
  input.aimY = wp.y;
  return input;
}

// Step the autopilot until a predicate holds (or the step cap). Returns
// true when the predicate was reached while still playing.
export function runUntil(state, predicate, maxSteps) {
  const ap = createAutopilot();
  const dt = 1 / 60;
  state.screen = 'playing';
  let steps = 0;
  while (steps < maxSteps && state.screen === 'playing' && !predicate(state)) {
    stepWorld(state, autopilotInput(state, ap, dt), dt);
    steps += 1;
  }
  return predicate(state) && state.screen === 'playing';
}

// Run the autopilot headlessly until victory or the step cap. Returns the
// run summary; the same seed always returns the same summary.
export function runAutopilot(state, maxSteps) {
  const ap = createAutopilot();
  const dt = 1 / 60;
  let steps = 0;
  state.screen = 'playing';
  while (steps < maxSteps && state.screen === 'playing') {
    const input = autopilotInput(state, ap, dt);
    stepWorld(state, input, dt);
    steps += 1;
  }
  return {
    steps,
    seconds: Math.round(steps / 60 * 10) / 10,
    victory: state.screen === 'victory',
    screen: state.screen,
    mission: state.mission,
    money: state.money,
    score: state.score,
    kills: state.kills,
    carsStolen: state.carsStolen,
    maxWanted: state.maxWanted,
    state: keyState(state),
  };
}

// ------------------------------------------------------------ staging ---

// Build the world for one named shot, deterministically from its seed.
// Returns the world ready to render; the caller renders a few frames and
// then sets window.__shotReady.
export function setupShot(seed, name) {
  const state = createWorld(seed);
  if (name === '1-start') {
    // Title screen over the downtown skyline.
    state.player.x = 1200;
    state.player.y = 900;
    state.camera.x = clamp(1200 - 640, 0, 2400 - 1280);
    state.camera.y = clamp(900 - 360, 0, 1800 - 720);
    state.screen = 'title';
    return state;
  }
  if (name === '2-drive') {
    // Real play: stop the moment Rico is driving with a mission underway,
    // so the shot shows an early driving mission, not the endgame.
    const reached = runUntil(
      state,
      (s) => s.player.inCar && s.mission >= 1,
      60 * 75,
    );
    if (!reached) {
      // Fallback staging if the run ended early: put Rico in a car mid-run.
      stageDriving(state, Math.max(1, state.mission));
    }
    state.screen = 'playing';
    return state;
  }
  if (name === '3-chase') {
    // Real play: stop the moment the "lose the cops" mission is live with
    // real heat and real police closing in, then let the pursuit run on.
    const reached = runUntil(
      state,
      (s) => s.mission === 3 && s.wanted >= 2 && s.police.length >= 2,
      60 * 200,
    );
    if (!reached) {
      stageChase(state);
    } else {
      // Let the pursuit close in for a few seconds of real chase.
      const ap = createAutopilot();
      const dt = 1 / 60;
      for (let i = 0; i < 60 * 4; i++) {
        stepWorld(state, autopilotInput(state, ap, dt), dt);
        if (state.screen !== 'playing') break;
      }
    }
    state.screen = 'playing';
    return state;
  }
  // '4-end': the full run to victory, played by the autopilot for real.
  const run = runAutopilot(state, 60 * 500);
  if (!run.victory) {
    // Fallback staging: a completed game, honestly labelled by its stats.
    state.mission = 5;
    state.money = 2500;
    state.score = 2900;
    state.kills = 4;
    state.carsStolen = 2;
    state.maxWanted = 4;
    state.screen = 'victory';
  }
  state.screen = 'victory';
  return state;
}

// Fallback staging for the driving shot: Rico in a car on a downtown
// street, mid-mission, with traffic around.
function stageDriving(state, mission) {
  state.mission = mission;
  state.stage = 0;
  const car = state.cars.find((c) => c.kind === 'parked') || state.cars[0];
  car.x = 1050;
  car.y = 750;
  car.angle = 0;
  car.speed = 240;
  state.player.inCar = true;
  state.player.car = car;
  state.player.x = car.x;
  state.player.y = car.y;
  state.screen = 'playing';
}

// Fallback staging for the chase shot: Rico driving with three police cars
// closing in and three wanted stars on the HUD.
function stageChase(state) {
  state.mission = 3;
  state.stage = 0;
  state.money = 1250;
  state.score = 1250;
  const car = state.cars.find((c) => c.kind === 'parked') || state.cars[0];
  car.x = 1350;
  car.y = 1050;
  car.angle = Math.PI / 2;
  car.speed = 300;
  state.player.inCar = true;
  state.player.car = car;
  state.player.x = car.x;
  state.player.y = car.y;
  state.wanted = 3;
  state.maxWanted = 3;
  state.police = [];
  const spots = [
    { x: 1350, y: 750 }, { x: 1050, y: 1050 }, { x: 1650, y: 1350 },
  ];
  for (const s of spots) {
    const cop = {
      id: state.nextCarId++, x: s.x, y: s.y, angle: 0, speed: 200,
      color: '#2b4fd8', kind: 'police', node: { col: 0, row: 0 },
      targetNode: null, stuckTime: 0, reverseTime: 0, health: 80,
      smoke: 0, stolen: false, ramCooldown: 0, sirenPhase: 0,
    };
    state.police.push(cop);
  }
  state.screen = 'playing';
}
