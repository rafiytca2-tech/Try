// The sky: its colour by height (day, dusk, night, space), stars and planets high up, and
// drifting clouds.
(() => {
'use strict';
const { clamp } = SS, { rect, disc, mulberry32 } = SS.px, { ctx, view } = SS.screen;

// Top and bottom colour of the sky at each height (game pixels climbed).
const SKY = [
  [0,    [0x9f, 0xcf, 0xee], [0xc9, 0xe6, 0xf6]],
  [1400, [0x3f, 0x8f, 0xd6], [0x9e, 0xd2, 0xf0]],
  [2600, [0x28, 0x47, 0x9a], [0x6d, 0x8f, 0xd0]],
  [3600, [0x12, 0x1c, 0x4a], [0x2c, 0x3d, 0x80]],
  [4800, [0x05, 0x08, 0x1a], [0x0e, 0x15, 0x36]],
];

const rand = mulberry32(2005);   // this file's own seeded generator: the same clouds and stars every visit
const clouds = Array.from({ length: 34 }, () => ({ ly: -600 - rand() * 2000, bx: rand() * 2400, w: 18 + Math.floor(rand() * 30), sp: 2 + rand() * 5, puff: rand() < 0.5 }));
const stars = Array.from({ length: 150 }, () => ({ x: Math.floor(rand() * 320), y: Math.floor(rand() * 320), big: rand() < 0.1, ph: rand() * 6.28 }));

const mix = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t));
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
function skyAt(alt) {
  if (alt <= SKY[0][0]) return [SKY[0][1], SKY[0][2]];
  for (let i = 1; i < SKY.length; i++) {
    if (alt <= SKY[i][0]) { const a = SKY[i - 1], b = SKY[i], t = (alt - a[0]) / (b[0] - a[0]); return [mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
  }
  const l = SKY[SKY.length - 1]; return [l[1], l[2]];
}

function drawSky(alt) {
  const [top, bot] = skyAt(alt), bands = 16, bh = Math.ceil(view.h / bands);
  for (let i = 0; i < bands; i++) rect(ctx, rgb(mix(top, bot, i / (bands - 1))), 0, i * bh, view.w, bh);
}
function drawStars(alt, camY) {
  const a = clamp((alt - 1800) / 1600, 0, 1);
  if (a <= 0) return;
  const oy = Math.floor(-camY * 0.08);
  ctx.fillStyle = '#ffffff';
  for (let ty = 0; ty < view.h + 320; ty += 320) {
    for (let tx = 0; tx < view.w; tx += 320) {
      for (const s of stars) {
        const x = tx + s.x, y = ty + ((s.y + oy) % 320) - 320;
        if (x >= view.w || y < 0 || y >= view.h) continue;
        ctx.globalAlpha = a * (s.big ? 1 : 0.55 + 0.45 * Math.sin(SS.time * 2.2 + s.ph));
        ctx.fillRect(x, y, 1, 1);
        if (s.big) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
      }
    }
  }
  ctx.globalAlpha = 1;
}
function discBands(cx, cy, r, colorAt) {
  for (let dy = -r; dy <= r; dy++) { const h = Math.floor(Math.sqrt(r * r - dy * dy)); ctx.fillStyle = colorAt(dy); ctx.fillRect(cx - h, cy + dy, h * 2 + 1, 1); }
}
function drawSpace(alt, camY) {
  if (alt < 1800) return;
  const mx = Math.round(view.w * 0.8), my = Math.round(-260 - camY * 0.1);          // moon
  if (my > -20 && my < view.h + 20) {
    disc(ctx, mx, my, 12, '#e6e2d3');
    disc(ctx, mx - 4, my - 3, 3, '#c9c4b2'); disc(ctx, mx + 5, my + 4, 2, '#c9c4b2'); disc(ctx, mx + 2, my - 6, 1, '#c9c4b2');
  }
  const sx = Math.round(view.w * 0.2), sy = Math.round(-420 - camY * 0.1);          // ringed planet
  if (sy > -30 && sy < view.h + 30) {
    const ring = side => { ctx.fillStyle = '#cdb57a'; for (let dx = -22; dx <= 22; dx++) ctx.fillRect(sx + dx, sy + side * Math.round(Math.sqrt(1 - (dx / 22) ** 2) * 4), 1, 1); };
    ring(-1);
    discBands(sx, sy, 9, dy => (dy % 4 === 0 ? '#c9a86a' : '#e3c68a'));
    ring(1);
  }
  const jx = Math.round(view.w * 0.66), jy = Math.round(-600 - camY * 0.1), jr = 26; // banded giant
  if (jy > -40 && jy < view.h + 40) {
    const bands = ['#e9d6b3', '#c99a6b', '#f1e3c9', '#b7794d', '#ecd9b8', '#c28e61', '#e9d6b3'];
    discBands(jx, jy, jr, dy => bands[Math.min(bands.length - 1, Math.floor((dy + jr) / (2 * jr + 1) * bands.length))]);
    rect(ctx, '#b8503a', jx + 6, jy + 7, 8, 4); rect(ctx, '#b8503a', jx + 7, jy + 6, 6, 6);
  }
}
function drawClouds(alt, camY) {
  const fade = 1 - clamp((alt - 2600) / 800, 0, 1);
  if (fade <= 0) return;
  const RW = view.w + 140;
  ctx.globalAlpha = fade;
  for (const c of clouds) {
    const sy = Math.round(c.ly - camY * 0.55);
    if (sy < -12 || sy > view.h + 10) continue;
    const sx = Math.round((((c.bx + c.sp * SS.time) % RW) + RW) % RW - 70);
    rect(ctx, '#ffffff', sx, sy, c.w, 6);
    rect(ctx, '#ffffff', sx + 4, sy - 4, Math.floor(c.w * 0.45), 4);
    rect(ctx, '#ffffff', sx + Math.floor(c.w * 0.4), sy - 7, Math.floor(c.w * 0.35), 7);
    if (c.puff) rect(ctx, '#ffffff', sx + c.w - 10, sy - 3, 8, 3);
    rect(ctx, '#d3e9f5', sx + 2, sy + 6, c.w - 4, 2);
  }
  ctx.globalAlpha = 1;
}

function draw(camY) {
  const alt = Math.max(0, -camY - view.h / 2);
  drawSky(alt);
  drawStars(alt, camY);
  drawSpace(alt, camY);
  drawClouds(alt, camY);
}

SS.sky = { SKY, draw };
})();
