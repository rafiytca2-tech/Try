// Chips: little flakes of concrete, paint and glass knocked off floors when they hit something.
// They fly out from the hit, spin, fall under gravity, bounce and skid on the ground, and fade.
(() => {
'use strict';
const { ctx, view } = SS.screen;

const CHIPS = {
  gravityShare: 0.8,          // of a dropped floor's gravity (drop/fall.js)
  speed: [50, 230],           // px/s thrown, from a light hit to a heavy one
  spread: 1.3,                // radians either side of the way they're thrown
  size: [0.7, 2.3],           // px
  life: [0.9, 1.9],           // seconds
  bounce: 0.35,               // share of speed kept bouncing off the ground
  skid: 0.55,                 // share of sideways speed and spin kept each bounce
  max: 280,
  colors: ['#479cab', '#1a5f6f', '#a8a89c', '#9aa29c', '#72c3cf', '#a2ae8e', '#555c57'],
};

function init(g) { g.chips = []; }

// count chips from (x, y), thrown mostly along (dx, dy), harder for k (0..1).
function burst(g, x, y, dx, dy, count, k = 0.5) {
  const C = CHIPS, base = Math.atan2(dy, dx);
  for (let i = 0; i < count && g.chips.length < C.max; i++) {
    const a = base + (Math.random() - 0.5) * 2 * C.spread, v = (C.speed[0] + (C.speed[1] - C.speed[0]) * k) * (0.4 + Math.random() * 0.8);
    const s = C.size[0] + Math.random() * (C.size[1] - C.size[0]), n = Math.random() < 0.5 ? 3 : 4, shape = [];
    for (let j = 0; j < n; j++) { const t = (j / n) * Math.PI * 2 + Math.random() * 0.8, r = s * (0.6 + Math.random() * 0.5); shape.push([Math.cos(t) * r, Math.sin(t) * r]); }
    g.chips.push({
      x: x + (Math.random() - 0.5) * 3, y: y + (Math.random() - 0.5) * 3, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40 * Math.random(),
      a: Math.random() * 6.28, w: (Math.random() - 0.5) * 30, s, shape, t: 0,
      life: C.life[0] + Math.random() * (C.life[1] - C.life[0]), color: C.colors[Math.floor(Math.random() * C.colors.length)],
    });
  }
}

function update(g, dt) {
  const C = CHIPS, grav = SS.fall.FALL.gravity * C.gravityShare;
  for (const c of g.chips) {
    c.t += dt;
    c.vy += grav * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.a += c.w * dt;
    if (c.y > -c.s * 0.5 && c.vy > 0) {                  // the ground
      c.y = -c.s * 0.5; c.vy = -c.vy * C.bounce; c.vx *= C.skid; c.w *= C.skid;
      if (c.vy > -25) c.vy = 0;
    }
  }
  g.chips = g.chips.filter(c => c.t < c.life);
}

function draw(g, camY) {
  const cx = view.w / 2;
  for (const c of g.chips) {
    const x = cx + c.x, y = c.y - camY;
    if (y < -10 || y > view.h + 10) continue;
    const k = c.t / c.life, co = Math.cos(c.a), si = Math.sin(c.a);
    ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.fillStyle = c.color;
    ctx.beginPath();
    c.shape.forEach(([u, v], i) => (i ? ctx.lineTo(x + co * u - si * v, y + si * u + co * v) : ctx.moveTo(x + co * u - si * v, y + si * u + co * v)));
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

SS.chips = { CHIPS, init, burst, update, draw };
})();
