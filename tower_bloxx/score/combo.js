// Combo. Measured from the recording: a perfect drop starts the combo or refills its bar; every
// floor that lands while the bar is running raises the multiplier (x2, x3, ...). The bar drains
// faster at each level (60, 71, 81, 91, 101 px/s on its 413 px). When it runs out the combo pays
// n x (n + 1) residents (x6 paid 42, x3 paid 12), who then fly in, and the amount shows at the
// top. A perfect drop made while holding (hold/hold.js) counts as several steps. A miss breaks
// the combo with no bonus.
(() => {
'use strict';

const COMBO = {
  bar: 413,           // bar length in the recording, px
  base: 50,           // drain, px/s: base + perLevel * multiplier
  perLevel: 10,
  bonusShow: 1.3,     // seconds the payout blinks at the top
};
// n x (n + 1), less the share of residents that don't move in (score/residents.js).
const payout = n => Math.round(n * (n + 1) * SS.residents.RESIDENTS.share);

function init(g) { g.combo = { n: 0, left: 0 }; g.maxCombo = 0; g.bonusT = 0; }   // left: share of the bar still full

// A floor landed; mult: the hold's multiplier it carried. A perfect one at ×2 counts as two
// steps of the combo, at ×4 as four.
function onLand(g, perfect, mult = 1) {
  const c = g.combo, steps = perfect ? Math.max(1, Math.round(mult)) : 1;
  if (c.n > 0) { c.n += steps; if (perfect) c.left = 1; }
  else if (perfect) { c.n = steps; c.left = 1; }
  if (c.n) g.maxCombo = Math.max(g.maxCombo, c.n);
}

function lose(g) { g.combo.n = 0; g.combo.left = 0; }

function update(g, dt) {
  const c = g.combo;
  if (SS.round.state === 'play' && c.n) {
    c.left -= (COMBO.base + COMBO.perLevel * c.n) / COMBO.bar * dt;
    if (c.left <= 0) {
      const bonus = payout(c.n);
      SS.residents.bonus(g, bonus, c.n);                // they fly in (tenants/flight.js)
      c.n = 0; c.left = 0;
      g.bonusT = COMBO.bonusShow;
      SS.hud.showBonus(bonus);
      SS.sound.bonus();
      SS.hud.update(g);
    }
  }
  if (g.bonusT > 0) g.bonusT -= dt;
}

SS.combo = { COMBO, init, onLand, lose, update };
})();
