// The screen: the recording's 580x1280 phone shape, always 242 game pixels wide, so the tower,
// crane and tenants take up the same share of it on every device. On wide screens the stage is
// framed at that shape in the middle. The canvas has as many pixels as the screen really has, so
// everything is drawn sharp, and moving things sit between pixels for smooth motion.
(() => {
'use strict';
const { K, $ } = SS;

const SCREEN = {
  aspect: 580 / 1280,          // width / height of the recording
  width: Math.round(580 * K),  // game pixels across
  frameAbove: 0.62,            // wider than this (width / height) and the stage is framed
};

const stage = $('stage'), canvas = $('view'), ctx = canvas.getContext('2d', { alpha: false });
const view = { w: SCREEN.width, h: 535, scale: 1, m: 1 };

function layout() {
  const vw = window.innerWidth;
  const sh = stage.clientHeight || window.innerHeight;
  const framed = vw / sh > SCREEN.frameAbove;
  const sw = framed ? Math.round(sh * SCREEN.aspect) : vw;
  stage.style.width = sw + 'px';
  stage.style.left = Math.round((vw - sw) / 2) + 'px';
  stage.classList.toggle('framed', framed);
  const dpr = window.devicePixelRatio || 1;
  view.scale = sw / SCREEN.width;                           // CSS px per game pixel
  view.w = SCREEN.width; view.h = Math.ceil(sh / view.scale);
  view.m = view.scale * dpr;                                // screen pixels per game pixel
  canvas.width = Math.round(view.w * view.m); canvas.height = Math.round(view.h * view.m);
  canvas.style.width = sw + 'px';
  canvas.style.height = (view.h * view.scale) + 'px';
  stage.style.setProperty('--u', view.scale + 'px');
  ctx.__snap = view.m;                                      // flat shapes line up with screen pixels (core/pixels.js)
}

SS.screen = { SCREEN, stage, canvas, ctx, view, layout };
})();
