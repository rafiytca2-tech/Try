// How tenants fly in. Every resident is a tenant: a clean floor gets four, a held drop or a combo
// payout (score/residents.js) sends more. Measured from the recording at 60 fps: about 0.48 s
// after a floor lands, tenants set off from just beyond each edge of the screen, alternately
// left and right (umbrella top about 83 px above the floor top), fly sideways and down together,
// fast at first and slowing to a stop about 2.64 s later at one of the floor's two windows
// (umbrella top 38 px below the floor top). Each tenant flies a little differently: when they
// set off, how high they start, how long they take, a gentle arc up or dip down, how they bob,
// lean into the flight and swing under the umbrella, and their size. At the window they go in:
// it lights up and the population goes up by one. They follow the floor as the tower sways. If
// their floor falls in a collapse, they turn back and fly off.
(() => {
'use strict';
const { K, clamp } = SS, { ctx, view } = SS.screen;

const TENANTS = {
  delay: 0.48,                  // seconds after the landing
  gap: 0.22,                    // seconds between each pair setting off for the same floor (varies ±50%)
  jitter: 0.25,                 // seconds of random extra delay
  time: 2.64,                   // seconds of flight (varies by `timeVary`)
  timeVary: [0.8, 1.25],
  startHeight: [-28, 22],       // px higher (−) or lower than the usual start
  startOut: [0, 18],            // px further off screen they may start
  arc: [-26, 14],               // px the path bows up (−) or dips down at its middle
  ease: [1.6, 2.6],             // how sharply they slow down at the end (2 = the recording's)
  bob: [0.8, 2.6],              // px they bob up and down in flight
  bobRate: [2.5, 5.5],          // rad/s
  lean: [0.05, 0.16],           // radians they lean into the flight at the start
  size: [0.92, 1.08],
  swing: [0.7, 1.8],            // px the person swings under the umbrella
  swingRate: [3.5, 6.5],        // rad/s
  startUmbrella: 83 * K,        // umbrella top above the floor top at the start
  endUmbrella: 38 * K,          // umbrella top below the floor top at the end
  window: 8,                    // px from the floor's centre to the middle of each window
  spread: 1.2,                  // px of random offset so a crowd doesn't stack on one spot
  offScreen: 3,                 // px beyond the screen edge where they start
  glow: 0.45,                   // seconds a window stays lit after someone goes in
  glowColor: '255,214,120',
  leaveTime: 1.3,               // seconds to fly back off screen when their floor falls
};

function init(g) { g.tenants = []; g.glows = []; }

const rnd = ([a, b]) => a + Math.random() * (b - a);

// count tenants set off for a floor, after an extra wait of `after` seconds.
function moveIn(g, floor, count, after = 0) {
  const T = TENANTS, feet = SS.tenantSprite.HEIGHT;
  let wait = T.delay + after;
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1;
    if (i % 2 === 0 && i) wait += T.gap * (0.5 + Math.random());
    g.tenants.push({
      floor, side, endX: side * T.window + (Math.random() - 0.5) * 2 * T.spread,
      sx: side * (view.w / 2 + T.offScreen + rnd(T.startOut)),
      sy: -(floor + 1) * SS.blocks.H - (T.startUmbrella - feet) + rnd(T.startHeight),   // feet
      t: -(wait + Math.random() * T.jitter), dur: T.time * rnd(T.timeVary),
      arc: rnd(T.arc), ease: rnd(T.ease), bob: rnd(T.bob), bobRate: rnd(T.bobRate), lean: rnd(T.lean),
      scale: rnd(T.size), swing: rnd(T.swing), swingRate: rnd(T.swingRate), ph: Math.random() * 6.28,
      x: 0, y: 0, tilt: 0, leave: null,
      ...SS.tenantSprite.look(),
    });
  }
}

function pos(g, p) {
  if (p.leave) {                                   // turning back: off the way they came
    const k = Math.min(1, p.leave.t / TENANTS.leaveTime), e = k * k;
    return { x: p.leave.x + (p.sx - p.leave.x) * e, y: p.leave.y + (p.sy - 40 - p.leave.y) * e, tilt: p.side * 0.2 * e };
  }
  const f = g.tower[p.floor];
  const end = SS.sway.bent(g, f.x + p.endX, -(p.floor + 1) * SS.blocks.H + TENANTS.endUmbrella + SS.tenantSprite.HEIGHT);
  const k = clamp(p.t / p.dur, 0, 1), e = 1 - Math.pow(1 - k, p.ease), u = 1 - e;
  const mx = (p.sx + end.x) / 2, my = (p.sy + end.y) / 2 + p.arc;               // a gentle bow in the path
  const bob = Math.sin(p.t * p.bobRate + p.ph) * p.bob * u;
  return { x: u * u * p.sx + 2 * u * e * mx + e * e * end.x, y: u * u * p.sy + 2 * u * e * my + e * e * end.y + bob, tilt: -p.side * p.lean * u };
}

function update(g, dt) {
  for (const p of g.tenants) {
    p.t += dt;
    if (p.leave) {
      p.leave.t += dt; p.gone = p.leave.t >= TENANTS.leaveTime;
      const q = pos(g, p); p.x = q.x; p.y = q.y; p.tilt = q.tilt;
      continue;
    }
    if (p.t < 0) continue;
    if (p.t >= p.dur) {                            // through the window
      p.gone = true;
      g.glows.push({ floor: p.floor, side: p.side, t: 0 });
      SS.residents.arrive(g, p.floor);
      continue;
    }
    const q = pos(g, p); p.x = q.x; p.y = q.y; p.tilt = q.tilt;
  }
  g.tenants = g.tenants.filter(p => !p.gone);
  for (const w of g.glows) w.t += dt;
  g.glows = g.glows.filter(w => w.t < TENANTS.glow && g.tower[w.floor]);
}

// Floors from this one up have fallen (collapse/collapse.js): their tenants turn back.
function dropFrom(g, floor) {
  for (const p of g.tenants) {
    if (p.floor < floor || p.leave) continue;
    if (p.t < 0) p.gone = true;                    // not set off yet
    else p.leave = { x: p.x, y: p.y, t: 0 };
  }
  g.tenants = g.tenants.filter(p => !p.gone);
  g.glows = g.glows.filter(w => w.floor < floor);
}

// A window lighting up as someone goes in.
function drawGlow(g, w, cx, camY) {
  const f = g.tower[w.floor], { H } = SS.blocks, a = 1 - w.t / TENANTS.glow;
  const p = SS.sway.bent(g, f.x + w.side * TENANTS.window, -(w.floor + 1) * H + 23);
  const x = cx + p.x, y = p.y - camY, halo = ctx.createRadialGradient(x, y, 0, x, y, 16);
  halo.addColorStop(0, `rgba(${TENANTS.glowColor},${0.55 * a})`); halo.addColorStop(1, `rgba(${TENANTS.glowColor},0)`);
  ctx.fillStyle = halo; ctx.fillRect(x - 16, y - 18, 32, 36);
  SS.px.rrect(ctx, `rgba(255,236,170,${0.75 * a})`, x - 3, y - 12, 6, 25, 1);
}

function draw(g, camY) {
  const cx = view.w / 2;
  for (const w of g.glows) drawGlow(g, w, cx, camY);
  for (const p of g.tenants) {
    if (p.t < 0) continue;
    ctx.save();
    ctx.translate(cx + p.x, p.y - camY);
    if (p.tilt) ctx.rotate(p.tilt);
    if (p.scale !== 1) ctx.scale(p.scale, p.scale);
    SS.tenantSprite.draw(p, 0, 0);
    ctx.restore();
  }
}

// Tenants still on their way (the end of the round waits for them).
const busy = g => g.tenants.length > 0;

SS.tenants = { TENANTS, init, moveIn, update, dropFrom, busy, draw };
})();
