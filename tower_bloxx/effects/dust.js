// Dust: a puff of pale specks where a missed floor crashes on the ground.
(() => {
'use strict';
const { circle } = SS.px, { ctx, view } = SS.screen;

const DUST = {
  color: '#efe8d6',
  spread: 90,          // px/s sideways, either way
  rise: [15, 60],      // px/s upwards
  life: [0.35, 0.6],   // seconds
  gravity: 380,        // px/s²
};

function init(g) { g.parts = []; }

function puff(g, x, y, count) {
  const n = SS.reduceMotion ? Math.ceil(count / 3) : count, D = DUST;
  for (let i = 0; i < n; i++) g.parts.push({ x: x + (Math.random() - 0.5) * 6, y: y - 1, vx: (Math.random() - 0.5) * D.spread, vy: -(D.rise[0] + Math.random() * (D.rise[1] - D.rise[0])), t: 0, life: D.life[0] + Math.random() * (D.life[1] - D.life[0]), c: D.color, s: Math.random() < 0.3 ? 2 : 1, g: D.gravity });
}

function update(g, dt) {
  for (const p of g.parts) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.t += dt; }
  g.parts = g.parts.filter(p => p.t < p.life);
}

function draw(g, camY) {
  const cx = view.w / 2;
  for (const p of g.parts) {
    ctx.globalAlpha = 1 - p.t / p.life;
    circle(ctx, cx + p.x, p.y - camY, p.s * (0.6 + 0.5 * p.t / p.life), p.c);
  }
  ctx.globalAlpha = 1;
}

SS.dust = { DUST, init, puff, update, draw };
})();
