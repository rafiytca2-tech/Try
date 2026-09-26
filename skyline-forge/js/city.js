'use strict';
/* ==================================================================== *
 * City simulation (GDD §6), economy, levels and build rules.           *
 * An aggregate model: capacities -> ratios -> target occupancy, eased  *
 * over real time. See DESIGN.md §5 for the formulas.                   *
 * ==================================================================== */

const City = { A: null, lv: {}, rate: 0 };
const cityLevel = () => save.level;
function levelForPop(p) { let l = 1; while (l < MAX_LEVEL && p >= LEVELS[l]) l++; return l; }
const buildingAt = id => { const b = save.lots[id]; return b && b.bp ? b : null; };
const placeAt = id => { const b = save.lots[id]; return b && b.place ? b.place : null; };
function buildingsList() { const out = []; for (const lot of LOTS) { const b = buildingAt(lot.id); if (b) out.push([lot, b]); } return out; }
function capsOf(b) { return b.caps || { [BLUEPRINTS[b.bp].role === 'mixed' ? 'res' : BLUEPRINTS[b.bp].role]: b.cap || 0 }; }
const capTotal = caps => Object.values(caps).reduce((s, v) => s + v, 0);
const hasRole = (b, role) => { const c = capsOf(b); return (c[role] || 0) > 0; };

/* ---------------- Land value ---------------- */
function landValue(lot) {
  const d = DISTRICT_BY_ID[lot.d];
  let v = d.lv + (lot.water ? 0.1 : 0), parks = 0, plazas = 0, transit = 0, landmark = false;
  for (const o of LOTS) {
    if (o.id === lot.id) continue;
    const p = placeAt(o.id), dist = lotDist(lot, o);
    if (p) {
      const P = PLACEABLES[p];
      if (dist <= P.radius) {
        if (p === 'park' && parks < 2) { parks++; v += P.lv; }
        else if (p === 'plaza' && plazas < 1) { plazas++; v += P.lv; }
        else if (P.transit) transit = Math.max(transit, P.lv);
      }
    }
    const b = buildingAt(o.id);
    if (b && BLUEPRINTS[b.bp].role === 'landmark' && b.done && dist <= 150) landmark = true;
  }
  return v + transit + (landmark ? 0.2 : 0);
}

/* ---------------- The simulation ---------------- */
function recomputeCity() {
  const A = { Rcap: 0, Ccap: 0, Ocap: 0, Gcap: 0, Vcap: 0, parks: 0, plazas: 0, landmarks: 0, covered: 0, buildings: 0, waterHotels: 0 };
  const list = buildingsList();
  for (const lot of LOTS) {
    City.lv[lot.id] = landValue(lot);
    const p = placeAt(lot.id);
    if (p === 'park') A.parks++;
    if (p === 'plaza') A.plazas++;
  }
  let oldTownTourism = 0;
  for (const [lot, b] of list) {
    const c = capsOf(b);
    A.Rcap += c.res || 0; A.Ccap += c.com || 0; A.Ocap += c.off || 0; A.Gcap += c.hot || 0; A.Vcap += c.landmark || 0;
    A.buildings++;
    if (BLUEPRINTS[b.bp].role === 'landmark' && b.done) A.landmarks++;
    if ((c.hot || 0) > 0 && lot.water) A.waterHotels++;
    if (DISTRICT_BY_ID[lot.d].tourism) oldTownTourism = DISTRICT_BY_ID[lot.d].tourism;
    for (const o of LOTS) { const p = placeAt(o.id); if (p && PLACEABLES[p].transit && lotDist(lot, o) <= PLACEABLES[p].radius) { A.covered++; break; } }
  }
  const W = 0.5 * A.Rcap, jobs = A.Ccap + A.Ocap + 0.3 * A.Gcap;
  A.W = W; A.jobs = jobs;
  A.jobRatio = W > 0 ? jobs / W : 1;
  A.shopRatio = A.Rcap > 0 ? A.Ccap / (0.25 * A.Rcap) : 1;
  A.tourism = Math.min(1, 0.3 + 0.15 * A.landmarks + 0.05 * A.plazas + 0.1 * Math.min(2, A.waterHotels) + oldTownTourism);
  const unemployment = W > 0 ? Math.max(0, W - jobs) / W : 0;
  const shopShort = A.Rcap > 0 ? Math.max(0, 1 - A.shopRatio) : 0;
  A.unemployment = unemployment;
  A.happy = clamp(0.62 + Math.min(0.25, 0.05 * A.parks) + Math.min(0.1, 0.05 * A.plazas) + 0.15 * (A.buildings ? A.covered / A.buildings : 0) + (A.landmarks ? 0.1 : 0) - 0.2 * unemployment - 0.1 * shopShort, 0.25, 1);
  // Demand bars, -1..1 (GDD §6 Demand)
  A.demand = {
    R: A.Rcap || jobs ? clamp((jobs - W) / Math.max(W, 50), -1, 1) : 1,
    C: clamp((0.25 * A.Rcap - A.Ccap) / Math.max(0.25 * A.Rcap, 30), -1, 1),
    O: clamp((W - jobs) / Math.max(W, 50), -1, 1),
  };
  // Target occupancy per building
  const roleT = {
    res: clamp(0.45 + 0.35 * Math.min(1, A.jobRatio) + 0.2 * Math.min(1, A.shopRatio), 0, 1) * (0.8 + 0.4 * A.happy),
    com: 0.3 + 0.7 * Math.min(1, A.Ccap > 0 ? 0.25 * A.Rcap / A.Ccap : 1),
    off: 0.3 + 0.7 * Math.min(1, A.Ocap > 0 ? W / jobs : 1),
    hot: 0.4 + 0.6 * A.tourism,
    landmark: 0.6 + 0.4 * A.tourism,
  };
  A.roleT = roleT;
  for (const [lot, b] of list) {
    const c = capsOf(b), tot = capTotal(c) || 1;
    let t = 0; for (const [r, v] of Object.entries(c)) t += (roleT[r] ?? 0.6) * v / tot;
    const lvf = clamp(0.9 + 0.25 * (City.lv[lot.id] - 1), 0.9, 1.15);
    b.occT = clamp(t * lvf, 0.2, 1);                 // target occupancy (b.target is the floor target)
    if (b.occ == null) b.occ = b.occT * ECON.newOccShare;
  }
  City.A = A;
  measureCity();
  return A;
}
// Current population, jobs and income from occupancy.
function measureCity() {
  const A = City.A; if (!A) return;
  let P = 0, rich = 0, jobsHeld = 0, guests = 0, visitors = 0, lvSum = 0, n = 0;
  for (const [lot, b] of buildingsList()) {
    const c = capsOf(b), o = b.occ ?? 0;
    P += (c.res || 0) * o; if (BLUEPRINTS[b.bp].rich) rich += (c.res || 0) * o;
    jobsHeld += ((c.com || 0) + (c.off || 0)) * o;
    guests += (c.hot || 0) * o; visitors += (c.landmark || 0) * o;
    lvSum += City.lv[lot.id]; n++;
  }
  const filled = Math.min(jobsHeld, 0.5 * P + 0.3 * guests);
  A.pop = P; A.filled = filled; A.guests = guests; A.visitors = visitors;
  A.meanLV = n ? lvSum / n : 1;
  City.rate = (0.25 * P + 0.125 * rich + 0.3 * filled + 0.8 * guests + 0.5 * visitors) * (0.7 + 0.5 * A.happy) * A.meanLV;
}
const population = () => (City.A ? Math.round(City.A.pop) : 0);
const incomeCap = () => Math.max(50, City.rate * ECON.incomeCapHours);

// Advance occupancy and income by real time (also used for time away).
function tickCity(dtSec) {
  if (!City.A) recomputeCity();
  const k = 1 - Math.exp(-dtSec / (ECON.occTauMin * 60));
  for (const [, b] of buildingsList()) if (b.occT != null) b.occ += (b.occT - b.occ) * k;
  measureCity();
  if (save.bank < incomeCap()) save.bank = Math.min(incomeCap(), save.bank + City.rate * dtSec / 3600);   // never shrinks if the rate drops
}
function catchUpOffline() {
  const away = Math.max(0, (Date.now() - (save.seen || Date.now())) / 1000);
  recomputeCity();
  const before = save.bank;
  if (away > 5) tickCity(Math.min(away, 7 * 24 * 3600));
  return { away, earned: save.bank - before };
}
function collectIncome() {
  const n = Math.floor(save.bank);
  if (n < 1) return 0;
  save.bank -= n;
  addCoins(n);
  Sound.coin(Math.min(6, 1 + Math.floor(n / 100)));
  persist();
  return n;
}

/* ---------------- Currencies ---------------- */
function addCoins(n) { save.coins = Math.max(0, Math.round(save.coins + n)); bus.emit('coins', save.coins); }
function addPrestige(n) { if (n > 0) { save.prestige += n; bus.emit('prestige', save.prestige); } }

/* ---------------- Levels ---------------- */
function unlocksAt(level) {
  const out = [];
  for (const [k, bp] of Object.entries(BLUEPRINTS)) if (bp.level === level) out.push({ type: 'bp', key: k, name: bp.name });
  for (const [k, p] of Object.entries(PLACEABLES)) if (p.level === level) out.push({ type: 'place', key: k, name: p.name });
  for (const d of DISTRICTS) if (d.level === level && d.cost) out.push({ type: 'district', key: d.id, name: d.name });
  for (const [k, l] of Object.entries(FEATURES)) if (l === level) out.push({ type: 'feature', key: k, name: FEATURE_NAMES[k] });
  return out;
}
// Levels never go down, so unlocks are never lost.
function checkLevelUp() {
  const target = levelForPop(population());
  const ups = [];
  while (save.level < target) {
    save.level++;
    const reward = ECON.levelReward(save.level);
    addCoins(reward);
    ups.push({ level: save.level, reward, unlocks: unlocksAt(save.level) });
    bus.emit('level', save.level);
  }
  if (ups.length) persist();
  return ups;
}
function levelProgress() {
  const l = save.level, cur = LEVELS[l - 1], next = LEVELS[l];
  if (next == null) return { l, frac: 1, next: null };
  return { l, frac: clamp((population() - cur) / (next - cur), 0, 1), next };
}

/* ---------------- Build rules ---------------- */
function nearbyHas(lot, test) {
  for (const o of LOTS) {
    if (o.id === lot.id || lotDist(lot, o) > 36) continue;
    const b = save.lots[o.id];
    if (b && test(b)) return true;
  }
  return false;
}
function permitCost(key) { return key === 'flats' && save.freeFlats ? 0 : BLUEPRINTS[key].cost; }
const NEED_TEXT = { res: 'Residential', com: 'Commercial', off: 'Office' };
function needsMet(key, lot) {
  const bp = BLUEPRINTS[key], missing = [];
  for (const need of bp.needs || []) {
    if (need === 'parkOrWater') { if (!lot.water && !nearbyHas(lot, b => b.place === 'park')) missing.push('a park nearby or a waterfront lot'); }
    else if (!nearbyHas(lot, b => b.bp && hasRole(b, need))) missing.push(NEED_TEXT[need]);
  }
  return missing;
}
function canBuild(key, lot, opts = {}) {
  const bp = BLUEPRINTS[key], d = DISTRICT_BY_ID[lot.d];
  const cost = opts.cont ? Math.round(bp.cost * ECON.continueFee) : permitCost(key);
  if (opts.cont) { const b = buildingAt(lot.id); if (!b || b.bp !== key || b.done) return { ok: false, reason: 'Nothing to continue here', cost }; }
  if (!save.districts[lot.d]) return { ok: false, reason: `Buy ${d.name} first`, cost };
  if (bp.level > save.level) return { ok: false, reason: `City level ${bp.level}`, cost, locked: true };
  if (d.maxFloors && bp.floors > d.maxFloors) return { ok: false, reason: `Max ${d.maxFloors} floors here`, cost };
  const here = save.lots[lot.id];
  if (here && here.place) return { ok: false, reason: 'Lot in use', cost };
  if (bp.unique && !opts.cont) for (const [l2, b] of buildingsList()) if (b.bp === key && l2.id !== lot.id) return { ok: false, reason: 'One per city', cost };
  if (!opts.cont) {
    const missing = needsMet(key, lot);
    if (missing.length) return { ok: false, reason: `Needs ${missing.join(' + ')} nearby`.replace('Needs a park nearby or a waterfront lot nearby', 'Needs a park nearby or waterfront'), cost };
  }
  if (save.coins < cost) return { ok: false, reason: `${fmt(cost - save.coins)} more coins`, cost, short: true };
  return { ok: true, cost };
}
// Pay for the permit up front; it's refunded if the app closes before the build ends.
function payPermit(key, lot, cont) {
  const r = canBuild(key, lot, { cont });
  if (!r.ok) return false;
  addCoins(-r.cost);
  if (key === 'flats' && !cont) save.freeFlats = false;
  save.pending = { lot: lot.id, bp: key, cost: r.cost };
  persistNow();
  return true;
}
function refundPending() {
  if (!save.pending) return 0;
  const c = save.pending.cost || 0; addCoins(c); save.pending = null; persist(); return c;
}

/* ---------------- Finishing a city build ---------------- */
function completeBuild(r) {
  save.pending = null;
  const lot = LOT_BY_ID[r.site.id], bp = BLUEPRINTS[r.bp], d = DISTRICT_BY_ID[lot.d];
  const prev = buildingAt(lot.id), cont = !!(prev && !prev.done && prev.bp === r.bp && r.xs.length > prev.xs.length && r.xs.slice(0, prev.xs.length).every((x, i) => Math.abs(x - prev.xs[i]) < 0.2));
  const bonus = 1 + ((d.bonus && (d.bonus[r.bp] || 0)) || 0) + ((d.bonus && (d.bonus[bp.role] || 0)) || 0) + FORGE.specialBonus * r.specialPerfects;
  const caps = {};
  for (const [role, v] of Object.entries(r.caps)) caps[role] = Math.round(v * bonus);
  if (cont) for (const [role, v] of Object.entries(capsOf(prev))) caps[role] = (caps[role] || 0) + v;
  const landed = r.landed + (cont ? prev.landed || prev.xs.length : 0);
  const quality = cont ? ((prev.quality || 0.8) * (prev.landed || prev.xs.length) + r.quality * r.landed) / Math.max(1, landed) : r.quality;
  const stars = r.done ? (quality >= ECON.stars[1] ? 3 : quality >= ECON.stars[0] ? 2 : 1) : 0;
  const rec = {
    bp: r.bp, xs: r.xs, target: r.target, done: r.done, caps, cap: capTotal(caps), quality, landed, stars,
    perfects: r.perfects + (cont ? prev.perfects || 0 : 0), combo: Math.max(r.maxCombo, cont ? prev.combo || 0 : 0),
    power: r.powerPerfects + (cont ? prev.power || 0 : 0), strongest: Math.max(r.strongest, cont ? prev.strongest || 1 : 1),
    recoveries: (cont ? prev.recoveries || [] : []).concat(r.recoveries), specials: r.specialPerfects + (cont ? prev.specials || 0 : 0),
    date: cont ? prev.date : Date.now(), finished: r.done ? Date.now() : null, occ: cont ? prev.occ : null, builds: (cont ? prev.builds || 1 : (prev && prev.bp === r.bp ? (prev.builds || 1) : 0) + 1),
  };
  // A rebuild keeps whichever tower is better, like the classic city mode.
  let kept = false;
  if (prev && !cont && r.xs.length) {
    if ((prev.done && !rec.done) || (prev.done === rec.done && prev.cap > rec.cap)) kept = true;
  }
  if (!kept && r.xs.length) save.lots[lot.id] = rec;
  const topped = r.done && !kept;                        // a discarded rebuild isn't a top-out
  // Rewards (DESIGN.md §6)
  const E = ECON.build, sm = bp.mult;
  let coins = Math.round(r.newFloors * E.perFloor * sm + r.perfects * E.perPerfect + r.powerPerfects * E.perPowerPerfect);
  let prestige = r.recoveryPrestige;
  const firstTop = topped && !(save.mastery[r.bp] && save.mastery[r.bp].built);
  if (topped) { coins += Math.round(bp.cost * E.completion + stars * bp.floors * E.perStarFloor); prestige += Math.round(stars * bp.floors / 4); }
  addCoins(coins); addPrestige(prestige);
  const m = save.mastery[r.bp] || (save.mastery[r.bp] = { built: 0, stars: 0 });
  if (topped) { m.built++; m.stars = Math.max(m.stars, stars); save.stats.toppedOut++; if (stars === 3) save.stats.threeStars++; }
  save.stats.builds++;
  recomputeCity();
  const out = { coins, prestige, stars: topped ? stars : 0, kept, saved: !kept && r.xs.length > 0, cont, caps, cap: rec.cap, quality, firstTop, bonus, prev: kept ? prev : null };
  bus.emit('build', { bp: r.bp, done: topped, stars: topped ? stars : 0, quality, perfects: r.perfects, powerPerfects: r.powerPerfects });
  persistNow();
  return out;
}

/* ---------------- Placeables, demolition, districts ---------------- */
function canPlace(key, lot) {
  const P = PLACEABLES[key];
  if (!save.districts[lot.d]) return { ok: false, reason: 'Buy this district first' };
  if (P.level > save.level) return { ok: false, reason: `City level ${P.level}`, locked: true };
  if (save.lots[lot.id]) return { ok: false, reason: 'Lot in use' };
  if (save.coins < P.cost) return { ok: false, reason: `${fmt(P.cost - save.coins)} more coins`, short: true };
  return { ok: true, cost: P.cost };
}
function placeItem(key, lot) {
  const r = canPlace(key, lot); if (!r.ok) return false;
  addCoins(-r.cost);
  save.lots[lot.id] = { place: key, date: Date.now() };
  if (key === 'park') save.stats.parks++;
  recomputeCity(); persistNow();
  bus.emit('place', { key });
  return true;
}
function clearLot(lot) {
  const b = save.lots[lot.id]; if (!b) return 0;
  const refund = b.place ? Math.round(PLACEABLES[b.place].cost * 0.5) : Math.round(BLUEPRINTS[b.bp].cost * ECON.demolishRefund);
  delete save.lots[lot.id];
  addCoins(refund); recomputeCity(); persistNow();
  return refund;
}
function canBuyDistrict(d) {
  if (save.districts[d.id]) return { ok: false, reason: 'Owned' };
  if (d.level > save.level) return { ok: false, reason: `City level ${d.level}`, locked: true };
  if (save.coins < d.cost) return { ok: false, reason: `${fmt(d.cost - save.coins)} more coins`, short: true };
  return { ok: true };
}
function buyDistrict(d) {
  if (!canBuyDistrict(d).ok) return false;
  addCoins(-d.cost); save.districts[d.id] = true;
  recomputeCity(); persistNow();
  bus.emit('district', Object.keys(save.districts).length);
  return true;
}
