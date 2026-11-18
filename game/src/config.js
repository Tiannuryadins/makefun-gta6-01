// Solmar Bay — tuning numbers and palette.
// A sun-soaked coastal city: bright ground, wide streets, warm sunset light
// that never darkens the scene below readability.

export const WORLD_W = 2400;
export const WORLD_H = 1800;

// Street grid: vertical streets at these x, horizontal at these y.
// Street centre-lines are exactly on these coordinates; buildings keep a
// 46 px margin off every street edge.
export const STREET_XS = [150, 450, 750, 1050, 1350, 1650, 1950, 2250];
export const STREET_YS = [150, 450, 750, 1050, 1350, 1650];
export const STREET_W = 72;
export const BLOCK_MARGIN = 46;

export const VIEW_W = 1280;
export const VIEW_H = 720;

// Districts, west to east, north to south. Each block belongs to the
// district whose centre is nearest; the renderer tints ground per district.
export const DISTRICTS = [
  { name: 'Marina Pier', x: 120, y: 450, ground: '#e8d9a8', road: '#8d8578' },
  { name: 'Old Port', x: 300, y: 1500, ground: '#d9c9a3', road: '#8d8578' },
  { name: 'North Hills', x: 1200, y: 120, ground: '#cfe0b8', road: '#7e7a6e' },
  { name: 'Downtown', x: 1200, y: 900, ground: '#ddd3bd', road: '#7e7a6e' },
  { name: 'Palm Suburbs', x: 2100, y: 600, ground: '#e6ddc0', road: '#8d8578' },
  { name: 'Sunset Beach', x: 600, y: 1680, ground: '#eed9a4', road: '#8d8578' },
];

// Key places. Every mission target sits on a street centre-line or on open
// beach, never inside a building block, so walking and driving can reach it.
export const PLACES = {
  pier: { x: 120, y: 450, label: 'Marina Pier' },
  port: { x: 450, y: 1650, label: 'Old Port Docks' },
  garage: { x: 1950, y: 450, label: "Mara's Garage" },
  downtown: { x: 1050, y: 750, label: 'Downtown' },
  warehouse: { x: 2250, y: 1350, label: 'Harbor Warehouse' },
  safehouse: { x: 150, y: 1650, label: 'Beach Safehouse' },
};

// Player on foot.
export const WALK_SPEED = 230;
export const PLAYER_RADIUS = 13;
export const PLAYER_HEALTH = 100;
export const HEALTH_REGEN = 5; // per second, after 4 s without damage
export const REGEN_DELAY = 4;

// Driving. Angles are measured with x = cos, y = sin, so a positive angle
// turns clockwise on screen (y points down). Turning right adds angle;
// turning left subtracts it.
export const CAR_ACCEL = 430;
export const CAR_BRAKE = 760;
export const CAR_REVERSE_MAX = 170;
export const CAR_MAX_SPEED = 530;
export const POLICE_MAX_SPEED = 565;
export const CAR_TURN_RATE = 2.7; // rad/s at full speed factor
export const CAR_RADIUS = 16;
export const TRAFFIC_SPEED = 150;

// Combat.
export const PISTOL_DAMAGE = 30;
export const PISTOL_RANGE = 540;
export const PISTOL_INTERVAL = 0.26;
export const PISTOL_AMMO_START = 48;
export const BULLET_SPEED = 660;
export const MELEE_DAMAGE = 40;
export const MELEE_RANGE = 52;
export const MELEE_INTERVAL = 0.42;
export const ENEMY_HEALTH = 60;
export const ENEMY_BULLET_DAMAGE = 5;
export const ENEMY_BULLET_SPEED = 380;
export const ENEMY_SHOOT_INTERVAL = 1.45;
export const POLICE_HEALTH = 80;

// Wanted level and police.
export const MAX_WANTED = 5;
export const WANTED_DECAY_SECONDS = 9; // -1 star when no cop within 520 px
export const POLICE_SPAWN_DIST = 520;
export const POLICE_DESPAWN_DIST = 980;
export const POLICE_RAM_DAMAGE = 7;
export const POLICE_RAM_INTERVAL = 0.8;

// Missions: name, objective lines, rewards. Money is the score backbone.
export const MISSIONS = [
  {
    name: 'The Pier Meet',
    objective: 'Meet Mara\u2019s contact at Marina Pier',
    reward: 250,
    start: { x: 450, y: 450 },
  },
  {
    name: 'Dockside Run',
    objective: 'Pick up the package at the Old Port docks',
    objective2: 'Deliver the package to Mara\u2019s Garage',
    reward: 450,
    start: { x: 450, y: 450 },
  },
  {
    name: 'Gold Standard',
    objective: 'Steal the gold sedan in Downtown',
    objective2: 'Bring the gold sedan to Mara\u2019s Garage',
    reward: 550,
    start: { x: 1050, y: 1050 },
  },
  {
    name: 'Cooling Off',
    objective: 'Lose the cops \u2014 reach the Beach Safehouse',
    reward: 350,
    start: { x: 1950, y: 450 },
  },
  {
    name: 'Warehouse Reckoning',
    objective: 'Clear the crew at the Harbor Warehouse',
    objective2: 'Reach the extraction point at Marina Pier',
    reward: 900,
    start: { x: 150, y: 1650 },
  },
];

export const TOTAL_REWARD = MISSIONS.reduce((s, m) => s + m.reward, 0);

// Palette for canvas drawing.
export const PALETTE = {
  sea: '#3f9ec4',
  seaDeep: '#2f7ea6',
  sand: '#ecd9a0',
  grass: '#a8c98a',
  park: '#93bd7d',
  road: '#6f6a60',
  roadEdge: '#5b564c',
  lane: '#e8e0c8',
  sidewalk: '#cfc6ae',
  building: '#b09a7a',
  buildingRoof: '#8a6f52',
  downtown: '#9c8a72',
  warehouse: '#7d7468',
  player: '#e8452c',
  playerCar: '#e8452c',
  trafficCar: '#4a7fb5',
  goldCar: '#d9a521',
  policeCar: '#2b4fd8',
  ped: '#5a7d4a',
  enemy: '#7a2e8f',
  marker: '#ffd23e',
  hudBg: 'rgba(12, 18, 28, 0.72)',
  hudText: '#f5efe0',
  star: '#ffd23e',
  starEmpty: '#5a5548',
};

export const CAR_COLORS = ['#4a7fb5', '#c65a3a', '#5a8f5a', '#8a6fb5', '#b5a04a', '#4ab5a0', '#a04a6b'];
