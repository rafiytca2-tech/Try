// Pixel-art drawing primitives shared by every part that draws, and a seeded random generator
// for scenery that must look the same on every visit.
(() => {
'use strict';
const { clamp } = SS;

function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rect(g, color, x, y, w, h) { g.fillStyle = color; g.fillRect(x, y, w, h); }
function pixLine(g, color, x0, y0, x1, y1, width = 1) {
  const dx = x1 - x0, dy = y1 - y0, steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  g.fillStyle = color;
  for (let i = 0; i <= steps; i++) g.fillRect(Math.round(x0 + dx * i / steps), Math.round(y0 + dy * i / steps), width, 1);
}
function disc(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) { const h = Math.floor(Math.sqrt(r * r - dy * dy)); g.fillRect(cx - h, cy + dy, h * 2 + 1, 1); }
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => clamp(v + amt, 0, 255));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

SS.px = { canvasOf, rect, pixLine, disc, shade, mulberry32 };
})();
