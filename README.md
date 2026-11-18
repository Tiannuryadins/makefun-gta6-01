# Solmar Bay — an open-world crime game

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Tiannuryadins/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Tiannuryadins/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game for the make.fun **gta6-01** bounty
("Make GTA 6"), built from scratch in vanilla JavaScript — no libraries,
no external assets, no network requests. Everything is procedural: the
city is drawn on canvas, the sounds are synthesized with WebAudio.

You are **Rico Vega**, a driver in debt to the fixer **Mara**. Across five
missions you will meet her contact at Marina Pier, run a package through
the Old Port docks, steal a gold sedan in Downtown, lose the Solmar Bay
police, and clear the Harbor Warehouse crew — then reach the pier
extraction a free man.

The city of **Solmar Bay** (2400×1800) has six districts — Marina Pier,
Old Port, North Hills, Downtown, Palm Suburbs and Sunset Beach — with
traffic, pedestrians, parked cars to steal, a 0–5 star wanted level with
police pursuit, pistol and melee combat, a HUD with a live minimap, a
start screen, and save/continue via localStorage.

## How to run

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser. The game is
plain static files under `game/` and plays offline.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Walk, or drive (steer, accelerate, brake/reverse) |
| E | Enter / exit a car (stealing one raises your wanted level) |
| Mouse | Aim |
| Click | Shoot the pistol |
| F | Melee attack |
| P or Esc | Pause |
| M | Mute sound |
| R | Restart the current mission |
| Enter | Start / continue / play again |

## Screenshots

The four images in `screenshots/` are real renders of the game itself,
captured with `node capture-shots.cjs` (headless Chromium): the title
screen over the city, driving the dockside run, a police chase at two
wanted stars, and the victory screen after all five missions.

## Files

- `game/index.html` — full-window canvas, loads `src/main.js`
- `game/src/config.js` — tuning numbers, palette, districts, missions
- `game/src/random.js` — seeded RNG (mulberry32); the sim is deterministic
- `game/src/world.js` — city, driving, traffic/pedestrian/police AI,
  wanted level, missions, combat, save state
- `game/src/input.js` — keyboard + mouse, one-shot action flags
- `game/src/render.js` — canvas renderer, HUD + minimap, menu screens
- `game/src/audio.js` — synthesized WebAudio sound (engine, sirens, shots)
- `game/src/shots.js` — street-grid pathfinder, autopilot, staged scenes
- `game/src/main.js` — boot, fixed-step loop, screens, save/continue
- `main.ts` — the make.fun entry program (copies `game/` + `screenshots/`,
  writes `dossier.json`)
- `serve.ts` — static file server for local play
