// The game's shared namespace and a few helpers every part uses. Each other file adds its own
// part to SS (SS.crane, SS.tower, SS.tenants, ...). Load this file first.
//
// Units everywhere are game pixels and seconds. Motion was measured frame by frame from a 60 fps,
// 580x1280 phone recording of City Bloxx; K converts those recording pixels to game pixels
// (a 110 px floor there is a 46 px floor here).
window.SS = {
  K: 46 / 110,
  game: null,      // the round in play (round/round.js)
  time: 0,         // seconds since the page opened (core/loop.js)
  $: id => document.getElementById(id),
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  fmt: n => Math.round(n).toLocaleString('en-US'),
  pad: (n, d) => String(Math.max(0, Math.round(n))).padStart(d, '0'),
  easeOut: k => 1 - (1 - k) * (1 - k),
  pick: list => list[Math.floor(Math.random() * list.length)],
  reduceMotion: !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches),
};
