// Drawing primitives shared by every part that draws, and a seeded random generator for scenery
// that must look the same on every visit. Coordinates are game pixels. On the main canvas, flat
// rectangles are lined up with the screen's real pixels so neighbouring shapes never show seams;
// everything else is drawn smooth.
(() => {
'use strict';
const { clamp } = SS;

function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rect(g, color, x, y, w, h) {
  g.fillStyle = color;
  const s = g.__snap;
  if (!s) { g.fillRect(x, y, w, h); return; }
  const x0 = Math.round(x * s) / s, y0 = Math.round(y * s) / s;
  g.fillRect(x0, y0, Math.round((x + w) * s) / s - x0, Math.round((y + h) * s) / s - y0);
}
function rrect(g, color, x, y, w, h, r) {
  g.fillStyle = color;
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  g.fill();
}
function circle(g, x, y, r, color) { g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
function disc(g, cx, cy, r, color) { circle(g, cx, cy, r + 0.5, color); }   // same size as the old pixel discs
function line(g, color, x0, y0, x1, y1, width = 1, cap = 'round') {
  g.strokeStyle = color; g.lineWidth = width; g.lineCap = cap;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
}
function poly(g, color, pts) {
  g.fillStyle = color;
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath(); g.fill();
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => clamp(v + amt, 0, 255));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

SS.px = { canvasOf, rect, rrect, circle, disc, line, poly, shade, mulberry32 };
})();
