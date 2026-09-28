// Press and hold: while held, the crane swings faster, a step every half second, and the floor
// carries a bigger multiplier when it goes: more residents, more combo and more steadiness for a
// perfect landing, a bigger blow (more floors down) for a bad one. Let go, or drag down and let
// go, to drop it; drag up and let go to cancel and keep it on the hook. At 2.2 s it starts
// beeping, and at 3 s it drops by itself. A quick tap is a plain drop. Steps and multipliers
// are the bigger game's.
(() => {
'use strict';

const HOLD = {
  step: 0.5,                                  // seconds held per step
  speed: [1, 1.15, 1.4, 1.8, 2.5, 3.5],       // swing speed at each step
  mult: [1, 1.2, 1.5, 2.0, 2.8, 4.0],         // the floor's multiplier at each step
  label: ['Safe', 'Low risk', 'Committed', 'High risk', 'Very high risk', 'Extreme'],
  warn: 2.2,                                  // seconds: it starts beeping
  cap: 3.0,                                   // seconds: it drops by itself
  ease: 10,                                   // 1/s: how fast the swing follows the hold
  cancelDrag: 40,                             // CSS px dragged up that cancels on release
};
const stepOf = t => Math.min(HOLD.speed.length - 1, Math.floor(t / HOLD.step));

function init(g) { g.charge = null; g.holdWaiting = false; g.swingMult = 1; }

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
  SS.fall.drop(g, HOLD.mult[c.step]);
}

// The multiplier a floor would carry if let go now.
const multNow = g => (g.charge ? HOLD.mult[g.charge.step] : 1);

function update(g, dt) {
  if (!g.charge && g.holdWaiting && canHold(g)) { g.holdWaiting = false; begin(g); }
  const c = g.charge;
  if (c && !canHold(g)) g.charge = null;
  const target = g.charge ? HOLD.speed[c.step] : 1;
  g.swingMult += (target - g.swingMult) * Math.min(1, dt * HOLD.ease);
  if (!g.charge && Math.abs(g.swingMult - 1) < 0.002) g.swingMult = 1;
  if (!g.charge) return;
  c.t += dt;
  const step = stepOf(c.t);
  if (step !== c.step) { c.step = step; SS.sound.holdStep(step); }
  if (c.t >= HOLD.warn) {
    const every = Math.max(0.07, 0.3 - (c.t - HOLD.warn) * 0.3);   // beeps come faster
    if (c.t - c.beep >= every) { c.beep = c.t; SS.sound.beep(); }
  }
  if (c.t >= HOLD.cap) { g.charge = null; SS.fall.drop(g, HOLD.mult[c.step]); }   // held too long: it goes
}

SS.hold = { HOLD, init, press, aimCancel, release, multNow, update };
})();
