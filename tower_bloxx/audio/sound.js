// Sound: short square-wave blips, made on the fly with Web Audio. Starts on the first tap.
(() => {
'use strict';
const Sound = {
  ctx: null, muted: false,
  ensure() {
    if (this.muted) return;
    try {
      if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; this.ctx = new AC(); }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { /* no audio */ }
  },
  tone(freq, dur, { type = 'square', vol = 0.06, slide = 0, delay = 0 } = {}) {
    if (this.muted || !this.ctx) return;
    try {
      const c = this.ctx, t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* ignore */ }
  },
  release() { this.tone(760, 0.05, { vol: 0.03, slide: 520 }); },                   // floor let go
  land() { this.tone(160, 0.09, { vol: 0.09, slide: 70 }); this.tone(90, 0.07, { type: 'triangle', vol: 0.08 }); },
  perfect(n) { const b = 660 + Math.min(n, 6) * 60; [1, 1.26, 1.5].forEach((m, i) => this.tone(b * m, 0.08, { vol: 0.05, delay: i * 0.06 })); },
  bonus() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.09, { vol: 0.045, delay: i * 0.07 })); },
  miss() { this.tone(420, 0.4, { type: 'sawtooth', vol: 0.045, slide: 70 }); },
  over() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.18, { vol: 0.05, delay: i * 0.14 })); },
};
SS.sound = Sound;
})();
