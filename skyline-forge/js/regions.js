'use strict';
/* ==================================================================== *
 * Regions (GDD §11): found new cities in other climates. The city you  *
 * are in lives in the top-level save fields; the others wait in        *
 * save.regions and keep earning (up to the usual storage) while away.  *
 * ==================================================================== */

const CITY_FIELDS = ['lots', 'districts', 'level', 'bank', 'stadium', 'airport', 'freeFlats'];
const regionNow = () => REGION_BY_ID[save.region] || REGIONS[0];
const freshCity = () => ({ lots: {}, districts: { harbor: true }, level: 1, bank: 0, stadium: { stage: 0, parts: {} }, airport: { stage: 0, parts: {} }, freeFlats: true });
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
  save.peak = Math.max(save.peak || 1, save.level);
  save.regions[save.region] = snapshotCity();
  delete save.regions[id];
  for (const k of CITY_FIELDS) save[k] = c[k] ?? freshCity()[k];
  save.region = id;
  City.A = null; City.lv = {}; City.ctx = null;
  applyRegionLook(regionNow().look);
  rebuildLots(); for (const P of Object.values(PROJECTS)) P.rebuild(true);
  recomputeCity();
  const away = Math.max(0, (Date.now() - (c.at || Date.now())) / 1000);
  if (away > 5) tickCity(Math.min(away, 7 * 24 * 3600));       // it kept filling up and earning while you were gone
  persistNow();
  return true;
}

// The map itself lives in menus.js (showWorldMap).
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
