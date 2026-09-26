'use strict';
/* ==================================================================== *
 * CLASSIC BASE: the retro Skyline Stack engine, unchanged in feel:      *
 * same units (classic px, y down), rope, swing, drop, sway and camera. *
 * FORGE LAYER on top: hold, Power Drop, recall, ratings, recoveries.   *
 * SESSIONS: attract (title), city (a blueprint on a lot), race, daily. *
 * ==================================================================== */

let game = null;
let sceneTime = 0;

/* ---------------- Rigging for the active site ---------------- */
// Everything the engine draws hangs off siteRoot, so engine coordinates map to the site: x*S, -y*S.
const siteRoot = new T.Group(); scene.add(siteRoot);
const rope = rod(0.12, siteRoot);                               // the classic's heavy black rope
const slings = [rod(0.045, siteRoot), rod(0.045, siteRoot), rod(0.045, siteRoot), rod(0.045, siteRoot)];
const hookBlock = new T.Group(); siteRoot.add(hookBlock);
const hookClaw = new T.Mesh(new T.TorusGeometry(0.34, 0.1, 6, 14, Math.PI * 1.4), new T.MeshStandardMaterial({ color: lin('#9aa0a6'), roughness: 0.4, metalness: 0.8 }));
{
  const pulley = new T.Mesh(new T.BoxGeometry(1.05, 1.05, 0.8).translate(0, -0.52, 0), new T.MeshStandardMaterial({ color: lin('#c9a445'), roughness: 0.45, metalness: 0.4 }));
  pulley.castShadow = true;
  hookClaw.position.set(0, -1.8, 0); hookClaw.rotation.z = Math.PI * 0.8;
  hookBlock.add(pulley, hookClaw);
}
const ghosts = [0.2, 0.12, 0.06].map(o => { const m = new T.Mesh(geoModule, new T.MeshBasicMaterial({ color: '#ffe1a0', transparent: true, opacity: o, depthWrite: false })); m.visible = false; siteRoot.add(m); return m; });
const warnGlow = new T.Mesh(new T.BoxGeometry(W * S + 0.5, H * S + 0.5, DEPTH + 0.5), new T.MeshBasicMaterial({ color: '#ff3b2f', transparent: true, opacity: 0.2, depthWrite: false, blending: T.AdditiveBlending }));
warnGlow.visible = false; siteRoot.add(warnGlow);
const specialGlow = new T.Mesh(new T.BoxGeometry(W * S + 0.4, H * S + 0.4, DEPTH + 0.4), new T.MeshBasicMaterial({ color: '#7dffb0', transparent: true, opacity: 0.18, depthWrite: false, blending: T.AdditiveBlending }));
specialGlow.visible = false; siteRoot.add(specialGlow);
// The joint that is about to give way glows red (GDD §3: telegraph a collapse before it happens).
const jointGlow = new T.Mesh(new T.BoxGeometry(W * S + 0.7, 0.5, DEPTH + 0.7), new T.MeshBasicMaterial({ color: '#ff3b2f', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
jointGlow.visible = false;

// Engine px -> world, for particles and floating text.
const sx = x => siteRoot.position.x + x * S, sy = y => -y * S, sz = () => siteRoot.position.z;
const dust = (x, y, n, s = 4) => burst(sx(x), sy(y), sz() + 1, n, '#d9cfbd', s, 2.5, 1.2, 2.4, false);
const sparkle = (x, y) => burst(sx(x), sy(y), sz(), 26, '#ffd76a', 5, 7, 0.9, 1, true);
const popup = (text, x, y, cls, delay = 0) => popupAt(text, sx(x), sy(y), sz(), cls, delay);

/* ---------------- Sessions ---------------- */
function featureOn(name) {
  if (save.settings.classic) return false;
  if (game && game.mods.noHold && (name === 'hold' || name === 'power')) return false;
  if (game && game.mods.noRecall && name === 'recall') return false;
  return skillLevel() >= FEATURES[name];
}
function newGame(kind, o = {}) {
  const bp = o.bp ? BLUEPRINTS[o.bp] : null;
  const mods = Object.assign({ swing: 1, gravity: 1, wind: 0, lives: CFG.lives, noHold: false, noRecall: false, fog: false }, o.mods || {});
  const g = {
    kind, site: o.site || PIER, bpKey: o.bp || null, bp, style: o.style || (bp ? bp.style : 'green'),
    target: o.target || (bp ? bp.floors : 0), mult: o.mult || (bp ? bp.mult : 2), mods, daily: o.daily || null, weekly: o.weekly || null, stage: o.stage ?? null, slowmo: 0,
    tower: [], lives: mods.lives, pop: 0, perfects: 0, maxCombo: 0,
    combo: { timer: 0, streak: 0 },
    swingPhase: o.swingPhase || 0,
    // e: 0 = reeled up out of sight, 1 = fully lowered. The title hangs it higher, clear of the menu.
    hook: { has: true, next: false, e: o.hookE ?? (kind === 'attract' ? 0.3 : 0.55), wait: 0, recall: false },
    falling: null, debris: [],
    sway: { phase: 0, amp: 0, target: mods.wind },
    camY: 0, shake: 0, time: 0,
    intro: kind === 'attract' ? null : { t: 0 },
    ending: null, pan: null, hold: false, finished: false,
    // Forge layer and report stats
    charge: null, swingMult: 1, trail: [], ratings: {}, quality: 0, landed: 0, powerPerfects: 0, bestRisk: 1, bestPerfectRisk: 0,
    recoveries: [], recoveryPrestige: 0, danger: null, level: 0, strongest: 1, peakSway: 0, specialPerfects: 0, caps: {}, startFloors: 0,
    group: new T.Group(), hookMesh: null,
    // The rope hangs still until the first floor is in view, then builds up its swing. Coming from
    // the title screen it is already swinging, so it settles first.
    swingOn: kind === 'attract', swingEnv: kind === 'attract' || o.hookE !== undefined ? 1 : 0,
    struct: { strain: 0, level: 0, creak: 0, k: -2, m: 1, lat: 0 }, collapses: 0, floorsLost: 0,
  };
  siteRoot.position.set(g.site.x, 0, g.site.z); siteRoot.visible = true;
  siteRoot.add(g.group); g.group.add(jointGlow); jointGlow.visible = false;
  // Continuing an unfinished tower: its floors are already standing.
  if (o.xs && o.xs.length) {
    const p0 = o.xs[0];
    g.group.position.x = p0 * S;
    o.xs.forEach((x, i) => {
      const kind2 = floorKind(bp, i, o.xs.length + 1, false);
      const st = floorStyleOf(bp, i, g.style), m = makeModule(st, kind2);
      m.position.set((x - p0) * S, (i * H + H / 2) * S, 0);
      g.group.add(m);
      g.tower.push({ x, kind: kind2, style: st, residents: 0, mesh: m });
    });
    g.startFloors = o.xs.length;
  }
  g.hookMesh = makeModule(floorStyle(g), nextKind(g), roofStyleOf(g.bp, g.style)); siteRoot.add(g.hookMesh);
  g.camY = introCam(g);
  if (g.intro) g.intro.from = g.camY;
  fogBoost = mods.fog ? 0.011 : 0;
  return g;
}
function disposeGame(g) {
  if (!g) return;
  siteRoot.visible = false; warnGlow.visible = specialGlow.visible = false;
  siteRoot.remove(g.group);
  if (g.hookMesh) siteRoot.remove(g.hookMesh);
  if (g.falling) siteRoot.remove(g.falling.mesh);
  for (const d of g.debris) siteRoot.remove(d.mesh);
  fogBoost = 0;
}

const grav = g => 2 * RIG.gap / (CFG.dropTime * CFG.dropTime) * g.mods.gravity;
const vRef = g => grav(g) * CFG.dropTime / Math.sqrt(g.mods.gravity);   // landing speed of a normal drop
const cameraTarget = g => -g.tower.length * H - RIG.topScreen;
const introCam = g => cameraTarget(g) + RIG.pivot - Math.round(view.h * CFG.intro.craneAt);
const pivotWorldY = g => cameraTarget(g) + RIG.pivot;     // the crane climbs with the tower
function swingParams(g) {
  const n = g.tower.length;
  return {
    reach: Math.min(CFG.swingReach.max, CFG.swingReach.start + n * CFG.swingReach.perFloor),
    w: Math.min(CFG.swingSpeed.max, CFG.swingSpeed.start + n * CFG.swingSpeed.perFloor) * g.mods.swing,
  };
}
const swingAmp = g => Math.asin(Math.min(0.9, swingParams(g).reach / RIG.L)) * smooth(clamp(g.swingEnv, 0, 1));
function ropeAngle(g) { return swingAmp(g) * Math.sin(g.swingPhase); }
// Sideways speed of the hanging floor, classic px per second.
function swingVelocity(g) {
  const { w } = swingParams(g), A = swingAmp(g), th = A * Math.sin(g.swingPhase);
  return RIG.L * Math.cos(th) * A * Math.cos(g.swingPhase) * w * g.swingMult;
}
// Where a floor dropped right now would land (used by the test bot; the player has to judge it).
function landingX(g) {
  const th = ropeAngle(g), kind = nextKind(g), off = HANG[kind] + extraTop(kind) + H / 2;
  const x0 = RIG.L * Math.sin(th), y0 = pivotWorldY(g) + RIG.L * Math.cos(th) + off;
  const d = Math.max(0, towerTop(g).y - H / 2 - y0), G = grav(g);
  return x0 + swingVelocity(g) * CFG.releaseMomentum * Math.sqrt(2 * d / G);
}
function ropeLength(g) {
  const h = g.hook, k = h.has ? smooth(h.e) : h.e;
  return RIG.L - RIG.lowerDist * (1 - k);
}
function nextKind(g) {
  const n = g.tower.length;
  if (n === 0) return 'foundation';
  if (g.target && n === g.target - 1) return 'roof';
  return isSpecial(g.bp, n) ? 'special' : 'floor';
}
const floorStyle = g => floorStyleOf(g.bp, g.tower.length, g.style);
// The building rocks as one rigid piece about the middle of its base.
function swayAngle(g) {
  const n = g.tower.length;
  if (!n) return 0;
  const d = g.sway.amp * Math.sin(g.sway.phase);
  return clamp(Math.atan2(d, n * H), -CFG.sway.maxTilt, CFG.sway.maxTilt);
}
function toWorld(g, lx, ly, a) {
  const p0 = g.tower[0].x, x = lx - p0;
  return { x: p0 + x * Math.cos(a) - ly * Math.sin(a), y: x * Math.sin(a) + ly * Math.cos(a) };
}
function towerTop(g) {
  const n = g.tower.length;
  if (!n) return { x: 0, y: 0 };
  return toWorld(g, g.tower[n - 1].x, -n * H, swayAngle(g));
}
function canCharge() {
  const g = game;
  return !!g && state === 'play' && g.kind !== 'attract' && !g.intro && g.hook.has && g.hook.e >= 1 && !g.hook.recall && !g.falling && !g.ending && !g.pan;
}

function drop(tier, forced) {
  const g = game;
  if (!g || state !== 'play' || g.kind === 'attract' || g.intro || !g.hook.has || g.hook.e < 1 || g.hook.recall || g.falling || g.ending) return false;
  const th = ropeAngle(g);
  const kind = nextKind(g), off = HANG[kind] + extraTop(kind) + H / 2, L = RIG.L;
  const ex = L * Math.sin(th), ey = pivotWorldY(g) + L * Math.cos(th);
  const v = swingVelocity(g) * CFG.releaseMomentum;          // the floor keeps a little of the swing
  // Forge: hold band and Power Drop ride along with the block.
  const band = g.charge ? holdBand(g.charge.t) : 0, hold = FORGE.hold.mult[band], power = tier ? tier[1] : 1;
  const vy = tier ? (power - 1) * FORGE.power.boost * vRef(g) : 0;
  g.falling = { x: ex, y: ey + off, vx: v, vy, ang: 0, kind, style: floorStyle(g), hold, power, forced: !!forced, E: 1, mesh: g.hookMesh };
  g.hookMesh = null;
  g.hook.has = false; g.hook.next = false; g.hook.wait = 0;
  g.charge = null;
  Sound.release(); vib(8);
  if (tier) { Sound.power(); vib([25, 15, 25]); doneTip('power'); }
  if (forced) popup('Forced release', ex, ey + off - H, 'info');
  doneTip('tap');
  if (band > 0) doneTip('hold');
  return true;
}

function stepFalling(g, dt) {
  const b = g.falling;
  b.vy += grav(g) * dt; b.x += b.vx * dt; b.y += b.vy * dt;
  b.ang *= Math.exp(-14 * dt);
  const n = g.tower.length, top = towerTop(g);
  if (b.y + H / 2 < top.y) return;
  b.E = Math.max(1, (b.vy / vRef(g)) ** 2);   // impact energy vs a normal drop
  b.y = top.y - H / 2;
  if (n === 0) {
    if (Math.abs(b.x) > CFG.slabHalf) {
      g.falling = null;
      g.debris.push({ state: 'wreck', x: b.x, y: -H / 2, ang: 0, t: 0.9, mesh: b.mesh });
      dust(b.x, 0, 14);
      loseLife(g, b.x, -H, 'Off site');
      return;
    }
    settle(g, b, b.x);
    return;
  }
  let dx = b.x - top.x;
  // Forge: a heavy off-centre Power Drop shoves the floor further out.
  if (b.power > 1 && Math.abs(dx) > CFG.perfectTol) { dx *= 1 + FORGE.power.shove * (b.E - 1); b.x = top.x + dx; }
  // Momentum: a floor landing with sideways speed slides a little further before friction holds it.
  if (n > 0 && b.vx) { dx += b.vx * FORGE.collapse.slide; b.x = top.x + dx; }
  if (Math.abs(dx) >= W) {                       // clean miss: keeps falling past the tower
    g.falling = null;
    g.debris.push({ state: 'fall', x: b.x, y: b.y, vx: b.vx, vy: b.vy, ang: b.ang, spin: Math.sign(dx) * 1.5, mesh: b.mesh });
    loseLife(g, b.x, top.y, 'Miss');
  } else if (Math.abs(dx) > W / 2) {             // centre past the edge: tips over the side
    const sgn = Math.sign(dx), ex = top.x + sgn * W / 2;
    g.falling = null;
    g.debris.push({ state: 'tip', x: b.x, y: b.y, ang: 0, av: 0, sgn, px: ex, py: top.y, rx: b.x - ex, ry: -H / 2, mesh: b.mesh });
    loseLife(g, b.x, top.y, 'Miss');
  } else {
    settle(g, b, dx);
  }
}

function rateLanding(dx, perfect, first) {
  if (perfect) return FORGE.ratings[0];
  const r = Math.abs(dx) / (first ? 2 * CFG.slabHalf : W);   // the first floor is rated against the slab
  for (let i = 1; i < FORGE.ratings.length; i++) if (r <= FORGE.ratings[i][1]) return FORGE.ratings[i];
  return FORGE.ratings[FORGE.ratings.length - 1];
}

function settle(g, b, dx) {
  const n = g.tower.length;
  const perfect = Math.abs(dx) <= CFG.perfectTol;
  if (perfect) dx = 0;
  const x = n === 0 ? dx : g.tower[n - 1].x + dx;
  const acc = 1 - Math.min(1, Math.abs(dx) / (n === 0 ? CFG.slabHalf : W / 2));
  const c = g.combo, active = c.timer > 0;
  const raw = perfect ? CFG.residents.perfect : Math.round(CFG.residents.base + CFG.residents.accuracy * acc);
  const bonus = active ? c.streak * CFG.comboBonus : 0;
  if (perfect) { c.streak = active ? c.streak + 1 : 1; c.timer = CFG.comboTime; g.perfects++; g.maxCombo = Math.max(g.maxCombo, c.streak); }
  const risk = b.hold * b.power;                                  // Forge: hold x power multiplier
  const residents = Math.round((raw + bonus) * g.mult * risk);
  g.tower.push({ x, kind: b.kind, style: b.style, residents, mesh: b.mesh, q: 0, sp: false });
  const p0 = g.tower[0].x;
  g.group.position.x = p0 * S;
  g.group.add(b.mesh);
  b.mesh.position.set((x - p0) * S, (n * H + H / 2) * S, 0); b.mesh.rotation.set(0, 0, 0);
  g.pop += residents;
  const role = g.bp ? roleAt(g.bp, n) : 'res';
  g.caps[role] = (g.caps[role] || 0) + residents;
  g.falling = null;

  // Forge: rating ladder and report stats.
  const rt = rateLanding(dx, perfect, n === 0);
  g.ratings[rt[0]] = (g.ratings[rt[0]] || 0) + 1; g.quality += rt[2]; g.landed++;
  g.tower[n].q = rt[2];
  g.bestRisk = Math.max(g.bestRisk, risk);
  const E = b.E || 1;
  g.strongest = Math.max(g.strongest, E);
  if (perfect) { g.bestPerfectRisk = Math.max(g.bestPerfectRisk, risk); if (b.power > 1) g.powerPerfects++; }
  const special = b.kind === 'special';
  if (special && perfect) { g.specialPerfects++; g.tower[n].sp = true; }

  // Instability: every sloppy floor makes the whole building swing more, a perfect one calms it.
  // Forge: a heavier impact multiplies the sway it adds; a centred heavy one settles the tower.
  const s = g.sway;
  const settled = !perfect && n > 0 && E > 1.25 && Math.abs(dx) <= FORGE.ratings[1][1] * W;
  if (perfect) s.target *= CFG.sway.perfectKeep;
  else if (settled) s.target *= FORGE.settleKeep;
  else if (n > 0) {
    if (s.amp < 1.5) s.phase = dx > 0 ? 0 : Math.PI;   // start swinging toward the heavy side
    s.target = Math.min(CFG.sway.max, s.target + Math.abs(dx) * CFG.sway.gain * E);
  }
  // Momentum: a floor that lands moving sideways pushes the whole tower.
  if (n > 0 && b.vx) { s.target = Math.min(CFG.sway.max, s.target + Math.abs(b.vx) * FORGE.collapse.kick * E); if (s.amp < 1.5) s.phase = b.vx > 0 ? 0 : Math.PI; }
  s.target = Math.max(s.target, g.mods.wind);
  if (g.danger) { g.danger.placed++; if (perfect && b.power > 1) g.danger.power = true; }

  const top = towerTop(g);
  if (!reduceMotion && save.settings.shake) g.shake = 1 + (E - 1) * 0.8;
  dust(top.x - W / 2, top.y + H, 8, 3 + E); dust(top.x + W / 2, top.y + H, 8, 3 + E);
  if (perfect) {
    sparkle(top.x, top.y);
    // Impact moment: a Power Perfect lands in slow motion with a ring of sparks.
    if (b.power > 1 && !reduceMotion) { g.slowmo = 0.45; Sound.slowmo(); burst(sx(top.x), sy(top.y), sz(), 50, '#fff1b8', 12, 3, 0.8, 1.2, true); }
    popup(b.power > 1 ? 'Power Perfect' : 'Perfect', top.x, top.y - 16, 'perfect');
    if (c.streak >= 2) popup(`Combo ×${c.streak}`, top.x, top.y - 40, 'combo', 0.08);
  } else {
    popup(rt[0], top.x, top.y - 16, rt[0].toLowerCase());
  }
  popup(`+${fmt(residents)}`, top.x, top.y + 6, 'pts', perfect ? 0.1 : 0.05);
  if (risk > 1.01) popup(`×${risk.toFixed(1)} risk`, top.x, top.y + 26, 'info', 0.15);
  if (settled) popup('Settled', top.x, top.y + 44, 'info', 0.2);
  if (special && g.bp) popup(perfect ? `${g.bp.special.name} +${Math.round(FORGE.specialBonus * 100)}%` : `${g.bp.special.name} missed its bonus`, top.x, top.y + (perfect ? 62 : 44), perfect ? 'bonus' : 'info', 0.25);
  Sound.impact(E);
  if (perfect) Sound.perfect(c.streak, b.power > 1);
  vib(perfect ? (E > 1.2 ? [45, 25, 60] : 28) : (E > 1.2 ? 45 : 12));
  Music.setChain(c.streak);
  bus.emit('floor', { kind: g.kind, perfect, rating: rt[0], risk, hold: b.hold, power: b.power, combo: c.streak, special });

  if (g.target && g.tower.length >= g.target) {
    g.ending = { t: 1.4, done: true };
    Sound.complete();
    const t = towerTop(g);
    fireworks(sx(t.x), sy(t.y), sz());
    banner('Topped out', g.bp ? g.bp.name : `${g.target} floors`);
    vib([30, 30, 30, 30, 80]);
  } else {
    g.hook.next = true; g.hook.wait = CFG.nextDelay;
  }
  updateBuildHud();
}

function loseLife(g, x, y, label) {
  g.lives--;
  g.combo.timer = 0; g.combo.streak = 0;
  g.ratings.Miss = (g.ratings.Miss || 0) + 1;
  popup(label, x, y - 10, 'miss');
  Sound.miss(); vib([20, 40, 20]);
  Music.setChain(0);
  bus.emit('miss', { kind: g.kind });
  if (g.lives <= 0) { g.ending = { t: 1.1 }; setTimeout(() => Sound.over(), 500); }
  else { g.hook.next = true; g.hook.wait = CFG.nextDelay + 0.35; }
  updateBuildHud();
}

function stepDebris(g, d, dt) {
  if (d.state === 'tip') {
    // Rotates about the edge it hangs over (a single floor, or a whole toppling section as one piece).
    d.av += (d.alpha ?? d.sgn * 18) * dt; d.ang += d.av * dt;
    const r = d.ang - (d.a0 || 0), c = Math.cos(r), s = Math.sin(r);
    d.x = d.px + d.rx * c - d.ry * s; d.y = d.py + d.rx * s + d.ry * c;
    if (Math.abs(r) > (d.breakAt || 0.9)) {
      d.state = 'fall';
      if (d.alpha != null) { d.vx = (-d.rx * s - d.ry * c) * d.av + (Math.random() - 0.5) * 30; d.vy = (d.rx * c - d.ry * s) * d.av; }
      else { d.vx = d.sgn * 70; d.vy = 40; }
      d.spin = d.av * (0.6 + Math.random() * 0.8);
    }
  } else if (d.state === 'fall') {
    d.vy += grav(g) * 0.8 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.ang += d.spin * dt;
    if (d.y + H / 2 >= 0) { d.state = 'wreck'; d.y = -H / 2; d.ang = 0; d.t = 0.8; dust(d.x, 0, 12); }
  } else {
    d.t -= dt;
  }
}

// Forge: the stability readout is the classic sway, shown as four levels.
function stabilityLevel(g) {
  const n = g.tower.length;
  if (n < 2) return 0;
  const shown = Math.min(g.sway.amp, n * H * Math.tan(CFG.sway.maxTilt)) / CFG.sway.max;
  const L = FORGE.stability;
  return Math.max(shown < L[0] ? 0 : shown < L[1] ? 1 : shown < L[2] ? 2 : 3, g.struct.level);
}

/* ---------------- Balance and collapse (GDD §3) ---------------- */
// For every joint, the floors above it act as one body: their centre of mass, shifted sideways by
// the tower's current lean, has to stay over the floor below. The whole tower has to stay over its
// slab. Floors finished in an earlier session are set solid and never give way.
function checkStructure(g, dt) {
  const n = g.tower.length, S = g.struct, C = FORGE.collapse;
  if (n < 2 || g.ending || g.finished || g.kind === 'attract') { S.level = 0; S.k = -2; S.strain = 0; return; }
  const ta = Math.tan(swayAngle(g)), first = Math.max(0, g.startFloors - 1);
  let sumX = 0, sumH = 0, cnt = 0, worst = Infinity, wk = -2, wlat = 0;
  for (let k = n - 2; k >= first; k--) {
    sumX += g.tower[k + 1].x; sumH += (k + 1.5) * H; cnt++;
    const lat = sumX / cnt - g.tower[k].x + (sumH / cnt - (k + 1) * H) * ta;
    const m = (C.grip * W / 2 - Math.abs(lat)) / (C.grip * W / 2);
    if (m < worst) { worst = m; wk = k; wlat = lat; }
  }
  if (g.startFloors === 0) {                              // the whole tower on its slab
    const lat = (sumX + g.tower[0].x) / n + ((sumH + H / 2) / n) * ta;
    const m = (CFG.slabHalf - Math.abs(lat)) / CFG.slabHalf;
    if (m < worst) { worst = m; wk = -1; wlat = lat; }
  }
  S.k = wk; S.m = worst; S.lat = wlat;
  S.level = worst < C.warn[2] ? 3 : worst < C.warn[1] ? 2 : worst < C.warn[0] ? 1 : 0;
  if (worst < 0) {
    S.strain += dt * (1 + 6 * -worst);                  // the further past the edge, the faster it goes
    if (S.strain > C.hold) { collapseAt(g, wk, Math.sign(wlat) || 1); return; }
  } else S.strain = Math.max(0, S.strain - dt * 0.8);
  // Telegraph: creaks, dust at the weak joint and a shiver, faster as it gets worse.
  if (S.level >= 2 && wk >= 0) {
    S.creak -= dt;
    if (S.creak <= 0) {
      S.creak = S.level === 3 ? 0.45 : 0.9;
      Sound.creak(S.level === 3 ? 1 : 0.6); vib(S.level === 3 ? [10, 30, 10, 30, 10] : [8, 40, 8]);
      const j = toWorld(g, g.tower[wk].x + Math.sign(wlat) * W / 2, -(wk + 1) * H, swayAngle(g));
      dust(j.x, j.y, 6, 3);
      showTip('balance');
    }
  }
}
function collapseAt(g, k, sgn) {
  const n = g.tower.length, a = swayAngle(g), first = k + 1;
  const pivot = k >= 0 ? toWorld(g, g.tower[k].x + sgn * W / 2, -(k + 1) * H, a) : { x: sgn * CFG.slabHalf, y: 0 };
  const pieces = [];
  for (let i = first; i < n; i++) pieces.push({ f: g.tower[i], c: toWorld(g, g.tower[i].x, -(i * H + H / 2), a), i });
  const hCom = pieces.reduce((s, p) => s + (pivot.y - p.c.y), 0) / pieces.length;
  const alpha = sgn * 16 * clamp(1.5 * H / Math.max(H, hCom), 0.18, 1);   // tall sections topple slowly, like a tree
  g.tower.length = first;
  let lostRes = 0;
  for (const p of pieces) {
    const f = p.f;
    g.group.remove(f.mesh); siteRoot.add(f.mesh);
    g.debris.push({ state: 'tip', x: p.c.x, y: p.c.y, ang: a, a0: a, av: sgn * 0.4, alpha, sgn, px: pivot.x, py: pivot.y,
      rx: p.c.x - pivot.x, ry: p.c.y - pivot.y, breakAt: 0.45 + Math.random() * 0.35, mesh: f.mesh });
    lostRes += f.residents;
    const role = g.bp ? roleAt(g.bp, p.i) : 'res';
    g.caps[role] = Math.max(0, (g.caps[role] || 0) - f.residents);
    if (f.q) { g.quality -= f.q; g.landed--; }
    if (f.sp) g.specialPerfects--;
  }
  g.pop = Math.max(0, g.pop - lostRes);
  g.collapses++; g.floorsLost += pieces.length;
  g.struct.strain = 0; g.struct.level = 0; g.struct.k = -2;
  g.sway.amp *= 0.4; g.sway.target *= 0.4;
  g.danger = null;
  const full = k < 0;
  for (let i = 0; i < Math.min(6, pieces.length); i++) setTimeout(() => dust(pivot.x + sgn * i * 6, pivot.y - i * H * 0.6, 14, 6), i * 120);
  popup(full ? 'Total collapse' : `Collapse · −${plural(pieces.length, 'floor')}`, pivot.x, pivot.y - 30, 'miss');
  if (pieces.length >= 3 || full) banner(full ? 'Total collapse' : 'Collapse', `${plural(pieces.length, 'floor')} lost`);
  Sound.collapse(pieces.length); vib([60, 40, 120, 40, 220]);
  if (!reduceMotion && save.settings.shake) g.shake = 3.5;
  bus.emit('collapse', { kind: g.kind, floors: pieces.length, full });
  // A collapse costs a life, like a miss; losing the whole tower ends the build.
  g.combo.timer = 0; g.combo.streak = 0; Music.setChain(0);
  g.lives = full ? 0 : g.lives - 1;
  g.ratings.Collapse = (g.ratings.Collapse || 0) + 1;
  if (g.lives <= 0) { if (!g.ending) g.ending = { t: 1.8 }; setTimeout(() => Sound.over(), 700); }
  updateBuildHud();
}
// The GDD's recovery ladder: how bad it got, how long you fought it, and how you finished it.
function recoveryTier(g, d) {
  if (d.worst < 3) return 0;
  const impossible = d.peak >= 0.95 && g.tower.length >= 20;
  if (impossible && d.power) return 4;
  if (impossible) return 3;
  if (d.placed >= 3) return 2;
  return 1;
}
function awardRecovery(g, d) {
  const tier = recoveryTier(g, d), [name, pts, pr] = FORGE.recovery[tier];
  const add = Math.round(pts * g.mult);
  g.pop += add; g.recoveries.push(name); g.recoveryPrestige += pr;
  const role = g.bp ? roleAt(g.bp, g.tower.length - 1) : 'res';
  g.caps[role] = (g.caps[role] || 0) + add;
  banner(name, `+${fmt(add)} · +${pr} ✦`);
  Sound.bonus(); vib([15, 30, 15]);
  doneTip('recover');
  bus.emit('recovery', { kind: g.kind, tier, name });
  updateBuildHud();
}

function update(dt) {
  const g = game;
  g.time += dt;

  // Forge: holding speeds the swing up in Appendix A bands; letting go eases it back to the classic speed.
  const ch = g.charge;
  const targetMult = ch ? FORGE.hold.speed[holdBand(ch.t)] : 1;
  g.swingMult += (targetMult - g.swingMult) * Math.min(1, dt * 10);
  if (!ch && Math.abs(g.swingMult - 1) < 0.002) g.swingMult = 1;
  // The rope starts still and only builds up its swing once the first floor is in view.
  if (!g.swingOn && !g.intro && g.hook.has && g.hook.e >= 0.999) g.swingOn = true;
  const envTarget = g.swingOn ? 1 : 0;
  if (g.swingEnv !== envTarget) g.swingEnv = envTarget > g.swingEnv ? Math.min(1, g.swingEnv + dt / CFG.swingStart) : Math.max(0, g.swingEnv - dt / 0.7);
  if (g.swingEnv <= 0) g.swingPhase = 0;               // it starts from the middle, moving out
  else g.swingPhase += swingParams(g).w * g.swingMult * dt;
  if (ch) {
    ch.t += dt;
    const band = holdBand(ch.t);
    if (band !== ch.band) { ch.band = band; Sound.band(band); vib(6); }
    if (ch.t >= FORGE.hold.warn) {
      showTip('forced');
      const period = Math.max(0.07, 0.3 - (ch.t - FORGE.hold.warn) * 0.3);
      if (ch.t - ch.beep >= period) { ch.beep = ch.t; Sound.beep(); vib(8); }
    }
    if (ch.t >= FORGE.hold.cap) { input.down = false; if (!drop(null, true)) g.charge = null; doneTip('forced'); }
  } else if (input.down && input.pending && canCharge()) { input.pending = false; startCharge(); }

  const hk = g.hook;
  if (g.kind !== 'attract') {
    if (hk.has) {
      if (hk.recall) { hk.e = Math.max(0.4, hk.e - dt * 3); if (hk.e <= 0.4) hk.recall = false; }   // Forge: recall reels it up a way
      else hk.e = Math.min(1, hk.e + dt / CFG.hookLowerTime);
    } else {
      hk.e = Math.max(0, hk.e - dt * 4);                 // empty hook reels up out of sight
      if (hk.next) {
        hk.wait -= dt;
        if (hk.wait <= 0 && hk.e <= 0) { hk.has = true; hk.next = false; hk.e = 0; g.hookMesh = makeModule(floorStyle(g), nextKind(g), roofStyleOf(g.bp, g.style)); siteRoot.add(g.hookMesh); Sound.ratchet(); }   // next floor comes down
      }
    }
  }

  const s = g.sway;
  s.phase += dt * 2 * Math.PI / CFG.sway.period;
  s.amp += (s.target - s.amp) * Math.min(1, dt * 1.5);

  if (g.combo.timer > 0) { g.combo.timer -= dt; if (g.combo.timer <= 0) { g.combo.timer = 0; g.combo.streak = 0; Music.setChain(0); } }

  if (g.falling) stepFalling(g, dt);
  for (const d of g.debris) stepDebris(g, d, dt);
  for (let i = g.debris.length - 1; i >= 0; i--) {
    const d = g.debris[i];
    if (d.state === 'wreck' ? d.t <= 0 : d.y - g.camY >= view.h + 120) { siteRoot.remove(d.mesh); g.debris.splice(i, 1); }
  }

  checkStructure(g, dt);
  // Forge: stability readout and the recovery ladder.
  if (g.kind !== 'attract') {
    const lv = stabilityLevel(g);
    g.peakSway = Math.max(g.peakSway, g.tower.length >= 2 ? Math.min(s.amp, g.tower.length * H * Math.tan(CFG.sway.maxTilt)) / CFG.sway.max : 0);
    if (lv !== g.level) { if (lv >= 2 && g.level < 2) vib([12, 40, 12]); g.level = lv; }
    if (lv >= 1 && g.tower.length >= 6) showTip('sway');
    if (lv >= 2) {
      if (!g.danger) g.danger = { worst: lv, placed: 0, peak: 0, power: false };
      g.danger.worst = Math.max(g.danger.worst, lv); g.danger.peak = Math.max(g.danger.peak, s.amp / CFG.sway.max);
      showTip('recover');
    } else if (lv === 0 && g.danger) { if (g.danger.placed > 0 && !g.ending && !g.finished) awardRecovery(g, g.danger); g.danger = null; }
  }

  if (g.pan) {
    const d = g.pan.to - g.camY, step = g.pan.speed * dt;
    if (Math.abs(d) <= step) { g.camY = g.pan.to; g.pan = null; g.hold = true; finishRound(g); }
    else g.camY += Math.sign(d) * step;
  } else if (g.kind === 'attract') {
    g.camY = introCam(g);
  } else if (g.intro) {
    g.intro.t += dt;
    const { hold, pan } = CFG.intro, k = clamp((g.intro.t - hold) / pan, 0, 1);
    g.camY = g.intro.from + (cameraTarget(g) - g.intro.from) * easeInOut(k);
    if (k >= 1) { g.intro = null; showTip('tap'); }
  } else if (!g.hold) {
    g.camY += (cameraTarget(g) - g.camY) * (1 - Math.exp(-CFG.cameraRate * dt));
  }
  if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 9);

  if (g.ending && !g.ending.started) {
    g.ending.t -= dt;
    if (g.ending.t <= 0 && !g.falling) { g.ending.started = true; startPan(g); }
  }
}

// After the round, the camera slides back down the whole tower to the street,
// which ends just above the results card.
const endCam = () => -Math.round(view.h * 0.55);
function startPan(g) {
  const to = endCam(), dist = Math.abs(to - g.camY);
  if (dist < 4) { g.hold = true; finishRound(g); return; }
  g.pan = { to, speed: Math.max(260, dist / 1.8) };
}
function finishRound(g) {
  if (g.finished) return;
  g.finished = true;
  const n = g.tower.length;
  onSessionEnd({
    kind: g.kind, site: g.site, bp: g.bpKey, style: g.style, target: g.target, daily: g.daily, weekly: g.weekly, stage: g.stage, mods: g.mods,
    floors: n, newFloors: n - g.startFloors, done: !!(g.target && n >= g.target),
    pts: g.pop, caps: g.caps, quality: g.landed ? g.quality / g.landed : 0, landed: g.landed,
    perfects: g.perfects, maxCombo: g.maxCombo, powerPerfects: g.powerPerfects, bestRisk: g.bestRisk, bestPerfectRisk: g.bestPerfectRisk,
    recoveries: g.recoveries.slice(), recoveryPrestige: g.recoveryPrestige, strongest: g.strongest, peakSway: g.peakSway,
    specialPerfects: g.specialPerfects, lives: g.lives, ratings: g.ratings, collapses: g.collapses, floorsLost: g.floorsLost,
    xs: g.tower.map(f => Math.round(f.x * 10) / 10),
  });
}

/* ---------------- Drawing the classic state in 3D ---------------- */
const hookPos = new T.Vector3(), pivotPos = new T.Vector3(), corner = new T.Vector3();
function syncScene(g) {
  g.group.rotation.z = -swayAngle(g);

  // Crane, rope, hook and the hanging block, exactly where the classic drew them.
  const py = pivotWorldY(g), th = ropeAngle(g), len = ropeLength(g);
  const rx = len * Math.sin(th), ry = py + len * Math.cos(th);
  pivotPos.set(0, -py * S, 0);
  hookPos.set(rx * S, -ry * S, 0);
  setCraneHeight(pivotPos.y);
  placeRod(rope, pivotPos, hookPos);
  hookBlock.position.copy(hookPos);
  const kind = nextKind(g), m = g.hookMesh;
  const sling = kind === 'foundation' && g.hook.has;
  hookClaw.visible = !sling;
  if (g.hook.has && m) {
    const topY = ry + HANG[kind] + extraTop(kind);      // block top, classic px
    m.position.set(rx * S, -(topY + H / 2) * S, 0); m.rotation.set(0, 0, 0);
    let i = 0;
    for (const sxx of [-1, 1]) for (const szz of [-1, 1]) {
      const r = slings[i++];
      if (sling) placeRod(r, tmpA.set(hookPos.x, hookPos.y - 1.05, 0), corner.set(hookPos.x + sxx * (W * S / 2 - 0.4), -topY * S, szz * (DEPTH / 2 - 0.4)));
      else r.visible = false;
    }
    // Forge: momentum trail and forced-release warning; special floors glow.
    const fast = g.swingMult >= 1.35 && !reduceMotion;
    if (fast) { g.trail.unshift(m.position.x, m.position.y); if (g.trail.length > 24) g.trail.length = 24; } else g.trail.length = 0;
    ghosts.forEach((gh, k) => { const j = (k + 1) * 6; gh.visible = fast && g.trail.length > j + 1; if (gh.visible) gh.position.set(g.trail[j], g.trail[j + 1], 0); });
    warnGlow.visible = !!(g.charge && g.charge.t >= FORGE.hold.warn);
    if (warnGlow.visible) { warnGlow.position.copy(m.position); warnGlow.material.opacity = 0.12 + 0.18 * (0.5 + 0.5 * Math.sin(g.time * 30)); }
    specialGlow.visible = kind === 'special' && !warnGlow.visible;
    if (specialGlow.visible) { specialGlow.position.copy(m.position); specialGlow.material.opacity = 0.1 + 0.1 * (0.5 + 0.5 * Math.sin(g.time * 5)); }
  } else {
    for (const r of slings) r.visible = false;
    for (const gh of ghosts) gh.visible = false;
    warnGlow.visible = false; specialGlow.visible = false;
  }

  if (g.falling) { const b = g.falling; b.mesh.position.set(b.x * S, -b.y * S, 0); b.mesh.rotation.set(0, 0, -b.ang); }
  // The weak joint glows while the tower is close to giving way.
  const st = g.struct, weak = st.level >= 2 && st.k >= 0 && st.k < g.tower.length;
  jointGlow.visible = weak;
  if (weak) {
    jointGlow.position.set((g.tower[st.k].x - g.tower[0].x) * S, (st.k + 1) * H * S, 0);
    jointGlow.material.opacity = (st.level === 3 ? 0.35 : 0.18) * (0.6 + 0.4 * Math.sin(g.time * (st.level === 3 ? 22 : 12)));
  }
  for (const d of g.debris) {
    d.mesh.position.set(d.x * S, -d.y * S, 0); d.mesh.rotation.set(0, 0, -d.ang);
    d.mesh.visible = !(d.state === 'wreck' && Math.floor(d.t * 10) % 2);
  }
}
// The construction camera: level and straight-on, framing exactly the classic screen.
function buildCamera(g, out) {
  let camY = g.camY;
  if (g.shake > 0) camY += (Math.floor(sceneTime * 60) % 2 ? 1 : -1) * g.shake;
  const hv = view.h * S, yc = -(camY + view.h / 2) * S;
  out.pos.set(g.site.x, yc, g.site.z + hv / (2 * TAN_HALF));
  out.look.set(g.site.x, yc, g.site.z);
  return out;
}
