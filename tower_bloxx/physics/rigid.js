// A small rigid-body solver for loose floors: boxes that fall, spin, knock into each other, the
// tower and the ground, slide, and come to rest. It is the sequential-impulse method of Box2D
// Lite: each step finds where boxes touch (up to two points per pair, by clipping the edge of
// one box against the face of the other), then pushes the boxes apart and applies friction a
// number of times over, so stacks and piles settle. Boxes that are not pushed around (the
// tower's floors, which sway on their own) have no inverse mass but still carry their speed, so
// a swaying floor knocks what touches it. The ground is flat at y = 0.
(() => {
'use strict';

const RIGID = {
  iterations: 10,
  friction: 0.55,
  restitution: 0.18,   // share of the closing speed a hard hit bounces back
  bounceFrom: 80,      // px/s: slower hits don't bounce
  slop: 0.4,           // px of overlap allowed, so resting contact stays calm
  bias: 0.25,          // share of the overlap corrected each step
  spinDamp: 0.4,       // 1/s: air slowing the spin a little
};

// A box: centre (x, y), angle a, half-sizes hw and hh, velocity (vx, vy), spin w. invM and invI
// are 0 for a box nothing can push.
function box(o) {
  const b = Object.assign({ x: 0, y: 0, a: 0, vx: 0, vy: 0, w: 0, hw: 20, hh: 23, invM: 1 }, o);
  if (b.invI === undefined) b.invI = b.invM ? 3 * b.invM / (b.hw * b.hw + b.hh * b.hh) : 0;
  return b;
}

const radius = b => Math.hypot(b.hw, b.hh);
function corners(b) {
  const c = Math.cos(b.a), s = Math.sin(b.a), out = [];
  for (const [u, v] of [[-b.hw, -b.hh], [b.hw, -b.hh], [b.hw, b.hh], [-b.hw, b.hh]]) out.push([b.x + c * u - s * v, b.y + s * u + c * v]);
  return out;
}

// The edge of box b (angle c, s) that faces most against the normal (nx, ny).
function incidentEdge(b, c, s, nx, ny) {
  const n1 = -(c * nx + s * ny), n2 = -(-s * nx + c * ny), hx = b.hw, hy = b.hh;
  let v0, v1;
  if (Math.abs(n1) > Math.abs(n2)) {
    if (n1 > 0) { v0 = [hx, -hy]; v1 = [hx, hy]; } else { v0 = [-hx, hy]; v1 = [-hx, -hy]; }
  } else if (n2 > 0) { v0 = [hx, hy]; v1 = [-hx, hy]; } else { v0 = [-hx, -hy]; v1 = [hx, -hy]; }
  return [v0, v1].map(([u, v]) => [b.x + c * u - s * v, b.y + s * u + c * v]);
}
function clip(pts, nx, ny, offset) {
  const out = [], d0 = nx * pts[0][0] + ny * pts[0][1] - offset, d1 = nx * pts[1][0] + ny * pts[1][1] - offset;
  if (d0 <= 0) out.push(pts[0]);
  if (d1 <= 0) out.push(pts[1]);
  if (d0 * d1 < 0) { const k = d0 / (d0 - d1); out.push([pts[0][0] + k * (pts[1][0] - pts[0][0]), pts[0][1] + k * (pts[1][1] - pts[0][1])]); }
  return out;
}

// Where boxes A and B touch: the normal (from A to B) and up to two points with their overlap
// (negative), or null.
function collide(A, B) {
  const cA = Math.cos(A.a), sA = Math.sin(A.a), cB = Math.cos(B.a), sB = Math.sin(B.a);
  const dx = B.x - A.x, dy = B.y - A.y;
  const dAx = cA * dx + sA * dy, dAy = -sA * dx + cA * dy, dBx = cB * dx + sB * dy, dBy = -sB * dx + cB * dy;
  const c11 = Math.abs(cA * cB + sA * sB), c12 = Math.abs(sA * cB - cA * sB), c21 = c12, c22 = c11;
  const faceAx = Math.abs(dAx) - A.hw - (c11 * B.hw + c12 * B.hh), faceAy = Math.abs(dAy) - A.hh - (c21 * B.hw + c22 * B.hh);
  if (faceAx > 0 || faceAy > 0) return null;
  const faceBx = Math.abs(dBx) - (c11 * A.hw + c21 * A.hh) - B.hw, faceBy = Math.abs(dBy) - (c12 * A.hw + c22 * A.hh) - B.hh;
  if (faceBx > 0 || faceBy > 0) return null;

  let axis = 0, sep = faceAx, nx = dAx > 0 ? cA : -cA, ny = dAx > 0 ? sA : -sA;
  if (faceAy > 0.95 * sep + 0.01 * A.hh) { axis = 1; sep = faceAy; nx = dAy > 0 ? -sA : sA; ny = dAy > 0 ? cA : -cA; }
  if (faceBx > 0.95 * sep + 0.01 * B.hw) { axis = 2; sep = faceBx; nx = dBx > 0 ? cB : -cB; ny = dBx > 0 ? sB : -sB; }
  if (faceBy > 0.95 * sep + 0.01 * B.hh) { axis = 3; sep = faceBy; nx = dBy > 0 ? -sB : sB; ny = dBy > 0 ? cB : -cB; }

  let fnx, fny, front, snx, sny, half, inc, ref;
  if (axis < 2) { fnx = nx; fny = ny; ref = A; inc = incidentEdge(B, cB, sB, fnx, fny); }
  else { fnx = -nx; fny = -ny; ref = B; inc = incidentEdge(A, cA, sA, fnx, fny); }
  const rc = ref === A ? cA : cB, rs = ref === A ? sA : sB;
  if (axis === 0 || axis === 2) { front = ref.x * fnx + ref.y * fny + ref.hw; snx = -rs; sny = rc; half = ref.hh; }
  else { front = ref.x * fnx + ref.y * fny + ref.hh; snx = rc; sny = rs; half = ref.hw; }
  const side = ref.x * snx + ref.y * sny;
  let pts = clip(inc, -snx, -sny, -side + half);
  if (pts.length < 2) return null;
  pts = clip(pts, snx, sny, side + half);
  if (pts.length < 2) return null;
  const out = [];
  for (const p of pts) {
    const s = fnx * p[0] + fny * p[1] - front;
    if (s <= 0) out.push({ x: p[0] - s * fnx, y: p[1] - s * fny, sep: s });
  }
  return out.length ? { nx, ny, pts: out } : null;
}

const GROUND = { x: 0, y: 1e6, a: 0, vx: 0, vy: 0, w: 0, invM: 0, invI: 0, ground: true };

// One step: bodies move under gravity, with statics (boxes nothing pushes) and the ground in the
// way. onHit(A, B, x, y, nx, ny, speed) hears about every pair that met at more than
// RIGID.bounceFrom / 2 px/s.
function step(bodies, statics, gravity, dt, onHit) {
  const R = RIGID, contacts = [];
  const add = (A, B, hit) => { for (const p of hit.pts) contacts.push({ A, B, nx: hit.nx, ny: hit.ny, x: p.x, y: p.y, sep: p.sep }); };
  for (let i = 0; i < bodies.length; i++) {
    const A = bodies[i], rA = radius(A);
    for (let j = i + 1; j < bodies.length; j++) {
      const B = bodies[j];
      if (Math.abs(A.x - B.x) > rA + radius(B) || Math.abs(A.y - B.y) > rA + radius(B)) continue;
      const hit = collide(A, B);
      if (hit) add(A, B, hit);
    }
    for (const S of statics) {
      if (Math.abs(A.x - S.x) > rA + radius(S) || Math.abs(A.y - S.y) > rA + radius(S)) continue;
      const hit = collide(A, S);
      if (hit) add(A, S, hit);
    }
    if (A.y + rA > 0) for (const [x, y] of corners(A)) if (y > 0) contacts.push({ A, B: GROUND, nx: 0, ny: 1, x, y, sep: -y });
  }

  for (const b of bodies) b.vy += gravity * dt;

  const pairs = new Map();
  for (const c of contacts) {
    const { A, B } = c;
    c.r1x = c.x - A.x; c.r1y = c.y - A.y; c.r2x = c.x - B.x; c.r2y = c.y - B.y;
    const rn1 = c.r1x * c.nx + c.r1y * c.ny, rn2 = c.r2x * c.nx + c.r2y * c.ny;
    c.mn = 1 / (A.invM + B.invM + A.invI * (c.r1x * c.r1x + c.r1y * c.r1y - rn1 * rn1) + B.invI * (c.r2x * c.r2x + c.r2y * c.r2y - rn2 * rn2));
    const tx = c.ny, ty = -c.nx, rt1 = c.r1x * tx + c.r1y * ty, rt2 = c.r2x * tx + c.r2y * ty;
    c.mt = 1 / (A.invM + B.invM + A.invI * (c.r1x * c.r1x + c.r1y * c.r1y - rt1 * rt1) + B.invI * (c.r2x * c.r2x + c.r2y * c.r2y - rt2 * rt2));
    c.bias = -R.bias / dt * Math.min(0, c.sep + R.slop);
    const vn = relVel(c, c.nx, c.ny);
    c.bounce = vn < -R.bounceFrom ? -R.restitution * vn : 0;
    c.Pn = 0; c.Pt = 0;
    const key = pairKey(A, B), k = pairs.get(key);
    if (-vn > (k ? k.speed : 0)) pairs.set(key, { A, B, x: c.x, y: c.y, nx: c.nx, ny: c.ny, speed: -vn });
  }

  for (let it = 0; it < R.iterations; it++) {
    for (const c of contacts) {
      const { A, B } = c;
      const vn = relVel(c, c.nx, c.ny);
      let dPn = c.mn * (-vn + Math.max(c.bias, c.bounce));
      const Pn0 = c.Pn; c.Pn = Math.max(Pn0 + dPn, 0); dPn = c.Pn - Pn0;
      push(c, dPn * c.nx, dPn * c.ny);
      const tx = c.ny, ty = -c.nx, vt = relVel(c, tx, ty);
      let dPt = c.mt * -vt;
      const max = R.friction * c.Pn, Pt0 = c.Pt;
      c.Pt = Math.max(-max, Math.min(max, Pt0 + dPt)); dPt = c.Pt - Pt0;
      push(c, dPt * tx, dPt * ty);
    }
  }

  const damp = Math.exp(-R.spinDamp * dt);
  for (const b of bodies) { b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.w * dt; b.w *= damp; }
  if (onHit) for (const p of pairs.values()) if (p.speed > R.bounceFrom / 2) onHit(p.A, p.B, p.x, p.y, p.nx, p.ny, p.speed);
}

let ids = 0;
function pairKey(A, B) { A.id = A.id || ++ids; B.id = B.id || ++ids; return A.id + ':' + B.id; }
// How fast B's point moves away from A's along (nx, ny).
function relVel(c, nx, ny) {
  const { A, B } = c;
  const dvx = B.vx - B.w * c.r2y - A.vx + A.w * c.r1y, dvy = B.vy + B.w * c.r2x - A.vy - A.w * c.r1x;
  return dvx * nx + dvy * ny;
}
function push(c, px, py) {
  const { A, B } = c;
  A.vx -= A.invM * px; A.vy -= A.invM * py; A.w -= A.invI * (c.r1x * py - c.r1y * px);
  B.vx += B.invM * px; B.vy += B.invM * py; B.w += B.invI * (c.r2x * py - c.r2y * px);
}

SS.rigid = { RIGID, box, corners, collide, step };
})();
