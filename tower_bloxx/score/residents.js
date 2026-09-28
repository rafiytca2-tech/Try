// Residents (the score). Measured from the recording: 4 for a clean floor and one fewer for
// every 5 px it lands off centre (never fewer than 1); the ground floor brings none. A floor
// dropped while holding (hold/hold.js) gets its multiplier's worth. Each resident is a tenant
// who flies in (tenants/flight.js) and only counts once through the window. When a combo pays
// out, that many more fly into the floors built during it. Floors that fall off in a collapse
// take the residents who live there with them.
(() => {
'use strict';

const RESIDENTS = {
  clean: 4,           // residents for a floor landed dead centre
  band: 5,            // px off centre per resident lost
  least: 1,
  foundation: 0,      // the ground floor
  bonusStagger: 0.25, // seconds between floors as a combo's residents set off
};

function init(g) { g.pop = 0; }

// A floor landed (index n, dx px off centre, carrying the hold's multiplier): how many residents
// will move in.
function onLand(g, n, dx, mult = 1) {
  if (n === 0) return RESIDENTS.foundation;
  const base = Math.max(RESIDENTS.least, RESIDENTS.clean - Math.floor(Math.abs(dx) / RESIDENTS.band));
  return Math.round(base * mult);
}

// One resident got in through a window of floor i.
function arrive(g, i) {
  const f = g.tower[i];
  if (!f) return;
  f.residents = (f.residents || 0) + 1;
  g.pop++;
  SS.hud.update(g);
}

// A combo of n paid `amount` residents: they fly into the top n floors, shared out evenly.
function bonus(g, amount, n) {
  const top = g.tower.length - 1;
  if (top < 0) return;
  const floors = [];
  for (let i = top; i >= Math.max(1, top - n + 1); i--) floors.push(i);
  if (!floors.length) floors.push(top);
  const each = Math.floor(amount / floors.length);
  let extra = amount - each * floors.length;
  floors.forEach((f, k) => {
    const count = each + (extra-- > 0 ? 1 : 0);
    if (count) SS.tenants.moveIn(g, f, count, k * RESIDENTS.bonusStagger);
  });
}

// Floors fell off the tower (collapse/collapse.js): their residents are gone.
function remove(g, count) { g.pop = Math.max(0, g.pop - count); SS.hud.update(g); }

SS.residents = { RESIDENTS, init, onLand, arrive, bonus, remove };
})();
