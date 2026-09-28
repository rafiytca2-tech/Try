// Dropping a floor: letting it go from the hook, the fall, and where it hits.
//
// Measured from the recording: a released floor keeps about half of the hook's sideways speed,
// falls at 7200 px/s² and turns level as it falls. When it reaches the tower top it either lands
// (landing/landing.js) or misses (miss/miss.js): its centre past the edge tips it over the side,
// a full width off and it falls clean past, and a first floor off the slab is lost.
(() => {
'use strict';
const { K } = SS, { view } = SS.screen;

const FALL = {
  gravity: 7200 * K,    // px/s²
  carry: 0.55,          // share of the hook's sideways speed a released floor keeps
  straighten: 14,       // a released floor turns level at this rate (1/s)
};

function init(g) { g.falling = null; }

function drop(g) {
  if (SS.round.state !== 'play' || !g.hook.has || g.falling || g.ending) return;
  const { H } = SS.blocks;
  const h = SS.crane.hookAt(g), kind = SS.crane.nextKind(g), d = SS.rigging.RIGGING.hang[kind] + H / 2;
  // the centre of the load, which hangs tilted below the hook point
  const sx = h.x - d * Math.sin(h.tilt), sy = h.y + d * Math.cos(h.tilt);
  g.falling = { x: sx - view.w / 2, y: sy + g.camY, vx: h.vx * FALL.carry, vy: h.vy, ang: h.tilt, kind };
  SS.crane.take(g);
  SS.hud.hideTip();
  SS.sound.release();
}

function update(g, dt) {
  const b = g.falling;
  if (!b) return;
  const { W, H } = SS.blocks;
  b.vy += FALL.gravity * dt; b.x += b.vx * dt; b.y += b.vy * dt;
  b.ang *= Math.exp(-FALL.straighten * dt);
  const n = g.tower.length, top = SS.tower.top(g);
  if (b.y + H / 2 < top.y) return;
  b.y = top.y - H / 2;
  if (n === 0) {                                   // first floor: on the slab or lost
    if (Math.abs(b.x) > SS.ground.GROUND.slabHalf) { g.falling = null; SS.miss.offSite(g, b); return; }
    SS.landing.land(g, b, b.x);
    return;
  }
  const dx = b.x - top.x;
  if (Math.abs(dx) >= W) { g.falling = null; SS.miss.fallPast(g, b, dx); }            // a full width off
  else if (Math.abs(dx) > W / 2) { g.falling = null; SS.miss.tipOver(g, b, dx, top); } // centre past the edge
  else SS.landing.land(g, b, dx);
}

function draw(g, camY) {
  const b = g.falling;
  if (b) SS.blocks.drawAt(b.kind, view.w / 2 + b.x, b.y - camY, b.ang);
}

SS.fall = { FALL, init, drop, update, draw };
})();
