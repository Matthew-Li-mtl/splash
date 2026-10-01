// Tiny Web Audio synth + step sequencer. Every sound is synthesized, so songs are
// stored as note grids (a few hundred bytes) and there are no samples to load.

import { useSyncExternalStore } from "react";
import type { BassInstrument, MelodyInstrument, SongContent } from "@splash/shared";
import { rowToMidi, totalSteps } from "./music";

let ctx: AudioContext | null = null;
let out: GainNode;
let reverbSend: GainNode;
let noise: AudioBuffer;

function makeImpulse(c: AudioContext, seconds: number) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

/** Create (or wake) the audio graph. Must be first called from a user gesture on iOS. */
export function audio(): AudioContext {
  if (!ctx) {
    // Play through the iOS silent switch, like a music app would.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";

    ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    out = ctx.createGain();
    out.gain.value = 0.7;
    out.connect(comp).connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, 2.2);
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.25;
    reverbSend.connect(reverb).connect(comp);

    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function voice(c: AudioContext, t: number, attack: number, peak: number, decay: number, wet = false) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(out);
  if (wet) g.connect(reverbSend);
  return g;
}

function osc(c: AudioContext, type: OscillatorType, freq: number, dest: AudioNode, t: number, stop: number, detune = 0) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  o.connect(dest);
  o.start(t);
  o.stop(stop);
  return o;
}

export function playMelodyNote(inst: MelodyInstrument, midi: number, t: number, dur: number) {
  const c = audio();
  const f = mtof(midi);
  switch (inst) {
    case "marimba": {
      const g = voice(c, t, 0.004, 0.45, 0.55);
      osc(c, "sine", f, g, t, t + 0.7);
      const click = voice(c, t, 0.002, 0.12, 0.06);
      osc(c, "sine", f * 4, click, t, t + 0.1);
      break;
    }
    case "piano": {
      const g = voice(c, t, 0.005, 0.32, 1.4, true);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(3200, t);
      lp.frequency.exponentialRampToValueAtTime(900, t + 1);
      lp.connect(g);
      osc(c, "triangle", f, lp, t, t + 1.5);
      osc(c, "sine", f * 2, lp, t, t + 1.5, 4);
      break;
    }
    case "synth": {
      const g = voice(c, t, 0.006, 0.2, Math.max(0.25, dur * 1.2));
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 7;
      lp.frequency.setValueAtTime(4200, t);
      lp.frequency.exponentialRampToValueAtTime(700, t + 0.3);
      lp.connect(g);
      osc(c, "sawtooth", f, lp, t, t + dur * 1.3 + 0.3);
      break;
    }
    case "pad": {
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.08);
      g.gain.setValueAtTime(0.12, t + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.7);
      g.connect(out);
      g.connect(reverbSend);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1700;
      lp.connect(g);
      osc(c, "sawtooth", f, lp, t, t + dur + 0.8, -8);
      osc(c, "sawtooth", f, lp, t, t + dur + 0.8, 8);
      break;
    }
    case "bell": {
      const g = voice(c, t, 0.003, 0.3, 2.2, true);
      const carrier = osc(c, "sine", f, g, t, t + 2.4);
      const modGain = c.createGain();
      modGain.gain.setValueAtTime(f * 2.2, t);
      modGain.gain.exponentialRampToValueAtTime(1, t + 1.4);
      modGain.connect(carrier.frequency);
      osc(c, "sine", f * 3.5, modGain, t, t + 2.4);
      break;
    }
  }
}

export function playBassNote(inst: BassInstrument, midi: number, t: number, dur: number) {
  const c = audio();
  const f = mtof(midi);
  if (inst === "sub") {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
    g.gain.setValueAtTime(0.5, t + dur * 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    g.connect(out);
    osc(c, "sine", f, g, t, t + dur + 0.15);
    osc(c, "triangle", f * 2, g, t, t + dur + 0.15).detune.value = 3;
    return;
  }
  const g = voice(c, t, 0.005, inst === "fuzz" ? 0.22 : 0.4, inst === "fuzz" ? Math.max(0.3, dur) : 0.45);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = inst === "fuzz" ? 2 : 5;
  lp.frequency.setValueAtTime(inst === "fuzz" ? 1600 : 1100, t);
  lp.frequency.exponentialRampToValueAtTime(inst === "fuzz" ? 700 : 240, t + 0.3);
  lp.connect(g);
  if (inst === "fuzz") {
    osc(c, "square", f, lp, t, t + dur + 0.4, -6);
    osc(c, "square", f, lp, t, t + dur + 0.4, 6);
  } else {
    osc(c, "sawtooth", f, lp, t, t + 0.6);
  }
}

function noiseBurst(c: AudioContext, t: number, filter: BiquadFilterType, freq: number, peak: number, decay: number, q = 0.8) {
  const src = c.createBufferSource();
  src.buffer = noise;
  const bf = c.createBiquadFilter();
  bf.type = filter;
  bf.frequency.value = freq;
  bf.Q.value = q;
  const g = voice(c, t, 0.002, peak, decay);
  src.connect(bf).connect(g);
  src.start(t, Math.random() * 0.5);
  src.stop(t + decay + 0.05);
}

/** Drum rows: 0 kick, 1 snare, 2 hat, 3 clap. */
export function playDrum(row: number, t: number) {
  const c = audio();
  if (row === 0) {
    const g = voice(c, t, 0.002, 0.9, 0.42);
    const o = osc(c, "sine", 150, g, t, t + 0.5);
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
  } else if (row === 1) {
    noiseBurst(c, t, "highpass", 1300, 0.42, 0.17);
    const g = voice(c, t, 0.002, 0.3, 0.09);
    osc(c, "triangle", 190, g, t, t + 0.12);
  } else if (row === 2) {
    noiseBurst(c, t, "highpass", 7500, 0.2, 0.045);
  } else {
    for (const offset of [0, 0.011, 0.022]) noiseBurst(c, t + offset, "bandpass", 1500, 0.35, offset === 0.022 ? 0.16 : 0.02, 1.2);
  }
}

// ---------- Sequencer ----------

type State = { owner: string | null; step: number };
let state: State = { owner: null, step: -1 };
const listeners = new Set<() => void>();
const setState = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

let song: SongContent | null = null;
let byStep = new Map<number, { melody: number[]; bass: number[]; drums: number[] }>();
let timer: ReturnType<typeof setInterval> | undefined;
let raf = 0;
let nextStep = 0;
let nextTime = 0;
let queue: { step: number; time: number }[] = [];

function index(s: SongContent) {
  byStep = new Map();
  const slot = (step: number) => {
    let e = byStep.get(step);
    if (!e) byStep.set(step, (e = { melody: [], bass: [], drums: [] }));
    return e;
  };
  for (const [st, r] of s.melody.notes) slot(st).melody.push(r);
  for (const [st, r] of s.bass.notes) slot(st).bass.push(r);
  for (const [st, r] of s.drums.notes) slot(st).drums.push(r);
}

const stepDuration = (s: SongContent) => 60 / s.bpm / s.stepsPerBeat;

function tick() {
  const c = audio();
  if (!song) return;
  while (nextTime < c.currentTime + 0.12) {
    const notes = byStep.get(nextStep);
    const dur = stepDuration(song);
    if (notes) {
      for (const r of notes.melody) playMelodyNote(song.melody.instrument, rowToMidi(song, "melody", r), nextTime, dur);
      for (const r of notes.bass) playBassNote(song.bass.instrument, rowToMidi(song, "bass", r), nextTime, dur);
      for (const r of notes.drums) playDrum(r, nextTime);
    }
    queue.push({ step: nextStep, time: nextTime });
    nextTime += dur;
    nextStep = (nextStep + 1) % totalSteps(song);
  }
}

function frame() {
  const c = audio();
  let latest = -1;
  while (queue.length && queue[0].time <= c.currentTime) latest = queue.shift()!.step;
  if (latest >= 0) setState({ step: latest });
  raf = requestAnimationFrame(frame);
}

export const player = {
  /** Start looping a song. `owner` identifies which component is playing. */
  play(owner: string, s: SongContent) {
    player.stop();
    const c = audio();
    song = s;
    index(s);
    nextStep = 0;
    nextTime = c.currentTime + 0.06;
    queue = [];
    timer = setInterval(tick, 25);
    tick();
    raf = requestAnimationFrame(frame);
    setState({ owner, step: -1 });
  },
  /** Live edits while playing. */
  update(owner: string, s: SongContent) {
    if (state.owner !== owner) return;
    song = s;
    index(s);
    nextStep %= totalSteps(s);
  },
  stop(owner?: string) {
    if (owner && state.owner !== owner) return;
    clearInterval(timer);
    cancelAnimationFrame(raf);
    song = null;
    queue = [];
    if (state.owner) setState({ owner: null, step: -1 });
  },
};

export function usePlayer(owner: string) {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
  const playing = snap.owner === owner;
  return { playing, step: playing ? snap.step : -1 };
}

/** Short preview when placing a note. */
export function previewNote(s: SongContent, track: "melody" | "bass" | "drums", row: number) {
  const c = audio();
  const t = c.currentTime + 0.01;
  const dur = stepDuration(s);
  if (track === "drums") playDrum(row, t);
  else if (track === "melody") playMelodyNote(s.melody.instrument, rowToMidi(s, "melody", row), t, dur);
  else playBassNote(s.bass.instrument, rowToMidi(s, "bass", row), t, dur);
}
