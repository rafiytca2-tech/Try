// The building site at street level: the concrete slab the first floor must land on, a
// chain-link fence and hedge on the left, a tree and wooden hoarding on the right, traffic cones,
// the dirt, and black below it.
(() => {
'use strict';
const { canvasOf, rect, disc, shade, mulberry32 } = SS.px, { ctx, view } = SS.screen;

const GROUND = {
  slabHalf: 52,         // half-width of the slab; a first floor landing outside it is lost
};

// This file's own seeded generator (see scenery/city.js for why the seed looks like this).
const rand = mulberry32((2005 + 770 * 0x6D2B79F5) | 0);
const rocks = Array.from({ length: 22 }, () => ({ x: Math.round(rand() * 560 - 280), y: 8 + Math.round(rand() * 56), s: 2 + Math.floor(rand() * 4) }));

const meshTile = canvasOf(6, 6);
{ const g = meshTile.getContext('2d'); for (let i = 0; i < 6; i++) { rect(g, '#b9b9b9', i, i, 1, 1); rect(g, '#b9b9b9', 5 - i, i, 1, 1); } }
const MESH = ctx.createPattern(meshTile, 'repeat');

function cone(x, yb) {
  rect(ctx, '#2a1a10', x - 4, yb - 1, 9, 2);
  rect(ctx, '#e8452c', x - 3, yb - 3, 7, 2);
  rect(ctx, '#ffffff', x - 2, yb - 5, 5, 2);
  rect(ctx, '#e8452c', x - 2, yb - 7, 5, 2);
  rect(ctx, '#e8452c', x - 1, yb - 9, 3, 2);
  rect(ctx, '#ffd0c4', x, yb - 10, 1, 1);
}

function draw(camY) {
  const gy = Math.round(-camY);
  if (gy - 80 > view.h) return;
  const cx = Math.round(view.w / 2), S = GROUND.slabHalf, back = gy - 6;

  // chain-link fence with a hedge behind it, left of the site
  const leftEnd = cx - S - 8, fTop = back - 26;
  if (leftEnd > 0) {
    rect(ctx, '#4f7f45', 0, back - 16, leftEnd, 16);
    for (let x = 0; x < leftEnd; x += 6) rect(ctx, '#6e9c62', x, back - 18, 4, 2);
    ctx.save(); ctx.translate(0, fTop); ctx.fillStyle = MESH; ctx.fillRect(0, 0, leftEnd, 26); ctx.restore();
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
    const x = cx + r.x, y = gy + Math.round(r.y * depth / 78);
    if (x < -8 || x > view.w + 8) continue;
    for (let k = 0; k < r.s; k++) rect(ctx, '#5c4526', x - k, y + k, k * 2 + 1, 1);
    rect(ctx, '#b08d5c', x, y, 1, 1);
  }
  rect(ctx, '#5a4428', 0, back + depth, view.w, 14);
  if (back + depth + 14 < view.h) rect(ctx, '#0a0a0a', 0, back + depth + 14, view.w, view.h - back - depth - 14);

  // concrete slab, drawn in the original's slight top-down perspective
  for (let r = 0; r < 12; r++) { const half = Math.round(S - 6 + r * 10 / 11); rect(ctx, shade('#abb893', -r * 3), cx - half, back + r, half * 2, 1); }
  rect(ctx, '#5d5d52', cx - S - 4, gy + 6, 2 * (S + 4), 6);
  rect(ctx, '#29201a', cx - S - 4, gy + 12, 2 * (S + 4), 1);

  cone(cx - S - 16, back + 1); cone(cx + S + 18, back + 1);
}

SS.ground = { GROUND, draw };
})();
