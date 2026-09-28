// Perfect-drop stars: a perfect floor throws a star off each of its four corners, each trailing
// a thin line back to where it started, fading out after about half a second.
(() => {
'use strict';
const { easeOut } = SS, { rect, pixLine } = SS.px, { ctx, view } = SS.screen;

const STARS = {
  life: 0.55,         // seconds
  dist: 62,           // px each star travels, diagonally
  line: '#fff2a0',
};

function init(g) { g.bursts = []; }

function burst(g, top) {
  const { W, H } = SS.blocks;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.bursts.push({ x0: top.x + sx * W / 2, y0: top.y + (sy < 0 ? 2 : H - 2), dx: sx * Math.SQRT1_2, dy: sy * Math.SQRT1_2, t: 0, life: STARS.life, dist: STARS.dist });
  }
}

function update(g, dt) {
  for (const b of g.bursts) b.t += dt;
  g.bursts = g.bursts.filter(b => b.t < b.life);
}

function drawStar(x, y) {
  const O = '#d86a00', Y = '#ffd21f', L = '#fff6a8';
  rect(ctx, O, x - 1, y - 4, 3, 1); rect(ctx, O, x - 4, y - 1, 9, 1); rect(ctx, O, x - 3, y + 2, 7, 1); rect(ctx, O, x - 3, y + 3, 2, 1); rect(ctx, O, x + 2, y + 3, 2, 1);
  rect(ctx, Y, x, y - 3, 1, 1); rect(ctx, Y, x - 1, y - 2, 3, 1); rect(ctx, Y, x - 3, y, 7, 2); rect(ctx, Y, x - 2, y + 2, 5, 1); rect(ctx, Y, x - 1, y - 1, 3, 1);
  rect(ctx, L, x, y - 1, 1, 2);
}

function draw(g, camY) {
  const cx = view.w / 2;
  for (const b of g.bursts) {
    const k = b.t / b.life, d = b.dist * easeOut(Math.min(1, k * 1.25));
    const x0 = cx + b.x0, y0 = b.y0 - camY, x = x0 + b.dx * d, y = y0 + b.dy * d;
    ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    pixLine(ctx, STARS.line, Math.round(x0), Math.round(y0), Math.round(x), Math.round(y));
    drawStar(Math.round(x), Math.round(y));
  }
  ctx.globalAlpha = 1;
}

SS.stars = { STARS, init, burst, update, draw };
})();
