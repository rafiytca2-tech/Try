// Misses: a floor that tips over the edge, falls clean past the tower, or lands off the slab.
// It tumbles, crashes on the ground in a puff of dust, blinks out, and costs a life.
(() => {
'use strict';
const { view } = SS.screen;

const MISS = {
  tipSpin: 18,          // rad/s² a floor tipping over the edge speeds up its turn
  tipLetGo: 0.9,        // radians of turn before it drops off the edge
  tipOffSpeed: [70, 40],// px/s sideways and down as it drops off
  fallSpin: 1.5,        // rad/s of a floor falling clean past
  gravityShare: 0.8,    // share of a dropped floor's gravity (drop/fall.js) while tumbling
  wreckTime: 0.8,       // seconds the wreck blinks on the ground
  offSiteWreckTime: 0.9,
};

function init(g) { g.debris = []; }

function offSite(g, b) {
  g.debris.push({ state: 'wreck', x: b.x, y: -SS.blocks.H / 2, ang: 0, t: MISS.offSiteWreckTime, kind: b.kind });
  SS.dust.puff(g, b.x, 0, 14);
  SS.lives.lose(g);
}
function fallPast(g, b, dx) {
  g.debris.push({ state: 'fall', x: b.x, y: b.y, vx: b.vx, vy: b.vy, ang: b.ang, spin: Math.sign(dx) * MISS.fallSpin, kind: b.kind });
  SS.lives.lose(g);
}
function tipOver(g, b, dx, top) {
  const { W, H } = SS.blocks, sgn = Math.sign(dx), ex = top.x + sgn * W / 2;
  g.debris.push({ state: 'tip', x: b.x, y: b.y, ang: 0, av: 0, sgn, px: ex, py: top.y, rx: b.x - ex, ry: -H / 2, kind: b.kind });
  SS.lives.lose(g);
}

// The floor a tipping floor was turning on has gone (collapse/collapse.js): it drops off.
function releaseTips(g) {
  for (const d of g.debris) {
    if (d.state !== 'tip') continue;
    d.state = 'fall'; d.vx = d.sgn * MISS.tipOffSpeed[0]; d.vy = MISS.tipOffSpeed[1]; d.spin = d.av || d.sgn * 2;
  }
}

function step(g, d, dt) {
  const { H } = SS.blocks;
  if (d.state === 'tip') {
    d.av += d.sgn * MISS.tipSpin * dt; d.ang += d.av * dt;
    const c = Math.cos(d.ang), s = Math.sin(d.ang);
    d.x = d.px + d.rx * c - d.ry * s; d.y = d.py + d.rx * s + d.ry * c;
    if (Math.abs(d.ang) > MISS.tipLetGo) { d.state = 'fall'; d.vx = d.sgn * MISS.tipOffSpeed[0]; d.vy = MISS.tipOffSpeed[1]; d.spin = d.av; }
  } else if (d.state === 'fall') {
    d.vy += SS.fall.FALL.gravity * MISS.gravityShare * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.ang += d.spin * dt;
    if (d.y + H / 2 >= 0) { d.state = 'wreck'; d.y = -H / 2; d.ang = 0; d.t = MISS.wreckTime; SS.dust.puff(g, d.x, 0, 12); }
  } else {
    d.t -= dt;
  }
}

function update(g, dt) {
  for (const d of g.debris) step(g, d, dt);
  g.debris = g.debris.filter(d => (d.state === 'wreck' ? d.t > 0 : d.y - g.camY < view.h + 120));
}

function draw(g, camY) {
  for (const d of g.debris) {
    if (d.state === 'wreck' && Math.floor(d.t * 10) % 2) continue;   // wreck blinks out
    SS.blocks.drawAt(d.kind, view.w / 2 + d.x, d.y - camY, d.ang);
  }
}

// A floor is still turning over the tower's edge (the end of the round waits for it).
const busy = g => g.debris.some(d => d.state === 'tip');

SS.miss = { MISS, init, offSite, fallPast, tipOver, releaseTips, busy, update, draw };
})();
