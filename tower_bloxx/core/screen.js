// The screen: the stage fills the whole window on any device, in any orientation. The view is at
// least the recording's 243 game pixels across and SCREEN.height tall, scaled to fit whichever is
// tighter: a phone held upright shows the recording's width and more height, and anything wider
// (a phone on its side, a tablet, a desktop) shows the same height with more of the city on each
// side, the tower always in the middle. Only past SCREEN.maxWidth is the stage framed in the middle.
// The canvas has as many pixels as the screen really has (up to SCREEN.maxPixels, so very large
// screens stay quick), so everything is drawn sharp, and moving things sit between pixels.
(() => {
'use strict';
const { K, $ } = SS;

const SCREEN = {
  width: Math.round(580 * K),  // game pixels across at least: the recording's width
  height: 460,                 // game pixels top to bottom at least (the recording's shape is 536)
  maxWidth: 1400,              // game pixels across at most; wider than that and the stage is framed
  maxPixels: 4.5e6,            // canvas pixels at most
};

const stage = $('stage'), canvas = $('view'), ctx = canvas.getContext('2d', { alpha: false });
const view = { w: SCREEN.width, h: 536, scale: 1, m: 1 };

function layout() {
  const vw = window.innerWidth;
  const sh = stage.clientHeight || window.innerHeight;
  view.scale = Math.min(vw / SCREEN.width, sh / SCREEN.height);   // CSS px per game pixel
  view.w = Math.min(SCREEN.maxWidth, vw / view.scale);          // not rounded, so the stage fills the window exactly
  view.h = Math.ceil(sh / view.scale - 1e-6);
  const sw = view.w * view.scale, framed = sw < vw - 2;
  stage.style.width = sw + 'px';
  stage.style.left = Math.round((vw - sw) / 2) + 'px';
  stage.classList.toggle('framed', framed);
  const dpr = window.devicePixelRatio || 1;
  view.m = Math.min(view.scale * dpr, Math.sqrt(SCREEN.maxPixels / (view.w * view.h)));   // screen pixels per game pixel
  canvas.width = Math.round(view.w * view.m); canvas.height = Math.round(view.h * view.m);
  canvas.style.width = sw + 'px';
  canvas.style.height = (view.h * view.scale) + 'px';
  stage.style.setProperty('--u', view.scale + 'px');
  ctx.__snap = view.m;                                      // flat shapes line up with screen pixels (core/pixels.js)
}

SS.screen = { SCREEN, stage, canvas, ctx, view, layout };
})();
