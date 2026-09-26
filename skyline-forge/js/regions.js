'use strict';
/* ==================================================================== *
 * Regions (GDD §11): found new cities in other climates. The city you  *
 * are in lives in the top-level save fields; the others wait in        *
 * save.regions and keep earning (up to the usual storage) while away.  *
 * ==================================================================== */

const CITY_FIELDS = ['lots', 'districts', 'level', 'bank', 'stadium', 'freeFlats'];
const regionNow = () => REGION_BY_ID[save.region] || REGIONS[0];
const freshCity = () => ({ lots: {}, districts: { harbor: true }, level: 1, bank: 0, stadium: { stage: 0, parts: {} }, freeFlats: true });
function snapshotCity() {
  const c = {};
  for (const k of CITY_FIELDS) c[k] = save[k];
  Object.assign(c, { rate: City.rate, cap: incomeCap(), pop: population(), at: Date.now() });
  return c;
}
// What an away city has waiting for you right now.
function awayBank(c) { return Math.max(c.bank || 0, Math.min(c.cap || 0, (c.bank || 0) + (c.rate || 0) * (Date.now() - (c.at || Date.now())) / 3600e3)); }
function canFound(R) {
  if (R.id === save.region || save.regions[R.id]) return { ok: false, reason: 'Founded', owned: true };
  if (skillLevel() < R.unlock) return { ok: false, reason: `City level ${R.unlock}`, locked: true };
  if (save.coins < R.cost) return { ok: false, reason: `${fmt(R.cost - save.coins)} more coins`, short: true };
  return { ok: true };
}
function foundRegion(id) {
  const R = REGION_BY_ID[id];
  if (!canFound(R).ok) return false;
  addCoins(-R.cost);
  save.regions[id] = Object.assign(freshCity(), { rate: 0, cap: 50, pop: 0, at: Date.now() });
  bus.emit('region', ownedCities());
  travelTo(id);
  return true;
}
function travelTo(id) {
  const c = save.regions[id];
  if (!c || id === save.region) return false;
  save.regions[save.region] = snapshotCity();
  delete save.regions[id];
  for (const k of CITY_FIELDS) save[k] = c[k] ?? freshCity()[k];
  save.region = id;
  City.A = null; City.lv = {}; City.ctx = null;
  applyRegionLook(regionNow().look);
  rebuildLots(); rebuildStadium(true);
  recomputeCity();
  const away = Math.max(0, (Date.now() - (c.at || Date.now())) / 1000);
  if (away > 5) tickCity(Math.min(away, 7 * 24 * 3600));       // it kept filling up and earning while you were gone
  persistNow();
  return true;
}

/* ---------------- The region map ---------------- */
function showRegions() {
  const cards = REGIONS.map(R => {
    const here = R.id === save.region, away = save.regions[R.id], f = canFound(R);
    let status, sub;
    if (here) { status = 'You are here'; sub = `${fmt(population())} residents · level ${save.level}`; }
    else if (away) { status = 'Travel'; sub = `${fmt(away.pop || 0)} residents · level ${away.level} · ${fmt(awayBank(away))} coins waiting`; }
    else if (f.locked) { status = `Level ${R.unlock}`; sub = R.climate; }
    else { status = f.ok ? `Found · ${fmtK(R.cost)}` : esc(f.reason); sub = `${R.climate} · founding costs ${fmt(R.cost)} coins`; }
    const col = R.look.grass[0];
    return `<button class="card ${here ? 'done' : ''}" type="button" data-region="${R.id}" aria-disabled="${here || (!away && !f.ok)}">
      <i class="sw" style="--c:${col}"></i><span><b>${esc(R.name)}</b><small>${esc(sub)}</small><small>${esc(R.trait)}</small></span><span class="go">${status}</span></button>`;
  }).join('');
  const n = ownedCities();
  openModal(`${head('Regions', `${n} of ${REGIONS.length} cities · trade adds +${Math.round(TRADE_BONUS * (n - 1) * 100)}% income everywhere`)}
    <p class="lede">Found new cities in other climates. Your coins, materials, skills, designs and trophies travel with you; each city has its own lots, level and income, and <b>every city you own adds ${Math.round(TRADE_BONUS * 100)}% trade income to all of them</b>.</p>
    <div class="cards">${cards}</div>`, p => {
    bind(p, '[data-region]', el => {
      const id = el.dataset.region, R = REGION_BY_ID[id];
      if (id === save.region) return;
      if (save.regions[id]) { closeModal(); regionTransition(() => travelTo(id)); return; }
      const f = canFound(R);
      if (!f.ok) { Sound.deny(); toast(f.locked ? `${R.name} opens when any of your cities reaches level ${R.unlock}` : f.reason); return; }
      if (el.dataset.arm) { closeModal(); regionTransition(() => { foundRegion(id); toast(`Welcome to ${R.name}. Your first permit is free.`, 'good'); }); }
      else { el.dataset.arm = 1; el.querySelector('.go').textContent = 'Tap again to found'; }
    });
  });
}
// Fade to black, swap cities, and fly in over the new harbour.
function regionTransition(fn) {
  const f = $('fade');
  f.hidden = false; f.classList.remove('out'); void f.offsetWidth; f.classList.add('in');
  Sound.horn();
  setTimeout(() => {
    fn();
    hubCam.tx = 0; hubCam.tz = 20; hubCam.d = 240; clampHub();
    hubPose(goalPose); cam.pos.copy(goalPose.pos).add(tmpA.set(0, 80, 60)); cam.look.copy(goalPose.look);
    state = 'fly'; $('hub').hidden = true;
    f.classList.remove('in'); f.classList.add('out');
    flyTo(hubPose, 1.4, () => { f.hidden = true; enterHub(); banner(regionNow().name, regionNow().climate); });
  }, 450);
}
