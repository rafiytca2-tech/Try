// Press and hold: while held, the crane swings faster and wider, a step every 0.8 s, and the
// floor carries more of the swing's momentum when it goes (so the drop has to be led) and a
// bigger multiplier: more residents, more combo and more steadiness for a perfect landing, a
// bigger blow (more floors down) for a bad one. Let go, or drag down and let go, to drop it;
// drag up and let go to cancel and keep it on the hook. At the last step it warns for 2 s, then
// drops by itself. A quick tap is a plain drop. Speeds and multipliers are the bigger game's.
(() => {
'use strict';

const HOLD = {
  step: 0.8,                                  // seconds held per step
  speed: [1, 1.15, 1.4, 1.8, 2.5, 3.5],       // swing speed at each step
  reach: [1, 1.1, 1.2, 1.32, 1.45, 1.6],      // swing size at each step
  carry: [0, 0.04, 0.08, 0.12, 0.16, 0.2],    // extra share of the hook's speed the floor keeps (drop/fall.js)
  mult: [1, 1.2, 1.5, 2.0, 2.8, 4.0],         // the floor's multiplier at each step
  label: ['Safe', 'Low risk', 'Committed', 'High risk', 'Very high risk', 'Extreme'],
  warnFor: 2,                                 // seconds of warning at the last step before it drops by itself
  ease: 4,                                    // 1/s: how fast the swing follows the hold
  cancelDrag: 40,                             // CSS px dragged up that cancels on release
};
const LAST = HOLD.speed.length - 1;
const WARN_AT = LAST * HOLD.step;             // seconds held when the warning starts
const CAP = WARN_AT + HOLD.warnFor;           // seconds held when it drops by itself
const stepOf = t => Math.min(LAST, Math.floor(t / HOLD.step));

function init(g) { g.charge = null; g.holdWaiting = false; g.swingMult = 1; g.swingReach = 1; }

const canHold = g => SS.round.state === 'play' && g.hook.has && !g.falling && !g.ending;
function begin(g) { g.charge = { t: 0, step: 0, beep: 0, cancel: false }; }

// Pressed: start holding now, or as soon as the next floor is on the hook.
function press(g) {
  if (SS.round.state !== 'play' || g.ending) return;
  if (canHold(g)) begin(g); else g.holdWaiting = true;
}

// Dragged far enough up (or back down) while holding.
function aimCancel(g, on) { if (g.charge) g.charge.cancel = on; }

// Let go: drop the floor with the multiplier reached, or put it back if cancelled.
function release(g, cancel) {
  g.holdWaiting = false;
  const c = g.charge;
  if (!c) return;
  g.charge = null;
  if (cancel || c.cancel) { SS.sound.cancel(); return; }
  go(g, c);
}
function go(g, c) { SS.fall.drop(g, HOLD.mult[c.step], HOLD.carry[c.step]); }

// The multiplier a floor would carry if let go now.
const multNow = g => (g.charge ? HOLD.mult[g.charge.step] : 1);

function update(g, dt) {
  if (!g.charge && g.holdWaiting && canHold(g)) { g.holdWaiting = false; begin(g); }
  const c = g.charge;
  if (c && !canHold(g)) g.charge = null;
  const k = Math.min(1, dt * HOLD.ease), step0 = g.charge ? c.step : -1;
  g.swingMult += ((step0 < 0 ? 1 : HOLD.speed[step0]) - g.swingMult) * k;
  g.swingReach += ((step0 < 0 ? 1 : HOLD.reach[step0]) - g.swingReach) * k;
  if (!g.charge && Math.abs(g.swingMult - 1) < 0.002 && Math.abs(g.swingReach - 1) < 0.002) { g.swingMult = 1; g.swingReach = 1; }
  if (!g.charge) return;
  c.t += dt;
  const step = stepOf(c.t);
  if (step !== c.step) { c.step = step; SS.sound.holdStep(step); }
  if (c.t >= WARN_AT) {                                            // the last step: beeps come faster
    const every = Math.max(0.08, 0.4 * (1 - (c.t - WARN_AT) / HOLD.warnFor));
    if (c.t - c.beep >= every) { c.beep = c.t; SS.sound.beep(); }
  }
  if (c.t >= CAP) { g.charge = null; go(g, c); }                   // held too long: it goes
}

SS.hold = { HOLD, WARN_AT, CAP, init, press, aimCancel, release, multNow, update };
})();
