// How a floor looks: its size, the teal body with a concrete cap and a shaded side, the beige
// window frames with sky-reflecting glass, and the glass doors on the ground floor. Also draws a
// loose floor (falling or wrecked) at an angle.
(() => {
'use strict';
const { canvasOf, rect, shade } = SS.px;

const W = 40, H = 46;   // one floor, in game pixels (97 x 110 px in the recording)
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
  rect(g, t.dark, W - 4, 4, 3, H - 5);                // shaded side
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
const SPR = {};
for (const kind of ['floor', 'foundation']) {
  SPR[kind] = canvasOf(W, H);
  paintBlock(SPR[kind].getContext('2d'), BLOCK, kind === 'foundation');
}

// A loose floor, centred on (x, y) in screen pixels and turned by ang.
function drawAt(kind, x, y, ang) {
  const { ctx } = SS.screen;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (ang) ctx.rotate(ang);
  ctx.drawImage(SPR[kind], -W / 2, -H / 2);
  ctx.restore();
}

SS.blocks = { W, H, SPR, drawAt };
})();
