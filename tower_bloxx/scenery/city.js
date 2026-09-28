// The city behind the site: big grey blocks with sky showing between them, each with its roof
// and right-hand wall showing (the same 2.5D as the floors, shallower further back), scrolling
// slower than the tower (0.82 of the camera's climb, measured from the recording), with a paler,
// slower layer further back that shows once the near one runs out.
(() => {
'use strict';
const { canvasOf, rect, poly, shade, mulberry32 } = SS.px, { ctx, view } = SS.screen;

const CITY = {
  parallax: 0.82,       // near blocks move this share of the camera's climb
  farParallax: 0.35,
  near: { colors: ['#a4abaa', '#b8bdbc', '#a39392', '#c9cccb', '#9aa1a0', '#8f9392'], minW: 40, maxW: 110, minH: 500, maxH: 1300, detail: 0.8, glass: '#add6ef', depth: 0.85 },
  far: { colors: ['#b9c3cc', '#c7cfd7', '#adb8c2', '#c0c8cf'], minW: 24, maxW: 60, minH: 220, maxH: 520, detail: 0.5, glass: '#c4dcee', depth: 0.5 },
};

// This file's own seeded generator, so the skyline is the same on every visit. The seed carries
// on from where the old single-file version's shared generator was at this point, so the
// skyline looks exactly as it did before the game was split into files.
const rand = mulberry32((2005 + 836 * 0x6D2B79F5) | 0);

// Where each block goes is chosen once, at load, so the skyline never changes. It is painted
// onto its own canvas at up to MAX_RES screen pixels per game pixel (enough to stay sharp), and
// repainted if the screen's resolution changes.
const MAX_RES = 3;

function makeBackdrop({ colors: pal, minW, maxW, minH, maxH, detail, glass, depth }) {
  const arr = []; let total = 0;
  while (total < 720) {
    const b = {
      w: minW + Math.floor(rand() * (maxW - minW)), h: minH + Math.floor(rand() * (maxH - minH)),
      gap: rand() < 0.3 ? 3 : 0, c: pal[Math.floor(rand() * pal.length)],
      kind: ['bands', 'glass', 'grid', 'bands', 'plain'][Math.floor(rand() * 5)], cap: rand() < 0.35, gx: rand(),
    };
    arr.push(b); total += b.w + b.gap;
  }
  return { arr, total, tall: maxH + 12, detail, glass, depth, img: null, res: 0 };
}

function paint(layer, res) {
  const { arr, total, tall, detail, glass } = layer, c = canvasOf(total * res, tall * res), g = c.getContext('2d');
  const D = SS.blocks.DEPTH, dx = D.x * layer.depth, dy = D.y * layer.depth;   // the blocks' roofs and right-hand walls
  g.scale(res, res);
  let x = 0;
  for (const b of arr) {
    const top = tall - b.h;
    poly(g, shade(b.c, -26), [x + b.w, top, x + b.w + dx, top + dy, x + b.w + dx, tall, x + b.w, tall]);
    poly(g, shade(b.c, 22), [x, top, x + b.w, top, x + b.w + dx, top + dy, x + dx, top + dy]);
    rect(g, b.c, x, top, b.w, b.h);
    if (b.cap) rect(g, shade(b.c, -12), x + 5, top - 8, Math.round(b.w * 0.4), 8);
    if (b.kind === 'bands') for (let y = top + 14; y < tall - 8; y += 22) rect(g, shade(b.c, -20 * detail), x, y, b.w, 6);
    if (b.kind === 'glass') { const gw = Math.min(14, b.w - 10), gx = x + 4 + Math.floor(b.gx * (b.w - gw - 8)); rect(g, glass, gx, top + 6, gw, b.h - 8); rect(g, shade(glass, 18), gx, top + 6, 3, b.h - 8); }
    if (b.kind === 'grid') for (let y = top + 8; y < tall - 8; y += 9) for (let xx = x + 4; xx < x + b.w - 6; xx += 7) rect(g, shade(b.c, -26 * detail), xx, y, 3, 4);
    rect(g, shade(b.c, 16), x, top, b.w, 2);
    rect(g, shade(b.c, -14), x + b.w - 1, top, 1, b.h);
    rect(g, b.c, x, tall - 2, b.w - 3, 2);
    x += b.w + b.gap;
  }
  layer.img = c; layer.res = res;
}
const FAR = makeBackdrop(CITY.far);
const NEAR = makeBackdrop(CITY.near);

function drawLayer(layer, camY, p) {
  const base = -camY * p + (1 - p) * SS.camera.restLine();
  if (base - layer.tall > view.h) return;
  const res = Math.min(MAX_RES, Math.max(1, Math.ceil(view.m - 0.01)));
  if (layer.res !== res) paint(layer, res);
  const { img, total, tall } = layer;
  const x0 = Math.round(view.w / 2) - total * Math.ceil(view.w / 2 / total + 1);
  for (let x = x0; x < view.w; x += total) {
    ctx.drawImage(img, x, base - tall, total, tall);
    if (base < view.h) ctx.drawImage(img, 0, (tall - 1) * res, total * res, res, x, base - 0.5, total, view.h - base + 0.5);
  }
}

function draw(camY) {
  drawLayer(FAR, camY, CITY.farParallax);
  drawLayer(NEAR, camY, CITY.parallax);
}

SS.city = { CITY, draw };
})();
