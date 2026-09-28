// Perfect-drop stars: a perfect floor throws a star off each of its four corners, each trailing
// a thin line back to where it started, fading out after about half a second.
(() => {
'use strict';
const { easeOut } = SS, { ctx, view } = SS.screen;

const STARS = {
  life: 0.55,         // seconds
  dist: 62,           // px each star travels, diagonally
  size: 4.6,          // px, centre to a point
  spin: 5,            // rad/s
  line: '255,242,160',                                       // trail colour (r,g,b)
  colors: { edge: '#d86a00', body: '#ffd21f', shine: '#fff6a8', glow: 'rgba(255,220,80,0.45)' },
};

function init(g) { g.bursts = []; }

function burst(g, top) {
  const { W, H } = SS.blocks;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.bursts.push({ x0: top.x + sx * W / 2, y0: top.y + (sy < 0 ? 2 : H - 2), dx: sx * Math.SQRT1_2, dy: sy * Math.SQRT1_2, t: 0, life: STARS.life, dist: STARS.dist, dir: sx });
  }
}

function update(g, dt) {
  for (const b of g.bursts) b.t += dt;
  g.bursts = g.bursts.filter(b => b.t < b.life);
}

function starPath(x, y, r, a) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r, t = a - Math.PI / 2 + i * Math.PI / 5;
    ctx.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr);
  }
  ctx.closePath();
}

function drawStar(x, y, r, a) {
  const C = STARS.colors, glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
  glow.addColorStop(0, C.glow); glow.addColorStop(1, 'rgba(255,220,80,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill();
  starPath(x, y, r, a);
  ctx.fillStyle = C.body; ctx.fill();
  ctx.lineJoin = 'round'; ctx.strokeStyle = C.edge; ctx.lineWidth = 0.9; ctx.stroke();
  starPath(x - r * 0.12, y - r * 0.12, r * 0.42, a);
  ctx.fillStyle = C.shine; ctx.fill();
}

function draw(g, camY) {
  const cx = view.w / 2;
  for (const b of g.bursts) {
    const k = b.t / b.life, d = b.dist * easeOut(Math.min(1, k * 1.25));
    const x0 = cx + b.x0, y0 = b.y0 - camY, x = x0 + b.dx * d, y = y0 + b.dy * d;
    ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    const trail = ctx.createLinearGradient(x0, y0, x, y);
    trail.addColorStop(0, `rgba(${STARS.line},0)`); trail.addColorStop(1, `rgba(${STARS.line},1)`);
    ctx.strokeStyle = trail; ctx.lineWidth = 1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
    drawStar(x, y, STARS.size, b.t * STARS.spin * b.dir);
  }
  ctx.globalAlpha = 1;
}

SS.stars = { STARS, init, burst, update, draw };
})();
