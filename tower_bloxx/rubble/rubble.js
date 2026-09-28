// Rubble: floors that have come loose (misses, and floors thrown off in a collapse) as solid
// boxes (physics/rigid.js). They fall, spin, knock into each other, glance off and tumble over
// the edges of the tower's floors (which sway, and knock back), bounce and skid on the ground
// and come to rest. Every knock throws chips (effects/chips.js) and dust (effects/dust.js), and
// hard ones crack the floors and chip their corners (art/damage.js), the tower's included, thud,
// and jolt the screen. A floor lying still for a moment crumbles away in a cloud of dust.
(() => {
'use strict';
const { clamp } = SS, { ctx, view } = SS.screen;

const RUBBLE = {
  gravityShare: 0.8,     // of a dropped floor's gravity (drop/fall.js)
  substeps: 2,           // physics steps per game step
  knock: 60,             // px/s closing speed that makes chips and dust
  mark: 180,             // px/s that cracks a floor or chips a corner
  chipsPer: 70,          // px/s of knock per chip thrown
  chipsMax: 12,          // per knock
  heavy: 700,            // px/s that counts as a heavy knock (full effect)
  shakeFrom: 260,        // px/s that jolts the screen, if it's on screen
  shakePer: 1 / 180,     // px of jolt per px/s above that
  thudGap: 0.07,         // seconds between thuds at most
  still: 8,              // px/s (spin counts as px/s at the corners) below which a floor is lying still
  rest: 0.9,             // seconds lying still before it crumbles
  crumble: 0.5,          // seconds it takes to crumble away
};

function init(g) { g.rubble = []; g.thudAt = -1; }

// A floor comes loose: { kind, x, y, a, vx, vy, w, dmg }.
function add(g, o) {
  const { W, H } = SS.blocks;
  const b = SS.rigid.box({ x: o.x, y: o.y, a: o.a || 0, vx: o.vx || 0, vy: o.vy || 0, w: o.w || 0, hw: W / 2, hh: H / 2 });
  Object.assign(b, { kind: o.kind, dmg: o.dmg || SS.damage.make(), still: 0, fade: 0, age: 0 });
  g.rubble.push(b);
  return b;
}

// The tower's floors near any rubble, as boxes that sway and lean with the tower.
function towerBoxes(g) {
  const { W, H } = SS.blocks, n = g.tower.length, near = new Set();
  for (const b of g.rubble) {
    const r = 32, i0 = Math.max(0, Math.floor(-(b.y + r) / H)), i1 = Math.min(n - 1, Math.floor(-(b.y - r) / H));
    for (let i = i0; i <= i1; i++) near.add(i);
  }
  return [...near].map(i => {
    const f = g.tower[i], d0 = SS.sway.bendAt(g, i), d1 = SS.sway.bendAt(g, i + 1);
    return SS.rigid.box({ x: f.x + (d0 + d1) / 2, y: -(i + 0.5) * H, a: Math.atan2(d1 - d0, H), hw: W / 2, hh: H / 2,
      vx: SS.sway.bendVelAt(g, i + 0.5), invM: 0, invI: 0, floor: i });
  });
}

// Two things met at (x, y), B on the far side of normal (nx, ny), closing at `speed` px/s.
function knock(g, A, B, x, y, nx, ny, speed) {
  const R = RUBBLE;
  if (speed < R.knock) return;
  const k = clamp((speed - R.knock) / (R.heavy - R.knock), 0, 1);
  SS.chips.burst(g, x, y, -nx, -ny - 0.3, Math.min(R.chipsMax, Math.round(speed / R.chipsPer)), k);
  if (!B.ground) SS.chips.burst(g, x, y, nx, ny - 0.3, Math.min(R.chipsMax, Math.round(speed / R.chipsPer / 2)), k);
  SS.dust.burst(g, x, y, -nx, -ny, k);
  if (speed >= R.mark) {
    for (const body of [A, B]) {
      const d = body.dmg || (body.floor !== undefined && g.tower[body.floor] && (g.tower[body.floor].dmg ||= SS.damage.make()));
      if (!d) continue;
      const c = Math.cos(body.a), s = Math.sin(body.a), dx = x - body.x, dy = y - body.y;
      SS.damage.hit(d, c * dx + s * dy, -s * dx + c * dy, speed - R.mark);
    }
  }
  const onScreen = y - g.camY > -20 && y - g.camY < view.h + 20;
  if (onScreen && speed > R.shakeFrom) SS.shake.add(g, (speed - R.shakeFrom) * R.shakePer);
  if (onScreen && SS.time - g.thudAt > R.thudGap) { g.thudAt = SS.time; SS.sound.thud(k); }
}

// A floor lying still breaks up: chips and dust from all over it.
function crumble(g, b) {
  const { W, H } = SS.blocks, c = Math.cos(b.a), s = Math.sin(b.a);
  for (let i = 0; i < 5; i++) {
    const u = (Math.random() - 0.5) * W, v = (Math.random() - 0.5) * H;
    const x = b.x + c * u - s * v, y = b.y + s * u + c * v;
    SS.chips.burst(g, x, y, (Math.random() - 0.5), -1, 3, 0.2);
    SS.dust.burst(g, x, Math.min(0, y + H / 3), 0, -1, 0.35);
  }
  if (b.y - g.camY < view.h + 20) SS.sound.crumble();
}

function update(g, dt) {
  const R = RUBBLE;
  if (!g.rubble.length) return;
  const h = dt / R.substeps, grav = SS.fall.FALL.gravity * R.gravityShare, statics = towerBoxes(g);
  for (let i = 0; i < R.substeps; i++) SS.rigid.step(g.rubble, statics, grav, h, (A, B, x, y, nx, ny, v) => knock(g, A, B, x, y, nx, ny, v));
  for (const b of g.rubble) {
    b.age += dt;
    if (b.fade) { b.fade += dt / R.crumble; continue; }
    const moving = Math.hypot(b.vx, b.vy) + Math.abs(b.w) * 25;
    b.still = moving < R.still ? b.still + dt : 0;
    if (b.still > R.rest) { b.fade = 1e-6; crumble(g, b); }
  }
  g.rubble = g.rubble.filter(b => b.fade < 1);
}

// Loose floors still around the tower's top (the end of the round waits for them).
function busy(g) {
  const top = -g.tower.length * SS.blocks.H;
  return g.rubble.some(b => !b.fade && b.y < top + SS.blocks.H * 1.5);
}

function draw(g, camY) {
  const cx = view.w / 2, { W, H } = SS.blocks;
  for (const b of g.rubble) {
    const y = b.y - camY;
    if (y < -60 || y > view.h + 60) continue;
    ctx.save();
    ctx.globalAlpha = 1 - b.fade;
    ctx.translate(cx + b.x, y + b.fade * 6);           // crumbling: it sinks as it goes
    ctx.rotate(b.a);
    SS.damage.draw(ctx, b.kind, b.dmg, -W / 2, -H / 2);
    ctx.restore();
  }
}

SS.rubble = { RUBBLE, init, add, update, busy, draw };
})();
