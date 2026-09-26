'use strict';
/* ==================================================================== *
 * Skyline Forge: shared helpers, dates, events and the save file.      *
 * The js/ files share one global scope in load order (see DESIGN.md).  *
 * ==================================================================== */

const $ = id => document.getElementById(id);
function fatal(msg) {
  for (const s of document.querySelectorAll('.screen, .hud')) s.hidden = true;
  $('fatalText').textContent = msg; $('fatal').hidden = false;
}
if (!window.THREE) { fatal('The 3D engine could not load. Check your connection and reload the page.'); throw new Error('three.js missing'); }
const T = THREE;

const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const touchDevice = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const easeInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const fmt = n => Math.round(n).toLocaleString('en-US');
function fmtK(n) {
  n = Math.round(n);
  if (Math.abs(n) < 10000) return n.toLocaleString('en-US');
  if (Math.abs(n) < 1e6) return (n / 1000).toFixed(n < 1e5 ? 1 : 0).replace(/\.0$/, '') + 'k';
  return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
}
const plural = (n, one, many = one + 's') => `${fmt(n)} ${n === 1 ? one : many}`;
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const lin = hex => new T.Color(hex).convertSRGBToLinear();
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- Dates (local calendar days) ---------------- */
function dayKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function keyToDate(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(key, n) { const d = keyToDate(key); d.setDate(d.getDate() + n); return dayKey(d); }
function fmtDuration(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/* ---------------- Event bus ---------------- */
// Game events ('floor', 'miss', 'recovery', 'session', 'build', 'place', 'level', 'daily', ...)
// feed contracts, achievements and the UI without the systems knowing about each other.
const bus = {
  handlers: {},
  on(name, fn) { (this.handlers[name] || (this.handlers[name] = [])).push(fn); },
  emit(name, data) { for (const fn of this.handlers[name] || []) { try { fn(data); } catch (e) { console.error(e); } } },
};

/* ---------------- Save file ---------------- */
const SAVE_KEY = 'skyline-forge/v3';
function defaultSave() {
  const now = Date.now();
  return {
    v: 3, created: now, seen: now,
    coins: 500, prestige: 0, level: 1, freeFlats: true,
    materials: 50,               // steel and concrete for big towers; Harbor Works and Perfect floors make more
    districts: { harbor: true },
    lots: {},                    // lot id -> building { bp, xs[], ... } or placeable { place }
    bank: 0,                     // income waiting to be collected
    stats: { builds: 0, toppedOut: 0, floors: 0, perfects: 0, powerPerfects: 0, bestCombo: 0, recoveries: 0, races: 0, dailies: 0, contracts: 0, parks: 0, threeStars: 0 },
    race: { best: 0, bestPop: 0, xs: null, style: 'green', date: 0 },
    daily: { streak: 0, last: '', best: {}, cleared: {} },
    contracts: { slots: [], made: 0 },
    ach: {},                     // achievement id -> unlock time
    mastery: {},                 // blueprint -> { built, stars }
    cosmetics: { crane: 'yellow' },
    settings: { classic: false, sfx: true, music: true, haptics: true, shake: !reduceMotion, tips: true, quality: 'auto', tod: 'auto', bigText: false, weather: 'live', contrast: false },
    tips: {},
    ftue: 0,                     // onboarding step: 0 new, 1 first build started, 2 done
    pending: null,               // a paid permit whose build hasn't finished (refunded on next start)
    seenAch: 0,                  // achievements already seen in Trophies (drives the badge)
    events: { active: null, next: 0, seen: 0 },   // rotating city events (meta.js)
    weekly: { key: '', best: 0, tiers: 0 },
    stadium: { stage: 0, parts: {} },            // the Harbor Stadium megaproject
    custom: [],                  // player-made blueprints
    overlay: '',                 // hub map overlay
    region: 'harbor',            // the city you are in; the others wait in regions{}
    regions: {},                 // region id -> that city's saved state while you're away
    peak: 1,                     // highest city level anywhere: your skills and features
  };
}
let save = defaultSave();

// The previous Skyline Forge (0.4) kept a best Quick Game and a 5x5 City Bloxx grid.
function migrateV2(d) {
  const s = defaultSave();
  if (d.best) { s.race.best = +d.best.floors || 0; s.race.bestPop = +d.best.pop || 0; }
  if (d.settings) for (const k of Object.keys(s.settings)) if (k in d.settings) s.settings[k] = d.settings[k];
  if (d.tips && typeof d.tips === 'object') Object.assign(s.tips, d.tips);
  const map = { blue: 'flats', red: 'market', green: 'office', gold: 'luxury' };
  const olds = Array.isArray(d.city) ? d.city.filter(b => b && map[b.type] && b.floors > 0) : [];
  const spots = ['C1', 'C2', 'C3', 'B1', 'B2', 'B3', 'A1', 'A2', 'A3'];
  olds.slice(0, spots.length).forEach((b, i) => {
    const bp = map[b.type], full = { flats: 8, market: 10, office: 16, luxury: 30 }[bp], n = Math.max(1, Math.min(+b.floors || 1, full));
    s.lots['harbor-' + spots[i]] = { bp, xs: Array(n).fill(0), target: full, done: n >= full, cap: +b.residents || n * 15, quality: 0.8, stars: n >= full ? 1 : 0, perfects: 0, combo: 0, power: 0, strongest: 1, recoveries: [], date: Date.now(), migrated: true };
  });
  if (olds.length) { s.ftue = 2; s.freeFlats = false; }
  return s;
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.v === 3) {
        const s = defaultSave();
        for (const k of Object.keys(s)) if (k in d) s[k] = (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) ? Object.assign(s[k], d[k]) : d[k];
        // Repair: a building's floor target is a whole number of floors.
        for (const b of Object.values(s.lots)) if (b && b.bp && BLUEPRINTS[b.bp] && !(Number.isInteger(b.target) && b.target >= 1)) b.target = BLUEPRINTS[b.bp].floors;
        // Skills follow your best city: saves from before regions only knew the one level.
        s.peak = Math.max(s.peak || 1, s.level || 1, ...Object.values(s.regions || {}).map(c => (c && c.level) || 1));
        save = s;
        return 'loaded';
      }
    }
    const old = JSON.parse(localStorage.getItem('skyline-forge/v2') || 'null');
    if (old && typeof old === 'object') { save = migrateV2(old); persistNow(); return 'migrated'; }
  } catch (e) { /* storage unavailable or corrupt: start fresh */ }
  return 'new';
}
let persistTimer = 0;
function persistNow() {
  clearTimeout(persistTimer); persistTimer = 0;
  save.seen = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}
// Batch writes: many small changes (coins, stats) land in one write.
function persist() { if (!persistTimer) persistTimer = setTimeout(persistNow, 400); }
window.addEventListener('pagehide', persistNow);

const vib = p => { if (save.settings.haptics && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* ignore */ } } };
