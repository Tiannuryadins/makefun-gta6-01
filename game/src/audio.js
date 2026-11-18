// Synthesized sound with plain WebAudio: no audio files, no network.
// The context is created lazily on the first user gesture (browser policy)
// and every effect is a short oscillator/noise burst built in code.

export function createAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenLfo: null,
    muted: false,
    sirenOn: false,
  };
}

export function ensureAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = audio.muted ? 0 : 0.5;
  master.connect(ctx.destination);
  audio.ctx = ctx;
  audio.master = master;

  // Engine hum: a low sawtooth whose pitch follows driving speed.
  const engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  const engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  const engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 420;
  engineOsc.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(master);
  engineOsc.start();
  audio.engineOsc = engineOsc;
  audio.engineGain = engineGain;

  // Police siren: a triangle wave wobbling between two tones.
  const sirenOsc = ctx.createOscillator();
  sirenOsc.type = 'triangle';
  sirenOsc.frequency.value = 720;
  const sirenGain = ctx.createGain();
  sirenGain.gain.value = 0;
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 0.55;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 170;
  lfo.connect(lfoGain);
  lfoGain.connect(sirenOsc.frequency);
  sirenOsc.connect(sirenGain);
  sirenGain.connect(master);
  sirenOsc.start();
  lfo.start();
  audio.sirenOsc = sirenOsc;
  audio.sirenGain = sirenGain;
  audio.sirenLfo = lfo;
}

function blip(audio, freq, dur, type, vol, slideTo) {
  if (!audio.ctx || audio.muted) return;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.02);
}

function noiseBurst(audio, dur, vol, filterFreq) {
  if (!audio.ctx || audio.muted) return;
  const ctx = audio.ctx;
  const len = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq || 1800;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  src.start();
}

export function playShot(audio) {
  noiseBurst(audio, 0.12, 0.5, 2600);
  blip(audio, 190, 0.09, 'square', 0.22, 70);
}

export function playPunch(audio) {
  noiseBurst(audio, 0.08, 0.35, 900);
}

export function playPickup(audio) {
  blip(audio, 660, 0.1, 'sine', 0.3);
  setTimeout(() => blip(audio, 990, 0.14, 'sine', 0.3), 90);
}

export function playMissionSting(audio) {
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => blip(audio, freq, 0.22, 'triangle', 0.3), i * 110);
  });
}

export function playCrash(audio) {
  noiseBurst(audio, 0.25, 0.5, 500);
}

export function playHurt(audio) {
  blip(audio, 140, 0.18, 'sawtooth', 0.25, 80);
}

export function playBusted(audio) {
  blip(audio, 392, 0.3, 'triangle', 0.3, 196);
  setTimeout(() => blip(audio, 311, 0.4, 'triangle', 0.3, 155), 260);
}

export function setEngine(audio, speedFrac, driving) {
  if (!audio.ctx || !audio.engineOsc) return;
  const target = driving ? 0.05 + speedFrac * 0.1 : 0;
  audio.engineGain.gain.setTargetAtTime(audio.muted ? 0 : target, audio.ctx.currentTime, 0.08);
  audio.engineOsc.frequency.setTargetAtTime(52 + speedFrac * 115, audio.ctx.currentTime, 0.08);
}

export function setSiren(audio, on) {
  if (!audio.ctx || !audio.sirenGain) return;
  audio.sirenOn = on;
  audio.sirenGain.gain.setTargetAtTime(on && !audio.muted ? 0.045 : 0, audio.ctx.currentTime, 0.15);
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
  if (audio.ctx) setSiren(audio, audio.sirenOn);
}
