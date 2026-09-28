// Combo. Measured from the recording: a perfect drop starts the combo or refills its bar; every
// floor that lands while the bar is running raises the multiplier (x2, x3, ...). The bar drains
// faster at each level (60, 71, 81, 91, 101 px/s on its 413 px). When it runs out the combo pays
// n x (n + 1) residents (x6 paid 42, x3 paid 12) and the amount blinks at the top. A miss breaks
// the combo with no bonus.
(() => {
'use strict';

const COMBO = {
  bar: 413,           // bar length in the recording, px
  base: 50,           // drain, px/s: base + perLevel * multiplier
  perLevel: 10,
  bonusShow: 1.3,     // seconds the payout blinks at the top
};
const payout = n => n * (n + 1);

function init(g) { g.combo = { n: 0, left: 0 }; g.maxCombo = 0; g.bonusT = 0; }   // left: share of the bar still full

function onLand(g, perfect) {
  const c = g.combo;
  if (c.n > 0) { c.n++; if (perfect) c.left = 1; }
  else if (perfect) { c.n = 1; c.left = 1; }
  if (c.n) g.maxCombo = Math.max(g.maxCombo, c.n);
}

function lose(g) { g.combo.n = 0; g.combo.left = 0; }

function update(g, dt) {
  const c = g.combo;
  if (SS.round.state === 'play' && c.n) {
    c.left -= (COMBO.base + COMBO.perLevel * c.n) / COMBO.bar * dt;
    if (c.left <= 0) {
      const bonus = payout(c.n);
      SS.residents.add(g, bonus);
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
