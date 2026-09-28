// The crane's swing: how the hook moves and when the next floor appears on it.
//
// Measured from the recording (fitted over 300 frames, residual under 5 px): the rope is a
// straight line from a fixed pivot far above the screen to the hook. The hook goes round an
// ellipse, the load circling under the jib seen from the side: over the top to the left, back
// along the bottom to the right, its height a quarter turn ahead of its sideways position. The
// load tilts in proportion to how far the hook is off centre, almost three times the rope's own
// angle. The loop never changes speed or size as the tower grows. The crane hangs from the
// screen, not the world, so it stays put while the camera climbs.
//
// Timing round the loop is evened out so the load never seems to hang at the sides: it turns
// round each side quicker and crosses the middle a little slower, easing in and out the whole
// way, and one loop still takes exactly the same time.
(() => {
'use strict';
const { K } = SS, { view } = SS.screen;

const CRANE = {
  period: 8 / 3,               // seconds per loop
  rx: 76.7 * K,                // hook: sideways reach
  ry: 44.1 * K,                //       and rise and fall
  above: 331.1 * K,            // ellipse centre, above the resting tower top
  tilt: 16.8 * Math.PI / 180,  // load tilt at the sides (the rope is at 6.2 degrees there)
  pivot: 1032.4 * K,           // rope pivot, above the resting tower top (off screen)
  even: 1,                     // 0: plain circle, the load lingers at each side. 1: it rounds the sides about twice as fast as it crosses the middle
  nextDelay: 0.37,             // landing -> the next floor pops onto the moving hook
  missDelay: 0.72,             // the same after a miss
  startPhase: Math.PI / 2,     // where the loop starts on the first round
};
const OMEGA = 2 * Math.PI / CRANE.period;
const EVEN_NORM = 1 / Math.sqrt(1 + CRANE.even);   // keeps the loop time unchanged
const rate = ph => OMEGA * EVEN_NORM * (1 + CRANE.even * Math.sin(ph) ** 2);   // rad/s at this point of the loop

function init(g, prev) {
  g.phase = prev ? prev.phase : CRANE.startPhase;   // a new round carries on the swing
  g.hook = { has: true, wait: 0 };                  // has: a floor hangs on the hook
}

const nextKind = g => (g.tower.length === 0 ? 'foundation' : 'floor');
const pivotY = () => SS.camera.restLine() - CRANE.pivot;

// The hook point (the rope's end) in screen pixels, its velocity, and the tilt of the load.
function hookAt(g) {
  const s = Math.sin(g.phase), co = Math.cos(g.phase), w = rate(g.phase);
  return {
    x: view.w / 2 - CRANE.rx * s, y: SS.camera.restLine() - CRANE.above - CRANE.ry * co, tilt: CRANE.tilt * s,
    vx: -CRANE.rx * w * co, vy: CRANE.ry * w * s,
  };
}

function take(g) { g.hook.has = false; }                                              // the floor was let go
function reload(g, afterMiss) { g.hook.wait = afterMiss ? CRANE.missDelay : CRANE.nextDelay; }

function update(g, dt) {
  g.phase += rate(g.phase) * dt;
  if (!g.hook.has && !g.falling && !g.ending) {
    g.hook.wait -= dt;
    if (g.hook.wait <= 0) g.hook.has = true;
  }
}

SS.crane = { CRANE, init, update, hookAt, pivotY, nextKind, take, reload };
})();
