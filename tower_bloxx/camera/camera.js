// The camera: where the tower top rests on screen, the one-floor climb after each landing
// (ease-out over 0.45 s, measured from the recording), and the slide back down the tower to the
// street when the round ends.
(() => {
'use strict';
const { easeOut } = SS, { view } = SS.screen;

const CAMERA = {
  restRatio: 754 / 1280,   // the tower top comes to rest this far down the screen
  scrollTime: 0.45,        // seconds to climb one floor after a landing
  endRatio: 0.55,          // end of round: the street sits this far down the screen
  panMinSpeed: 260,        // end-of-round slide, px/s at least,
  panTime: 1.8,            //   or the whole slide in this many seconds if that is faster
};

const restLine = () => Math.round(view.h * CAMERA.restRatio);          // screen row of the resting tower top
const target = g => -g.tower.length * SS.blocks.H - restLine();        // camY with the tower top on the rest line
const endY = () => -Math.round(view.h * CAMERA.endRatio);

function init(g) { g.cam = null; g.pan = null; g.hold = false; g.camY = target(g); }

// After a landing: climb one floor.
function climb(g) { g.cam = { from: g.camY, to: target(g), t: 0 }; }

// End of the round: slide down to the street, then show the results.
function startPan(g) {
  g.cam = null;
  const to = endY(), dist = Math.abs(to - g.camY);
  if (dist < 4) { g.hold = true; SS.round.finish(g); return; }
  g.pan = { to, speed: Math.max(CAMERA.panMinSpeed, dist / CAMERA.panTime) };
}
function skipPan(g) {
  if (!g.pan) return false;
  g.camY = g.pan.to;
  return true;
}

function update(g, dt) {
  if (g.pan) {
    const d = g.pan.to - g.camY, step = g.pan.speed * dt;
    if (Math.abs(d) <= step) { g.camY = g.pan.to; g.pan = null; g.hold = true; SS.round.finish(g); }
    else g.camY += Math.sign(d) * step;
  } else if (g.cam) {
    g.cam.t += dt;
    const k = Math.min(1, g.cam.t / CAMERA.scrollTime);
    g.camY = g.cam.from + (g.cam.to - g.cam.from) * easeOut(k);
    if (k >= 1) g.cam = null;
  }
}

function onResize(g, playing) {
  if (!playing) g.camY = endY();
  else if (!g.pan) { g.cam = null; g.camY = target(g); }
}

SS.camera = { CAMERA, restLine, target, init, climb, startPan, skipPan, update, onResize };
})();
