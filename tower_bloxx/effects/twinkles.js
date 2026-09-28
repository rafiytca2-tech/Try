// Combo twinkles: while a combo runs, small gold glints wink on and off along the edges of the
// top two floors, moving with the sway.
(() => {
'use strict';
const { circle } = SS.px, { ctx, view } = SS.screen;

const TWINKLES = {
  every: [0.09, 0.21],   // seconds between glints, random in this range
  life: [0.18, 0.30],    // seconds each glint lasts
  secondFloor: 0.35,     // chance a glint is on the floor below the top
};

function init(g) { g.twinkles = []; g.twinkleT = 0; }

function update(g, dt) {
  for (const k of g.twinkles) k.t += dt;
  g.twinkles = g.twinkles.filter(k => k.t < k.life);
  if (!g.combo.n || !g.tower.length || SS.reduceMotion) return;
  g.twinkleT -= dt;
  if (g.twinkleT > 0) return;
  const { W, H } = SS.blocks, T = TWINKLES;
  g.twinkleT = T.every[0] + Math.random() * (T.every[1] - T.every[0]);
  const n = g.tower.length, i = n - 1 - (n > 1 && Math.random() < T.secondFloor ? 1 : 0), f = g.tower[i];
  const side = Math.floor(Math.random() * 3);           // left edge, right edge or the roof line
  const lx = side === 0 ? f.x - W / 2 : side === 1 ? f.x + W / 2 : f.x + (Math.random() - 0.5) * W;
  const ly = -(i + 1) * H + (side === 2 ? 0 : Math.random() * H);
  g.twinkles.push({ floor: i, lx, ly, t: 0, life: T.life[0] + Math.random() * (T.life[1] - T.life[0]), big: Math.random() < 0.5 });
}

// A four-pointed glint that grows and shrinks over its life.
function drawTwinkle(x, y, big, s) {
  const r = (big ? 3.2 : 2.2) * s, w = r * 0.22;
  ctx.fillStyle = '#ffd21f';
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x + w, y - w, x + r, y);
  ctx.quadraticCurveTo(x + w, y + w, x, y + r); ctx.quadraticCurveTo(x - w, y + w, x - r, y);
  ctx.quadraticCurveTo(x - w, y - w, x, y - r);
  ctx.fill();
  circle(ctx, x, y, r * 0.28, '#ffffff');
}

function draw(g, camY) {
  const cx = view.w / 2;
  for (const k of g.twinkles) {
    if (!g.tower[k.floor]) continue;
    const p = SS.sway.bent(g, k.lx, k.ly);
    drawTwinkle(cx + p.x, p.y - camY, k.big, Math.sin(Math.PI * k.t / k.life));
  }
}

SS.twinkles = { TWINKLES, init, update, draw };
})();
