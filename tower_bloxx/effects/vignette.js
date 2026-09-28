// Vignette: the edges of the view darken a little, drawing the eye to the middle. Drawn last,
// over the whole scene (the HUD sits above it).
(() => {
'use strict';
const { ctx, view } = SS.screen;

const VIGNETTE = {
  clear: 0.55,                  // share of the way out from the middle that stays clear
  color: '6,10,30',
  strength: 0.32,               // darkness at the corners
};

let cache = null;
function draw() {
  const { w, h } = view, V = VIGNETTE;
  if (!cache || cache.w !== w || cache.h !== h) {
    const r = Math.hypot(w, h) / 2, grad = ctx.createRadialGradient(w / 2, h / 2, r * V.clear, w / 2, h / 2, r);
    grad.addColorStop(0, `rgba(${V.color},0)`); grad.addColorStop(1, `rgba(${V.color},${V.strength})`);
    cache = { w, h, grad };
  }
  ctx.fillStyle = cache.grad; ctx.fillRect(0, 0, w, h);
}

SS.vignette = { VIGNETTE, draw };
})();
