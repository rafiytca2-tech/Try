// What the browser remembers between visits: the best tower for each game mode, the mode last
// played and the mute switch.
(() => {
'use strict';
const KEY = 'skyline-stack/v1';
const save = { best: {}, mode: 'relaxed', muted: false };   // best: { [mode]: { floors, pop } }

function read() {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d && typeof d === 'object' ? d : {}; }
  catch (e) { return {}; }
}
const record = o => ({ floors: +(o && o.floors) || 0, pop: +(o && o.pop) || 0 });
function load() {
  const d = read(), b = d.best && typeof d.best === 'object' ? d.best : {};
  save.best = {};
  if ('floors' in b) save.best.relaxed = record(b);           // saved before there were modes
  for (const [id, o] of Object.entries(b)) if (o && typeof o === 'object') save.best[id] = record(o);
  if (typeof d.mode === 'string') save.mode = d.mode;
  save.muted = !!d.muted;
}
// The best tower in one mode (made on first ask).
const best = id => (save.best[id] ||= record(null));
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ ...read(), best: save.best, mode: save.mode, muted: save.muted })); }
  catch (e) { /* storage unavailable: play without saving */ }
}

SS.storage = { save, load, best, persist };
})();
