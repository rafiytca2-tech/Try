// The sky: its colour by height (day, dusk, night, space), stars and planets high up, and
// drifting clouds.
(() => {
'use strict';
const { clamp } = SS, { rrect, circle, mulberry32 } = SS.px, { ctx, view } = SS.screen;

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
  const [top, bot] = skyAt(alt), grad = ctx.createLinearGradient(0, 0, 0, view.h);
  grad.addColorStop(0, rgb(top)); grad.addColorStop(1, rgb(bot));
  ctx.fillStyle = grad; ctx.fillRect(0, 0, view.w, view.h);
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
        ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, s.big ? 0.8 : 0.5, 0, Math.PI * 2); ctx.fill();
        if (s.big) { ctx.fillRect(x - 1, y + 0.3, 3, 0.4); ctx.fillRect(x + 0.3, y - 1, 0.4, 3); }
      }
    }
  }
  ctx.globalAlpha = 1;
}
// A round planet painted in horizontal stripes: colorAt(dy) gives the colour dy px from its centre.
function discBands(cx, cy, r, colorAt) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  let y0 = -r, c = colorAt(-r);
  for (let dy = -r + 1; dy <= r + 1; dy++) {
    const n = dy <= r ? colorAt(dy) : null;
    if (n !== c) { ctx.fillStyle = c; ctx.fillRect(cx - r, cy + y0, 2 * r, dy - y0); y0 = dy; c = n; }
  }
  ctx.restore();
}
function ringHalf(cx, cy, side) {
  ctx.strokeStyle = '#cdb57a'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(cx, cy, 22, 4, 0, side < 0 ? Math.PI : 0, side < 0 ? Math.PI * 2 : Math.PI); ctx.stroke();
}
function drawSpace(alt, camY) {
  if (alt < 1800) return;
  const mx = view.w * 0.8 + 0.5, my = -260 - camY * 0.1 + 0.5;                        // moon
  if (my > -20 && my < view.h + 20) {
    circle(ctx, mx, my, 12.5, '#e6e2d3');
    circle(ctx, mx - 4, my - 3, 3.5, '#c9c4b2'); circle(ctx, mx + 5, my + 4, 2.5, '#c9c4b2'); circle(ctx, mx + 2, my - 6, 1.5, '#c9c4b2');
  }
  const sx = view.w * 0.2 + 0.5, sy = -420 - camY * 0.1 + 0.5;                        // ringed planet
  if (sy > -30 && sy < view.h + 30) {
    ringHalf(sx, sy, -1);
    discBands(sx, sy, 9.5, dy => (Math.round(dy) % 4 === 0 ? '#c9a86a' : '#e3c68a'));
    ringHalf(sx, sy, 1);
  }
  const jx = view.w * 0.66 + 0.5, jy = -600 - camY * 0.1 + 0.5, jr = 26;               // banded giant
  if (jy > -40 && jy < view.h + 40) {
    const bands = ['#e9d6b3', '#c99a6b', '#f1e3c9', '#b7794d', '#ecd9b8', '#c28e61', '#e9d6b3'];
    discBands(jx, jy, jr + 0.5, dy => bands[Math.max(0, Math.min(bands.length - 1, Math.floor((dy + jr) / (2 * jr + 1) * bands.length)))]);
    ctx.fillStyle = '#b8503a'; ctx.beginPath(); ctx.ellipse(jx + 10, jy + 9, 4.5, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
}
function drawClouds(alt, camY) {
  const fade = 1 - clamp((alt - 2600) / 800, 0, 1);
  if (fade <= 0) return;
  const RW = view.w + 140;
  ctx.globalAlpha = fade;
  for (const c of clouds) {
    const sy = c.ly - camY * 0.55;
    if (sy < -12 || sy > view.h + 10) continue;
    const sx = (((c.bx + c.sp * SS.time) % RW) + RW) % RW - 70;
    rrect(ctx, '#d3e9f5', sx + 2, sy + 4, c.w - 4, 4, 2);
    rrect(ctx, '#ffffff', sx, sy, c.w, 6, 3);
    rrect(ctx, '#ffffff', sx + 4, sy - 4, c.w * 0.45, 7, 3.5);
    rrect(ctx, '#ffffff', sx + c.w * 0.4, sy - 7, c.w * 0.35, 10, 4);
    if (c.puff) rrect(ctx, '#ffffff', sx + c.w - 10, sy - 3, 8, 6, 3);
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
