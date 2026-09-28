// Misses: a floor that tips over the edge, falls clean past the tower, or lands off the slab.
// It comes loose (rubble/rubble.js tumbles it, crashes it and crumbles it away) and costs a
// life.
(() => {
'use strict';

const MISS = {
  fallSpin: 1.5,        // rad/s a floor falling clean past starts turning at
  tipNudge: 2.2,        // rad/s a floor landing past the edge starts turning over it at
  tipPush: 30,          // px/s outwards it starts with
};

function offSite(g, b) {
  SS.rubble.add(g, { kind: b.kind, x: b.x, y: -SS.blocks.H / 2, vx: b.vx, vy: b.vy });
  SS.lives.lose(g);
}
function fallPast(g, b, dx) {
  SS.rubble.add(g, { kind: b.kind, x: b.x, y: b.y, a: b.ang, vx: b.vx, vy: b.vy, w: Math.sign(dx) * MISS.fallSpin });
  SS.lives.lose(g);
}
// Its middle landed past the top floor's edge: it turns over that edge and drops off.
function tipOver(g, b, dx, top) {
  const sgn = Math.sign(dx);
  SS.rubble.add(g, { kind: b.kind, x: b.x, y: top.y - SS.blocks.H / 2 - 0.5, a: b.ang, vx: b.vx + sgn * MISS.tipPush, vy: b.vy, w: sgn * MISS.tipNudge });
  SS.lives.lose(g);
}

SS.miss = { MISS, offSite, fallPast, tipOver };
})();
