// The city behind the site: three layers of buildings, near, middle and far, each scrolling
// slower than the tower the further back it is (the near one at 0.82 of the camera's climb, as
// measured from the recording). Buildings come in all sizes, from squat blocks to skyscrapers
// that step back as they rise, in a warm, lively palette of corals, oranges, golds, pinks and
// violets: nothing near the tower's teal, so the player's building always stands out against them.
// Facades have window grids, ribbon windows, champagne glass curtain walls, vertical strips or
// brick, with spires with a red light, gold domes, water tanks, stepped crowns or parapets on top. They're seen in
// 3D through the camera's eye like the floors (the side facing the middle, and the roof once
// you're above it), hazed by the air in front of them, and their windows light up at night.
(() => {
'use strict';
const { canvasOf, rect, shade, mulberry32 } = SS.px, { ctx, view } = SS.screen;

const CITY = {
  layers: [   // back to front; res: the most screen px per game px a layer is painted at
    { parallax: 0.35, haze: 0.4, deep: 40, width: [18, 46], height: [110, 560], res: 2, lights: 0.35,
      colors: ['#f3c9b0', '#e8d6a8', '#f0b8b0', '#d9c2e0', '#e6c9a0', '#f2d4c4', '#e3c0d6', '#efdcb4'] },
    { parallax: 0.6, haze: 0.22, deep: 55, width: [24, 70], height: [140, 900], res: 2, lights: 0.4,
      colors: ['#e89a7a', '#e8c170', '#b99acb', '#f2a38e', '#d8d27a', '#e4b58a', '#d98fa8', '#c9a3e0', '#f0b56a'] },
    { parallax: 0.82, haze: 0.15, deep: 70, width: [32, 100], height: [170, 1100], res: 3, lights: 0.45,
      colors: ['#e07a5f', '#f2cc8f', '#e9c46a', '#b5838d', '#f4a261', '#9a72c0', '#ffb4a2', '#c96f53', '#d4708f', '#a86fb0', '#e8a33d', '#f6d6a8', '#8a5a78', '#b0584a'] },
  ],
  tallBias: 2.1,        // >1: most buildings are low or middling, a few are very tall
  hazeFade: 140,        // px down from a layer's tallest roofs over which its haze thickens
  gapChance: 0.35,      // chance of a gap after a building
  gap: [2, 9],          // px
  styles: ['grid', 'grid', 'bands', 'glass', 'columns', 'brick'],
  roofs: ['flat', 'flat', 'setback', 'setback', 'spire', 'dome', 'tank', 'crown'],
  avoid: 55,            // degrees: no building colour within this of the tower's hue (art/blocks.js)
  glassTint: '#fbd9b0', // champagne glass, warm like the rest
  windowDark: '#3a2f45',   // window glass on light buildings,
  windowLight: '#fff4e6',  //   and on darker ones
  dome: ['#f6d88a', '#b8862e'],   // gilded domes, lit side to shaded side
  lightColors: ['255,214,140', '255,236,180', '255,196,120', '210,230,255'],
};

// This file's own seeded generator, so the skyline is the same on every visit.
const rand = mulberry32(0x5eed1e);
const between = ([a, b]) => a + rand() * (b - a);
const pick = list => list[Math.floor(rand() * list.length)];
const mixHex = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), ch = (p, s) => (p >> s) & 255;
  return `rgb(${[16, 8, 0].map(s => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t)).join(',')})`;
};
const bright = hex => { const p = parseInt(hex.slice(1), 16); return ((p >> 16) * 0.3 + ((p >> 8) & 255) * 0.59 + (p & 255) * 0.11) / 255; };
// A colour's hue in degrees, or null for a grey (which clashes with nothing).
const hueOf = hex => {
  const p = parseInt(hex.slice(1), 16), r = p >> 16, g = (p >> 8) & 255, b = p & 255, hi = Math.max(r, g, b), c = hi - Math.min(r, g, b);
  if (c < 24) return null;
  const h = hi === r ? (g - b) / c : hi === g ? (b - r) / c + 2 : (r - g) / c + 4;
  return (h * 60 + 360) % 360;
};
// Too close in hue to the tower's own colour to stand apart from it.
function nearTower(hex) {
  const a = hueOf(hex), t = hueOf(SS.blocks.BLOCK.body);
  if (a === null || t === null) return false;
  const d = Math.abs(a - t);
  return Math.min(d, 360 - d) < CITY.avoid;
}

// A building: its tiers (from the ground up; each narrower one stands on the one below), its
// colour, facade and what's on its roof. Sizes in px; y is height above the ground.
function makeBuilding(L) {
  const w = Math.round(between(L.width)), h = Math.round(L.height[0] + Math.pow(rand(), CITY.tallBias) * (L.height[1] - L.height[0]));
  const roof = pick(CITY.roofs), tiers = [];
  if (roof === 'setback' && h > 160 && w > 26) {             // narrower tiers stepping back toward the top
    const steps = h > 600 ? 2 : 1;
    let x0 = 0, x1 = w, top = Math.round(h * (steps === 2 ? 0.66 : 0.8));
    tiers.push({ x0, x1, top });
    for (let i = 0; i < steps; i++) {
      const inset = Math.max(3, Math.round((x1 - x0) * between([0.14, 0.26])));
      x0 += inset; x1 -= inset; top = i === steps - 1 ? h : Math.round(top + (h - top) * 0.5);
      tiers.push({ x0, x1, top });
    }
  } else tiers.push({ x0: 0, x1: w, top: h });
  return { w, h, tiers, c: pick(L.colors), style: pick(CITY.styles), roof, seed: rand() };
}

function makeLayer(L) {
  const ok = L.colors.filter(c => !nearTower(c)), arr = [];
  L = { ...L, colors: ok.length ? ok : L.colors };
  let total = 0;
  while (total < 720) {
    const b = makeBuilding(L);
    b.x = total;
    arr.push(b);
    total += b.w + (rand() < CITY.gapChance ? Math.round(between(CITY.gap)) : 0);
  }
  const tall = Math.max(...arr.map(b => b.h)) + 70;       // room above for spires
  return { ...L, arr, total, tall, img: null, lit: null, painted: 0 };
}

// --- painting a building's front (x: its left edge on the strip, ground: the strip's bottom) ---

function paintFacade(g, b, tier, x, ground, lights, L) {
  const l = x + tier.x0, w = tier.x1 - tier.x0, top = ground - tier.top, bottom = ground;
  const dark = bright(b.c) > 0.62;                          // light buildings get darker glass
  const glass = mixHex(b.c, dark ? CITY.windowDark : CITY.windowLight, 0.62);
  const r = mulberry32(Math.floor(b.seed * 1e9) + tier.top);
  const light = (px, py, pw, ph) => { if (r() < L.lights) { lights.fillStyle = `rgba(${CITY.lightColors[Math.floor(r() * CITY.lightColors.length)]},0.95)`; lights.fillRect(px, py, pw, ph); } };
  const body = g.createLinearGradient(0, top, 0, bottom);   // lit from above
  body.addColorStop(0, shade(b.c, 14)); body.addColorStop(Math.min(1, 160 / Math.max(160, tier.top)), b.c); body.addColorStop(1, shade(b.c, -16));
  g.fillStyle = body; g.fillRect(l, top, w, tier.top);
  rect(g, shade(b.c, 26), l, top, 1, tier.top);             // the lit left edge
  rect(g, shade(b.c, -24), l + w - 1, top, 1, tier.top);    // the shaded right edge
  if (b.style === 'grid') {
    const cols = Math.max(1, Math.floor((w - 5) / 7)), gx = (w - cols * 7 + 3) / 2;
    for (let y = top + 7; y < bottom - 8; y += 9) for (let i = 0; i < cols; i++) {
      const px = l + gx + i * 7;
      rect(g, glass, px, y, 4, 5); rect(g, shade(b.c, 30), px, y + 5, 4, 0.8);
      light(px, y, 4, 5);
    }
  } else if (b.style === 'bands') {
    for (let y = top + 8; y < bottom - 8; y += 13) {
      rect(g, glass, l + 3, y, w - 6, 5); rect(g, shade(b.c, 24), l + 3, y + 5, w - 6, 0.8);
      for (let px = l + 3; px < l + w - 6; px += 8) light(px + 0.5, y, 6, 5);
    }
  } else if (b.style === 'glass') {
    const tint = mixHex(b.c, CITY.glassTint, 0.72);
    rect(g, tint, l + 2, top + 3, w - 4, tier.top - 5);
    for (let px = l + 2; px < l + w - 2; px += 6) rect(g, shade(b.c, -12), px, top + 3, 0.7, tier.top - 5);
    for (let y = top + 3; y < bottom - 2; y += 11) { rect(g, shade(b.c, -12), l + 2, y, w - 4, 0.7); for (let px = l + 2; px < l + w - 6; px += 6) light(px + 0.8, y + 1, 5, 9.5); }
    g.save(); g.beginPath(); g.rect(l + 2, top + 3, w - 4, tier.top - 5); g.clip();   // a sweep of reflected sky
    g.fillStyle = 'rgba(255,255,255,0.22)';
    for (let y = top - w; y < bottom; y += 90) { g.beginPath(); g.moveTo(l, y + w); g.lineTo(l + w, y); g.lineTo(l + w, y + 14); g.lineTo(l, y + w + 14); g.fill(); }
    g.restore();
  } else if (b.style === 'columns') {
    for (let px = l + 3; px < l + w - 5; px += 7) {
      rect(g, glass, px, top + 6, 3, tier.top - 12);
      for (let y = top + 6; y < bottom - 8; y += 10) light(px, y, 3, 8);
    }
  } else {                                                    // brick: pairs of small windows and a cornice
    rect(g, shade(b.c, 20), l, top, w, 3); rect(g, shade(b.c, -20), l, top + 3, w, 1);
    for (let y = top + 9; y < bottom - 8; y += 10) for (let px = l + 4; px < l + w - 7; px += 9) {
      rect(g, glass, px, y, 3, 5); rect(g, glass, px + 4, y, 3, 5); rect(g, shade(b.c, 28), px - 0.5, y + 5, 8, 0.8);
      light(px, y, 7, 5);
    }
  }
}

function paintRoof(g, b, x, ground, lights) {
  const t = b.tiers[b.tiers.length - 1], l = x + t.x0, w = t.x1 - t.x0, top = ground - t.top, mid = l + w / 2;
  rect(g, shade(b.c, 30), l, top, w, 1.2);                  // parapet catching the light
  if (b.roof === 'spire') {
    rect(g, shade(b.c, -20), mid - 3, top - 5, 6, 5);
    rect(g, '#4a4f58', mid - 0.6, top - 5 - 30 - b.seed * 25, 1.2, 30 + b.seed * 25);
    lights.fillStyle = 'rgba(255,60,50,1)'; lights.beginPath(); lights.arc(mid, top - 6 - 30 - b.seed * 25, 1.4, 0, Math.PI * 2); lights.fill();
    g.fillStyle = '#e8453c'; g.beginPath(); g.arc(mid, top - 6 - 30 - b.seed * 25, 1.1, 0, Math.PI * 2); g.fill();
  } else if (b.roof === 'dome') {
    const r = Math.min(w * 0.32, 16), dome = g.createLinearGradient(mid - r, 0, mid + r, 0);
    dome.addColorStop(0, CITY.dome[0]); dome.addColorStop(1, CITY.dome[1]);
    rect(g, shade(b.c, -10), mid - r - 1, top - 3, 2 * r + 2, 3);
    g.fillStyle = dome; g.beginPath(); g.ellipse(mid, top - 3, r, r * 0.9, 0, Math.PI, 0); g.fill();
    rect(g, '#3b4a52', mid - 0.5, top - 3 - r * 0.9 - 6, 1, 6);
  } else if (b.roof === 'tank') {
    const tx = l + w * (0.2 + b.seed * 0.5);
    rect(g, '#5a4636', tx - 3, top - 5, 1, 5); rect(g, '#5a4636', tx + 3, top - 5, 1, 5);
    g.fillStyle = '#8a6a4c'; g.beginPath(); g.moveTo(tx - 5, top - 5); g.lineTo(tx + 5, top - 5); g.lineTo(tx + 5, top - 13); g.lineTo(tx, top - 17); g.lineTo(tx - 5, top - 13); g.closePath(); g.fill();
    rect(g, '#6e533b', tx - 5, top - 10, 10, 0.8);
  } else if (b.roof === 'crown') {
    for (let i = 0; i < 3; i++) { const cw = w * (0.7 - i * 0.2); rect(g, shade(b.c, 10 - i * 6), mid - cw / 2, top - 4 * (i + 1), cw, 4); }
  } else {                                                    // flat: a couple of rooftop boxes
    rect(g, shade(b.c, -18), l + w * 0.15, top - 4, w * 0.22, 4);
    if (w > 40) rect(g, shade(b.c, -28), l + w * 0.6, top - 6, w * 0.16, 6);
  }
}

// Paints a layer's strip (and its night lights, kept separate so they can fade in).
function paint(layer, res) {
  const { arr, total, tall } = layer, c = canvasOf(total * res, tall * res), g = c.getContext('2d');
  const lc = canvasOf(total, tall), lg = lc.getContext('2d');
  g.scale(res, res);
  for (const b of arr) {
    for (const tier of b.tiers) paintFacade(g, b, tier, b.x, tall, lg, layer);
    paintRoof(g, b, b.x, tall, lg);
  }
  layer.img = c; layer.lit = lc; layer.painted = res;
}
const LAYERS = CITY.layers.map(makeLayer);

// 3D: each block's side facing the middle and, once the camera is above it, its roof, drawn in
// toward the camera's eye (camera/camera.js). A layer that moves p of the camera's climb is
// 1 / p times as far away as the tower, so its depth draws in less. The fronts go over these.
function blockSides(layer, x, base) {
  const E = SS.camera.eye(), far = E.dist / layer.parallax, k = far / (far + layer.deep);
  const back = ([px, py]) => [E.x + (px - E.x) * k, E.y + (py - E.y) * k];
  const quad = pts => { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fill(); };
  for (const b of layer.arr) {
    if (x + b.x + b.w < -30 || x + b.x > view.w + 30) continue;
    b.tiers.forEach((tr, i) => {
      const l = x + b.x + tr.x0, r = x + b.x + tr.x1, t = base - tr.top;
      const bottom = Math.min(i ? base - b.tiers[i - 1].top : base, view.h + 20);
      if (t > view.h) return;
      if (l > E.x) { ctx.fillStyle = shade(b.c, -8); quad([[l, t], [l, bottom], back([l, bottom]), back([l, t])]); }    // its left wall, lit
      if (r < E.x) { ctx.fillStyle = shade(b.c, -34); quad([[r, t], [r, bottom], back([r, bottom]), back([r, t])]); }   // its right wall, in shade
      if (t > E.y) { ctx.fillStyle = shade(b.c, 22); quad([[l, t], [r, t], back([r, t]), back([l, t])]); }              // its roof
    });
  }
}

// Draws a layer and returns the screen row of its tallest roofs (or null when it's off screen).
function drawLayer(layer, camY, night) {
  const p = layer.parallax, base = -camY * p + (1 - p) * SS.camera.restLine();
  if (base - layer.tall > view.h) return null;
  const res = Math.min(layer.res, Math.max(1, Math.ceil(view.m - 0.01)));   // layer.res: the most it's painted at
  if (layer.painted !== res) paint(layer, res);
  const { img, lit, total, tall } = layer;
  const x0 = Math.round(view.w / 2) - total * Math.ceil(view.w / 2 / total + 1);
  for (let x = x0; x < view.w; x += total) blockSides(layer, x, base);
  for (let x = x0; x < view.w; x += total) {
    ctx.drawImage(img, x, base - tall, total, tall);
    if (base < view.h) ctx.drawImage(img, 0, (tall - 1) * res, total * res, res, x, base - 0.5, total, view.h - base + 0.5);
  }
  layer.lightsAt = night > 0.02 ? { x0, base } : null;
  return base - tall;
}
// The layer's lit windows, over its haze, fading in as night falls.
function drawLights(layer, night) {
  if (!layer.lightsAt) return;
  const { x0, base } = layer.lightsAt;
  ctx.globalAlpha = night * (1 - layer.haze * 0.6);
  for (let x = x0; x < view.w; x += layer.total) ctx.drawImage(layer.lit, x, base - layer.tall, layer.total, layer.tall);
  ctx.globalAlpha = 1;
}

// Air between here and the buildings: the colour of the low sky laid over them, thicker further
// back, thickening down from the tallest roofs so it leaves no edge across the sky.
function haze(top, amount, color) {
  if (top === null || top > view.h) return;
  const y = Math.max(0, top), grad = ctx.createLinearGradient(0, top, 0, top + CITY.hazeFade);
  grad.addColorStop(0, `rgba(${color},0)`); grad.addColorStop(1, `rgba(${color},${amount})`);
  ctx.fillStyle = grad; ctx.fillRect(0, y, view.w, view.h - y);
}

function draw(camY) {
  const color = SS.sky.hazeAt(camY), night = SS.sky.nightAt(camY);
  for (const L of LAYERS) {
    haze(drawLayer(L, camY, night), L.haze, color);
    drawLights(L, night);
  }
}

SS.city = { CITY, draw };
})();
