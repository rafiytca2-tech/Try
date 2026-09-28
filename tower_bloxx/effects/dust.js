// Dust: soft clouds and fine grit kicked up where floors hit something. The clouds billow out
// along the surface that was hit, slow down in the air, swell, drift and slowly sink as they
// thin out; the grit is heavier, arcs out under gravity and settles on the ground.
(() => {
'use strict';
const { ctx, view } = SS.screen;

const DUST = {
  color: [239, 232, 214],
  cloud: {
    life: [0.8, 1.6],        // seconds
    size: [2.5, 5],          // px across at the start
    swell: [9, 18],          // px it grows by
    speed: [30, 110],        // px/s outwards, from a light hit to a heavy one
    drag: 3,                 // 1/s: air slowing it down
    rise: 25,                // px/s it starts rising (warm air)
    sink: 22,                // px/s² it sinks as it settles
    alpha: 0.55,
  },
  grit: {
    life: [0.5, 1.1],
    size: [0.4, 1],
    speed: [60, 190],
    gravityShare: 0.35,      // of a dropped floor's gravity: grit is light
    drag: 1.2,
    bounce: 0.2,
  },
  max: 360,
};

// A soft round cloud, drawn once and scaled.
const PUFF = (() => {
  const c = SS.px.canvasOf(64, 64), g = c.getContext('2d'), [r, gg, b] = DUST.color;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${r},${gg},${b},1)`); grad.addColorStop(0.55, `rgba(${r},${gg},${b},0.55)`); grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return c;
})();

const rnd = ([a, b]) => a + Math.random() * (b - a);
function init(g) { g.parts = []; }

// A hit at (x, y) on a surface facing (nx, ny) (away from it), strength k (0..1).
function burst(g, x, y, nx, ny, k = 0.5) {
  const D = DUST, C = D.cloud, G = D.grit, n = SS.reduceMotion ? 0.4 : 1;
  const clouds = Math.round((3 + 7 * k) * n), grits = Math.round((4 + 14 * k) * n);
  const tx = -ny, ty = nx;                             // along the surface
  for (let i = 0; i < clouds && g.parts.length < D.max; i++) {
    const side = i % 2 ? 1 : -1, v = rnd(C.speed) * (0.5 + k * 0.8) * (0.4 + Math.random() * 0.6);
    const sx = side * tx + nx * 0.4 + (Math.random() - 0.5) * 0.4, sy = side * ty + ny * 0.4 + (Math.random() - 0.5) * 0.4;
    g.parts.push({ cloud: true, x, y, vx: sx * v, vy: sy * v - C.rise, t: 0, life: rnd(C.life), r0: rnd(C.size), swell: rnd(C.swell) * (0.6 + k * 0.6) });
  }
  for (let i = 0; i < grits && g.parts.length < D.max; i++) {
    const a = Math.atan2(ny, nx) + (Math.random() - 0.5) * 2.4, v = rnd(G.speed) * (0.4 + k * 0.8);
    g.parts.push({ cloud: false, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rnd(G.life), r0: rnd(G.size) });
  }
}

// A floor crashing flat on the ground at x (y is the ground).
function puff(g, x, y, count) { burst(g, x, y, 0, -1, Math.min(1, count / 14)); }

function update(g, dt) {
  const C = DUST.cloud, G = DUST.grit, grav = SS.fall.FALL.gravity * G.gravityShare;
  const dc = Math.exp(-C.drag * dt), dg = Math.exp(-G.drag * dt);
  for (const p of g.parts) {
    p.t += dt;
    if (p.cloud) { p.vx *= dc; p.vy = p.vy * dc + C.sink * dt; }
    else {
      p.vx *= dg; p.vy = p.vy * dg + grav * dt;
      if (p.y > 0 && p.vy > 0) { p.y = 0; p.vy = -p.vy * G.bounce; p.vx *= 0.5; }
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.cloud && p.y > 0) p.y = 0;
  }
  g.parts = g.parts.filter(p => p.t < p.life);
}

function draw(g, camY) {
  const cx = view.w / 2, C = DUST.cloud, [r, gg, b] = DUST.color;
  for (const p of g.parts) {
    const x = cx + p.x, y = p.y - camY, k = p.t / p.life;
    if (y < -30 || y > view.h + 30) continue;
    if (p.cloud) {
      const rad = (p.r0 + p.swell * (1 - (1 - k) * (1 - k))) / 2;
      ctx.globalAlpha = C.alpha * Math.pow(1 - k, 1.6);
      ctx.drawImage(PUFF, x - rad, y - rad, rad * 2, rad * 2);
    } else {
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = `rgb(${r - 40},${gg - 40},${b - 40})`;
      ctx.beginPath(); ctx.arc(x, y, p.r0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

SS.dust = { DUST, init, burst, puff, update, draw };
})();
