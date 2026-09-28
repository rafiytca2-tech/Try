// Sound: a small synth made on the fly with Web Audio, starting on the first tap. Everything goes
// through one mix: a gentle compressor to keep it smooth and a soft room reverb for air. The
// voices are soft (sine and triangle bells and plucks, a round thump, filtered noise for air and
// dust), and every note comes from one major pentatonic scale, so it all sounds good together.
// A landing is a deep thump with a wooden knock; a perfect drop rings a bell, and each step of a
// combo rings the next note up the scale, so a run climbs into a melody; the combo payout is a
// rising flourish that blooms into a chord with a sparkle on top.
(() => {
'use strict';

const SOUND = {
  volume: 0.85,
  reverb: 0.24,          // share of each sound sent to the room
  roomTime: 1.8,         // seconds the room rings for
  root: 392,             // Hz: G4, the scale's first note
  arriveGap: 0.06,       // seconds between tenant pops at most
};
const SCALE = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3];                     // major pentatonic
const note = n => SOUND.root * SCALE[((n % 5) + 5) % 5] * Math.pow(2, Math.floor(n / 5));

const Sound = {
  ctx: null, muted: false, out: null, room: null, noiseBuf: null, lastArrive: -1,

  ensure() {
    if (this.muted) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.build();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { /* no audio */ }
  },

  // The mix: voices -> compressor -> volume -> speakers, and a send into the room.
  build() {
    const c = this.ctx, comp = c.createDynamicsCompressor(), vol = c.createGain();
    comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    vol.gain.value = SOUND.volume;
    comp.connect(vol).connect(c.destination);
    this.out = comp;
    const len = Math.floor(c.sampleRate * SOUND.roomTime), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    const verb = c.createConvolver(), wet = c.createGain(), tone = c.createBiquadFilter();
    verb.buffer = ir; wet.gain.value = 1; tone.type = 'lowpass'; tone.frequency.value = 5200;
    this.room = c.createGain(); this.room.gain.value = SOUND.reverb;
    this.room.connect(verb).connect(tone).connect(wet).connect(comp);
    const nlen = c.sampleRate;                                       // a second of white noise to reuse
    this.noiseBuf = c.createBuffer(1, nlen, c.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
  },

  live() { return !this.muted && this.ctx && this.out; },

  // Where a voice ends up: panned, into the mix and (some of it) into the room.
  route(node, t0, { pan = 0, send = 1 } = {}) {
    const c = this.ctx;
    let last = node;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.setValueAtTime(pan, t0); last.connect(p); last = p; }
    last.connect(this.out);
    if (send > 0) { const s = c.createGain(); s.gain.value = send; last.connect(s).connect(this.room); }
  },

  // One oscillator note: shape, pitch (sliding to `to`), an attack then an exponential fade.
  osc(freq, dur, { type = 'sine', gain = 0.1, attack = 0.005, to = 0, delay = 0, detune = 0, pan = 0, send = 1, lp = 0 } = {}) {
    if (!this.live()) return;
    try {
      const c = this.ctx, t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0); o.detune.value = detune;
      if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      let node = o.connect(g);
      if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node = node.connect(f); }
      this.route(node, t0, { pan, send });
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) { /* ignore */ }
  },

  // A burst of filtered noise: air, dust, rumble. The filter sweeps from `from` to `to` Hz.
  noise(dur, { gain = 0.1, type = 'lowpass', from = 1000, to = 0, q = 0.8, attack = 0.004, delay = 0, pan = 0, send = 0.6 } = {}) {
    if (!this.live()) return;
    try {
      const c = this.ctx, t0 = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; s.loop = true;
      f.type = type; f.Q.value = q; f.frequency.setValueAtTime(from, t0);
      if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      this.route(s.connect(f).connect(g), t0, { pan, send });
      s.start(t0, Math.random() * 0.8); s.stop(t0 + dur + 0.05);
    } catch (e) { /* ignore */ }
  },

  // A soft bell: a sine with a gently fading metallic overtone (FM), ringing into the room.
  bell(freq, dur, { gain = 0.12, delay = 0, pan = 0, bright = 1 } = {}) {
    if (!this.live()) return;
    try {
      const c = this.ctx, t0 = c.currentTime + delay;
      const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
      car.frequency.value = freq; mod.frequency.value = freq * 3.5;
      mg.gain.setValueAtTime(freq * 1.6 * bright, t0); mg.gain.exponentialRampToValueAtTime(freq * 0.05, t0 + dur * 0.6);
      mod.connect(mg).connect(car.frequency);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      this.route(car.connect(g), t0, { pan, send: 1.4 });
      car.start(t0); mod.start(t0); car.stop(t0 + dur + 0.05); mod.stop(t0 + dur + 0.05);
    } catch (e) { /* ignore */ }
  },

  // A plucked note: a triangle through a closing filter.
  pluck(freq, { gain = 0.08, delay = 0, pan = 0, dur = 0.35 } = {}) {
    this.osc(freq, dur, { type: 'triangle', gain, delay, pan, lp: freq * 4, send: 0.9 });
    this.osc(freq * 2, dur * 0.5, { gain: gain * 0.25, delay, pan, send: 0.6 });
  },

  // --- the game's sounds ---

  // A floor let go: a soft swish of air.
  release() {
    this.noise(0.22, { type: 'bandpass', from: 2400, to: 650, q: 1.1, gain: 0.16, attack: 0.02, send: 0.3 });
  },
  // A floor lands: a round thump from underneath, the knock of it seating, a puff of dust.
  land() {
    this.osc(120, 0.22, { gain: 0.42, to: 46, attack: 0.003, send: 0.15 });
    this.noise(0.1, { from: 900, to: 260, gain: 0.16, send: 0.2 });
    this.osc(310, 0.07, { type: 'triangle', gain: 0.07, to: 250, send: 0.3 });
  },
  // A perfect drop: a bell on the combo's step of the scale with its fifth, a little shimmer over
  // it, and a warm low swell under it. Each step of a combo is one note higher.
  perfect(n) {
    const s = 4 + Math.min(n || 1, 14);
    this.bell(note(s), 1.4, { gain: 0.16 });
    this.bell(note(s + 3), 1.1, { gain: 0.07, delay: 0.03 });
    [7, 9, 12].forEach((d, i) => this.osc(note(s + d), 0.22, { gain: 0.035, delay: 0.06 + i * 0.045, send: 1.4 }));
    this.osc(note(s - 10), 0.5, { gain: 0.09, attack: 0.02, send: 0.5 });
  },
  // Quick Finger: a near drop refilled the clock: a softer bell on the combo's step, and a pluck
  // a step above it.
  near(n) {
    const s = 4 + Math.min(n || 1, 14);
    this.bell(note(s), 0.9, { gain: 0.11, bright: 0.7 });
    this.pluck(note(s + 2), { gain: 0.07, delay: 0.05 });
  },
  // Quick Finger: the clock is nearly out: a woodblock tick, a little higher as it gets urgent (k 0..1).
  tick(k = 0) {
    this.osc(1250 + 350 * k, 0.04, { type: 'triangle', gain: 0.07 + 0.05 * k, to: 800, send: 0.15 });
    this.noise(0.02, { type: 'highpass', from: 3500, gain: 0.025, send: 0.1 });
  },
  // A floor lands (not perfectly) while a combo runs: a pluck on the combo's next note.
  comboStep(n) { this.pluck(note(4 + Math.min(n, 14)), { gain: 0.16 }); },
  // The combo pays out: a quick climb up the scale that blooms into a chord, with a sparkle.
  bonus() {
    for (let i = 0; i < 7; i++) this.pluck(note(5 + i), { gain: 0.06, delay: i * 0.05, pan: (i - 3) * 0.12, dur: 0.3 });
    [0, 2, 4, 7].forEach(d => this.bell(note(10 + d), 1.8, { gain: 0.07, delay: 0.36 }));
    this.noise(0.8, { type: 'highpass', from: 6000, gain: 0.03, attack: 0.05, delay: 0.36, send: 1.2 });
  },
  // A tenant gets in through a window: a tiny pop, somewhere on the scale.
  arrive(side = 0) {
    if (!this.live() || this.ctx.currentTime - this.lastArrive < SOUND.arriveGap) return;
    this.lastArrive = this.ctx.currentTime;
    this.osc(note(9 + Math.floor(Math.random() * 5)), 0.08, { gain: 0.09, pan: side * 0.5, send: 0.8 });
  },
  // A miss: a soft falling sigh.
  miss() {
    this.osc(note(7), 0.55, { type: 'triangle', gain: 0.22, to: note(0) / 2, lp: 1800, send: 0.6 });
    this.noise(0.25, { from: 700, to: 200, gain: 0.1 });
  },
  // Out of lives (or out of time): a gentle falling phrase.
  over() { [4, 2, 1, -1].forEach((n, i) => this.bell(note(n), 1.2, { gain: 0.08, delay: i * 0.22, bright: 0.6 })); },
  // The top of the tower gives way: a deep rumble and crackling.
  collapse() {
    this.noise(1.4, { from: 260, to: 70, gain: 0.3, attack: 0.03, send: 0.5 });
    this.osc(60, 1.1, { gain: 0.25, to: 38, attack: 0.02, send: 0.3 });
    for (let i = 0; i < 6; i++) this.noise(0.06, { type: 'bandpass', from: 1500 + Math.random() * 1500, q: 2, gain: 0.05, delay: 0.1 + i * 0.12 + Math.random() * 0.06, pan: Math.random() - 0.5 });
  },
  // A loose floor knocks into something (k: 0 light .. 1 heavy).
  thud(k) {
    this.osc(95 + 30 * k, 0.12 + 0.1 * k, { gain: 0.08 + 0.25 * k, to: 42, send: 0.25 });
    this.noise(0.06 + 0.06 * k, { from: 500 + 900 * k, to: 180, gain: 0.05 + 0.12 * k, send: 0.3, pan: (Math.random() - 0.5) * 0.6 });
  },
  // A wreck crumbles to dust.
  crumble() {
    this.noise(0.35, { type: 'bandpass', from: 1400, to: 500, q: 0.9, gain: 0.05, send: 0.5 });
    for (let i = 0; i < 3; i++) this.noise(0.03, { type: 'highpass', from: 2500, gain: 0.025, delay: 0.04 + i * 0.07 });
  },
  // Holding: a soft tone rising a step with each step of the swing.
  holdStep(n) { this.osc(note(n * 2 + 2), 0.18, { gain: 0.12, attack: 0.02, send: 0.8 }); },
  // About to drop by itself: a soft tick.
  beep() { this.osc(note(12), 0.04, { gain: 0.04, send: 0.2 }); },
  // The drop was called off: two notes going down.
  cancel() { this.pluck(note(6), { gain: 0.05 }); this.pluck(note(3), { gain: 0.05, delay: 0.08 }); },
};
SS.sound = Sound;
})();
