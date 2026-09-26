'use strict';
/* ==================================================================== *
 * Reasons to come back: contracts, the daily challenge, the Sky Race   *
 * record, achievements, mastery and cosmetics (GDD §10, §15).          *
 * They listen to game events on the bus, so the engine stays simple.   *
 * ==================================================================== */

/* ---------------- Stats ---------------- */
bus.on('floor', ev => {
  if (ev.kind === 'attract') return;
  const s = save.stats;
  s.floors++; if (ev.perfect) s.perfects++; if (ev.perfect && ev.power > 1) s.powerPerfects++;
  s.bestCombo = Math.max(s.bestCombo, ev.combo);
});
bus.on('recovery', () => { save.stats.recoveries++; });

/* ---------------- Contracts ---------------- */
function unlockedBlueprints() {
  return BP_KEYS.filter(k => BLUEPRINTS[k].level <= save.level && !(BLUEPRINTS[k].unique && buildingsList().some(([, b]) => b.bp === k && b.done)));
}
function makeContract() {
  const n = ++save.contracts.made;
  const rng = mulberry32(hashStr(`contract:${save.created}:${n}`));
  const active = new Set(save.contracts.slots.filter(c => c && !c.empty).map(c => c.tpl));
  const ctx = { level: save.level, bps: unlockedBlueprints(), raceBest: save.race.best, pop: population() };
  const pool = CONTRACTS.filter(t => t.min <= save.level && !active.has(t.id) && (t.id !== 'topout' || ctx.bps.length));
  let total = pool.reduce((s, t) => s + t.w, 0), r = rng() * total, tpl = pool[0];
  for (const t of pool) { r -= t.w; if (r <= 0) { tpl = t; break; } }
  return Object.assign({ tpl: tpl.id, progress: 0, done: false, claimed: false }, tpl.make(rng, ctx));
}
function contractsOn() { return save.level >= FEATURES.contracts; }
function ensureContracts() {
  if (!contractsOn()) return;
  const slots = save.contracts.slots, now = Date.now();
  while (slots.length < 3) slots.push({ empty: true, readyAt: 0 });
  let changed = false;
  slots.forEach((c, i) => { if (c.empty && c.readyAt <= now) { slots[i] = makeContract(); changed = true; } });
  if (changed) persist();
}
function progressContract(c, amount = 1) {
  if (c.empty || c.done) return;
  c.progress = Math.min(c.target, c.progress + amount);
  if (c.progress >= c.target) { c.done = true; toast(`Contract complete: ${c.text}`, 'good'); Sound.bonus(); persist(); bus.emit('contractReady'); }
}
function eachContract(fn) { if (contractsOn()) for (const c of save.contracts.slots) if (!c.empty && !c.done) fn(c); }
bus.on('floor', ev => {
  if (ev.kind === 'attract') return;
  eachContract(c => {
    if (c.type === 'combo' && ev.combo >= c.n) progressContract(c);
    else if (c.type === 'hold' && ev.perfect && ev.hold >= c.m - 1e-6) progressContract(c);
    else if (c.type === 'floors') progressContract(c);
    else if (c.type === 'power' && ev.perfect && ev.power > 1) progressContract(c);
  });
});
bus.on('session', r => eachContract(c => {
  if (c.type === 'perfects' && r.perfects >= c.n) progressContract(c);
  else if (c.type === 'race' && r.kind === 'race' && r.floors >= c.h) progressContract(c);
}));
bus.on('build', ev => eachContract(c => {
  if (c.type === 'topout' && ev.done && ev.bp === c.bp) progressContract(c);
  else if (c.type === 'quality' && ev.done && ev.quality >= c.q - 1e-6) progressContract(c);
}));
bus.on('recovery', ev => eachContract(c => { if (c.type === 'recovery' && ev.tier >= c.k) progressContract(c); }));
bus.on('place', ev => eachContract(c => { if ((c.type === 'parks' && ev.key === 'park') || (c.type === 'transit' && PLACEABLES[ev.key].transit)) progressContract(c); }));
bus.on('renovate', () => eachContract(c => { if (c.type === 'reno') progressContract(c); }));
bus.on('build', ev => eachContract(c => { if (c.type === 'weather' && ev.done && WEATHER[ev.weather] && WEATHER[ev.weather].bonus) progressContract(c); }));
bus.on('daily', () => eachContract(c => { if (c.type === 'daily') progressContract(c); }));
function checkPopContracts() { const p = population(); eachContract(c => { if (c.type === 'pop' && p >= c.p) progressContract(c); }); }
function claimContract(i) {
  const c = save.contracts.slots[i];
  if (!c || c.empty || !c.done) return null;
  addCoins(c.coins); addPrestige(c.prestige);
  save.contracts.slots[i] = { empty: true, readyAt: Date.now() + ECON.contractRefillMin * 60000 };
  save.stats.contracts++;
  Sound.coin(4); persistNow();
  bus.emit('contract', save.stats.contracts);
  return c;
}
function replaceContract(i) {
  const c = save.contracts.slots[i];
  if (!c || c.empty || c.done || save.coins < ECON.contractReplace) return false;
  addCoins(-ECON.contractReplace);
  save.contracts.slots[i] = makeContract();
  persistNow();
  return true;
}
const contractsReady = () => (contractsOn() ? save.contracts.slots.filter(c => c && !c.empty && c.done).length : 0);

/* ---------------- Daily challenge (same seed for everyone each day) ---------------- */
function dailyOn() { return save.level >= FEATURES.daily; }
function dailyConfig(key = dayKey()) {
  const rng = mulberry32(hashStr('daily:' + key));
  const style = pick(rng, ['blue', 'red', 'green', 'gold', 'violet', 'teal']);
  const target = 12 + Math.floor(rng() * 14);
  const pool = DAILY_MODS.slice(), mods = [];
  const count = rng() < 0.45 ? 2 : 1;
  while (mods.length < count && pool.length) {
    const m = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    if (mods.some(x => x.id === 'purist') && m.id === 'norecall') continue;
    if (m.id === 'purist' && mods.some(x => x.id === 'norecall')) continue;
    mods.push(m);
  }
  const names = ['Harbour Sprint', 'Night Shift', 'Gull Tower', 'Pier Pressure', 'Tide Line', 'Crane Games', 'Salt Air', 'Dockside Dash'];
  return { key, style, target, mods, name: pick(rng, names), mult: 2 };
}
function dailyModObject(cfg) { const m = {}; for (const mod of cfg.mods) mod.apply(m); return m; }
function dailyStars(cfg, r) { if (!r.done) return 0; return r.pts >= cfg.target * 40 ? 3 : r.pts >= cfg.target * 28 ? 2 : 1; }
function dailyStreak() {
  const d = save.daily, today = dayKey();
  return d.last === today || d.last === addDays(today, -1) ? d.streak : 0;
}
const dailyCleared = () => !!save.daily.cleared[dayKey()];
function recordDaily(r) {
  const cfg = dailyConfig(r.daily), key = cfg.key, d = save.daily;
  const stars = dailyStars(cfg, r), prevBest = d.best[key] || 0;
  d.best[key] = Math.max(prevBest, r.pts);
  const out = { stars, best: d.best[key], newBest: r.pts > prevBest, first: false, coins: 0, prestige: 0, streak: dailyStreak() };
  if (r.done && !d.cleared[key]) {
    d.cleared[key] = stars || 1;
    d.streak = d.last === addDays(key, -1) ? d.streak + 1 : 1;
    d.last = key;
    const E = ECON.daily;
    out.first = true; out.streak = d.streak;
    out.coins = E.base + E.perStreak * Math.min(d.streak, E.streakCap) + E.perStar * stars;
    out.prestige = E.prestige;
    addCoins(out.coins); addPrestige(out.prestige);
    save.stats.dailies++;
    bus.emit('daily', d.streak);
  } else if (r.done) d.cleared[key] = Math.max(d.cleared[key] || 1, stars);
  // Keep a month of history.
  for (const k of Object.keys(d.best)) if (k < addDays(key, -40)) { delete d.best[k]; delete d.cleared[k]; }
  persistNow();
  return out;
}

/* ---------------- Weekly challenge (GDD §15): same tower, weather and crane for everyone all week ---------------- */
function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - y0) / 864e5 + 1) / 7)).padStart(2, '0')}`;
}
function weekEndsIn() { const d = new Date(), end = new Date(d); end.setHours(24, 0, 0, 0); end.setDate(end.getDate() + (7 - (d.getDay() || 7))); return end - d; }
const weeklyOn = () => save.level >= FEATURES.weekly;
function weeklyConfig(key = weekKey()) {
  const rng = mulberry32(hashStr('weekly:' + key));
  const style = pick(rng, ['navy', 'teal', 'orange', 'violet', 'brick', 'sky', 'obsidian', 'gold']);
  const target = 30 + Math.floor(rng() * 5) * 5;
  const pool = DAILY_MODS.filter(m => m.id !== 'oneshot' && m.id !== 'fog'), mods = [];
  while (mods.length < 2) { const m = pool.splice(Math.floor(rng() * pool.length), 1)[0]; if ((m.id === 'purist' && mods.some(x => x.id === 'norecall')) || (m.id === 'norecall' && mods.some(x => x.id === 'purist'))) continue; mods.push(m); }
  const weather = pick(rng, ['clear', 'wind', 'rain', 'storm', 'snow']);
  const names = ['Harbour Classic', 'Steel Week', 'Titan Tower', 'High Tide', 'Skyline Sprint', 'Crane Kings', 'Iron Lattice', 'Night Riveters'];
  const tiers = [target * 24, target * 32, target * 40];
  return { key, style, target, mods, weather, name: pick(rng, names), mult: 2.5, tiers };
}
function weeklyModObject(cfg) { const m = {}; for (const mod of cfg.mods) mod.apply(m); Object.assign(m, WEATHER[cfg.weather].mods || {}); m.weather = cfg.weather; return m; }
function weeklyState() { const w = save.weekly; if (w.key !== weekKey()) { w.key = weekKey(); w.best = 0; w.tiers = 0; } return w; }
const WEEKLY_TIERS = [['Bronze', 400, 4], ['Silver', 900, 8], ['Gold', 1800, 16]];
function recordWeekly(r) {
  const cfg = weeklyConfig(r.weekly), w = weeklyState();
  const prevBest = w.best; w.best = Math.max(w.best, r.pts);
  const reached = r.done ? cfg.tiers.filter(t => r.pts >= t).length : 0;
  const out = { best: w.best, newBest: r.pts > prevBest, tier: reached, newTiers: [], coins: 0, prestige: 0 };
  for (let i = w.tiers || 0; i < reached; i++) { const [name, c, p] = WEEKLY_TIERS[i]; out.newTiers.push(name); out.coins += c; out.prestige += p; }
  if (reached > (w.tiers || 0)) {
    if (reached === 3) save.stats.weeklyGolds = (save.stats.weeklyGolds || 0) + 1;
    w.tiers = reached; addCoins(out.coins); addPrestige(out.prestige);
    bus.emit('weekly', reached);
  }
  persistNow();
  return out;
}

/* ---------------- Sky Race (the classic Quick Game) ---------------- */
function recordRace(r) {
  const R = save.race, E = ECON.race;
  const coins = r.floors * E.perFloor + r.perfects * E.perPerfect;
  const record = r.floors > R.best;
  addCoins(coins);
  if (record) { R.best = r.floors; R.xs = r.xs; R.style = r.style; R.date = Date.now(); }
  R.bestPop = Math.max(R.bestPop, r.pts);
  save.stats.races++;
  persistNow();
  bus.emit('race', r.floors);
  return { coins, record, best: R.best };
}

/* ---------------- Achievements ---------------- */
const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
function unlockAch(id) {
  if (save.ach[id] || !ACH_BY_ID[id]) return;
  const a = ACH_BY_ID[id];
  save.ach[id] = Date.now();
  addPrestige(a.pr);
  toast(`Achievement: ${a.name} · +${a.pr} ✦`, 'ach');
  persist();
}
bus.on('floor', ev => {
  if (ev.kind === 'attract') return;
  if (ev.perfect) unlockAch('perfect1');
  if (ev.combo >= 5) unlockAch('combo5');
  if (ev.combo >= 10) unlockAch('combo10');
  if (ev.combo >= 20) unlockAch('combo20');
  if (ev.perfect && ev.hold >= 4) unlockAch('hold4');
  if (ev.perfect && ev.power > 1) unlockAch('power1');
  if (ev.perfect && ev.risk >= 8 - 1e-6) unlockAch('risk8');
});
bus.on('session', r => {
  if (r.powerPerfects >= 3) unlockAch('power3');
  if (r.kind === 'race') { if (r.floors >= 25) unlockAch('race25'); if (r.floors >= 50) unlockAch('race50'); if (r.floors >= 100) unlockAch('race100'); }
});
bus.on('recovery', ev => { if (ev.tier >= 1) unlockAch('save'); if (ev.tier >= 2) unlockAch('master'); if (ev.tier >= 4) unlockAch('legend'); });
bus.on('build', ev => {
  const s = save.stats;
  if (s.toppedOut >= 1) unlockAch('topout1');
  if (s.toppedOut >= 10) unlockAch('topout10');
  if (s.toppedOut >= 25) unlockAch('topout25');
  if (ev.stars === 3) unlockAch('star3');
  if (s.threeStars >= 10) unlockAch('star3x10');
  if (ev.done && ev.bp === 'spire') unlockAch('spire');
  if (ev.done && ev.bp === 'mega') unlockAch('mega');
});
bus.on('level', l => { if (l >= 10) unlockAch('level10'); if (l >= 20) unlockAch('level20'); });
bus.on('district', n => { if (n >= 3) unlockAch('district3'); if (n >= DISTRICTS.length) unlockAch('district8'); });
bus.on('daily', streak => { if (streak >= 3) unlockAch('daily3'); if (streak >= 7) unlockAch('daily7'); if (streak >= 30) unlockAch('daily30'); });
bus.on('contract', n => { if (n >= 10) unlockAch('contract10'); });
bus.on('stadium', n => { unlockAch('stage1'); if (n >= STADIUM.stages.length) unlockAch('stadium'); });
bus.on('weekly', tier => { if (tier >= 3) unlockAch('weekly1'); });
bus.on('renovate', () => { if ((save.stats.renos || 0) >= 5) unlockAch('reno5'); });
bus.on('build', ev => {
  if (ev.done && ev.weather === 'storm') unlockAch('storm');
  if (ev.done && ev.bp.startsWith('custom-')) unlockAch('designer');
  if (ev.tier >= 1 && STYLE_VARIANTS[ev.bp]) unlockAch('variant');
  if (ev.eventCoins > 0) unlockAch('event');
});
bus.on('place', ev => {
  if (ev.key === 'metro') unlockAch('metro');
  const placed = new Set(Object.values(save.lots).filter(b => b && b.place).map(b => b.place));
  if (placed.has('solar') && placed.has('wind')) unlockAch('clean');
});
function checkPopAchievements() { const p = population(); if (p >= 1000) unlockAch('pop1k'); if (p >= 10000) unlockAch('pop10k'); if (p >= 50000) unlockAch('pop50k'); }

/* ---------------- Cosmetics ---------------- */
const paintUnlocked = p => save.prestige >= p.need;
function setPaint(id) {
  const p = CRANE_PAINTS.find(c => c.id === id);
  if (!p || !paintUnlocked(p)) return false;
  save.cosmetics.crane = id; setCranePaint(id); persist();
  return true;
}
