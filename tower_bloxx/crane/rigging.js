// How the crane looks: the rope from its pivot above the screen, the round pulley with a gold
// hub at the rope's end, the short hook (or, for the first floor, a two-cable sling) and the
// floor hanging from it, all tilted with the load.
(() => {
'use strict';
const { circle, line } = SS.px, { ctx, view } = SS.screen;

const RIGGING = {
  hang: { foundation: 17, floor: 11 },   // rope end -> top of the load (27 px in the recording)
  ropeWidth: 3,
  rope: '#101010',
  pulley: { rim: '#1e1a14', body: '#8e8e86', shine: '#d2d2ca', hub: '#f2c83a', hubShine: '#fff0a0' },
  shank: '#b88a4a',
};

function drawRigging(kind, loaded) {
  const { W } = SS.blocks, HANG = RIGGING.hang, P = RIGGING.pulley;
  circle(ctx, 0, 4, 3.8, P.rim);                     // round pulley
  circle(ctx, 0, 4, 3, P.body);
  ctx.strokeStyle = P.shine; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.arc(0, 4, 2.2, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  circle(ctx, 0, 4, 1.5, P.hub);                     // gold hub
  circle(ctx, -0.4, 3.6, 0.5, P.hubShine);
  if (kind === 'foundation' && loaded) {             // two-cable sling for the first floor
    line(ctx, '#1a1a1a', 0, 7.5, -(W / 2 - 4), HANG.foundation, 0.9);
    line(ctx, '#1a1a1a', 0, 7.5, W / 2 - 4, HANG.foundation, 0.9);
  } else {                                           // hook shank down to the floor's top
    line(ctx, P.rim, 0, 7.6, 0, HANG.floor, 2.4, 'butt');
    line(ctx, RIGGING.shank, 0, 7.6, 0, HANG.floor - 0.2, 1.1, 'butt');
    if (!loaded) {                                   // open hook
      ctx.strokeStyle = P.rim; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(0.8, HANG.floor, 1.8, Math.PI * 0.95, Math.PI * 2.1, true); ctx.stroke();
    }
  }
}

function draw(g) {
  const h = SS.crane.hookAt(g), cx = view.w / 2, py = SS.crane.pivotY();
  // rope from the pivot above the screen, drawn from just above the top edge down
  const y0 = Math.max(py, -4), k0 = (y0 - py) / Math.max(1, h.y - py);
  line(ctx, RIGGING.rope, cx + (h.x - cx) * k0, y0, h.x, h.y + 0.5, RIGGING.ropeWidth, 'butt');
  const kind = SS.crane.nextKind(g);
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.tilt);
  drawRigging(kind, g.hook.has);
  if (g.hook.has) SS.blocks.draw(ctx, kind, -SS.blocks.W / 2, hangOf(kind));
  ctx.restore();
}

// Rope end to the top of the load (a balcony floor hangs like any floor).
function hangOf(kind) { return RIGGING.hang[kind] ?? RIGGING.hang.floor; }

SS.rigging = { RIGGING, hangOf, draw };
})();
