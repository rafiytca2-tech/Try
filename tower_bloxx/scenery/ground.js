// The building site at street level, seen in 3D through the camera's eye like the floors: the
// concrete slab the first floor must land on (its top narrowing away, as in the original), a
// chain-link fence and hedge on the left, a tree and wooden hoarding on the right, traffic cones,
// the ground's top going back to the fence line and its cut face, and black below it.
(() => {
'use strict';
const { canvasOf, rect, rrect, circle, disc, poly, shade, mulberry32 } = SS.px, { ctx, view } = SS.screen;

const GROUND = {
  slabHalf: 52,         // half-width of the slab; a first floor landing outside it is lost
  front: 6,             // px below street level where the ground's top ends and its cut face starts
  siteDeep: 50,         // 3D: px from there back to the fence line
  slabFront: 3,         // px below street level of the slab's front edge
  slabDeep: 44,         // 3D: px the slab's top goes back
  slabThick: 4,         // px of the slab's front face
  tufts: [-118, -104, -90, -76, -71, 74, 88, 97, 111, 121],   // px from the middle: grass on the ground's top
  tuftSpan: 280,        // px: the grass repeats this far apart across a wide screen (the stones every 560)
};

// This file's own seeded generator (see scenery/city.js for why the seed looks like this).
const rand = mulberry32((2005 + 770 * 0x6D2B79F5) | 0);
const ROCKS_SPAN = 560;
const rocks = Array.from({ length: 22 }, () => ({ x: Math.round(rand() * ROCKS_SPAN - ROCKS_SPAN / 2), y: 8 + Math.round(rand() * 56), s: 2 + Math.floor(rand() * 4) }));
// Calls fn with each offset (0, ±span, ±2 span, ...) needed to cover the screen from the middle out.
function across(span, fn) {
  const k = Math.ceil(view.w / 2 / span);
  for (let i = -k; i <= k; i++) fn(i * span);
}

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

// A round clump of leaves: light where the sun catches it (top left), dark underneath.
function leaf(x, y, r, lit, dark) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, lit); g.addColorStop(1, dark);
  circle(ctx, x, y, r, g);
}
// A little tuft of grass at (x, y), its foot on the ground.
function tuft(x, y) {
  ctx.strokeStyle = '#5f8f3a'; ctx.lineWidth = 0.7; ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [dx, h, lean] of [[-1.2, 3.2, -0.8], [0, 4.2, 0.2], [1.1, 3, 0.9], [2, 2.2, 1.2]]) { ctx.moveTo(x + dx, y); ctx.quadraticCurveTo(x + dx + lean * 0.3, y - h * 0.6, x + dx + lean, y - h); }
  ctx.stroke();
}
// A traffic cone standing on yb, centred on x + 0.5.
function cone(x, yb) {
  const c = x + 0.5, hw = y => 0.5 + 3 * (y - (yb - 10)) / 9;   // half-width at height y
  const band = (y0, y1, color) => poly(ctx, color, [c - hw(y0), y0, c + hw(y0), y0, c + hw(y1), y1, c - hw(y1), y1]);
  rrect(ctx, '#2a1a10', x - 4, yb - 1.5, 9, 2.5, 0.8);
  const shine = ctx.createLinearGradient(c - 3.5, 0, c + 3.5, 0);   // lit on the left, round the right
  shine.addColorStop(0, '#ff7a5c'); shine.addColorStop(0.35, '#f0523a'); shine.addColorStop(1, '#a92a18');
  band(yb - 10, yb - 1, shine);
  band(yb - 5.4, yb - 3.4, '#f4f4f4');
  circle(ctx, c - 0.9, yb - 7.2, 0.45, 'rgba(255,230,220,0.9)');
}

function draw(camY) {
  const gy = -camY;
  if (gy - 80 > view.h) return;
  // 3D: things further back are drawn in toward the camera's eye (camera/camera.js)
  const E = SS.camera.eye(), far = d => E.dist / (E.dist + d);
  const toBack = (x, y, d) => [E.x + (x - E.x) * far(d), E.y + (y - E.y) * far(d)];
  const cx = view.w / 2, S = GROUND.slabHalf, front = gy + GROUND.front;
  const back = E.y + (front - E.y) * far(GROUND.siteDeep);   // the back of the site: the fence line

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
  const trunk = ctx.createLinearGradient(tx - 2, 0, tx + 3, 0);
  trunk.addColorStop(0, '#5a3d22'); trunk.addColorStop(1, '#2e1e10');
  ctx.fillStyle = trunk; ctx.fillRect(tx - 2, back - 40, 5, 40);
  leaf(tx, back - 50, 17.5, '#2f6a28', '#173b15');                 // leafy clumps, lit from the top left
  leaf(tx - 10, back - 44, 11.5, '#3b7d31', '#1f4a1c'); leaf(tx + 11, back - 45, 12.5, '#357530', '#1b441a'); leaf(tx + 1, back - 58, 12.5, '#459238', '#22521f');
  leaf(tx - 5, back - 57, 6.5, '#63ad50', '#3a7a30'); leaf(tx - 12, back - 47, 5.5, '#5aa148', '#347129'); leaf(tx + 7, back - 52, 5.5, '#5aa148', '#347129');
  if (rs < view.w) {
    for (let x = rs; x < view.w; x += 5) { rect(ctx, '#c9a45e', x, wTop, 4, 30); rect(ctx, '#9a7a3e', x + 4, wTop, 1, 30); rect(ctx, '#e2c888', x, wTop, 4, 1); }
    rect(ctx, '#b08e4c', rs, wTop + 8, view.w - rs, 2); rect(ctx, '#b08e4c', rs, wTop + 21, view.w - rs, 2);
    rect(ctx, '#1a1a1a', rs + 12, wTop + 10, 16, 9); rect(ctx, '#f0d23a', rs + 13, wTop + 11, 14, 7);
    rect(ctx, '#1a1a1a', rs + 15, wTop + 13, 4, 1); rect(ctx, '#1a1a1a', rs + 21, wTop + 13, 4, 1); rect(ctx, '#1a1a1a', rs + 15, wTop + 15, 10, 1);
  }

  // the ground: its sunlit top going back to the fence line, then the cut face of the dirt, then
  // nothing but black below it (like the original's bottom bar)
  const depth = Math.max(78, Math.round(view.h * 0.2));
  const top = ctx.createLinearGradient(0, back, 0, front);
  top.addColorStop(0, '#9c7a3c'); top.addColorStop(1, '#b89048');
  ctx.fillStyle = top; ctx.fillRect(0, back, view.w, front - back);
  rect(ctx, '#946a20', 0, front, view.w, back + depth - front); rect(ctx, '#c9a25a', 0, front, view.w, 1);
  across(ROCKS_SPAN, off => {
    for (const r of rocks) {
      const x = Math.round(cx) + r.x + off, y = gy + Math.round(r.y * depth / 78);
      if (x < -8 || x > view.w + 8) continue;
      poly(ctx, '#5c4526', [x + 0.5, y - 0.3, x + r.s + 0.3, y + r.s, x + 0.7 - r.s, y + r.s]);
      circle(ctx, x + 0.5, y + 0.7, 0.55, '#b08d5c');
    }
  });
  rect(ctx, '#5a4428', 0, back + depth, view.w, 14);
  if (back + depth + 14 < view.h) rect(ctx, '#0a0a0a', 0, back + depth + 14, view.w, view.h - back - depth - 14);

  // the concrete slab, a low box seen from a little above: its top going back and narrowing
  // toward the eye (as in the original), and its front face
  const x0 = cx - S - 4, x1 = cx + S + 4, f = gy + GROUND.slabFront, t = GROUND.slabThick;
  const [bx0, by0] = toBack(x0, f, GROUND.slabDeep), [bx1] = toBack(x1, f, GROUND.slabDeep);
  const lit = ctx.createLinearGradient(0, by0, 0, f);
  lit.addColorStop(0, '#a3b08b'); lit.addColorStop(1, '#bcc8a4');
  poly(ctx, lit, [x0, f, x1, f, bx1, by0, bx0, by0]);
  rect(ctx, '#8c917f', x0, f, x1 - x0, t); rect(ctx, '#d6dcc6', x0, f, x1 - x0, 0.8);
  rect(ctx, 'rgba(20,14,8,0.35)', x0, f + t, x1 - x0, 1.2);

  cone(cx - S - 16, back + 1); cone(cx + S + 18, back + 1);
  across(GROUND.tuftSpan, off => {
    for (const x of GROUND.tufts) { const xx = x + off, tx2 = cx + xx; if (tx2 > -4 && tx2 < view.w + 4 && Math.abs(xx) > S + 12) tuft(tx2, back + 3 + (Math.abs(xx) % 5)); }
  });
}

SS.ground = { GROUND, draw };
})();
