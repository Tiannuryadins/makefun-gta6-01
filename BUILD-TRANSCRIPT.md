# Solmar Bay — build transcript (rebuild)

Built 2026-11-17 for make.fun gta6-01 ("Make GTA 6", $1,666). This is a
fresh rebuild: every non-kit file was deleted first and every line below
was written in this session, live, under the running recording. Nothing
was copied from the earlier attempt's source — only its prose design
notes were read first (feature list, verification method, bug lessons).

Original 2D canvas open-world crime game in vanilla JavaScript: no
libraries, no external assets, no network requests, no keys, no paid
services. All art is drawn procedurally; all sound is synthesized with
WebAudio. All city, character, vehicle, story and mission names are
original — nothing from Rockstar/GTA or any commercial game.

## What was built

`game/index.html` (18 lines) — full-window canvas `#game`, status line for
screen readers, loads `src/main.js` as a module. No external references.

| File | Lines | What it does |
|---|---|---|
| `game/src/config.js` | 151 | Tuning numbers + palette: 2400×1800 world, street grid, 6 districts, player/car physics, wanted rules, 5 missions |
| `game/src/random.js` | 38 | mulberry32 seeded RNG; no `Math.random` / `Date.now` in simulation code |
| `game/src/world.js` | ~1080 | DOM-free simulation: city gen, traffic AI (grid driving + car-ahead stop), pedestrians (wander + flee), police AI (chase/ram + stuck recovery) + wanted level, 5-mission state machine, pistol/melee combat, enemies, particles/skids/smoke, checkpoints + save state |
| `game/src/input.js` | 114 | WASD/arrows, mouse aim, one-shot flags (enter/melee/pause/mute/restart/confirm/shoot) |
| `game/src/render.js` | ~630 | Canvas renderer: sea + beach + waves, districts, parks, streets, buildings, landmarks, cars/peds/player/enemies, particles, light sunset wash, HUD (money/health/ammo/speed/wanted stars/mission banner + distance), canvas minimap, title/pause/busted/wasted/victory overlays |
| `game/src/audio.js` | 158 | WebAudio synth, lazy on first gesture: engine hum, siren loop, shots, punch, pickup, mission sting, crash, hurt, busted; mute flag |
| `game/src/shots.js` | ~440 | BFS street-grid pathfinder (waypoints on street centrelines) + autopilot (walk/drive/steal/shoot/exit-car) + `runUntil` staging + 4 staged scenes |
| `game/src/main.js` | 218 | Boot, fixed-step loop, 5 screens, `?seed=` / `?shot=` handling, `window.__shotReady`, save/continue via localStorage, visibility auto-pause |
| `capture-shots.cjs` | ~90 | Dev tool: headless Chromium (playwright-core + Chrome for Testing) captures `shots.json` to `screenshots/` as 1280×720 JPEG |
| `shots.json` | 1 | 4 shots: 1-start, 2-drive, 3-chase, 4-end (all `&seed=1`) |

`main.ts` (written in my own words, with the 3–4 screenshot gate),
`serve.ts`, `vendor/makefun-game.ts`, `LICENSE` (MIT) are the kit's, the
first rewritten and the rest untouched. `.makefun/owner.json` names the
payout wallet. Total game code: ~2,880 lines across 9 modules;
total source 93,973 bytes (cap 163,840).

## Verification (all run, all passing)

1. **Syntax** — `node --check` on `.mjs` copies of every `game/src/*.js`: **PASS** (8/8).
2. **Headless Node sim** (`/tmp/gta6b-sim.mjs`, not in the repo):
   - Full autopilot, seed 1: **VICTORY in 106.4 s** — all 5 missions,
     $2,500, 4 kills, 2 cars stolen, max wanted 2.
   - Seed sweep: autopilot wins **4/4 seeds**
     (106.4 s, 96.5 s, 111.2 s, 122.4 s); seed 7 also wins (103.9 s).
   - Steal check: entering a parked car → in car, wanted 1,
     1 police spawned, carsStolen 1.
   - Move check: walked 230 px in 1 s (exactly WALK_SPEED).
   - Determinism: same seed twice → byte-identical key state;
     a different seed differs.
3. **Dossier determinism** — `MAKEFUN_OUTPUT_DIR=/tmp/gta6b-out1 node main.ts`
   vs `/tmp/gta6b-out2`, `diff -r`: **byte-identical**. dossier.json
   563,104 B (cap 1.5 MiB); total source 93,973 B (cap 163,840 B).
4. **Serve smoke test** — `node serve.ts --port 8091`: `/` 200,
   `/src/main.js` 200, `/src/world.js` 200; path traversal (`/../main.ts`)
   404; server killed after the test.
5. **Screenshots** — `node capture-shots.cjs`: **ALL_SHOTS_OK**. All four
   are 1280×720 JPEG, quality 82, each ≤ 256 KiB: 1-start 78,661 B;
   2-drive 99,828 B; 3-chase 97,238 B; 4-end 72,495 B. Each was read back
   and visually checked: title over the city (all lines inside the
   panel); driving the dockside run (MISSION 2/5, $250, 1 wanted star, a
   police car, traffic, peds, HUD + minimap); a real police chase
   (MISSION 4/5 "Lose the cops", 2 stars, a police car ramming the
   player's car, 1833 m to the safehouse); victory panel ($2,500, score
   2,900, 4 crew down, 2 cars stolen, 2 stars, 1:46). Staging ground
   truth was also printed from Node: 2-drive stops the instant Rico is
   driving in mission 1+ (player (450,222), in car, wanted 1, 1 police);
   3-chase stops live at mission 3 with wanted 2 and 2 police
   (player (1551,441)); 4-end is a full autopilot victory.
6. **`makefun check`** — from the kit dir, after the local commit:
   `kit gta6-01 dev: verified 24 files`; `repository ... @ c394f72…:
   22 entries`; **4 passed, 0 failed, 16 skipped, 5 checked at
   submission; exit 0** — `ok: every check run here passes`. The 5
   at-submission items (repo_public, repo_owner, repo_created_after_open,
   commit_in_repo, duplicate_snapshot) are the coordinator's GitHub
   push/submit steps, not build failures. The check was re-run after the
   final transcript amend and still passes with the same counts.

## Bugs found and fixed during the build

- **Police ramming was lethal**: 7 damage every 0.8 s with no quiet
  window for health regen killed the player in ~15 s of a routine
  1-star chase. Ramming a car now deals 2 damage every 1.5 s; ramming
  a pedestrian deals 6 every 1.2 s.
- **Autopilot never stole the gold sedan**: it drove to it, exited,
  then walked up and stood 2 px away forever — the enter check only
  existed in the grab-a-car branch. Added an explicit on-foot
  gold-car enter check.
- **Enter grabbed the wrong car**: at 51.9 px from the gold sedan the
  autopilot pressed E, but `tryEnterCar` took the *nearest* car — the
  old car parked 46 px away — then immediately exited (still near the
  gold car) and looped forever. The mission-target car now takes
  priority in `tryEnterCar`, and the autopilot exits its old car
  150 px clear of the gold sedan instead of 100 px.
- **Parked-car crash**: a parked car the player stole and exited kept
  kind `'player'` with a null traffic route, crashing `stepTraffic`.
  Exiting restores a parked car's kind, and traffic defensively assigns
  a route when one is missing.
- **Car turn radius too wide at low speed**: the turn-rate floor scaled
  off max speed, so the player car swung 190 px wide through
  intersections at a crawl. Turn authority now scales off a fixed
  260 px/s reference with a 0.45 floor, so slow turns are tight.
- **HUD text unreadable on sand**: health/ammo sat outside the dark
  money panel and white text sat on pale ground. The money panel now
  covers health + ammo; wanted stars, objective distance, and the
  speed/controls hint each sit on their own dark pill; the minimap
  label moved inside the minimap on a dark pill.
- **Title panel overflow**: the last line ("Press ENTER to START") fell
  outside the panel border. Line spacing tightened (30 → 27 px) and one
  blank line removed.
- **Chase shot staged a fallback**: the first chase staging ran the
  autopilot to the 240 s cap, finished the whole game, and fell back to
  hand-placed police. Shots now use `runUntil` — 2-drive stops the
  instant Rico is driving in mission 1+, 3-chase stops the instant
  mission 4 is live with wanted ≥ 2 and ≥ 2 police — so both shots are
  live autopilot moments, not fallbacks.

## Not done (for the coordinator)

- No GitHub repo was created, nothing was pushed, nothing was submitted —
  those are the coordinator's steps. Screenshots are real renders of the
  game's own code, captured with `capture-shots.cjs` in this session.
