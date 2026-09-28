// What the browser remembers between visits: the best tower and the mute switch.
(() => {
'use strict';
const KEY = 'skyline-stack/v1';
const save = { best: { floors: 0, pop: 0 }, muted: false };

function read() {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d && typeof d === 'object' ? d : {}; }
  catch (e) { return {}; }
}
function load() {
  const d = read();
  if (d.best) save.best = { floors: +d.best.floors || 0, pop: +d.best.pop || 0 };
  save.muted = !!d.muted;
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ ...read(), best: save.best, muted: save.muted })); }
  catch (e) { /* storage unavailable: play without saving */ }
}

SS.storage = { save, load, persist };
})();
