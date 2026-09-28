// A floor lands: within 2 px of centre it snaps into line (a perfect drop), it joins the tower,
// and everything that follows a landing is set off from here: residents (who fly in as tenants),
// combo, sway, the perfect stars, the camera's climb and the next floor on the hook. The
// multiplier the floor carries from a held drop (hold/hold.js) goes to each of them.
(() => {
'use strict';

const LANDING = {
  perfectTol: 2,      // px from dead centre that still snaps into line
  dust: 0.25,         // how much dust puffs out from under a landing floor (0..1)
};

function init(g) { g.perfects = 0; }

// b: the falling floor; dx: how far its centre is from the top floor's (or the slab's) centre.
function land(g, b, dx) {
  const n = g.tower.length;
  const perfect = Math.abs(dx) <= LANDING.perfectTol;
  if (perfect) dx = 0;
  const x = n === 0 ? dx : g.tower[n - 1].x + dx;
  const mult = b.hold || 1;                          // held before the drop (hold/hold.js)
  const floor = { x, kind: b.kind, perfect, residents: 0 };
  g.tower.push(floor);
  g.falling = null;
  if (perfect) g.perfects++;

  const movingIn = SS.residents.onLand(g, n, dx, mult);
  SS.combo.onLand(g, perfect, mult);
  SS.sway.onLand(g, n, dx, perfect, mult);

  const top = SS.tower.top(g), k = LANDING.dust * (perfect ? 0.6 : 1);
  for (const side of [-1, 1]) SS.dust.burst(g, top.x + side * SS.blocks.W / 2, top.y + SS.blocks.H, side, 0, k);   // squeezed out from under it
  if (perfect) { SS.stars.burst(g, top); SS.sound.perfect(g.combo.n); }
  else if (g.combo.n > 0) SS.sound.comboStep(g.combo.n);   // the combo climbs a note
  SS.sound.land();
  SS.tenants.moveIn(g, n, movingIn);

  SS.camera.climb(g);
  SS.crane.reload(g);
  SS.hud.update(g);
}

SS.landing = { LANDING, init, land };
})();
