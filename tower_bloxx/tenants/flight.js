// How tenants fly in. Measured from the recording at 60 fps: 0.48 s after a floor lands, one
// tenant sets off from just beyond each edge of the screen (umbrella top 83 px above the floor
// top). Each flies a straight line, sideways and down together, fast at first (about 210 and
// 92 px/s there) and slowing evenly to a stop (an ease-out) 2.64 s later, passing the windows and
// meeting the other in the middle of the floor (umbrella top 38 px below the floor top), where
// they go inside. They follow the floor as the tower sways.
(() => {
'use strict';
const { K, clamp, easeOut } = SS, { view } = SS.screen;

const TENANTS = {
  perFloor: [-1, 1],            // one from the left edge, one from the right
  delay: 0.48,                  // seconds after the landing
  jitter: 0.03,                 // seconds of random extra delay
  time: 2.64,                   // seconds of flight
  startUmbrella: 83 * K,        // umbrella top above the floor top at the start
  endUmbrella: 38 * K,          // umbrella top below the floor top at the end
  endX: 2,                      // px either side of the floor's centre where they stop
  offScreen: 3,                 // px beyond the screen edge where they start
};

function init(g) { g.tenants = []; }

function moveIn(g, floor) {
  const T = TENANTS, feet = SS.tenantSprite.HEIGHT;
  for (const side of T.perFloor) {
    g.tenants.push({
      floor, endX: side * T.endX,
      sx: side * (view.w / 2 + T.offScreen), sy: -(floor + 1) * SS.blocks.H - (T.startUmbrella - feet),   // umbrella centre, feet
      t: -T.delay - Math.random() * T.jitter, dur: T.time, ph: Math.random() * 6.28,
      ...SS.tenantSprite.look(),
    });
  }
}

function pos(g, p) {
  const f = g.tower[p.floor];
  const end = SS.sway.bent(g, f.x + p.endX, -(p.floor + 1) * SS.blocks.H + TENANTS.endUmbrella + SS.tenantSprite.HEIGHT);
  const e = easeOut(clamp(p.t / p.dur, 0, 1));
  return { x: p.sx + (end.x - p.sx) * e, y: p.sy + (end.y - p.sy) * e };
}

function update(g, dt) {
  for (const p of g.tenants) p.t += dt;
  g.tenants = g.tenants.filter(p => p.t < p.dur);
}

// Floors from this one up have gone (tower collapse): their tenants turn back.
function dropFrom(g, floor) { g.tenants = g.tenants.filter(p => p.floor < floor); }

function draw(g, camY) {
  const cx = view.w / 2;
  for (const p of g.tenants) {
    if (p.t < 0) continue;
    const q = pos(g, p);
    SS.tenantSprite.draw(p, cx + q.x, q.y - camY);
  }
}

SS.tenants = { TENANTS, init, moveIn, update, dropFrom, draw };
})();
