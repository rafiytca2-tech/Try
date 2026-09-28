// Tower sway and how steady the tower is. The building bends like a mast: the bottom three
// floors never move, and each floor above them swings a little further than the one below, so
// the sway grows as the tower climbs. Floors are stored where they landed on a still tower;
// bendAt() gives how far a height is pushed sideways right now. A floor that lands off centre
// also rocks on the one below for a moment before it settles.
//
// Perfect drops steady the tower: each one takes a share of the remaining sway away, so after a
// couple in a row it barely moves, and the more of them there are the steadier it gets. A floor
// landed off centre shakes it loose again, the more the further off it lands. collapse/collapse.js
// reads how hard the tower is swinging to decide what a bad drop brings down.
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
  settle: 1.5,        // 1/s: how fast the sway grows or shrinks to its new size
  max: 36,            // px either way at most, at any floor: big swings ease up to it, so the
                      //   sway is always a smooth back-and-forth that never stops at the ends
  wobble: 0.01,       // radians the newly landed top floor rocks per px it landed off
  wobbleMax: 0.08,    // radians
  wobbleDecay: 0.2,   // seconds
  wobblePeriod: 0.3,  // seconds per rock
  // steadiness: 0 sways fully, 1 would not sway at all
  perPerfect: 0.55,   // share of the remaining sway each perfect drop takes away
  steadyMax: 0.95,
  shakeLoss: 24,      // px off centre at which a landing throws all the steadiness away
};

function init(g) {
  g.sway = { phase: 0, amp: SWAY.base, target: SWAY.base, kick: 0, steady: 0 };
  g.wobble = null;
}

function bendShape(y) {               // y: height above the ground, in floors
  return y <= SWAY.fixed ? 0 : Math.pow((y - SWAY.fixed) / SWAY.span, SWAY.power);
}
// How far a height swings either way at the moment (px): grows with the sway, easing up to max.
function swingAt(g, y) { return SWAY.max * Math.tanh((g.sway.amp + g.sway.kick) * bendShape(y) / SWAY.max); }
function bendAt(g, y) { return swingAt(g, y) * Math.sin(g.sway.phase); }
// How fast a height is being pushed sideways right now, in px/s.
function bendVelAt(g, y) { return swingAt(g, y) * Math.cos(g.sway.phase) * 2 * Math.PI / SWAY.period; }
// A point on the still tower (world pixels), moved to where the sway puts it now.
function bent(g, x, y) { return { x: x + bendAt(g, -y / SS.blocks.H), y }; }

function wobbleAngle(g) {
  const w = g.wobble;
  return w ? w.a * Math.exp(-w.t / SWAY.wobbleDecay) * Math.cos(2 * Math.PI * w.t / SWAY.wobblePeriod) : 0;
}

function update(g, dt) {
  const s = g.sway;
  s.phase += dt * 2 * Math.PI / SWAY.period;
  s.amp += (s.target - s.amp) * Math.min(1, dt * SWAY.settle);
  s.kick *= Math.exp(-dt / SWAY.kickDecay);
  if (g.wobble && (g.wobble.t += dt) > 0.8) g.wobble = null;
}

// How big the sway should be for the floors as they stand: the floors' average offset keeps
// the building rocking harder, and steadiness takes its share off.
function retarget(g) {
  const s = g.sway;
  if (!g.tower.length) { s.target = SWAY.base * (1 - s.steady); return; }
  const p0 = g.tower[0].x, com = g.tower.reduce((sum, f) => sum + f.x - p0, 0) / g.tower.length;
  s.target = Math.min(SWAY.max, (SWAY.base + SWAY.comGain * Math.abs(com)) * (1 - s.steady));
}

// A floor just landed (index n, dx px off the one below). A perfect one steadies the tower; an
// off-centre one shakes it loose, adds a swing that dies down and rocks the top floor.
function onLand(g, n, dx, perfect) {
  const s = g.sway;
  if (perfect) s.steady += (SWAY.steadyMax - s.steady) * SWAY.perPerfect;
  else s.steady *= Math.max(0, 1 - Math.abs(dx) / SWAY.shakeLoss);
  retarget(g);
  if (!perfect && n > 0) {
    s.kick = Math.min(SWAY.max, s.kick + Math.abs(dx) * SWAY.kick * (1 - s.steady));
    g.wobble = { a: clamp(dx * SWAY.wobble, -SWAY.wobbleMax, SWAY.wobbleMax), t: 0 };
  }
}

// Floors fell off the top (collapse/collapse.js): the shorter tower settles to its new sway.
function afterCollapse(g) {
  retarget(g);
  g.sway.kick *= 0.5;
  g.wobble = null;
}

SS.sway = { SWAY, init, update, onLand, afterCollapse, bendAt, bendVelAt, swingAt, bent, wobbleAngle };
})();
