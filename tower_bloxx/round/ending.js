// The end of a round, once the last life is lost: the camera waits on the top of whatever is
// still standing (after a collapse it has first moved down to it), the number of floors built
// pops up (and stays until every tenant still on the way has got in), the crane winds its rope
// up out of sight, the camera slides down to the street, and the results card pops up with Play
// again (round/round.js).
(() => {
'use strict';

const ENDING = {
  settle: 0.9,        // seconds after the last miss before the count shows, at least
  hold: 0.4,          // seconds the camera rests on the standing top once everything is still
  count: 1.4,         // seconds the floor count shows before the rope goes up
};

function init(g) { g.ending = null; }

// The last life is gone.
function start(g) { g.ending = { phase: 'settle', t: 0, still: 0 }; }

// Nothing is still landing, turning over the edge, or being followed by the camera.
const settled = g => !g.falling && !g.cam && !SS.collapse.busy(g) && !SS.miss.busy(g);

function update(g, dt) {
  const e = g.ending;
  if (!e || e.phase === 'pan') return;
  e.t += dt;
  if (e.phase === 'settle') {
    e.still = settled(g) ? e.still + dt : 0;
    if (e.t < ENDING.settle || e.still < ENDING.hold) return;
    e.phase = 'count'; e.t = 0;
    SS.hud.showBuilt(g.tower.length);
  } else if (e.phase === 'count') {
    if (e.t < ENDING.count || SS.tenants.busy(g)) return;     // everyone on the way gets in first
    e.phase = 'lift'; e.t = 0;
    SS.crane.raise(g);
  } else if (e.phase === 'lift') {
    if (!SS.crane.raised(g)) return;
    e.phase = 'pan';
    SS.camera.startPan(g);
  }
}

SS.ending = { ENDING, init, start, update };
})();
