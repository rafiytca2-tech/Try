// How tenants fly in. Every resident is a tenant: a clean floor gets four, a held drop or a combo
// payout (score/residents.js) sends more. Measured from the recording at 60 fps: about 0.48 s
// after a floor lands, tenants set off (umbrella top about 83 px above the floor top), fly
// sideways and down together, fast at first and slowing to a stop about 2.64 s later at the floor
// (umbrella top 38 px below the floor top). In 3D they come from any direction round the
// building except the 60° facing the camera, so they never cover its front: from the sides, from
// behind (small in the distance, passing behind the tower) and everywhere between, each to a
// window on the side of the floor they come from. Each flight also varies: when they set off,
// how high they start, how long they take, a gentle arc up or dip down, how they bob, lean into
// the flight and swing under the umbrella, and their size. When one gets in, the room lights up
// behind the front window on that side and the population goes up by one. They follow the floor
// as the tower sways. If their floor falls in a collapse, they turn back and fly off.
(() => {
'use strict';
const { K, clamp } = SS, { ctx, view } = SS.screen;

const TENANTS = {
  delay: 0.48,                  // seconds after the landing
  gap: 0.22,                    // seconds between each pair setting off for the same floor (varies ±50%)
  jitter: 0.25,                 // seconds of random extra delay
  time: 2.64,                   // seconds of flight (varies by `timeVary`)
  timeVary: [0.8, 1.25],
  around: [30, 330],            // degrees round the building they come from (0 = straight at the camera)
  reach: 175,                   // px from the building's middle where they start
  startUmbrella: 83 * K,        // umbrella top above the floor top at the start
  endUmbrella: 38 * K,          // umbrella top below the floor top at the end
  startHeight: [-28, 22],       // px higher (−) or lower than the usual start
  arc: [-26, 14],               // px the path bows up (−) or dips down at its middle
  ease: [1.6, 2.6],             // how sharply they slow down at the end (2 = the recording's)
  bob: [0.8, 2.6],              // px they bob up and down in flight
  bobRate: [2.5, 5.5],          // rad/s
  lean: [0.05, 0.16],           // radians they lean into the flight at the start
  size: [0.92, 1.08],
  swing: [0.7, 1.8],            // px the person swings under the umbrella
  swingRate: [3.5, 6.5],        // rad/s
  fadeIn: 0.3,                  // seconds to fade in (some appear out of the distance)
  window: 8,                    // px from the floor's centre to the middle of each front window
  glow: 0.45,                   // seconds a window stays lit after someone goes in
  glowColor: '255,214,120',
  leaveTime: 1.3,               // seconds to fly back off when their floor falls
};

function init(g) { g.tenants = []; g.glows = []; }

const rnd = ([a, b]) => a + Math.random() * (b - a);
const RAD = Math.PI / 180;

// count tenants set off for a floor, after an extra wait of `after` seconds.
function moveIn(g, floor, count, after = 0) {
  const T = TENANTS, { W, H, BOX } = SS.blocks, feet = SS.tenantSprite.HEIGHT, D = BOX.depth;
  let wait = T.delay + after;
  for (let i = 0; i < count; i++) {
    if (i % 2 === 0 && i) wait += T.gap * (0.5 + Math.random());
    const a = rnd(T.around) * RAD, sx = Math.sin(a), cz = -Math.cos(a);     // direction out from the middle (x, z)
    const side = Math.cos(a) > -Math.cos(45 * RAD);                        // round a side (or front corner), or from behind
    g.tenants.push({
      floor, dir: Math.sign(sx) || 1,
      ox: sx * T.reach, oz: D / 2 + cz * T.reach,                          // start, from the floor's middle
      ex: side ? Math.sign(sx) * (W / 2 + 1) : sx * W * 0.4,               // the window they go in by
      ez: side ? D / 2 + (Math.random() - 0.5) * 12 : D + 1,
      sy: -(floor + 1) * H - (T.startUmbrella - feet) + rnd(T.startHeight),   // feet
      t: -(wait + Math.random() * T.jitter), dur: T.time * rnd(T.timeVary),
      arc: rnd(T.arc), ease: rnd(T.ease), bob: rnd(T.bob), bobRate: rnd(T.bobRate), lean: rnd(T.lean),
      scale: rnd(T.size), swing: rnd(T.swing), swingRate: rnd(T.swingRate), ph: Math.random() * 6.28,
      x: 0, y: 0, z: 0, tilt: 0, leave: null,
      ...SS.tenantSprite.look(),
    });
  }
}

// Where a tenant is in 3D: x across from the tower's line, y as the world's, z back from the
// tower's front.
function pos(g, p) {
  if (p.leave) {                                   // turning back: off the way they came
    const k = Math.min(1, p.leave.t / TENANTS.leaveTime), e = k * k;
    return { x: p.leave.x + (p.leave.sx - p.leave.x) * e, y: p.leave.y + (p.sy - 40 - p.leave.y) * e, z: p.leave.z + (p.leave.sz - p.leave.z) * e, tilt: p.dir * 0.2 * e };
  }
  const f = g.tower[p.floor], H = SS.blocks.H;
  const endY = -(p.floor + 1) * H + TENANTS.endUmbrella + SS.tenantSprite.HEIGHT;
  const mid = f.x + SS.sway.bendAt(g, -endY / H);                  // the floor's middle, swaying
  const sx = mid + p.ox, ex = mid + p.ex;
  const k = clamp(p.t / p.dur, 0, 1), e = 1 - Math.pow(1 - k, p.ease), u = 1 - e;
  const my = (p.sy + endY) / 2 + p.arc;                            // a gentle bow in the path
  const bob = Math.sin(p.t * p.bobRate + p.ph) * p.bob * u;
  return {
    x: u * u * sx + 2 * u * e * (sx + ex) / 2 + e * e * ex,
    y: u * u * p.sy + 2 * u * e * my + e * e * endY + bob,
    z: p.oz + (p.ez - p.oz) * e,
    tilt: -Math.sign(p.ex - p.ox) * p.lean * u,
  };
}

function update(g, dt) {
  for (const p of g.tenants) {
    p.t += dt;
    if (p.leave) {
      p.leave.t += dt; p.gone = p.leave.t >= TENANTS.leaveTime;
      Object.assign(p, pos(g, p), { leave: p.leave });
      continue;
    }
    if (p.t < 0) continue;
    if (p.t >= p.dur) {                            // in through the window
      p.gone = true;
      g.glows.push({ floor: p.floor, side: p.dir, t: 0 });
      SS.residents.arrive(g, p.floor);
      SS.sound.arrive(p.dir);
      continue;
    }
    Object.assign(p, pos(g, p));
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
    else p.leave = { x: p.x, y: p.y, z: p.z, sx: p.x + p.ox * 1.2, sz: p.oz, t: 0 };
  }
  g.tenants = g.tenants.filter(p => !p.gone);
  g.glows = g.glows.filter(w => w.floor < floor);
}

// The room behind a front window lighting up as someone gets in.
function drawGlow(g, w, cx, camY) {
  const f = g.tower[w.floor], { H } = SS.blocks, a = 1 - w.t / TENANTS.glow;
  const p = SS.sway.bent(g, f.x + w.side * TENANTS.window, -(w.floor + 1) * H + 23);
  const x = cx + p.x, y = p.y - camY, halo = ctx.createRadialGradient(x, y, 0, x, y, 16);
  halo.addColorStop(0, `rgba(${TENANTS.glowColor},${0.55 * a})`); halo.addColorStop(1, `rgba(${TENANTS.glowColor},0)`);
  ctx.fillStyle = halo; ctx.fillRect(x - 16, y - 18, 32, 36);
  SS.px.rrect(ctx, `rgba(255,236,170,${0.75 * a})`, x - 3, y - 12, 6, 25, 1);
}

// Tenants seen through the camera's eye: drawn in toward it, and smaller, the further back they
// are. behind: those further back than the tower's middle (drawn before the tower, which hides
// them), or the rest (drawn after it).
function drawSome(g, camY, behind) {
  const E = SS.camera.eye(), mid = SS.blocks.BOX.depth / 2, cx = view.w / 2;
  for (const p of g.tenants) {
    if (p.t < 0 || (p.z > mid) !== behind) continue;
    const k = E.dist / Math.max(40, E.dist + p.z);
    const x = E.x + (cx + p.x - E.x) * k, y = E.y + (p.y - camY - E.y) * k;
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.leave ? 1 - p.leave.t / TENANTS.leaveTime : p.t / TENANTS.fadeIn);
    ctx.translate(x, y);
    if (p.tilt) ctx.rotate(p.tilt);
    ctx.scale(p.scale * k, p.scale * k);
    SS.tenantSprite.draw(p, 0, 0);
    ctx.restore();
  }
}
function drawBehind(g, camY) { drawSome(g, camY, true); }
function draw(g, camY) {
  const cx = view.w / 2;
  for (const w of g.glows) drawGlow(g, w, cx, camY);
  drawSome(g, camY, false);
}

// Tenants still on their way (the end of the round waits for them).
const busy = g => g.tenants.length > 0;

SS.tenants = { TENANTS, init, moveIn, update, dropFrom, busy, drawBehind, draw };
})();
