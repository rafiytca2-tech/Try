// The tower itself: the stack of landed floors, where its top is right now, and drawing it bent
// by the sway (tower/sway.js).
(() => {
'use strict';
const { view, ctx } = SS.screen;

function init(g) { g.tower = []; }   // each floor: { x: where it sits on a still tower, kind: 'foundation' | 'floor' }

// Centre of the top surface, including the sway.
function top(g) {
  const n = g.tower.length;
  if (!n) return { x: 0, y: 0 };
  return { x: g.tower[n - 1].x + SS.sway.bendAt(g, n), y: -n * SS.blocks.H };
}

// Each floor sits on the bent line: its bottom is moved sideways by the bend at its height and
// it leans by the bend's slope across its own height. The bottom three floors stay put.
function draw(g, camY) {
  const n = g.tower.length;
  if (!n) return;
  const { W, H, SPR } = SS.blocks, cx = view.w / 2;
  const iMin = Math.max(0, Math.floor(-(camY + view.h) / H) - 2), iMax = Math.min(n - 1, Math.ceil(-camY / H) + 2);
  for (let i = iMin; i <= iMax; i++) {
    const f = g.tower[i], d0 = SS.sway.bendAt(g, i), d1 = SS.sway.bendAt(g, i + 1);
    const lean = Math.atan2(d1 - d0, H) + (i === n - 1 ? SS.sway.wobbleAngle(g) : 0);
    const bx = Math.round(cx + f.x + d0), by = Math.round(-i * H - camY);
    if (Math.abs(lean) < 0.004) { ctx.drawImage(SPR[f.kind], bx - W / 2, by - H); continue; }
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(lean);
    ctx.drawImage(SPR[f.kind], -W / 2, -H);
    ctx.restore();
  }
}

SS.tower = { init, top, draw };
})();
