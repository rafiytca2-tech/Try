// Tower sway. The building bends like a mast: the bottom three floors never move, and each
// floor above them swings a little further than the one below, so the sway grows as the tower
// climbs. Floors are stored where they landed on a still tower; bendAt() gives how far a height
// is pushed sideways right now. A floor that lands off centre also rocks on the one below for a
// moment before it settles.
(() => {
'use strict';
const { clamp } = SS;

const SWAY = {
  period: 2.8,        // seconds per full swing of the building
  fixed: 3,           // floors that never move
  span: 10,           // floors above those at which the sway reaches its full size
  power: 1.5,         // how quickly it grows with height
  base: 2.5,          // px of sway (at full size) even when every floor is dead centre
  comGain: 1.2,       // more per px the floors' average sits off the base
  kick: 0.6,          // extra per px an off-centre floor lands off, dying down
  kickDecay: 0.6,     // seconds
  max: 36,            // px, at any floor
  wobble: 0.01,       // radians the newly landed top floor rocks per px it landed off
  wobbleMax: 0.08,    // radians
  wobbleDecay: 0.2,   // seconds
  wobblePeriod: 0.3,  // seconds per rock
};

function init(g) {
  g.sway = { phase: 0, amp: SWAY.base, target: SWAY.base, kick: 0 };
  g.wobble = null;
}

function bendShape(y) {               // y: height above the ground, in floors
  return y <= SWAY.fixed ? 0 : Math.pow((y - SWAY.fixed) / SWAY.span, SWAY.power);
}
function bendAt(g, y) {
  const d = (g.sway.amp + g.sway.kick) * Math.sin(g.sway.phase) * bendShape(y);
  return clamp(d, -SWAY.max, SWAY.max);
}
// A point on the still tower (world pixels), moved to where the sway puts it now.
function bent(g, x, y) { return { x: x + bendAt(g, -y / SS.blocks.H), y }; }

function wobbleAngle(g) {
  const w = g.wobble;
  return w ? w.a * Math.exp(-w.t / SWAY.wobbleDecay) * Math.cos(2 * Math.PI * w.t / SWAY.wobblePeriod) : 0;
}

function update(g, dt) {
  const s = g.sway;
  s.phase += dt * 2 * Math.PI / SWAY.period;
  s.amp += (s.target - s.amp) * Math.min(1, dt * 1.5);
  s.kick *= Math.exp(-dt / SWAY.kickDecay);
  if (g.wobble && (g.wobble.t += dt) > 0.8) g.wobble = null;
}

// A floor just landed (index n, dx px off the one below). The floors' average offset keeps the
// building rocking harder; an off-centre landing adds a swing that dies down and a wobble.
function onLand(g, n, dx, perfect) {
  const s = g.sway, p0 = g.tower[0].x;
  const com = g.tower.reduce((sum, f) => sum + f.x - p0, 0) / g.tower.length;
  s.target = Math.min(SWAY.max, SWAY.base + SWAY.comGain * Math.abs(com));
  if (!perfect && n > 0) {
    s.kick = Math.min(SWAY.max, s.kick + Math.abs(dx) * SWAY.kick);
    g.wobble = { a: clamp(dx * SWAY.wobble, -SWAY.wobbleMax, SWAY.wobbleMax), t: 0 };
  }
}

SS.sway = { SWAY, init, update, onLand, bendAt, bent, wobbleAngle };
})();
