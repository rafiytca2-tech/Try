// How the crane looks: the rope from its pivot above the screen, the round pulley with a gold
// hub at the rope's end, the short hook (or, for the first floor, a two-cable sling) and the
// floor hanging from it, all tilted with the load.
(() => {
'use strict';
const { rect, pixLine } = SS.px, { ctx, view } = SS.screen;

const RIGGING = {
  hang: { foundation: 17, floor: 11 },   // rope end -> top of the load (27 px in the recording)
  ropeWidth: 3,
  rope: '#050505',
};

function drawRigging(kind, loaded) {
  const { W } = SS.blocks, HANG = RIGGING.hang;
  const O = '#1e1a14', G = '#8e8e86', L = '#c4c4bc';
  rect(ctx, O, -2, 0, 5, 1); rect(ctx, O, -3, 1, 7, 6); rect(ctx, O, -2, 7, 5, 1);   // pulley outline
  rect(ctx, G, -2, 1, 5, 6); rect(ctx, L, -2, 1, 2, 1); rect(ctx, L, -2, 2, 1, 1);
  rect(ctx, '#f2c83a', -1, 3, 3, 2); rect(ctx, '#fff0a0', -1, 3, 1, 1);           // gold hub
  if (kind === 'foundation' && loaded) {             // two-cable sling for the first floor
    pixLine(ctx, '#1a1a1a', 0, 8, -(W / 2 - 4), HANG.foundation);
    pixLine(ctx, '#1a1a1a', 0, 8, W / 2 - 4, HANG.foundation);
  } else {                                           // hook shank down to the floor's top
    rect(ctx, O, -1, 8, 3, HANG.floor - 8);
    rect(ctx, '#b88a4a', 0, 8, 1, HANG.floor - 8);
    if (!loaded) { rect(ctx, O, -2, HANG.floor - 1, 1, 2); rect(ctx, O, -2, HANG.floor + 1, 4, 1); }   // open hook
  }
}

function draw(g) {
  const h = SS.crane.hookAt(g), cx = view.w / 2;
  const hx = Math.round(h.x), hy = Math.round(h.y), py = SS.crane.pivotY();
  // rope from the pivot above the screen, drawn from the top edge down
  const k0 = (Math.max(py, -2) - py) / Math.max(1, hy - py);
  const w = RIGGING.ropeWidth;
  pixLine(ctx, RIGGING.rope, Math.round(cx + (hx - cx) * k0) - (w >> 1), Math.max(py, -2), hx - (w >> 1), hy, w);
  const kind = SS.crane.nextKind(g);
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(h.tilt);
  drawRigging(kind, g.hook.has);
  if (g.hook.has) ctx.drawImage(SS.blocks.SPR[kind], -SS.blocks.W / 2, RIGGING.hang[kind]);
  ctx.restore();
}

SS.rigging = { RIGGING, draw };
})();
