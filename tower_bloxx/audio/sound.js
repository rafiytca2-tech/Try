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
  holdStep(n) { this.tone(420 + n * 110, 0.06, { vol: 0.035, slide: 520 + n * 130 }); },   // the hold reached a new step
  beep() { this.tone(1320, 0.04, { vol: 0.03 }); },                                         // about to drop by itself
  cancel() { this.tone(520, 0.1, { type: 'triangle', vol: 0.05, slide: 300 }); },           // the drop was called off
  thud(k) {                                                                                   // a floor knocks into something (k: 0..1)
    this.tone(95 + 40 * k, 0.1 + 0.08 * k, { type: 'triangle', vol: 0.03 + 0.07 * k, slide: 42 });
    if (k > 0.35) this.tone(210, 0.05, { type: 'square', vol: 0.015 + 0.02 * k, slide: 80 });
  },
  crumble() { this.tone(160, 0.22, { type: 'sawtooth', vol: 0.018, slide: 55 }); [0.05, 0.11].forEach(d => this.tone(300, 0.03, { vol: 0.012, delay: d, slide: 150 })); },
  collapse() {                                                                        // the top gives way
    this.tone(120, 0.7, { type: 'sawtooth', vol: 0.05, slide: 38 });
    this.tone(70, 0.8, { type: 'triangle', vol: 0.09, slide: 40 });
    [0.12, 0.27, 0.41].forEach((d, i) => this.tone(190 - i * 30, 0.08, { vol: 0.05, slide: 60, delay: d }));
  },
  over() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.18, { vol: 0.05, delay: i * 0.14 })); },
};
SS.sound = Sound;
})();
