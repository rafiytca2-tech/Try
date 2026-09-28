// How the crane looks: the rope from its pivot above the screen, the round pulley with a gold
// hub at the rope's end, the short hook (or, for the first floor, a two-cable sling) and the
// floor hanging from it, all tilted with the load.
(() => {
'use strict';
const { circle, line } = SS.px, { ctx, view } = SS.screen;

const RIGGING = {
  hang: { foundation: 17, floor: 11 },   // rope end -> top of the load (27 px in the recording)
  ropeWidth: 3,
  rope: '#141414',
  ropeShine: 'rgba(200,210,220,0.35)',
  pulley: { rim: '#1e1a14', body: '#8e8e86', shine: '#d2d2ca', hub: '#f2c83a', hubShine: '#fff0a0' },
  shank: '#b88a4a',
};

function drawRigging(kind, loaded) {
  const { W } = SS.blocks, HANG = RIGGING.hang, P = RIGGING.pulley;
  circle(ctx, 0, 4, 3.8, P.rim);                     // round steel pulley, lit from the top left
  const steel = ctx.createRadialGradient(-1.2, 2.8, 0.3, 0, 4, 3.2);
  steel.addColorStop(0, P.shine); steel.addColorStop(0.55, P.body); steel.addColorStop(1, '#5b5b55');
  circle(ctx, 0, 4, 3, steel);
  const gold = ctx.createRadialGradient(-0.5, 3.5, 0.1, 0, 4, 1.6);   // gold hub
  gold.addColorStop(0, P.hubShine); gold.addColorStop(0.6, P.hub); gold.addColorStop(1, '#a8781a');
  circle(ctx, 0, 4, 1.5, gold);
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
  const rx = cx + (h.x - cx) * k0;
  line(ctx, RIGGING.rope, rx, y0, h.x, h.y + 0.5, RIGGING.ropeWidth, 'butt');           // steel cable
  line(ctx, RIGGING.ropeShine, rx - 0.6, y0, h.x - 0.6, h.y + 0.5, 0.7, 'butt');       //   catching the light
  const kind = SS.crane.nextKind(g);
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.tilt);
  if (g.hook.has) SS.blocks.draw3d(ctx, kind, -SS.blocks.W / 2, hangOf(kind), h.tilt);   // the floor, then the hook over its roof
  drawRigging(kind, g.hook.has);
  ctx.restore();
}

// Rope end to the top of the load (a balcony floor hangs like any floor).
function hangOf(kind) { return RIGGING.hang[kind] ?? RIGGING.hang.floor; }

SS.rigging = { RIGGING, hangOf, draw };
})();
