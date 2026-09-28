// How a floor looks: its size, the teal body with a concrete cap, the beige window frames with
// sky-reflecting glass, the glass doors on the ground floor, and the balcony floor that comes
// every 10th floor. Floors are solid boxes seen in 3D through the camera's eye: a sliver of roof,
// underside or side wall shows depending on where a floor is against the eye, and it stays
// right however a floor is turned. The facade is lit
// from the top left, the glass is glossy, and at night windows light up. Everything is painted
// once at 8x detail so it stays sharp at any screen size and when it turns. Also draws a floor
// at any position and angle.
(() => {
'use strict';
const { canvasOf, rect, shade } = SS.px;

const W = 40, H = 46;   // one floor, in game pixels (97 x 110 px in the recording)
const RES = 8;          // detail the floors are painted at
const BLOCK = { body: '#479cab', light: '#72c3cf', dark: '#1a5f6f', outline: '#0e3440', frame: '#a2ae8e', frameDark: '#2c3526', cap: '#a8a89c' };
const GLASS = [['#c9f3fa', 6], ['#8fdbea', 7], ['#52bbd1', 6], ['#3899b3', 4], ['#2a7b93', 3]];   // sky reflection, top to bottom

// Glass: the sky's reflection from light to deep, a bright edge, and two glossy streaks.
function paintGlass(g, x, y, w, h) {
  let yy = y;
  for (const [c, n] of GLASS) { const rows = Math.min(Math.round(n * h / 26), y + h - yy); if (rows > 0) rect(g, c, x, yy, w, rows); yy += rows; }
  if (yy < y + h) rect(g, GLASS[GLASS.length - 1][0], x, yy, w, y + h - yy);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.beginPath(); g.moveTo(x, y + h * 0.5); g.lineTo(x + w, y + h * 0.22); g.lineTo(x + w, y + h * 0.36); g.lineTo(x, y + h * 0.64); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.16)';
  g.beginPath(); g.moveTo(x, y + h * 0.72); g.lineTo(x + w, y + h * 0.5); g.lineTo(x + w, y + h * 0.54); g.lineTo(x, y + h * 0.76); g.fill();
  g.restore();
  rect(g, '#f2fdff', x, y + 1, 1, Math.round(h * 0.4));
}
function paintWindow(g, x, y, w, h) {
  rect(g, BLOCK.frameDark, x, y, w, h);
  rect(g, BLOCK.frame, x + 1, y + 1, w - 2, h - 2);
  rect(g, shade(BLOCK.frame, 28), x + 1, y + 1, w - 2, 1);
  rect(g, BLOCK.frameDark, x + 2, y + 2, w - 4, h - 4);
  paintGlass(g, x + 3, y + 3, w - 6, h - 6);
  rect(g, shade(BLOCK.frame, 38), x - 0.5, y + h, w + 1, 1);          // the sill, catching the light
  rect(g, 'rgba(0,0,0,0.22)', x - 0.5, y + h + 1, w + 1, 1);          //   and its shadow
}
// Light from the top left: the facade a little brighter at the top, a soft shadow under the
// concrete slab along the top, and a seam up the middle.
function paintFacade(g, t) {
  const face = g.createLinearGradient(0, 1, 0, H - 1);
  face.addColorStop(0, shade(t.body, 14)); face.addColorStop(1, shade(t.body, -14));
  g.fillStyle = face; g.fillRect(1, 1, W - 2, H - 2);
  const ao = g.createLinearGradient(0, 5, 0, 10);
  ao.addColorStop(0, 'rgba(0,20,30,0.3)'); ao.addColorStop(1, 'rgba(0,20,30,0)');
  g.fillStyle = ao; g.fillRect(1, 5, W - 2, 5);
}
function paintBlock(g, t, door) {
  rect(g, t.outline, 0, 0, W, H);
  paintFacade(g, t);
  if (!door) rect(g, shade(t.body, -22), 19.7, 6, 0.6, H - 10);
  rect(g, t.light, 1, 5, 2, H - 9);
  rect(g, t.dark, W - 2, 4, 1, H - 5);                // the corner, turning into the wall
  rect(g, t.dark, 1, H - 4, W - 2, 3);                // shaded underside
  rect(g, shade(t.cap, 30), 1, 1, W - 2, 1);          // concrete floor slab along the top
  rect(g, t.cap, 1, 2, W - 2, 2);
  rect(g, shade(t.cap, -40), 1, 4, W - 2, 1);
  if (door) {
    paintWindow(g, 7, 8, 26, H - 11);
    rect(g, BLOCK.frame, 9, 16, 22, 2);               // transom bar
    rect(g, BLOCK.frameDark, 19, 18, 2, H - 21);      // between the door leaves
    rect(g, '#e6ecd5', 17, 29, 1, 3); rect(g, '#e6ecd5', 22, 29, 1, 3);
  } else {
    for (const x of [6, 22]) paintWindow(g, x, 8, 12, 31);
  }
}
// Every 10th floor: a gold cap, wide glass doors onto a balcony with a white railing and two
// potted plants, the balcony slab sticking out a little past the walls, and small lamps below.
const BALCONY = {
  out: 3,             // px the balcony sticks out past each wall (looks only: the floor is still W wide)
  trim: '#e2b64a', trimDark: '#8a6516', rail: '#f4f1e6', railShade: '#aeb0a4',
  slab: '#d4d4c8', slabDark: '#6f6f64', pot: '#b0603a', leaf: '#2f7a2c', leafLight: '#6dbb58',
};
function paintBalcony(g, t) {
  const B = BALCONY, o = B.out, wide = W + 2 * o;
  rect(g, t.outline, 0, 0, W, H);
  paintFacade(g, t);
  rect(g, t.light, 1, 5, 2, H - 9);
  rect(g, t.dark, W - 2, 4, 1, H - 5);
  rect(g, t.dark, 1, H - 4, W - 2, 3);
  rect(g, shade(B.trim, 45), 1, 1, W - 2, 1);           // gold cap
  rect(g, B.trim, 1, 2, W - 2, 2);
  rect(g, B.trimDark, 1, 4, W - 2, 1);
  rect(g, BLOCK.frameDark, 5, 7, 30, 27);               // glass doors, three panes
  rect(g, BLOCK.frame, 6, 8, 28, 25);
  rect(g, shade(BLOCK.frame, 28), 6, 8, 28, 1);
  for (const x of [7, 16, 25]) { rect(g, BLOCK.frameDark, x, 9, 8, 24); paintGlass(g, x + 1, 10, 6, 22); }
  for (const x of [3.5, 36.5]) {                        // potted plants behind the railing
    rect(g, B.pot, x - 2.5, 29, 5, 4);
    g.fillStyle = B.leaf; g.beginPath(); g.arc(x, 27.5, 2.8, 0, Math.PI * 2); g.fill();
    g.fillStyle = B.leafLight; g.beginPath(); g.arc(x - 0.8, 26.6, 1.3, 0, Math.PI * 2); g.fill();
  }
  rect(g, 'rgba(0,0,0,0.28)', 1, 36, W - 2, 2);          // the slab's shadow on the wall
  rect(g, B.slab, -o, 33, wide, 2);                     // balcony slab
  rect(g, B.slabDark, -o, 35, wide, 1);
  rect(g, B.rail, -o, 23, wide, 1.4);                   // railing
  rect(g, B.railShade, -o, 24.4, wide, 0.5);
  for (let x = -o + 0.6; x < W + o - 0.5; x += 2.5) rect(g, B.rail, x, 24.9, 0.8, 8.1);
  rect(g, B.rail, -o, 31.8, wide, 1.2);
  rect(g, B.railShade, -o, 23, 1, 10); rect(g, B.railShade, W + o - 1, 23, 1, 10);
  for (const x of [9, 20, 31]) {                        // lamps under the balcony
    g.fillStyle = B.trim; g.beginPath(); g.arc(x, 40.5, 1, 0, Math.PI * 2); g.fill();
  }
}

const SPR = {}, OUT = { balcony: BALCONY.out };
for (const kind of ['floor', 'foundation', 'balcony']) {
  const o = OUT[kind] || 0;
  SPR[kind] = canvasOf((W + 2 * o) * RES, H * RES);
  const g = SPR[kind].getContext('2d');
  g.scale(RES, RES);
  g.translate(o, 0);
  if (kind === 'balcony') paintBalcony(g, BLOCK); else paintBlock(g, BLOCK, kind === 'foundation');
}

// The box behind the front, in 3D: a floor goes BOX.depth back from its front, and the camera's
// eye (camera/camera.js) draws that depth in toward one point. So a floor below the eye shows a
// sliver of its roof, one above it a sliver of its underside, and one off to the side a sliver of
// the wall facing the middle. The faces are worked out on screen from wherever the front is
// drawn, so they stay right however a floor is moved or turned.
const BOX = { depth: 40 };   // px from a floor's front to its back
const FACE = {
  roof: shade(BLOCK.cap, 16), roofInner: shade(BLOCK.cap, 2), rim: shade(BLOCK.cap, 48),
  goldRim: shade(BALCONY.trim, 20),
  under: shade(BLOCK.body, -80),
  wallLit: shade(BLOCK.body, -18), wallShade: shade(BLOCK.body, -44),
  glass: '#2b6377', edge: 'rgba(8,30,40,0.7)',
};

// Night: floors darken as the sky does (their lit windows are drawn over this, see lights()).
const NIGHT = { color: '8,14,40', strength: 0.55 };
let shadeNow = null;
function setNight(night) { shadeNow = night > 0 ? `rgba(${NIGHT.color},${(NIGHT.strength * night).toFixed(3)})` : null; }

const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
function fillPoly(g, color, pts) {
  g.fillStyle = color; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath(); g.fill();
  if (shadeNow) { g.fillStyle = shadeNow; g.fill(); }
}

// The faces behind a floor whose front's top-left corner is at (x, y) in the current drawing
// space. opt.roof / opt.under = false leave those out (a floor in the tower has another floor
// right under it, so its underside never shows).
function faces(g, kind, x, y, opt = {}) {
  const S = SS.screen;
  if (!S.baseInv) return;
  const L = S.baseInv.multiply(g.getTransform());           // this drawing space -> screen (game px)
  const P = (px, py) => [L.a * px + L.c * py + L.e, L.b * px + L.d * py + L.f];
  const E = SS.camera.eye(), k = E.dist / (E.dist + BOX.depth);
  const front = [P(x, y), P(x + W, y), P(x + W, y + H), P(x, y + H)];   // corners: top left, top right, bottom right, bottom left
  const back = front.map(([px, py]) => [E.x + (px - E.x) * k, E.y + (py - E.y) * k]);
  g.save();
  g.setTransform(S.base);
  for (let i = 0; i < 4; i++) {                               // edges: top, right, bottom, left
    if ((i === 0 && opt.roof === false) || (i === 2 && opt.under === false)) continue;
    const p0 = front[i], p1 = front[(i + 1) % 4], q0 = back[i], q1 = back[(i + 1) % 4];
    const ex = p1[0] - p0[0], ey = p1[1] - p0[1];
    if ((E.x - p0[0]) * ey - (E.y - p0[1]) * ex <= 0.01) continue;   // the eye is on this edge's inside: hidden
    const quad = [p0, p1, q1, q0];
    if (i === 0) {                                           // roof: concrete, a lit front rim, a raised edge
      fillPoly(g, FACE.roof, quad);
      fillPoly(g, FACE.roofInner, [lerp(lerp(p0, q0, 0.2), lerp(p1, q1, 0.2), 0.06), lerp(lerp(p0, q0, 0.2), lerp(p1, q1, 0.2), 0.94), lerp(lerp(p0, q0, 0.85), lerp(p1, q1, 0.85), 0.94), lerp(lerp(p0, q0, 0.85), lerp(p1, q1, 0.85), 0.06)]);
      g.strokeStyle = kind === 'balcony' ? FACE.goldRim : FACE.rim; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
    } else if (i === 2) {
      fillPoly(g, FACE.under, quad);
    } else {                                                 // a wall (left one lit, right one in shade), with a narrow window
      fillPoly(g, i === 3 ? FACE.wallLit : FACE.wallShade, quad);
      const a = i === 1 ? 8 / H : 1 - 39 / H, b = i === 1 ? 39 / H : 1 - 8 / H;   // the right edge runs down, the left one up
      fillPoly(g, FACE.glass, [lerp(lerp(p0, p1, a), lerp(q0, q1, a), 0.3), lerp(lerp(p0, p1, b), lerp(q0, q1, b), 0.3), lerp(lerp(p0, p1, b), lerp(q0, q1, b), 0.7), lerp(lerp(p0, p1, a), lerp(q0, q1, a), 0.7)]);
    }
    g.strokeStyle = FACE.edge; g.lineWidth = 0.5;              // the far edge
    g.beginPath(); g.moveTo(q0[0], q0[1]); g.lineTo(q1[0], q1[1]); g.stroke();
  }
  g.restore();
}

// Lights on at night: where the glass is on each kind of floor, and which windows are lit.
const PANES = {
  floor: [[9, 11, 6, 25], [25, 11, 6, 25]],
  foundation: [[10, 11, 20, 29]],
  balcony: [[8, 10, 6, 22], [17, 10, 6, 22], [26, 10, 6, 22]],
};
const LIGHT = { on: 0.72, colors: ['255,214,140', '255,232,176', '255,196,120'] };
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
// Window lights for the floor at index i, with its front's top-left at (x, y): night is 0..1, and
// windows come on one after another as it gets dark.
function lights(g, kind, x, y, night, i) {
  if (night <= 0) return;
  PANES[kind].forEach(([px, py, pw, ph], k) => {
    const r = hash(i * 7.3 + k), on = Math.min(1, Math.max(0, night * 1.8 - r * 0.9));
    if (r > LIGHT.on || on <= 0) return;
    const c = LIGHT.colors[Math.floor(hash(i * 3.1 + k * 5.7) * LIGHT.colors.length)];
    const grad = g.createLinearGradient(0, y + py, 0, y + py + ph);
    grad.addColorStop(0, `rgba(${c},${0.95 * on})`); grad.addColorStop(1, `rgba(${c},${0.6 * on})`);
    g.fillStyle = grad; g.fillRect(x + px, y + py, pw, ph);
  });
}

// A floor's front with its top-left corner at (x, y) in the current drawing space (a balcony
// sticks out a little either side of that).
function draw(g, kind, x, y) {
  const o = OUT[kind] || 0;
  g.drawImage(SPR[kind], x - o, y, W + 2 * o, H);
  if (shadeNow) {
    g.fillStyle = shadeNow; g.fillRect(x, y, W, H);
    if (o) { g.fillRect(x - o, y + 23, o, 13); g.fillRect(x + W, y + 23, o, 13); }   // the balcony's ends
  }
}
// The whole box: the faces behind, then the front.
function draw3d(g, kind, x, y, opt) { faces(g, kind, x, y, opt); draw(g, kind, x, y); }

// A loose floor, centred on (x, y) in screen pixels and turned by ang.
function drawAt(kind, x, y, ang) {
  const { ctx } = SS.screen;
  ctx.save();
  ctx.translate(x, y);
  if (ang) ctx.rotate(ang);
  draw3d(ctx, kind, -W / 2, -H / 2);
  ctx.restore();
}

SS.blocks = { W, H, BOX, NIGHT, SPR, draw, draw3d, faces, lights, setNight, drawAt };
})();
