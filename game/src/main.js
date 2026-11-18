// Solmar Bay — boot and game loop. Fixed-step simulation (60 Hz), screens,
// save/continue through localStorage, synthesized audio wired to game
// events, and the ?shot= / ?seed= staging used for screenshots.

import { VIEW_W, VIEW_H, PISTOL_AMMO_START, PLAYER_HEALTH } from './config.js';
import {
  createWorld, stepWorld, restartMission, saveGame, applySave,
} from './world.js';
import { createInput, attachInput, readStepInput, consumeActions } from './input.js';
import { renderGame } from './render.js';
import {
  createAudio, ensureAudio, setEngine, setSiren, setMuted,
  playShot, playPunch, playPickup, playMissionSting, playCrash,
  playHurt, playBusted,
} from './audio.js';
import { setupShot, autopilotInput, createAutopilot } from './shots.js';

const SAVE_KEY = 'solmar-bay-save-v1';
const BEST_KEY = 'solmar-bay-best-v1';

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (err) {
    // Storage full or unavailable: the game still plays, just unsaved.
  }
}

function readBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch (err) {
    return 0;
  }
}

function writeBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch (err) {
    // Ignore storage failures.
  }
}

function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed') || 1) >>> 0 || 1;
  const shotName = params.get('shot');
  const input = createInput();
  const audio = createAudio();
  attachInput(input, canvas);

  let state;
  let shotAutopilot = null;
  if (shotName) {
    state = setupShot(seed, shotName);
    shotAutopilot = createAutopilot();
  } else {
    state = createWorld(seed);
    state.screen = 'title';
  }
  state.bestScore = readBest();
  const saved = readSave();
  state.hasSave = !!saved && saved.mission < 5;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function startNewGame() {
    state = createWorld(seed);
    state.bestScore = readBest();
    state.hasSave = false;
    state.screen = 'playing';
    try { window.localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
  }

  function continueGame() {
    const save = readSave();
    if (!save) return;
    state = createWorld(save.seed);
    applySave(state, save);
    state.save = save;
    state.bestScore = readBest();
    state.hasSave = true;
    state.screen = 'playing';
  }

  function handleEvents(events) {
    for (const event of events) {
      if (event === 'shot') playShot(audio);
      else if (event === 'punch') playPunch(audio);
      else if (event === 'pickup') playPickup(audio);
      else if (event === 'sting') playMissionSting(audio);
      else if (event === 'crash') playCrash(audio);
      else if (event === 'hurt') playHurt(audio);
      else if (event === 'busted') playBusted(audio);
      else if (event === 'victory') playMissionSting(audio);
    }
  }

  function syncSaveAndBest() {
    if (state.save) writeSave(state.save);
    if (state.score > state.bestScore) {
      state.bestScore = state.score;
      writeBest(state.score);
    }
  }

  // Keyboard shortcuts handled at the screen level, outside the sim.
  function handleScreenKeys() {
    if (input.pausePressed) {
      if (state.screen === 'playing') state.screen = 'paused';
      else if (state.screen === 'paused') state.screen = 'playing';
    }
    if (input.mutePressed) setMuted(audio, !audio.muted);
    if (input.restartPressed) {
      if (state.screen === 'playing' || state.screen === 'paused'
        || state.screen === 'busted' || state.screen === 'wasted') {
        const fresh = restartMission(state);
        fresh.bestScore = state.bestScore;
        fresh.hasSave = state.hasSave;
        state = fresh;
        state.screen = 'playing';
      }
    }
    if (input.confirmPressed) {
      if (state.screen === 'title') {
        if (state.hasSave) continueGame();
        else startNewGame();
      } else if (state.screen === 'victory' || state.screen === 'busted' || state.screen === 'wasted') {
        state.screen = 'title';
        state.bestScore = readBest();
        state.hasSave = !!readSave();
      }
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'playing') state.screen = 'paused';
  });

  let last = performance.now();
  let acc = 0;
  const dt = 1 / 60;
  let frames = 0;
  let shotSettled = false;

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (input.anyGesture) {
      ensureAudio(audio);
      input.anyGesture = false;
    }
    handleScreenKeys();
    consumeActions(input);

    if (state.screen === 'playing') {
      acc += elapsed;
      let steps = 0;
      while (acc >= dt && steps < 5) {
        let stepInput;
        if (shotName && shotAutopilot) {
          stepInput = autopilotInput(state, shotAutopilot, dt);
        } else {
          const scale = canvas.width / VIEW_W;
          stepInput = readStepInput(input, state.camera, scale);
        }
        stepWorld(state, stepInput, dt);
        handleEvents(state.events);
        acc -= dt;
        steps += 1;
      }
      if (steps === 5) acc = 0;
      syncSaveAndBest();
      const driving = state.player.inCar && state.player.car;
      setEngine(audio, driving ? Math.abs(state.player.car.speed) / 530 : 0, !!driving);
      setSiren(audio, state.wanted > 0);
    } else {
      setEngine(audio, 0, false);
      setSiren(audio, false);
    }

    renderGame(ctx, state, canvas.width, canvas.height);
    frames += 1;
    // Screenshots: the scene is staged synchronously at boot; flag it ready
    // after a few rendered frames so the capture sees the settled frame.
    if (shotName && !shotSettled && frames >= 4) {
      shotSettled = true;
      window.__shotReady = true;
    }
  }
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export { PISTOL_AMMO_START, PLAYER_HEALTH, VIEW_W, VIEW_H };
