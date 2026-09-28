// How a tenant looks: a red or blue dome umbrella, a thin handle, and a little person hanging
// from it by one raised arm (skin, shirt, orange-brown trousers), swinging slightly.
(() => {
'use strict';
const { pick } = SS, { rect, pixLine } = SS.px, { ctx } = SS.screen;

const LOOK = {
  umbrellas: [['#a81818', '#5c0a0a', '#e0463a'], ['#1b2f9a', '#0b1660', '#4a6ad8']],   // dome, rim, highlight
  shirts: ['#3f8f2f', '#c8a038', '#3a64b8', '#b84a3a'],
  skin: ['#e8b07a', '#c98a5a'],
  trousers: '#a8561e',
  swing: 1.2,         // px the person swings under the umbrella
  swingSpeed: 5,      // rad/s
};
const HEIGHT = 21;    // feet to the umbrella's top, game px (tenants/flight.js places tenants by it)

function look() { return { umbrella: pick(LOOK.umbrellas), shirt: pick(LOOK.shirts), skin: pick(LOOK.skin) }; }

// x: the umbrella's centre column; y: the screen row under the feet.
function draw(p, x, y) {
  const [dome, rim, hi] = p.umbrella, trousers = LOOK.trousers;
  const sw = Math.round(Math.sin(p.t * LOOK.swingSpeed + p.ph) * LOOK.swing), px = x + sw - 1;
  rect(ctx, '#2a1a1a', x, y - 22, 1, 1);          // tip
  rect(ctx, dome, x - 2, y - 21, 5, 1);
  rect(ctx, dome, x - 4, y - 20, 9, 1);
  rect(ctx, dome, x - 5, y - 19, 11, 2);
  rect(ctx, hi, x - 3, y - 20, 2, 1); rect(ctx, hi, x - 4, y - 19, 1, 1);
  rect(ctx, rim, x - 5, y - 17, 11, 1);
  for (const k of [-5, -1, 3]) rect(ctx, rim, x + k, y - 16, 2, 1);   // scalloped edge
  pixLine(ctx, '#1a1a1a', x, y - 16, px + 1, y - 12);                 // handle
  rect(ctx, p.skin, px + 1, y - 12, 1, 3);        // raised arm
  rect(ctx, p.skin, px - 1, y - 11, 2, 2);        // head
  rect(ctx, p.shirt, px - 1, y - 9, 3, 4);        // shirt
  rect(ctx, trousers, px - 1, y - 5, 3, 2);
  rect(ctx, trousers, px - 1, y - 3, 1, 2); rect(ctx, trousers, px + 1, y - 3, 1, 2);   // legs
  rect(ctx, '#2a1a10', px - 1, y - 1, 1, 1); rect(ctx, '#2a1a10', px + 1, y - 1, 1, 1);  // shoes
}

SS.tenantSprite = { LOOK, HEIGHT, look, draw };
})();
