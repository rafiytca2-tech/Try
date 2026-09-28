// Game modes, picked on the main screen (menu/menu.js). Relaxed is the game as it has always been:
// three lives, and combos come and go. Quick Finger races the clock: the combo bar is the clock,
// and the round ends the moment it runs out. It is full at the start, starts to drain when the
// first floor lands, and drains more slowly than a relaxed combo (and never faster than one at
// ×6). A perfect drop refills it, and so does a near one while the tower is low; the near window
// narrows as the tower climbs until, at 40 floors, only a perfect drop will do. There are no
// lives: a miss knocks time off the clock instead. And the combo pays as it goes: each step's
// residents move in straight away (score/combo.js), so the population climbs with the combo.
(() => {
'use strict';

const MODES = {
  relaxed: {
    name: 'Relaxed',
    blurb: 'Three lives. Take your time and build high.',
    tip: ['Tap to drop · hold to swing faster', 'Drag up and let go to cancel'],   // first-round hint (hud/hud.js)
    lives: true,          // three lives (lives/lives.js); combos come and go
    clock: false,
  },
  quick: {
    name: 'Quick Finger',
    blurb: 'Beat the clock. Land near the middle to refill it.',
    tip: ['Land near the middle to refill the clock', 'Tap to drop · hold to swing faster'],
    lives: false,         // no lives: a miss costs time instead
    clock: true,          // the round ends when the combo bar runs out
    drain: 0.75,          // of a relaxed combo's drain at the same level: the bar lasts a third longer
    drainCap: 6,          // it drains no faster than at ×6: 5 s for a full bar (a relaxed ×6 lasts 3.75 s)
    near: 7,              // px either side of the middle that refills it on the ground (perfect: 2)
    nearGone: 40,         // floors by which the near window has narrowed to the perfect one
    missCost: 0.25,       // share of the bar a miss knocks off
    payFloors: 3,         // top floors each combo step's residents move into
  },
};
const ORDER = ['relaxed', 'quick'];   // as listed on the main screen
let current = 'relaxed';

const rules = () => MODES[current];
function set(id) { if (MODES[id]) current = id; }

// px either side of dead centre that refills Quick Finger's clock on a tower of n floors: the near
// window, narrowing to the perfect one (difficulty/difficulty.js) by `nearGone` floors.
function nearTol(n) {
  const M = MODES.quick, p = SS.difficulty.perfectTol(n), p0 = SS.difficulty.perfectTol(0);
  return Math.max(p, p + (M.near - p0) * (1 - n / M.nearGone));
}

SS.mode = { MODES, ORDER, rules, set, nearTol, get id() { return current; } };
})();
