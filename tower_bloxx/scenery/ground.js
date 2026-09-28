// The building site at street level: the concrete slab the first floor must land on, a
// chain-link fence and hedge on the left, a tree and wooden hoarding on the right, traffic cones,
// the dirt, and black below it.
(() => {
'use strict';
const { canvasOf, rect, rrect, circle, disc, poly, shade, mulberry32 } = SS.px, { ctx, view } = SS.screen;

const GROUND = {
  slabHalf: 52,         // half-width of the slab; a first floor landing outside it is lost
};

// This file's own seeded generator (see scenery/city.js for why the seed looks like this).
const rand = mulberry32((2005 + 770 * 0x6D2B79F5) | 0);
const rocks = Array.from({ length: 22 }, () => ({ x: Math.round(rand() * 560 - 280), y: 8 + Math.round(rand() * 56), s: 2 + Math.floor(rand() * 4) }));

// Chain-link: a diamond mesh every 6 px, drawn at MESH_RES times size so it stays crisp.
const MESH_RES = 8, meshTile = canvasOf(6 * MESH_RES, 6 * MESH_RES);
{
  const g = meshTile.getContext('2d'), T = 6 * MESH_RES;
  g.strokeStyle = '#b9b9b9'; g.lineWidth = 0.8 * MESH_RES;
  for (const k of [-1, 0, 1]) {
    g.beginPath(); g.moveTo(k * T, 0); g.lineTo(k * T + T, T); g.stroke();
    g.beginPath(); g.moveTo(k * T + T, 0); g.lineTo(k * T, T); g.stroke();
  }
}
const MESH = ctx.createPattern(meshTile, 'repeat');

// A traffic cone standing on yb, centred on x + 0.5.
function cone(x, yb) {
  const c = x + 0.5, hw = y => 0.5 + 3 * (y - (yb - 10)) / 9;   // half-width at height y
  const band = (y0, y1, color) => poly(ctx, color, [c - hw(y0), y0, c + hw(y0), y0, c + hw(y1), y1, c - hw(y1), y1]);
  rrect(ctx, '#2a1a10', x - 4, yb - 1.5, 9, 2.5, 0.8);
  band(yb - 10, yb - 1, '#e8452c');
  band(yb - 5.4, yb - 3.4, '#ffffff');
  circle(ctx, c - 0.2, yb - 8.6, 0.5, '#ffd0c4');
}

function draw(camY) {
  const gy = -camY;
  if (gy - 80 > view.h) return;
  const cx = view.w / 2, S = GROUND.slabHalf, back = gy - 6;

  // chain-link fence with a hedge behind it, left of the site
  const leftEnd = cx - S - 8, fTop = back - 26;
  if (leftEnd > 0) {
    rect(ctx, '#4f7f45', 0, back - 16, leftEnd, 16);
    for (let x = 0; x < leftEnd; x += 6) rect(ctx, '#6e9c62', x, back - 18, 4, 2);
    ctx.save(); ctx.translate(0, fTop); ctx.scale(1 / MESH_RES, 1 / MESH_RES);
    ctx.fillStyle = MESH; ctx.fillRect(0, 0, leftEnd * MESH_RES, 26 * MESH_RES); ctx.restore();
    rect(ctx, '#d0d0d0', 0, fTop, leftEnd, 1); rect(ctx, '#7a7a7a', 0, fTop + 1, leftEnd, 1);
    for (let x = leftEnd - 3; x > -3; x -= 22) { rect(ctx, '#5e5e5e', x, fTop - 2, 3, 28); rect(ctx, '#a8a8a8', x, fTop - 2, 1, 28); }
  }

  // tree and wooden hoarding, right of the site
  const rs = cx + S + 10, wTop = back - 30, tx = cx + S + 50;
  rect(ctx, '#3b2716', tx - 2, back - 40, 5, 40);
  disc(ctx, tx, back - 50, 17, '#1f4a1c');
  disc(ctx, tx - 10, back - 44, 11, '#2c6526'); disc(ctx, tx + 11, back - 45, 12, '#2c6526'); disc(ctx, tx + 1, back - 58, 12, '#2c6526');
  disc(ctx, tx - 5, back - 57, 6, '#3f8a36'); disc(ctx, tx - 12, back - 47, 5, '#3f8a36'); disc(ctx, tx + 7, back - 52, 5, '#3f8a36');
  rect(ctx, '#6dbb58', tx - 7, back - 61, 2, 2); rect(ctx, '#6dbb58', tx + 5, back - 55, 2, 1);
  if (rs < view.w) {
    for (let x = rs; x < view.w; x += 5) { rect(ctx, '#c9a45e', x, wTop, 4, 30); rect(ctx, '#9a7a3e', x + 4, wTop, 1, 30); rect(ctx, '#e2c888', x, wTop, 4, 1); }
    rect(ctx, '#b08e4c', rs, wTop + 8, view.w - rs, 2); rect(ctx, '#b08e4c', rs, wTop + 21, view.w - rs, 2);
    rect(ctx, '#1a1a1a', rs + 12, wTop + 10, 16, 9); rect(ctx, '#f0d23a', rs + 13, wTop + 11, 14, 7);
    rect(ctx, '#1a1a1a', rs + 15, wTop + 13, 4, 1); rect(ctx, '#1a1a1a', rs + 21, wTop + 13, 4, 1); rect(ctx, '#1a1a1a', rs + 15, wTop + 15, 10, 1);
  }

  // dirt, then nothing but black below it (like the original's bottom bar)
  const depth = Math.max(78, Math.round(view.h * 0.2));
  rect(ctx, '#946a20', 0, back, view.w, depth); rect(ctx, '#a57a30', 0, back, view.w, 1);
  for (const r of rocks) {
    const x = Math.round(cx) + r.x, y = gy + Math.round(r.y * depth / 78);
    if (x < -8 || x > view.w + 8) continue;
    poly(ctx, '#5c4526', [x + 0.5, y - 0.3, x + r.s + 0.3, y + r.s, x + 0.7 - r.s, y + r.s]);
    circle(ctx, x + 0.5, y + 0.7, 0.55, '#b08d5c');
  }
  rect(ctx, '#5a4428', 0, back + depth, view.w, 14);
  if (back + depth + 14 < view.h) rect(ctx, '#0a0a0a', 0, back + depth + 14, view.w, view.h - back - depth - 14);

  // concrete slab, drawn in the original's slight top-down perspective
  const slab = ctx.createLinearGradient(0, back, 0, back + 12);
  slab.addColorStop(0, '#abb893'); slab.addColorStop(1, shade('#abb893', -33));
  poly(ctx, slab, [cx - S + 6, back, cx + S - 6, back, cx + S + 4, back + 12, cx - S - 4, back + 12]);
  rect(ctx, '#5d5d52', cx - S - 4, gy + 6, 2 * (S + 4), 6);
  rect(ctx, '#29201a', cx - S - 4, gy + 12, 2 * (S + 4), 1);

  cone(cx - S - 16, back + 1); cone(cx + S + 18, back + 1);
}

SS.ground = { GROUND, draw };
})();
