'use strict';
/* ==================================================================== *
 * City simulation (GDD §6), economy, levels and build rules.           *
 * An aggregate model: capacities -> ratios -> target occupancy, eased  *
 * over real time. See DESIGN.md §5 for the formulas.                   *
 * ==================================================================== */

const City = { A: null, lv: {}, rate: 0 };
const cityLevel = () => save.level;
// Skills and modes follow the best city you've built anywhere, so a new region never takes them away.
const skillLevel = () => Math.max(save.level, save.peak || 1);
const regionMods = () => (typeof regionNow === 'function' ? regionNow().mods : {}) || {};
const ownedCities = () => 1 + Object.keys(save.regions || {}).filter(k => k !== save.region && save.regions[k]).length;
function levelForPop(p) { let l = 1; while (l < MAX_LEVEL && p >= LEVELS[l]) l++; return l; }
const buildingAt = id => { const b = save.lots[id]; return b && b.bp ? b : null; };
const placeAt = id => { const b = save.lots[id]; return b && b.place ? b.place : null; };
function buildingsList() { const out = []; for (const lot of LOTS) { const b = buildingAt(lot.id); if (b) out.push([lot, b]); } return out; }
function capsOf(b) { return b.caps || { [BLUEPRINTS[b.bp].role === 'mixed' ? 'res' : BLUEPRINTS[b.bp].role]: b.cap || 0 }; }
const capTotal = caps => Object.values(caps).reduce((s, v) => s + v, 0);
const hasRole = (b, role) => { const c = capsOf(b); return (c[role] || 0) > 0; };

/* ---------------- Per-lot context: land value, services, pollution, transit ---------------- */
function serviceRadius(b, lot) { const bp = BLUEPRINTS[b.bp]; return (bp.radius || 0) * (bp.role === 'edu' && lot.d === 'unihill' ? 1.5 : 1); }
function lotContext() {
  const src = { park: [], plaza: [], transit: [], poll: [], svc: [], landmark: [] }, ctx = {};
  for (const lot of LOTS) {
    const p = placeAt(lot.id), b = buildingAt(lot.id), docks = !!DISTRICT_BY_ID[lot.d].docks;
    if (p) {
      const P = PLACEABLES[p];
      if (p === 'park') src.park.push(lot); else if (p === 'plaza') src.plaza.push(lot);
      if (P.transit) src.transit.push([lot, P]);
      if (P.pollution) src.poll.push([lot, P.pollution * (docks ? 0.5 : 1)]);
    }
    if (b) {
      const bp = BLUEPRINTS[b.bp];
      if (SERVICE_ROLES.includes(bp.role) && b.done) src.svc.push([lot, bp.role, serviceRadius(b, lot)]);
      if (bp.pollution && b.xs.length) src.poll.push([lot, bp.pollution * (docks ? 0.5 : 1)]);
      if (bp.role === 'landmark' && b.done) src.landmark.push(lot);
    }
  }
  for (const lot of LOTS) {
    const c = { svc: {}, poll: 0, transit: 0, parks: 0 };
    let v = DISTRICT_BY_ID[lot.d].lv + (lot.water ? 0.1 : 0) + (regionMods().lv || 0);
    for (const o of src.park) if (o.id !== lot.id && c.parks < 2 && lotDist(lot, o) <= PLACEABLES.park.radius) { c.parks++; v += PLACEABLES.park.lv; }
    for (const o of src.plaza) if (o.id !== lot.id && lotDist(lot, o) <= PLACEABLES.plaza.radius) { v += PLACEABLES.plaza.lv; break; }
    for (const [o, P] of src.transit) if (lotDist(lot, o) <= P.radius) c.transit = Math.max(c.transit, P.lv);
    v += c.transit;
    for (const [o, role, r] of src.svc) if (lotDist(lot, o) <= r) c.svc[role] = true;
    v += 0.04 * Object.keys(c.svc).length;
    for (const [o, r] of src.poll) if (o.id !== lot.id && lotDist(lot, o) <= r) c.poll++;
    v -= 0.15 * Math.min(2, c.poll);
    if (src.landmark.some(o => lotDist(lot, o) <= 150)) v += 0.2;
    const b = buildingAt(lot.id);
    if (b && b.reno && b.reno.facade) v += 0.1;
    c.lv = Math.max(0.5, v);
    ctx[lot.id] = c;
  }
  return ctx;
}
const landValue = lot => (City.ctx && City.ctx[lot.id] ? City.ctx[lot.id].lv : DISTRICT_BY_ID[lot.d].lv);

/* ---------------- The simulation ---------------- */
function recomputeCity() {
  const RM = regionMods();
  const A = { Rcap: 0, Ccap: 0, Ocap: 0, Icap: 0, Gcap: 0, Vcap: 0, Svc: 0, Ecap: 0, parks: 0, plazas: 0, landmarks: 0, arenas: 0, covered: 0, buildings: 0,
    waterHotels: 0, floors: 0, power: UTIL.basePower, water: Math.round(UTIL.baseWater * (RM.water || 1)), powerUse: 0, waterUse: 0, roadCap: 300, gardens: 0, lights: 0, polluted: 0, industry: 0,
    svc: { health: 0, edu: 0, safety: 0 }, extraTourism: 0 };
  const ctx = City.ctx = lotContext();
  const list = buildingsList();
  A.roadCap += 60 * Object.keys(save.districts).length;
  for (const lot of LOTS) {
    City.lv[lot.id] = ctx[lot.id].lv;
    const p = placeAt(lot.id); if (!p) continue;
    const P = PLACEABLES[p];
    if (p === 'park') A.parks++;
    if (p === 'plaza') A.plazas++;
    A.power += Math.round((P.power || 0) * (p === 'solar' ? RM.solar || 1 : p === 'wind' ? RM.wind || 1 : 1));
    A.water += Math.round((P.water || 0) * (RM.water || 1)); A.roadCap += P.cap || 0; A.extraTourism += P.tourism || 0;
  }
  let oldTownTourism = 0, resCovered = 0, resTotal = 0;
  for (const [lot, b] of list) {
    const c = capsOf(b), bp = BLUEPRINTS[b.bp], n = b.xs.length;
    A.Rcap += c.res || 0; A.Ccap += c.com || 0; A.Ocap += c.off || 0; A.Icap += c.ind || 0; A.Gcap += c.hot || 0; A.Vcap += c.landmark || 0;
    A.Svc += (c.edu || 0) + (c.health || 0) + (c.safety || 0); A.Ecap += c.ent || 0;
    A.buildings++; A.floors += n;
    const heavy = bp.role === 'ind' || bp.role === 'landmark' || bp.role === 'mixed';
    A.powerUse += n * (heavy ? UTIL.heavyPerFloor : UTIL.perFloor); A.waterUse += n * UTIL.perFloor;
    if (b.reno && b.reno.solar) A.power += n;
    if (b.reno && b.reno.garden) A.gardens++;
    if (b.reno && b.reno.lights) A.lights++;
    if (bp.role === 'landmark' && b.done) A.landmarks++;
    if (bp.role === 'ent' && b.done) A.arenas++;
    if (bp.role === 'ind') A.industry++;
    if ((c.hot || 0) > 0 && lot.water) A.waterHotels++;
    if (DISTRICT_BY_ID[lot.d].tourism) oldTownTourism = DISTRICT_BY_ID[lot.d].tourism;
    const cx = ctx[lot.id];
    if (cx.transit > 0) A.covered++;
    if ((c.res || 0) > 0) {
      resTotal += c.res;
      for (const role of SERVICE_ROLES) if (cx.svc[role]) A.svc[role] += c.res;
      if (cx.poll) A.polluted += c.res;
    }
  }
  for (const role of SERVICE_ROLES) A.svc[role] = resTotal ? A.svc[role] / resTotal : 0;
  A.powerUse = Math.round(A.powerUse * (RM.heat || 1));             // northern cities heat every floor
  A.pollShare = resTotal ? A.polluted / resTotal : 0;
  // Utilities: a shortage empties buildings (GDD §6 Utilities).
  A.powerRatio = A.powerUse ? Math.min(1, A.power / A.powerUse) : 1;
  A.waterRatio = A.waterUse ? Math.min(1, A.water / A.waterUse) : 1;
  A.util = Math.min(A.powerRatio, A.waterRatio);
  // Jobs and workers.
  const W = 0.5 * A.Rcap, jobs = A.Ccap + A.Ocap + A.Icap + 0.3 * A.Gcap + 0.5 * A.Svc + 0.4 * A.Ecap;
  A.W = W; A.jobs = jobs;
  A.jobRatio = W > 0 ? jobs / W : 1;
  A.shopRatio = A.Rcap > 0 ? A.Ccap / (0.25 * A.Rcap) : 1;
  const stad = typeof stadiumDone === 'function' && stadiumDone();
  A.stadium = stad;
  A.tourism = Math.min(1, 0.3 + (RM.tourism || 0) + (stad ? 0.25 : 0.03 * save.stadium.stage) + 0.15 * A.landmarks + 0.05 * A.plazas + 0.1 * Math.min(2, A.waterHotels) + oldTownTourism + 0.1 * Math.min(2, A.arenas) + A.extraTourism + 0.02 * Math.min(5, A.lights));
  // Traffic: commuters vs road and transit capacity (GDD §9).
  A.commute = 0.9 * Math.min(jobs, W);
  A.congestion = Math.max(0, A.commute / A.roadCap - 1);
  const unemployment = W > 0 ? Math.max(0, W - jobs) / W : 0;
  const shopShort = A.Rcap > 0 ? Math.max(0, 1 - A.shopRatio) : 0;
  A.unemployment = unemployment;
  const svcSum = A.svc.health + A.svc.edu + A.svc.safety;
  A.happy = clamp(0.62 + Math.min(0.25, 0.05 * A.parks) + Math.min(0.1, 0.05 * A.plazas) + 0.15 * (A.buildings ? A.covered / A.buildings : 0) + (A.landmarks ? 0.1 : 0)
    + 0.06 * svcSum + Math.min(0.08, 0.01 * A.gardens) + Math.min(0.08, 0.04 * A.arenas) + (stad ? 0.06 : 0)
    - 0.2 * unemployment - 0.1 * shopShort - 0.12 * Math.min(1, A.congestion) - 0.12 * A.pollShare - 0.2 * (1 - A.util), 0.25, 1);
  // Demand bars, -1..1 (GDD §6 Demand)
  A.demand = {
    R: A.Rcap || jobs ? clamp((jobs - W) / Math.max(W, 50), -1, 1) : 1,
    C: clamp((0.25 * A.Rcap - A.Ccap) / Math.max(0.25 * A.Rcap, 30), -1, 1),
    O: clamp((W - jobs) / Math.max(W, 50), -1, 1),
  };
  // Target occupancy per building.
  const roleT = {
    res: clamp(0.45 + 0.35 * Math.min(1, A.jobRatio) + 0.2 * Math.min(1, A.shopRatio), 0, 1) * (0.8 + 0.4 * A.happy),
    com: 0.3 + 0.7 * Math.min(1, A.Ccap > 0 ? 0.25 * A.Rcap / A.Ccap : 1),
    off: (0.3 + 0.7 * Math.min(1, A.Ocap > 0 ? W / jobs : 1)) * (0.9 + 0.1 * A.svc.edu),
    ind: 0.5 + 0.5 * Math.min(1, jobs > 0 ? W / jobs : 1),
    hot: 0.4 + 0.6 * A.tourism,
    landmark: 0.6 + 0.4 * A.tourism,
    ent: 0.4 + 0.6 * A.tourism,
    edu: 0.75 + 0.25 * A.happy, health: 0.75 + 0.25 * A.happy, safety: 0.8 + 0.2 * A.happy,
  };
  A.roleT = roleT;
  for (const [lot, b] of list) {
    const c = capsOf(b), tot = capTotal(c) || 1, cx = ctx[lot.id];
    let t = 0; for (const [r, v] of Object.entries(c)) t += (roleT[r] ?? 0.6) * v / tot;
    if ((c.res || 0) > 0) t *= 0.88 + 0.04 * Object.keys(cx.svc).length;
    const lvf = clamp(0.9 + 0.25 * (cx.lv - 1), 0.85, 1.15);
    const reno = b.reno || {};
    t *= lvf * (reno.amenities ? 1.08 : 1) * (reno.garden ? 1.03 : 1) * (0.5 + 0.5 * A.util);
    b.occT = clamp(t, 0.2, 1);                 // target occupancy (b.target is the floor target)
    if (b.occ == null) b.occ = b.occT * ECON.newOccShare;
  }
  City.A = A;
  measureCity();
  return A;
}
// Current population, jobs, income and materials from occupancy.
function measureCity() {
  const A = City.A; if (!A) return;
  let P = 0, rich = 0, jobsHeld = 0, guests = 0, visitors = 0, lvSum = 0, n = 0, indOut = 0;
  for (const [lot, b] of buildingsList()) {
    const c = capsOf(b), o = b.occ ?? 0;
    P += (c.res || 0) * o; if (BLUEPRINTS[b.bp].rich) rich += (c.res || 0) * o;
    jobsHeld += ((c.com || 0) + (c.off || 0) + (c.ind || 0) + 0.5 * ((c.edu || 0) + (c.health || 0) + (c.safety || 0))) * o;
    guests += (c.hot || 0) * o; visitors += ((c.landmark || 0) + (c.ent || 0)) * o;
    indOut += (c.ind || 0) * o;
    lvSum += City.lv[lot.id]; n++;
  }
  if (A.stadium) visitors += STADIUM.visitors * (0.5 + 0.5 * A.tourism);
  const filled = Math.min(jobsHeld, 0.5 * P + 0.3 * guests);
  A.pop = P; A.filled = filled; A.guests = guests; A.visitors = visitors;
  A.meanLV = n ? lvSum / n : 1;
  const ev = eventNow();
  A.matRate = indOut / ECON.materialsPerCap * ((ev && ev.matRate) || 1);
  City.rate = (eventInc('res') * (0.12 * P + 0.06 * rich) + eventInc('jobs') * 0.15 * filled + eventInc('guests') * 0.4 * guests + eventInc('visitors') * 0.25 * visitors)
    * (0.7 + 0.5 * A.happy) * A.meanLV * (1 - 0.1 * Math.min(1, A.congestion)) * (1 + TRADE_BONUS * (ownedCities() - 1));
}
const population = () => (City.A ? Math.round(City.A.pop) : 0);
const incomeCap = () => Math.max(50, City.rate * ECON.incomeCapHours);
const materialCap = () => ECON.materialCap * (1 + (City.A ? City.A.industry : 0));

// Advance occupancy, income and materials by real time (also used for time away).
function tickCity(dtSec) {
  if (!City.A) recomputeCity();
  const k = 1 - Math.exp(-dtSec / (ECON.occTauMin * 60));
  for (const [, b] of buildingsList()) if (b.occT != null) b.occ += (b.occT - b.occ) * k;
  measureCity();
  if (save.bank < incomeCap()) save.bank = Math.min(incomeCap(), save.bank + City.rate * dtSec / 3600);   // never shrinks if the rate drops
  if (save.materials < materialCap()) save.materials = Math.min(materialCap(), save.materials + City.A.matRate * dtSec / 3600);
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
    const reward = ECON.levelReward(save.level), newPeak = save.level > (save.peak || 1);
    addCoins(reward);
    // Features you already have from another city aren't announced again.
    ups.push({ level: save.level, reward, unlocks: unlocksAt(save.level).filter(u => u.type !== 'feature' || newPeak) });
    save.peak = Math.max(save.peak || 1, save.level);
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
// The facade the player picked in Trophies > Mastery, if they've unlocked it.
function chosenStyle(key) {
  const v = STYLE_VARIANTS[key], m = save.mastery[key], base = BLUEPRINTS[key].style;
  if (!v || !m || !m.style) return base;
  const i = v.indexOf(m.style);
  return i >= 0 && i <= masteryTier(key) ? m.style : base;
}
function permitCost(key) { return key === 'flats' && save.freeFlats ? 0 : BLUEPRINTS[key].cost; }
const NEED_TEXT = { res: 'Residential', com: 'Commercial', off: 'Office', edu: 'a school or university' };
function needsMet(key, lot) {
  const bp = BLUEPRINTS[key], missing = [];
  for (const need of bp.needs || []) {
    if (need === 'parkOrWater') { if (!lot.water && !nearbyHas(lot, b => b.place === 'park')) missing.push('a park nearby or a waterfront lot'); }
    else if (!nearbyHas(lot, b => b.bp && hasRole(b, need))) missing.push(NEED_TEXT[need]);
  }
  return missing;
}
const matCost = (key, cont) => Math.ceil((BLUEPRINTS[key].mat || 0) * (cont ? ECON.continueFee : 1));
function canBuild(key, lot, opts = {}) {
  const bp = BLUEPRINTS[key], d = DISTRICT_BY_ID[lot.d];
  const cost = opts.cont ? Math.round(bp.cost * ECON.continueFee) : permitCost(key), mat = matCost(key, opts.cont);
  if (opts.cont) { const b = buildingAt(lot.id); if (!b || b.bp !== key || b.done) return { ok: false, reason: 'Nothing to continue here', cost, mat }; }
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
  if (save.coins < cost) return { ok: false, reason: `${fmt(cost - save.coins)} more coins`, cost, mat, short: true };
  const matShort = Math.max(0, mat - Math.floor(save.materials));
  if (matShort) return { ok: false, reason: `${fmt(matShort)} more materials`, cost, mat, matShort };
  return { ok: true, cost, mat };
}
// Materials can always be bought, at a price, so a shortage never walls the player off.
const matPrice = n => Math.ceil(n * ECON.materialPrice * ((eventNow() && eventNow().matPrice) || 1));
// Buying for a specific build may go past storage; stocking up may not.
function buyMaterials(n, forBuild) {
  if (!forBuild) n = Math.min(n, Math.floor(materialCap() - save.materials));
  const c = matPrice(n);
  if (n <= 0 || save.coins < c) return false;
  addCoins(-c); save.materials += n; persist(); bus.emit('materials', save.materials);
  return true;
}
// Pay for the permit up front; it's refunded if the app closes before the build ends.
function payPermit(key, lot, cont) {
  const r = canBuild(key, lot, { cont });
  if (!r.ok) return false;
  addCoins(-r.cost); save.materials -= r.mat;
  if (key === 'flats' && !cont) save.freeFlats = false;
  save.pending = { lot: lot.id, bp: key, cost: r.cost, mat: r.mat };
  persistNow();
  return true;
}
function refundPending() {
  if (!save.pending) return 0;
  const c = save.pending.cost || 0; addCoins(c); save.materials += save.pending.mat || 0; save.pending = null; persist(); return c;
}

/* ---------------- Finishing a city build ---------------- */
function completeBuild(r) {
  save.pending = null;
  const lot = LOT_BY_ID[r.site.id], bp = BLUEPRINTS[r.bp], d = DISTRICT_BY_ID[lot.d];
  const prev = buildingAt(lot.id), cont = !!(prev && !prev.done && prev.bp === r.bp && r.xs.length > prev.xs.length && r.xs.slice(0, prev.xs.length).every((x, i) => Math.abs(x - prev.xs[i]) < 0.2));
  const ev = eventNow(), evCap = (ev && ev.cap && ev.cap[bp.role]) || 0;
  const bonus = 1 + ((d.bonus && (d.bonus[r.bp] || 0)) || 0) + ((d.bonus && (d.bonus[bp.role] || 0)) || 0) + FORGE.specialBonus * r.specialPerfects
    + ECON.masteryBonus * Math.max(0, masteryTier(r.bp)) + evCap + ((regionMods().cap && regionMods().cap[bp.role]) || 0);
  const caps = {};
  for (const [role, v] of Object.entries(r.caps)) caps[role] = Math.round(v * bonus);
  if (cont) for (const [role, v] of Object.entries(capsOf(prev))) caps[role] = (caps[role] || 0) + v;
  const landed = r.landed + (cont ? prev.landed || prev.xs.length : 0);
  const quality = cont ? ((prev.quality || 0.8) * (prev.landed || prev.xs.length) + r.quality * r.landed) / Math.max(1, landed) : r.quality;
  const stars = r.done ? (quality >= ECON.stars[1] ? 3 : quality >= ECON.stars[0] ? 2 : 1) : 0;
  const rec = {
    bp: r.bp, style: cont ? prev.style : r.style, xs: r.xs, target: r.target, done: r.done, caps, cap: capTotal(caps), quality, landed, stars,
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
  const wx = WEATHER[r.mods && r.mods.weather] || WEATHER.clear;
  const eventCoins = r.perfects * ((ev && ev.perfectCoins) || 0) + r.powerPerfects * ((ev && ev.powerCoins) || 0);
  let coins = Math.round((r.newFloors * E.perFloor * sm + r.perfects * E.perPerfect + r.powerPerfects * E.perPowerPerfect) * (1 + wx.bonus) + eventCoins);
  let prestige = r.recoveryPrestige;
  const firstTop = topped && !(save.mastery[r.bp] && save.mastery[r.bp].built);
  if (topped) { coins += Math.round(bp.cost * E.completion + stars * bp.floors * E.perStarFloor); prestige += Math.round(stars * bp.floors / 4); }
  addCoins(coins); addPrestige(prestige);
  const salvage = Math.min(materialCap() - save.materials, r.perfects * ECON.matPerPerfect);   // Perfect floors waste nothing
  if (salvage > 0) save.materials += salvage;
  const m = save.mastery[r.bp] || (save.mastery[r.bp] = { built: 0, stars: 0 });
  if (topped) { m.built++; m.stars = Math.max(m.stars, stars); save.stats.toppedOut++; if (stars === 3) save.stats.threeStars++; }
  save.stats.builds++;
  recomputeCity();
  const out = { coins, wxBonus: wx.bonus, eventCoins, prestige, materials: Math.max(0, Math.floor(salvage)), stars: topped ? stars : 0, kept, saved: !kept && r.xs.length > 0, cont, caps, cap: rec.cap, quality, firstTop, bonus, prev: kept ? prev : null };
  bus.emit('build', { bp: r.bp, done: topped, stars: topped ? stars : 0, quality, perfects: r.perfects, powerPerfects: r.powerPerfects, weather: r.mods && r.mods.weather, eventCoins, tier: masteryTier(r.bp) });
  persistNow();
  return out;
}

/* ---------------- Placeables, demolition, districts ---------------- */
function canPlace(key, lot) {
  const P = PLACEABLES[key];
  if (!save.districts[lot.d]) return { ok: false, reason: 'Buy this district first' };
  if (P.level > save.level) return { ok: false, reason: `City level ${P.level}`, locked: true };
  if (save.lots[lot.id]) return { ok: false, reason: 'Lot in use' };
  if (P.waterfront && !lot.water) return { ok: false, reason: 'Waterfront lots only' };
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
/* ---------------- Renovations (GDD §5): upgrade a topped-out building ---------------- */
function renoCost(b, R) { return Math.round(BLUEPRINTS[b.bp].cost * R.cost / 10) * 10; }
function canRenovate(lot, id) {
  const b = buildingAt(lot.id), R = RENOVATIONS.find(x => x.id === id);
  if (!b || !R) return { ok: false, reason: 'Nothing to renovate' };
  if (skillLevel() < ECON.renoLevel) return { ok: false, reason: `City level ${ECON.renoLevel}`, locked: true };
  if (!b.done) return { ok: false, reason: 'Top it out first' };
  if (b.reno && b.reno[id]) return { ok: false, reason: 'Done', done: true };
  const cost = renoCost(b, R);
  if (save.coins < cost) return { ok: false, reason: `${fmt(cost - save.coins)} more coins`, cost, short: true };
  if (save.materials < R.mat) return { ok: false, reason: `${fmt(Math.ceil(R.mat - save.materials))} more materials`, cost };
  return { ok: true, cost };
}
function renovate(lot, id) {
  const r = canRenovate(lot, id); if (!r.ok) return false;
  const b = buildingAt(lot.id), R = RENOVATIONS.find(x => x.id === id);
  addCoins(-r.cost); save.materials -= R.mat;
  (b.reno || (b.reno = {}))[id] = Date.now();
  save.stats.renos = (save.stats.renos || 0) + 1;
  recomputeCity(); persistNow();
  bus.emit('renovate', { id, bp: b.bp });
  return true;
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
