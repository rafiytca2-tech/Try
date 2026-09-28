// Screen shake: a heavy hit on screen gives the view a short jolt that dies away quickly.
// Off when the system asks for reduced motion.
(() => {
'use strict';

const SHAKE = {
  max: 4,           // px, however many hits pile up
  decay: 9,         // 1/s
  rate: 40,         // rad/s of the jolt's wobble
};

function init(g) { g.shake = 0; }
function add(g, px) { if (!SS.reduceMotion) g.shake = Math.min(SHAKE.max, g.shake + px); }
function update(g, dt) { g.shake *= Math.exp(-SHAKE.decay * dt); if (g.shake < 0.05) g.shake = 0; }

// How far to move the view this frame.
function offset(g) {
  if (!g.shake) return [0, 0];
  const t = SS.time * SHAKE.rate;
  return [Math.sin(t * 1.3) * g.shake, Math.cos(t * 1.7) * g.shake * 0.7];
}

SS.shake = { SHAKE, init, add, update, offset };
})();
