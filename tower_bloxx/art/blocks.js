// How a floor looks: its size, the teal body with a concrete cap, the beige window frames with
// sky-reflecting glass, the glass doors on the ground floor, and the balcony floor that comes
// every 10th floor. Floors are solid boxes drawn in 2.5D: behind the front you see the roof and
// the right-hand wall, going back up and to the right (lit from the top left, so the roof is
// light and the wall in shade), and they stay right however a floor is turned. Everything is
// painted once at 8x detail so it stays sharp at any screen size and when it turns. Also draws
// a floor at any position and angle.
(() => {
'use strict';
const { canvasOf, rect, shade } = SS.px;

const W = 40, H = 46;   // one floor, in game pixels (97 x 110 px in the recording)
const RES = 8;          // detail the floors are painted at
const BLOCK = { body: '#479cab', light: '#72c3cf', dark: '#1a5f6f', outline: '#0e3440', frame: '#a2ae8e', frameDark: '#2c3526', cap: '#a8a89c' };
const GLASS = [['#c9f3fa', 6], ['#8fdbea', 7], ['#52bbd1', 6], ['#3899b3', 4], ['#2a7b93', 3]];   // sky reflection, top to bottom

function paintGlass(g, x, y, w, h) {
  let yy = y;
  for (const [c, n] of GLASS) { const rows = Math.min(Math.round(n * h / 26), y + h - yy); if (rows > 0) rect(g, c, x, yy, w, rows); yy += rows; }
  if (yy < y + h) rect(g, GLASS[GLASS.length - 1][0], x, yy, w, y + h - yy);
  rect(g, '#f2fdff', x, y + 1, 1, Math.round(h * 0.4));
}
function paintWindow(g, x, y, w, h) {
  rect(g, BLOCK.frameDark, x, y, w, h);
  rect(g, BLOCK.frame, x + 1, y + 1, w - 2, h - 2);
  rect(g, shade(BLOCK.frame, 28), x + 1, y + 1, w - 2, 1);
  rect(g, BLOCK.frameDark, x + 2, y + 2, w - 4, h - 4);
  paintGlass(g, x + 3, y + 3, w - 6, h - 6);
}
function paintBlock(g, t, door) {
  rect(g, t.outline, 0, 0, W, H);
  rect(g, t.body, 1, 1, W - 2, H - 2);
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
  rect(g, t.body, 1, 1, W - 2, H - 2);
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

// The box behind the front: the roof and the right-hand wall, as textures laid on the
// parallelograms that join the front's edges to the same edges further back.
const DEPTH = { x: 7, y: -6 };   // how far back a floor goes, drawn on screen (up and to the right)
const DEEP = 8;                  // texture size along the depth, game px
function paintSide(g, t, trim) {              // DEEP wide (x: front edge -> back) x H tall
  rect(g, t.outline, 0, 0, DEEP, H);
  rect(g, shade(t.body, -40), 0, 1, DEEP - 0.7, H - 2);
  rect(g, shade(trim, -45), 0, 1, DEEP - 0.7, 4);                    // the cap, round the corner
  rect(g, shade(BLOCK.frameDark, -8), 2, 8, 4, 31);                  // a narrow side window
  rect(g, '#2b6377', 2.8, 9, 2.4, 29); rect(g, '#4f8fa3', 2.8, 9, 0.7, 12);
  rect(g, shade(t.body, -70), 0, H - 4, DEEP - 0.7, 3);
  const fade = g.createLinearGradient(0, 0, DEEP, 0);                // darker toward the back
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = fade; g.fillRect(0, 0, DEEP, H);
}
function paintTop(g, t, trim) {               // W wide x DEEP deep (y: front edge -> back)
  rect(g, t.outline, 0, 0, W, DEEP);
  rect(g, shade(trim, 22), 0.7, 0, W - 1.4, DEEP - 0.7);
  rect(g, shade(trim, 55), 0.7, 0, W - 1.4, 1);                      // the lit front rim
  rect(g, shade(trim, -12), 0.7, DEEP - 1.6, W - 1.4, 0.9);          // the far rim
  rect(g, shade(trim, -25), 26, 2.4, 7, 3); rect(g, shade(trim, 30), 26, 2.4, 7, 0.9);   // a vent box
  rect(g, shade(trim, -25), 8, 3, 3, 2);
}
const FACE = {};
for (const kind of ['floor', 'foundation', 'balcony']) {
  const trim = kind === 'balcony' ? BALCONY.trim : BLOCK.cap;
  const side = canvasOf(DEEP * RES, H * RES), top = canvasOf(W * RES, DEEP * RES), under = canvasOf(8, 8);
  const gs = side.getContext('2d'), gt = top.getContext('2d');
  gs.scale(RES, RES); paintSide(gs, BLOCK, trim);
  gt.scale(RES, RES); paintTop(gt, BLOCK, trim);
  under.getContext('2d').fillStyle = shade(BLOCK.body, -85); under.getContext('2d').fillRect(0, 0, 8, 8);
  FACE[kind] = { side, top, under };
}
function quad(g, tex, tw, th, ox, oy, ux, uy, vx, vy) {   // texture x along u, texture y along v
  g.save();
  g.transform(ux / tw, uy / tw, vx / th, vy / th, ox, oy);
  g.drawImage(tex, 0, 0, tw, th);
  g.restore();
}
// The faces behind a floor whose front's top-left corner is at (x, y), in a drawing space turned
// by ang: whichever of the roof, underside and side walls face the way the depth goes.
function faces(g, kind, x, y, ang = 0) {
  const c = Math.cos(ang), s = Math.sin(ang), F = FACE[kind];
  const dx = c * DEPTH.x + s * DEPTH.y, dy = -s * DEPTH.x + c * DEPTH.y;   // the depth, in the turned space
  if (dy < 0) quad(g, F.top, W, DEEP, x, y, W, 0, dx, dy);
  else if (dy > 0) quad(g, F.under, W, DEEP, x, y + H, W, 0, dx, dy);
  if (dx > 0) quad(g, F.side, DEEP, H, x + W, y, dx, dy, 0, H);
  else if (dx < 0) quad(g, F.side, DEEP, H, x, y, dx, dy, 0, H);
}

// A floor's front with its top-left corner at (x, y) in the current drawing space (a balcony
// sticks out a little either side of that).
function draw(g, kind, x, y) { const o = OUT[kind] || 0; g.drawImage(SPR[kind], x - o, y, W + 2 * o, H); }
// The whole box: the faces behind, then the front. ang: how the drawing space is turned.
function draw3d(g, kind, x, y, ang = 0) { faces(g, kind, x, y, ang); draw(g, kind, x, y); }

// A loose floor, centred on (x, y) in screen pixels and turned by ang.
function drawAt(kind, x, y, ang) {
  const { ctx } = SS.screen;
  ctx.save();
  ctx.translate(x, y);
  if (ang) ctx.rotate(ang);
  draw3d(ctx, kind, -W / 2, -H / 2, ang || 0);
  ctx.restore();
}

SS.blocks = { W, H, DEPTH, SPR, draw, draw3d, faces, drawAt };
})();
