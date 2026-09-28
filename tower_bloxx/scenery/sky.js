// The sky: its colour by height (day, dusk, night, space), with a warm glow along the bottom at
// sunset, the sun sinking and reddening as the tower climbs, soft shaded clouds drifting by, and
// stars, the moon and planets high up. The sun, moon and planets are far off, so they move with
// the camera's climb less than the city does, but still a little (parallax), and drift slowly
// sideways on their own. Also tells the rest of the game how dark it is (for lit windows) and what
// colour the haze is (for the city's depth).
(() => {
'use strict';
const { clamp } = SS, { circle, mulberry32 } = SS.px, { ctx, view } = SS.screen;

// Top and bottom colour of the sky at each height (game pixels climbed).
const SKY = [
  [0,    [0x9f, 0xcf, 0xee], [0xc9, 0xe6, 0xf6]],
  [1400, [0x3f, 0x8f, 0xd6], [0x9e, 0xd2, 0xf0]],
  [2600, [0x28, 0x47, 0x9a], [0x6d, 0x8f, 0xd0]],
  [3600, [0x12, 0x1c, 0x4a], [0x2c, 0x3d, 0x80]],
  [4800, [0x05, 0x08, 0x1a], [0x0e, 0x15, 0x36]],
];

const SUN = {
  x: 0.8, y: 0.1,     // across and down the screen at the start
  sink: 0.2,          // px it moves down per px the camera climbs (the far city moves 0.35): it
                      //   reaches the bottom of the sky about when the sunset glow is at its height
  size: 9, glow: 70,  // px
  gone: 3200,         // height climbed by which it has faded out
  drift: 6, driftTime: 50,   // px it drifts either way, and seconds to drift there and back
};
// The moon and planets: across the screen, and the height climbed at which each comes down past
// the top of the screen. From there they move `parallax` of the camera's climb, the stars less.
const SPACE = {
  parallax: 0.2, stars: 0.12,
  moon: [0.8, 2350], ringed: [0.2, 3150], giant: [0.66, 4050],
  drift: 4, driftTime: 70,   // px either way, seconds there and back
};
const DUSK = { at: 2300, width: 1000, color: [255, 150, 90], strength: 0.6 };   // sunset glow along the bottom of the sky

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

// A slow sideways drift: px from the resting place at the moment (phase: where in the drift it starts).
const drift = (px, time, phase) => px * Math.sin(SS.time * 2 * Math.PI / time + phase);
const duskAt = alt => Math.max(0, 1 - Math.abs(alt - DUSK.at) / DUSK.width);
function drawSky(alt) {
  const [top, bot] = skyAt(alt), grad = ctx.createLinearGradient(0, 0, 0, view.h), d = duskAt(alt) * DUSK.strength;
  grad.addColorStop(0, rgb(top));
  grad.addColorStop(0.55, rgb(mix(top, bot, 0.6)));
  grad.addColorStop(1, rgb(mix(bot, DUSK.color, d)));
  ctx.fillStyle = grad; ctx.fillRect(0, 0, view.w, view.h);
}
// The sun, sinking and turning orange as the tower climbs, with a soft glow round it.
function drawSun(alt) {
  const fade = 1 - clamp((alt - SUN.gone + 600) / 600, 0, 1);
  if (fade <= 0) return;
  const x = view.w * SUN.x + drift(SUN.drift, SUN.driftTime, 0), y = view.h * SUN.y + alt * SUN.sink, d = duskAt(alt);
  const core = mix([255, 250, 225], [255, 170, 90], d), glowC = mix([255, 240, 190], [255, 140, 70], d);
  const glow = ctx.createRadialGradient(x, y, 0, x, y, SUN.glow);
  glow.addColorStop(0, `rgba(${glowC},${0.55 * fade})`); glow.addColorStop(0.25, `rgba(${glowC},${0.22 * fade})`); glow.addColorStop(1, `rgba(${glowC},0)`);
  ctx.fillStyle = glow; ctx.fillRect(x - SUN.glow, y - SUN.glow, SUN.glow * 2, SUN.glow * 2);
  ctx.globalAlpha = fade; circle(ctx, x, y, SUN.size, rgb(core)); ctx.globalAlpha = 1;
}
function drawStars(alt, camY) {
  const a = clamp((alt - 1800) / 1600, 0, 1);
  if (a <= 0) return;
  const oy = Math.floor(-camY * SPACE.stars);
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
function drawSpace(alt) {
  if (alt < 1800) return;
  const P = SPACE.parallax, at = ([ax, ay], ph) => [view.w * ax + drift(SPACE.drift, SPACE.driftTime, ph) + 0.5, (alt - ay) * P + 0.5];
  const [mx, my] = at(SPACE.moon, 0);                                                   // moon
  if (my > -20 && my < view.h + 20) {
    circle(ctx, mx, my, 12.5, '#e6e2d3');
    circle(ctx, mx - 4, my - 3, 3.5, '#c9c4b2'); circle(ctx, mx + 5, my + 4, 2.5, '#c9c4b2'); circle(ctx, mx + 2, my - 6, 1.5, '#c9c4b2');
  }
  const [sx, sy] = at(SPACE.ringed, 2);                                                 // ringed planet
  if (sy > -30 && sy < view.h + 30) {
    ringHalf(sx, sy, -1);
    discBands(sx, sy, 9.5, dy => (Math.round(dy) % 4 === 0 ? '#c9a86a' : '#e3c68a'));
    ringHalf(sx, sy, 1);
  }
  const [jx, jy] = at(SPACE.giant, 4), jr = 26;                                        // banded giant
  if (jy > -40 && jy < view.h + 40) {
    const bands = ['#e9d6b3', '#c99a6b', '#f1e3c9', '#b7794d', '#ecd9b8', '#c28e61', '#e9d6b3'];
    discBands(jx, jy, jr + 0.5, dy => bands[Math.max(0, Math.min(bands.length - 1, Math.floor((dy + jr) / (2 * jr + 1) * bands.length)))]);
    ctx.fillStyle = '#b8503a'; ctx.beginPath(); ctx.ellipse(jx + 10, jy + 9, 4.5, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
}
// Soft clouds: a few puffy shapes painted once (white on top, shaded blue-grey underneath) and
// drawn at each cloud's size.
const CLOUD_ART = (() => {
  const r = mulberry32(77), out = [];
  for (let v = 0; v < 4; v++) {
    const S = 4, w = 64, h = 30, c = SS.px.canvasOf(w * S, h * S), g = c.getContext('2d');
    g.scale(S, S);
    const puffs = 6 + Math.floor(r() * 4);
    for (let i = 0; i < puffs; i++) {
      const px = 10 + r() * 44, rad = 6 + r() * 7 + (1 - Math.abs(px - 32) / 32) * 5, py = h - 8 - rad * (0.35 + r() * 0.45);
      const grad = g.createRadialGradient(px - rad * 0.3, py - rad * 0.4, rad * 0.1, px, py, rad);
      grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.75, 'rgba(255,255,255,0.95)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.beginPath(); g.arc(px, py, rad, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-atop';           // shade the underside
    const under = g.createLinearGradient(0, h * 0.35, 0, h);
    under.addColorStop(0, 'rgba(170,195,220,0)'); under.addColorStop(1, 'rgba(150,178,208,0.7)');
    g.fillStyle = under; g.fillRect(0, 0, w, h);
    out.push(c);
  }
  return out;
})();
function drawClouds(alt, camY) {
  const fade = 1 - clamp((alt - 2600) / 800, 0, 1);
  if (fade <= 0) return;
  const RW = view.w + 160;
  ctx.globalAlpha = fade;
  clouds.forEach((c, i) => {
    const w = c.w * 1.9, h = w * 30 / 64, sy = c.ly - camY * 0.55 - h * 0.6;
    if (sy < -h || sy > view.h + 4) return;
    const sx = (((c.bx + c.sp * SS.time) % RW) + RW) % RW - 80;
    ctx.drawImage(CLOUD_ART[i % CLOUD_ART.length], sx, sy, w, h);
  });
  ctx.globalAlpha = 1;
}

const altOf = camY => Math.max(0, -camY - view.h / 2);
function draw(camY) {
  const alt = altOf(camY);
  drawSky(alt);
  drawSun(alt);
  drawStars(alt, camY);
  drawSpace(alt);
  drawClouds(alt, camY);
}

// How dark it is (0 day .. 1 night), and the colour of the air low down (for haze).
const nightAt = camY => clamp((altOf(camY) - 1900) / 1700, 0, 1);
const hazeAt = camY => { const alt = altOf(camY); return mix(skyAt(alt)[1], DUSK.color, duskAt(alt) * DUSK.strength * 0.6); };

SS.sky = { SKY, SUN, SPACE, DUSK, draw, nightAt, hazeAt };
})();
