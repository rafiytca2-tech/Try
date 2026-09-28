// Combo. Measured from the recording: a perfect drop starts the combo or refills its bar; every
// floor that lands while the bar is running raises the multiplier (x2, x3, ...). The bar drains
// faster at each level (60, 71, 81, 91, 101 px/s on its 413 px). When it runs out the combo pays
// n x (n + 1) residents (x6 paid 42, x3 paid 12), who then fly in, and the amount shows at the
// top. A perfect drop made while holding (hold/hold.js) counts as several steps. A miss breaks
// the combo with no bonus.
//
// In Quick Finger (mode/mode.js) the bar is the round's clock: it is full from the start, begins
// to drain when the first floor lands, and drains more slowly, up to a limit. A near drop refills
// it as well as a perfect one, a miss knocks time off it rather than breaking it, and it ticks
// when it's nearly empty. Each step pays its share straight away (the same total, in step with
// the combo). When it runs out, the round is over, unless a floor is still falling, which can
// still refill it when it lands.
(() => {
'use strict';

const COMBO = {
  bar: 413,           // bar length in the recording, px
  base: 50,           // drain, px/s: base + perLevel * multiplier
  perLevel: 10,
  bonusShow: 1.3,     // seconds the payout blinks at the top
  tickBelow: 0.3,     // Quick Finger: share of the bar left at which the clock starts ticking,
  tickEvery: [0.3, 0.14],   //   seconds between ticks, from there to empty
};
// n x (n + 1), less the share of residents that don't move in (score/residents.js).
const payout = n => Math.round(n * (n + 1) * SS.residents.RESIDENTS.share);

function init(g) {
  g.combo = { n: 0, left: SS.mode.rules().clock ? 1 : 0, tick: 0 };   // left: share of the bar still full
  g.maxCombo = 0; g.bonusT = 0;
}

// A floor landed; mult: the hold's multiplier it carried; near: close enough to refill the clock
// (Quick Finger). A perfect one at ×2 counts as two steps of the combo, at ×4 as four.
function onLand(g, perfect, mult = 1, near = false) {
  if (g.ending) return;                              // the clock ran out while it fell
  const c = g.combo, M = SS.mode.rules(), steps = perfect ? Math.max(1, Math.round(mult)) : 1, n0 = c.n;
  if (c.n > 0 || M.clock) { c.n += steps; if (perfect || near) c.left = 1; }
  else if (perfect) { c.n = steps; c.left = 1; }
  if (c.n) g.maxCombo = Math.max(g.maxCombo, c.n);
  if (M.clock && n0 > 0) SS.residents.bonus(g, payout(c.n) - payout(n0), M.payFloors);   // pays as it goes
}

function lose(g) { g.combo.n = 0; g.combo.left = 0; }

// Quick Finger: a miss knocks time off the clock.
function knock(g) { g.combo.left = Math.max(0, g.combo.left - SS.mode.rules().missCost); }

// Quick Finger: the clock ran out.
function timeUp(g) {
  lose(g);
  SS.ending.start(g);
  SS.hud.showBanner("Time's up");
  SS.sound.over();
  SS.hud.update(g);
}

function update(g, dt) {
  const c = g.combo, M = SS.mode.rules();
  if (SS.round.state === 'play' && c.n && !g.ending) {
    const level = M.clock ? Math.min(c.n, M.drainCap) : c.n;
    c.left -= (COMBO.base + COMBO.perLevel * level) / COMBO.bar * (M.clock ? M.drain : 1) * dt;
    if (M.clock) {
      c.left = Math.max(0, c.left);
      if (c.left <= 0 && !g.falling) timeUp(g);
      else if (c.left < COMBO.tickBelow && (c.tick -= dt) <= 0) {
        const [slow, fast] = COMBO.tickEvery, k = c.left / COMBO.tickBelow;
        c.tick = fast + (slow - fast) * k;
        SS.sound.tick(1 - k);
      }
    } else if (c.left <= 0) {
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

SS.combo = { COMBO, init, onLand, lose, knock, update };
})();
