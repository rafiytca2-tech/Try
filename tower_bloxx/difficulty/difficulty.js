// How the game gets harder as the tower climbs. The window for a perfect drop narrows a little
// with every floor, and bad drops cost a little more: they shake the tower harder (tower/sway.js),
// lose more residents (score/residents.js), and bring the top down sooner and further
// (collapse/collapse.js). Each asks here with the tower's height in floors.
(() => {
'use strict';

const DIFFICULTY = {
  perfect: [2, 1],          // px either side of dead centre that counts as perfect: on the ground, and at its narrowest
  perfectPerFloor: 0.015,   // px the window narrows by with each floor (narrowest at about 67 floors)
  penaltyPerFloor: 0.015,   // how much harder bad drops hit with each floor (1 = as on the ground)
  penaltyMax: 2,            // at most twice as hard (at about 67 floors)
};

// px either side of dead centre that counts as a perfect drop on a tower of n floors.
const perfectTol = n => Math.max(DIFFICULTY.perfect[1], DIFFICULTY.perfect[0] - n * DIFFICULTY.perfectPerFloor);
// How much harder a bad drop hits on a tower of n floors (1 on the ground).
const penalty = n => Math.min(DIFFICULTY.penaltyMax, 1 + n * DIFFICULTY.penaltyPerFloor);

SS.difficulty = { DIFFICULTY, perfectTol, penalty };
})();
