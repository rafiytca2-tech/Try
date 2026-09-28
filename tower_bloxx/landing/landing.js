// A floor lands: within 5 px of centre it snaps into line (a perfect drop), it joins the tower,
// and everything that follows a landing is set off from here: residents, combo, sway, the
// perfect stars, the tenants, the camera's climb and the next floor on the hook.
(() => {
'use strict';

const LANDING = {
  perfectTol: 5,      // px from dead centre that still snaps into line (a 5.9 px landing in the recording did not)
};

function init(g) { g.perfects = 0; }

// b: the falling floor; dx: how far its centre is from the top floor's (or the slab's) centre.
function land(g, b, dx) {
  const n = g.tower.length;
  const perfect = Math.abs(dx) <= LANDING.perfectTol;
  if (perfect) dx = 0;
  const x = n === 0 ? dx : g.tower[n - 1].x + dx;
  g.tower.push({ x, kind: b.kind });
  g.falling = null;
  if (perfect) g.perfects++;

  SS.residents.onLand(g, n, dx);
  SS.combo.onLand(g, perfect);
  SS.sway.onLand(g, n, dx, perfect);

  const top = SS.tower.top(g);
  if (perfect) { SS.stars.burst(g, top); SS.sound.perfect(g.combo.n); }
  SS.sound.land();
  SS.tenants.moveIn(g, n);

  SS.camera.climb(g);
  SS.crane.reload(g);
  SS.hud.update(g);
}

SS.landing = { LANDING, init, land };
})();
