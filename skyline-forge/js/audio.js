'use strict';
/* ==================================================================== *
 * Sound: everything is synthesized with Web Audio, so there are no     *
 * files to load and the game works offline.                            *
 * ==================================================================== */

const Sound = {
  ctx: null, master: null, sfx: null, music: null, noise: null, wind: null, rain: null, amb: null,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.connect(this.master);
    const buf = c.createBuffer(1, c.sampleRate, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6;
    this.wind = c.createGain(); this.wind.gain.value = 0;
    src.connect(bp).connect(this.wind).connect(this.sfx); src.start();
    // Rain: bright filtered noise. City ambience: a low murmur of traffic and people, louder as the city grows.
    const rs = c.createBufferSource(); rs.buffer = buf; rs.loop = true; rs.playbackRate.value = 0.8;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    this.rain = c.createGain(); this.rain.gain.value = 0;
    rs.connect(hp).connect(lp).connect(this.rain).connect(this.sfx); rs.start();
    const as = c.createBufferSource(); as.buffer = buf; as.loop = true; as.playbackRate.value = 0.5;
    const al = c.createBiquadFilter(); al.type = 'lowpass'; al.frequency.value = 380;
    this.amb = c.createGain(); this.amb.gain.value = 0;
    as.connect(al).connect(this.amb).connect(this.sfx); as.start();
    this.apply();
    Music.start();
  },
  resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  apply() { if (!this.ctx) return; this.sfx.gain.value = save.settings.sfx ? 1 : 0; this.music.gain.value = save.settings.music ? 0.5 : 0; },
  tone(f, dur, o = {}) {
    const c = this.ctx; if (!c) return;
    try {
      const t0 = c.currentTime + (o.delay || 0), osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t0);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t0 + (o.attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(o.dest || this.sfx); osc.start(t0); osc.stop(t0 + dur + 0.05);
    } catch (e) { /* ignore */ }
  },
  hiss(dur, o = {}) {
    const c = this.ctx; if (!c) return;
    try {
      const t0 = c.currentTime + (o.delay || 0), src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.noise; f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.freq || 800, t0); f.Q.value = o.q || 0.7;
      if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t0 + dur);
      g.gain.setValueAtTime(o.vol || 0.2, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f).connect(g).connect(o.dest || this.sfx); src.start(t0); src.stop(t0 + dur + 0.05);
    } catch (e) { /* ignore */ }
  },
  impact(E) {
    const k = Math.min(3, E);
    this.tone(95 - k * 12, 0.22 + k * 0.08, { vol: 0.32 + k * 0.08, slide: 36 });
    this.hiss(0.12 + k * 0.06, { freq: 900 - k * 150, vol: 0.14 + k * 0.06 });
  },
  // The classic's rising three-note chime: higher with every Perfect in the combo.
  perfect(streak, power) {
    const b = 660 + Math.min(streak, 6) * 60;
    [1, 1.26, 1.5].forEach((m, i) => this.tone(b * m, 0.14, { type: 'triangle', vol: 0.08, delay: i * 0.06 }));
    if (power) this.tone(55, 0.7, { vol: 0.22, type: 'triangle' });
  },
  release() { this.tone(520, 0.1, { type: 'triangle', vol: 0.07, slide: 300 }); this.hiss(0.15, { type: 'highpass', freq: 2500, vol: 0.05 }); },
  band(b) { this.tone(440 + b * 110, 0.06, { type: 'triangle', vol: 0.05 }); },
  beep() { this.tone(1500, 0.06, { type: 'square', vol: 0.04 }); },
  power() { this.hiss(0.3, { type: 'bandpass', freq: 300, sweep: 3000, q: 1.5, vol: 0.18 }); },
  recall() { this.hiss(0.4, { type: 'bandpass', freq: 3000, sweep: 400, q: 1.4, vol: 0.14 }); },
  ratchet() { for (let i = 0; i < 6; i++) this.hiss(0.02, { type: 'highpass', freq: 3000, vol: 0.035, delay: i * 0.055 }); },
  miss() { this.tone(300, 0.5, { type: 'sawtooth', vol: 0.06, slide: 80 }); },
  complete() { [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, { type: 'triangle', vol: 0.1, delay: i * 0.12 })); },
  over() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.09, delay: i * 0.16 })); },
  bonus() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.09, delay: i * 0.07 })); },
  coin(n = 1) { for (let i = 0; i < Math.min(6, n); i++) { this.tone(1568, 0.08, { type: 'square', vol: 0.03, delay: i * 0.06 }); this.tone(2093, 0.12, { type: 'square', vol: 0.025, delay: i * 0.06 + 0.04 }); } },
  star(i) { this.tone(784 * Math.pow(1.26, i), 0.35, { type: 'triangle', vol: 0.1 }); this.tone(1568 * Math.pow(1.26, i), 0.25, { vol: 0.04, delay: 0.03 }); },
  levelUp() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.45, { type: 'triangle', vol: 0.1, delay: i * 0.09 })); this.hiss(0.8, { type: 'highpass', freq: 5000, vol: 0.04, delay: 0.3 }); },
  click() { this.tone(900, 0.04, { type: 'triangle', vol: 0.04 }); },
  deny() { this.tone(180, 0.18, { type: 'square', vol: 0.04, slide: 140 }); },
  place() { this.tone(220, 0.2, { vol: 0.18, slide: 110 }); this.hiss(0.2, { freq: 1200, vol: 0.08 }); },
  demolish() { this.hiss(2.2, { freq: 260, vol: 0.45 }); for (let i = 0; i < 7; i++) this.tone(48 + Math.random() * 40, 0.5, { vol: 0.2, delay: i * 0.16 }); },
  setWind(k) { if (this.wind) this.wind.gain.setTargetAtTime(k * 0.1, this.ctx.currentTime, 0.5); },
  setRain(k) { if (this.rain) this.rain.gain.setTargetAtTime(k * 0.07, this.ctx.currentTime, 0.8); },
  setAmbience(k) { if (this.amb) this.amb.gain.setTargetAtTime(k * 0.12, this.ctx.currentTime, 1); },
  thunder(delay = 0) { this.hiss(2.6, { freq: 180, sweep: 60, vol: 0.5, delay }); this.tone(42, 1.8, { vol: 0.25, delay: delay + 0.05, slide: 30 }); },
  gull() { const f = 1500 + Math.random() * 500; this.tone(f, 0.18, { type: 'triangle', vol: 0.02, slide: f * 0.7 }); this.tone(f * 0.9, 0.22, { type: 'triangle', vol: 0.018, slide: f * 0.6, delay: 0.2 }); },
  horn() { this.tone(98, 1.4, { type: 'sawtooth', vol: 0.03, attack: 0.15 }); this.tone(147, 1.4, { type: 'sawtooth', vol: 0.02, attack: 0.15 }); },
  slowmo() { this.hiss(0.5, { type: 'bandpass', freq: 2400, sweep: 300, q: 2, vol: 0.12 }); this.tone(60, 0.6, { vol: 0.3, type: 'triangle', slide: 38 }); },
};

// Generative music: layers join as the combo grows and fall away on a miss (GDD §13).
const Music = {
  next: 0, step: 0, spb: 60 / 96 / 4, lv: { perc: 0, bass: 0, arp: 0 }, target: { perc: 0, bass: 0, arp: 0 }, timer: 0,
  start() { if (this.timer) return; this.next = Sound.ctx.currentTime + 0.1; this.timer = setInterval(() => this.tick(), 60); },
  setChain(c) { this.target = { perc: c >= 2 ? 1 : 0, bass: c >= 4 ? 1 : 0, arp: c >= 7 ? 1 : 0 }; },
  tick() {
    const c = Sound.ctx;
    if (!c || c.state !== 'running' || !save.settings.music || document.hidden) { if (c) this.next = c.currentTime + 0.1; return; }
    for (const k in this.lv) this.lv[k] += clamp(this.target[k] - this.lv[k], -0.02, 0.02);
    while (this.next < c.currentTime + 0.25) { this.play(this.step, this.next - c.currentTime); this.next += this.spb; this.step = (this.step + 1) % 64; }
  },
  play(st, delay) {
    const mt = m => 440 * Math.pow(2, (m - 69) / 12), dest = Sound.music;
    const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], ch = chords[Math.floor(st / 16) % 4], b = st % 16;
    if (b === 0) for (const n of ch) Sound.tone(mt(n), 2.4, { vol: 0.025, type: 'triangle', attack: 0.4, delay, dest });
    const L = this.lv;
    if (L.perc > 0.01) {
      if (b % 8 === 0) Sound.tone(120, 0.18, { vol: 0.12 * L.perc, slide: 40, delay, dest });
      if (b % 4 === 2) Sound.hiss(0.05, { type: 'highpass', freq: 6000, vol: 0.03 * L.perc, delay, dest });
    }
    if (L.bass > 0.01 && (b === 0 || b === 6 || b === 10)) Sound.tone(mt(ch[0] - 24), 0.35, { vol: 0.09 * L.bass, type: 'triangle', delay, dest });
    if (L.arp > 0.01 && b % 2 === 0) Sound.tone(mt(ch[(b / 2) % 3] + 12), 0.18, { vol: 0.035 * L.arp, type: 'square', delay, dest });
  },
};
