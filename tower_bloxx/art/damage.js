// Knocks on a floor: hairline cracks running in from where it was hit, and corners that chip
// off when a hit lands near them, showing the grey concrete inside. Each floor keeps its own
// damage (loose floors in rubble/rubble.js, and floors of the tower that debris hits). Draws a
// floor with its damage.
(() => {
'use strict';
const { clamp } = SS;

const DAMAGE = {
  maxCracks: 7,
  crackLen: [5, 15],        // px, from a light hit to a heavy one
  hardHit: 500,             // px/s of extra closing speed that counts as a heavy hit
  branch: 0.45,             // chance a crack forks
  cornerNear: 8,            // px from a corner that chips it
  cornerStep: [1.5, 4],     // px chipped off per hit, light to heavy
  cornerMax: 8,
  crack: 'rgba(10,30,38,0.85)',
  crackLight: 'rgba(255,255,255,0.3)',
  inside: '#9aa29c',        // concrete where a corner broke off
  insideDark: '#555c57',
};

const make = () => ({ cracks: [], corners: [0, 0, 0, 0], jag: [0, 0, 0, 0].map(() => 0.3 + Math.random() * 0.4) });
const damaged = d => !!d && (d.cracks.length > 0 || d.corners.some(Boolean));

// A hit at (lx, ly) from the floor's centre, `over` px/s harder than it takes to mark it.
function hit(d, lx, ly, over) {
  const { W, H } = SS.blocks, hw = W / 2, hh = H / 2, D = DAMAGE, k = clamp(over / D.hardHit, 0, 1);
  lx = clamp(lx, -hw, hw); ly = clamp(ly, -hh, hh);
  if (hw - Math.abs(lx) < hh - Math.abs(ly)) lx = Math.sign(lx || 1) * hw;   // onto the nearest edge
  else ly = Math.sign(ly || 1) * hh;
  if (hw - Math.abs(lx) < D.cornerNear && hh - Math.abs(ly) < D.cornerNear) {
    const i = ly < 0 ? (lx < 0 ? 0 : 1) : (lx > 0 ? 2 : 3);
    d.corners[i] = Math.min(D.cornerMax, d.corners[i] + D.cornerStep[0] + (D.cornerStep[1] - D.cornerStep[0]) * k);
  }
  if (d.cracks.length >= D.maxCracks) return;
  const len = (D.crackLen[0] + (D.crackLen[1] - D.crackLen[0]) * k) * (0.7 + Math.random() * 0.6);
  const main = crack(lx, ly, Math.atan2(-ly, -lx) + (Math.random() - 0.5) * 1.1, len);
  d.cracks.push(main);
  if (Math.random() < D.branch && main.length > 2) {
    const [bx, by] = main[1 + Math.floor(Math.random() * (main.length - 2))];
    d.cracks.push(crack(bx, by, Math.atan2(-ly, -lx) + (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.5), len * 0.5));
  }
}
function crack(x, y, dir, len) {
  const pts = [[x, y]], n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    dir += (Math.random() - 0.5) * 0.9;
    x += Math.cos(dir) * len / n; y += Math.sin(dir) * len / n;
    pts.push([x, y]);
  }
  return pts;
}

// The floor's outline with its chipped corners cut off (a little ragged), around (cx, cy).
function outline(ctx, d, cx, cy) {
  const { W, H } = SS.blocks, hw = W / 2, hh = H / 2, c = d.corners, j = d.jag;
  const cut = (i, ax, ay, bx, by, ox, oy) => {         // corner i: from point a to point b, bulging toward o
    if (!c[i]) { ctx.lineTo(cx + ox, cy + oy); return; }
    ctx.lineTo(cx + ax, cy + ay);
    ctx.lineTo(cx + (ax + bx) / 2 + (ox - (ax + bx) / 2) * j[i], cy + (ay + by) / 2 + (oy - (ay + by) / 2) * j[i]);
    ctx.lineTo(cx + bx, cy + by);
  };
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  cut(1, hw - c[1], -hh, hw, -hh + c[1], hw, -hh);
  ctx.lineTo(cx + hw + 4, cy - hh + 18); ctx.lineTo(cx + hw + 4, cy - hh + 40);   // room for a balcony
  cut(2, hw, hh - c[2], hw - c[2], hh, hw, hh);
  cut(3, -hw + c[3], hh, -hw, hh - c[3], -hw, hh);
  ctx.lineTo(cx - hw - 4, cy - hh + 40); ctx.lineTo(cx - hw - 4, cy - hh + 18);
  cut(0, -hw, -hh + c[0], -hw + c[0], -hh, -hw, -hh);
  ctx.closePath();
}

// A floor with its top-left corner at (x, y), with any damage it has.
function draw(ctx, kind, d, x, y) {
  if (!damaged(d)) { SS.blocks.draw(ctx, kind, x, y); return; }
  const { W, H } = SS.blocks, D = DAMAGE, cx = x + W / 2, cy = y + H / 2, hw = W / 2, hh = H / 2;
  ctx.save();
  outline(ctx, d, cx, cy); ctx.clip();
  SS.blocks.draw(ctx, kind, x, y);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const pts of d.cracks) {                        // a light edge, then the dark crack
    for (const [o, color, width] of [[0.4, D.crackLight, 0.5], [0, D.crack, 0.7]]) {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(cx + px + o, cy + py + o) : ctx.moveTo(cx + px + o, cy + py + o)));
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    }
  }
  ctx.restore();
  d.corners.forEach((c, i) => {                        // the broken concrete along each chip
    if (!c) return;
    const sx = i === 0 || i === 3 ? -1 : 1, sy = i < 2 ? -1 : 1;
    const ax = sx * (hw - c), ay = sy * hh, bx = sx * hw, by = sy * (hh - c), ox = sx * hw, oy = sy * hh;
    const mx = (ax + bx) / 2 + (ox - (ax + bx) / 2) * d.jag[i], my = (ay + by) / 2 + (oy - (ay + by) / 2) * d.jag[i];
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + ax, cy + ay); ctx.lineTo(cx + mx, cy + my); ctx.lineTo(cx + bx, cy + by);
    ctx.strokeStyle = D.insideDark; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.strokeStyle = D.inside; ctx.lineWidth = 0.6; ctx.stroke();
  });
}

SS.damage = { DAMAGE, make, hit, draw };
})();
