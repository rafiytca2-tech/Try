// The tower itself: the stack of landed floors, where its top is right now, and drawing it bent
// by the sway (tower/sway.js), with any knocks it has taken (art/damage.js), as solid boxes
// (art/blocks.js) with its shadow on the ground.
(() => {
'use strict';
const { view, ctx } = SS.screen;

// Each floor: { x: where it sits on a still tower, kind: 'foundation' | 'floor' | 'balcony',
//               perfect: landed dead centre, residents: how many live there so far,
//               dmg: cracks and chips from debris that hit it (art/damage.js), if any }
function init(g) { g.tower = []; }

// Centre of the top surface, including the sway.
function top(g) {
  const n = g.tower.length;
  if (!n) return { x: 0, y: 0 };
  return { x: g.tower[n - 1].x + SS.sway.bendAt(g, n), y: -n * SS.blocks.H };
}

const TOWER = {
  shadow: 34,          // px the tower's shadow reaches along the ground, back and to the right
  shadowDark: 0.38,    // how dark it is at the tower's foot
};

// The tower's shadow on the ground behind it (the light comes from the top left), and a dark
// line where it meets the slab.
function shadow(g, camY) {
  const { W, DEPTH: D } = SS.blocks, gy = -camY;
  if (gy < -20 || gy - 20 > view.h) return;
  const x = view.w / 2 + g.tower[0].x + W / 2, len = TOWER.shadow;
  const fade = ctx.createLinearGradient(x, 0, x + len, 0);
  fade.addColorStop(0, `rgba(24,18,10,${TOWER.shadowDark})`); fade.addColorStop(1, 'rgba(24,18,10,0)');
  SS.px.poly(ctx, fade, [x, gy, x + len, gy, x + len + D.x, gy + D.y, x + D.x, gy + D.y]);
  SS.px.rect(ctx, 'rgba(24,18,10,0.35)', x - W, gy, W, 1.2);
}

// Each floor sits on the bent line: its bottom is moved sideways by the bend at its height and
// it leans by the bend's slope across its own height. The bottom three floors stay put.
function draw(g, camY) {
  const n = g.tower.length;
  if (!n) return;
  shadow(g, camY);
  const { W, H } = SS.blocks, cx = view.w / 2, night = SS.sky.nightAt(camY);
  const iMin = Math.max(0, Math.floor(-(camY + view.h) / H) - 2), iMax = Math.min(n - 1, Math.ceil(-camY / H) + 2);
  for (let i = iMin; i <= iMax; i++) {
    const f = g.tower[i], d0 = SS.sway.bendAt(g, i), d1 = SS.sway.bendAt(g, i + 1);
    const lean = Math.atan2(d1 - d0, H) + (i === n - 1 ? SS.sway.wobbleAngle(g) : 0);
    const bx = cx + f.x + d0, by = -i * H - camY;
    if (!lean) { SS.damage.draw(ctx, f.kind, f.dmg, bx - W / 2, by - H, 0); SS.blocks.lights(ctx, f.kind, bx - W / 2, by - H, night, i); continue; }
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(lean);
    SS.damage.draw(ctx, f.kind, f.dmg, -W / 2, -H, lean);
    SS.blocks.lights(ctx, f.kind, -W / 2, -H, night, i);
    ctx.restore();
  }
}

SS.tower = { TOWER, init, top, draw };
})();
