// How a tenant looks: a red or blue dome umbrella with a scalloped edge, a thin handle, and a
// little person hanging from it by one raised arm (skin, shirt, orange-brown trousers), swinging
// gently.
(() => {
'use strict';
const { pick } = SS, { circle, rrect, line } = SS.px, { ctx } = SS.screen;

const LOOK = {
  umbrellas: [['#b31d1d', '#5c0a0a', '#f06a5a'], ['#2240b0', '#0b1660', '#7a98f0']],   // dome, rim, highlight
  shirts: ['#3f8f2f', '#c8a038', '#3a64b8', '#b84a3a'],
  skin: ['#e8b07a', '#c98a5a'],
  trousers: '#a8561e',
  shoes: '#2a1a10',
  swing: 1.2,         // px the person swings under the umbrella
  swingSpeed: 5,      // rad/s
};
const HEIGHT = 21;    // feet to the umbrella's top, game px (tenants/flight.js places tenants by it)

function look() { return { umbrella: pick(LOOK.umbrellas), shirt: pick(LOOK.shirts), skin: pick(LOOK.skin) }; }

// x: the umbrella's centre; y: the ground line under the feet (screen px, any fraction).
function draw(p, x, y) {
  const [dome, rim, hi] = p.umbrella, L = LOOK;
  const sw = Math.sin(p.t * L.swingSpeed + p.ph) * L.swing, px = x + sw - 0.5;
  const top = y - HEIGHT, base = y - 16.2, r = 5.6;

  // canopy: a dome, with a scalloped edge along the bottom
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.moveTo(x - r, base);
  ctx.bezierCurveTo(x - r, top + 0.6, x + r, top + 0.6, x + r, base);
  for (let i = 0; i < 3; i++) {
    const x0 = x + r - i * (2 * r / 3), x1 = x0 - 2 * r / 3;
    ctx.quadraticCurveTo((x0 + x1) / 2, base - 1.4, x1, base);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rim; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.strokeStyle = hi; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(x - 0.6, base + 0.4, 3.9, Math.PI * 1.18, Math.PI * 1.45); ctx.stroke();
  line(ctx, '#2a1a1a', x, top + 0.8, x, top - 0.8, 0.7);                 // tip

  // handle and the person holding it
  line(ctx, '#1a1a1a', x, base - 0.5, px + 0.9, y - 12, 0.6);
  line(ctx, p.skin, px + 0.9, y - 12, px + 0.8, y - 8.8, 0.9);           // raised arm
  circle(ctx, px - 0.2, y - 10.1, 1.25, p.skin);                         // head
  rrect(ctx, p.shirt, px - 1.6, y - 8.9, 3.2, 4.1, 0.9);                 // shirt
  rrect(ctx, L.trousers, px - 1.5, y - 5.1, 3, 2.3, 0.5);
  line(ctx, L.trousers, px - 0.8, y - 3.2, px - 0.9 - sw * 0.25, y - 0.9, 0.95);   // legs
  line(ctx, L.trousers, px + 0.8, y - 3.2, px + 0.9 - sw * 0.25, y - 0.9, 0.95);
  circle(ctx, px - 1 - sw * 0.25, y - 0.6, 0.6, L.shoes);
  circle(ctx, px + 1 - sw * 0.25, y - 0.6, 0.6, L.shoes);
}

SS.tenantSprite = { LOOK, HEIGHT, look, draw };
})();
