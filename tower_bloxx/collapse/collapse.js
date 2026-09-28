// Collapse: a bad drop on a shaky tower brings its top down. When a floor lands well off centre
// (or tips over the edge) while the tower is swinging hard, or while the weight above some
// floor already hangs past that floor's edge, the floors above the weakest joint turn over the
// edge of the floor below as one piece. Where each floor is, how fast the sway and the blow of
// the new floor are moving it, and how far the stack leans decide which joint gives, which way
// it goes and how fast it turns; gravity does the rest. Past a certain lean the piece comes
// apart and the floors tumble to the ground on their own, glancing off the tower that is left.
// At most 10 floors fall, the bad one included, and the bottom three never do. The bad floor
// costs a life as usual; the floors that fall take their residents with them.
(() => {
'use strict';
const { view } = SS.screen;

const COLLAPSE = {
  badLanding: 10,     // px off centre: a landing at least this far off is a bad one
  shaky: 9,           // px: the top swinging at least this far either way is shaky
  perExtra: 3,        // px more swing for each extra floor that goes with the bad one
  maxFloors: 10,      // floors that fall at most, the bad one included
  margin: 1,          // px inside a floor's edge the weight above it may reach before it goes over
  lookahead: 0.12,    // seconds of motion counted when judging where the weight is heading
  impact: 0.3,        // share of the bad floor's speed passed on to the floors it hits
  minLean: 2,         // px per floor the weight is held past the edge at least, so it goes over
  breakAngle: 0.45,   // radians of turn at which the piece comes apart
  spin: 1.2,          // rad/s of random spin each floor picks up as it comes apart
  spread: 30,         // px/s each floor is thrown clear as it comes apart
  bounce: 0.2,        // share of speed kept glancing off the tower
  wreckTime: 0.8,     // seconds a wreck blinks on the ground
};

const gravity = () => SS.fall.FALL.gravity * SS.miss.MISS.gravityShare;

function init(g) { g.collapse = { pieces: [], bodies: [] }; }

// Where a floor of the standing tower is right now: centre, lean and sideways speed.
function floorNow(g, i) {
  const { H } = SS.blocks, f = g.tower[i], d0 = SS.sway.bendAt(g, i), d1 = SS.sway.bendAt(g, i + 1);
  return { kind: f.kind, x: f.x + (d0 + d1) / 2, y: -(i + 0.5) * H, vx: SS.sway.bendVelAt(g, i + 0.5), vy: 0, lean: Math.atan2(d1 - d0, H) };
}

// A floor just hit the top of the tower (b: the floor, dx: off the top floor's centre; landed:
// it came to rest there, otherwise it is tipping over the edge). Returns true if the top gave
// way, in which case the floor did not land.
function onImpact(g, b, dx, landed) {
  const { W, H } = SS.blocks, C = COLLAPSE, n = g.tower.length, fixed = SS.sway.SWAY.fixed;
  if ((landed && Math.abs(dx) < C.badLanding) || n <= fixed) return false;

  // the blow: the bad floor's own motion, some of it passed on to the floor it hits
  const hit = { kind: b.kind, x: b.x, y: -(n + 0.5) * H, vx: b.vx, vy: b.vy * C.impact, lean: 0 };
  const floors = [];
  const lo = Math.max(fixed, n + 1 - C.maxFloors);
  for (let i = lo; i < n; i++) floors.push(floorNow(g, i));
  if (!landed) floors[floors.length - 1].vx += b.vx * C.impact;

  // weakest joint by weight: the lowest floor whose load (with where it is heading) leans past its edge
  const lean = k => {
    let m = 0, sx = 0;
    for (let i = k; i < n; i++) { const p = floors[i - lo]; sx += p.x + p.vx * C.lookahead; m++; }
    sx += hit.x + hit.vx * C.lookahead; m++;               // the bad floor bears on the top either way
    return sx / m - (g.tower[k - 1].x + SS.sway.bendAt(g, k) + SS.sway.bendVelAt(g, k) * C.lookahead);
  };
  let j = n;
  for (let k = lo; k < n; k++) if (Math.abs(lean(k)) > W / 2 - C.margin) { j = k; break; }

  // by sway: the harder the top is swinging, the more floors go with the bad one
  const swing = SS.sway.swingAt(g, n);
  if (swing >= C.shaky) j = Math.min(j, n - 1 - Math.floor((swing - C.shaky) / C.perExtra));
  j = Math.max(j, lo);
  if (j >= n) return false;

  // the piece that goes: floors j.. and, if it landed, the bad floor on top
  const parts = floors.slice(j - lo);
  if (landed) parts.push(hit);
  const off = lean(j), sgn = Math.sign(off) || Math.sign(dx) || 1;
  const base = g.tower[j - 1].x, px = base + SS.sway.bendAt(g, j) + sgn * W / 2, py = -j * H;
  const pvx = SS.sway.bendVelAt(g, j);                      // the edge moves with the sway
  let I = 0, L = 0;
  for (const p of parts) {
    p.rx = p.x - px; p.ry = p.y - py;
    I += (W * W + H * H) / 12 + p.rx * p.rx + p.ry * p.ry;
    L += p.rx * p.vy - p.ry * (p.vx - pvx);                 // angular momentum about the edge
  }
  const w0 = L / I;
  g.collapse.pieces.push({ parts, base, j, sgn, I, th: 0, w: sgn * w0 > 0 ? w0 : 0 });

  // the tower loses its top
  const gone = g.tower.splice(j);
  SS.residents.remove(g, gone.reduce((s, f) => s + (f.residents || 0), 0));
  SS.tenants.dropFrom(g, j);
  SS.miss.releaseTips(g);
  SS.sway.afterCollapse(g);
  SS.sound.collapse();
  if (landed) SS.lives.lose(g);                             // a tip-over has already cost it
  SS.camera.climb(g);
  SS.hud.update(g);
  return true;
}

function pivotOf(g, pc) { return { x: pc.base + SS.sway.bendAt(g, pc.j) + pc.sgn * SS.blocks.W / 2, y: -pc.j * SS.blocks.H }; }
function partAt(pc, p, pv) {
  const c = Math.cos(pc.th), s = Math.sin(pc.th), rx = p.rx * c - p.ry * s, ry = p.rx * s + p.ry * c;
  return { x: pv.x + rx, y: pv.y + ry, ang: pc.th + p.lean, rx, ry };
}

// The piece has turned far enough: every floor carries on alone with the speed it had.
function comeApart(g, pc) {
  const C = COLLAPSE, pv = pivotOf(g, pc), pvx = SS.sway.bendVelAt(g, pc.j);
  for (const p of pc.parts) {
    const q = partAt(pc, p, pv);
    g.collapse.bodies.push({
      kind: p.kind, x: q.x, y: q.y, ang: q.ang, state: 'fall',
      vx: -pc.w * q.ry + pvx + pc.sgn * C.spread * (0.5 + Math.random() * 0.5),
      vy: pc.w * q.rx,
      av: pc.w + (Math.random() - 0.5) * 2 * C.spin,
    });
  }
}

// Turning over the edge: gravity on each floor's lever about the edge speeds the turn.
function turn(g, pc, dt) {
  const C = COLLAPSE, c = Math.cos(pc.th), s = Math.sin(pc.th);
  let lever = 0;
  for (const p of pc.parts) lever += p.rx * c - p.ry * s;
  if (pc.sgn * lever < C.minLean * pc.parts.length) lever = pc.sgn * C.minLean * pc.parts.length;
  pc.w += gravity() * lever / pc.I * dt;
  if (pc.sgn * pc.w < 0) pc.w = 0;                          // the edge holds it up, it cannot swing back
  pc.th += pc.w * dt;
  if (Math.abs(pc.th) >= C.breakAngle) { comeApart(g, pc); return false; }
  return true;
}

// A loose floor: it falls, glances off the tower that is left, and wrecks on the ground.
function fall(g, d, dt) {
  const C = COLLAPSE, { W, H } = SS.blocks;
  if (d.state === 'wreck') { d.t -= dt; return; }
  const lastBottom = d.y + H / 2;
  d.vy += gravity() * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.ang += d.av * dt;
  const n = g.tower.length, topY = -n * H;
  if (n && d.y + H / 2 > topY) {
    if (lastBottom <= topY) {                                 // came down on the roof: bounce and roll off
      const ax = g.tower[n - 1].x + SS.sway.bendAt(g, n), side = Math.sign(d.x - ax) || 1;
      if (Math.abs(d.x - ax) < W) {
        d.y = topY - H / 2; d.vy = -Math.abs(d.vy) * C.bounce;
        d.vx += side * C.spread; d.av += side * C.spin;
      }
    } else {                                                // beside the tower: glance off its side
      const i = Math.min(n - 1, Math.max(0, Math.floor(-d.y / H)));
      const ax = g.tower[i].x + SS.sway.bendAt(g, i + 0.5), side = Math.sign(d.x - ax) || 1;
      if (Math.abs(d.x - ax) < W) {
        d.x = ax + side * W;
        if (Math.sign(d.vx) !== side) d.vx = -d.vx * C.bounce;
      }
    }
  }
  if (d.y + H / 2 >= 0) {
    d.state = 'wreck'; d.y = -H / 2; d.ang = 0; d.t = C.wreckTime + Math.random() * 0.2;
    SS.dust.puff(g, d.x, 0, 10);
  }
}

function update(g, dt) {
  const k = g.collapse;
  k.pieces = k.pieces.filter(pc => turn(g, pc, dt));
  for (const d of k.bodies) fall(g, d, dt);
  k.bodies = k.bodies.filter(d => (d.state === 'wreck' ? d.t > 0 : d.y - g.camY < view.h + 160));
}

function draw(g, camY) {
  const cx = view.w / 2, k = g.collapse;
  for (const pc of k.pieces) {
    const pv = pivotOf(g, pc);
    for (const p of pc.parts) { const q = partAt(pc, p, pv); SS.blocks.drawAt(p.kind, cx + q.x, q.y - camY, q.ang); }
  }
  for (const d of k.bodies) {
    if (d.state === 'wreck' && Math.floor(d.t * 10) % 2) continue;   // wreck blinks out
    SS.blocks.drawAt(d.kind, cx + d.x, d.y - camY, d.ang);
  }
}

SS.collapse = { COLLAPSE, init, onImpact, update, draw };
})();
