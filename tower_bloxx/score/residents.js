// Residents (the score). Measured from the recording: they move in the moment a floor lands,
// 4 for a clean floor and one fewer for every 5 px it lands off centre (never fewer than 1);
// the ground floor brings none. Combo bonuses are added here too (score/combo.js), and floors
// that fall off in a collapse take their residents with them.
(() => {
'use strict';

const RESIDENTS = {
  clean: 4,           // residents for a floor landed dead centre
  band: 5,            // px off centre per resident lost
  least: 1,
  foundation: 0,      // the ground floor
};

function init(g) { g.pop = 0; }

// A floor landed: its residents move in. Returns how many.
function onLand(g, n, dx) {
  const count = n === 0 ? RESIDENTS.foundation : Math.max(RESIDENTS.least, RESIDENTS.clean - Math.floor(Math.abs(dx) / RESIDENTS.band));
  g.pop += count;
  return count;
}

function add(g, count) { g.pop += count; }

// Floors fell off the tower (collapse/collapse.js): their residents are gone.
function remove(g, count) { g.pop = Math.max(0, g.pop - count); }

SS.residents = { RESIDENTS, init, onLand, add, remove };
})();
