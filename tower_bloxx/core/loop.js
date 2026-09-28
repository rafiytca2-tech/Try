// The game loop: what updates in which order, what draws on top of what, and starting up.
// Load this file last.
(() => {
'use strict';
const { ctx, view } = SS.screen;
const STEP = 1 / 120;   // fixed update step, seconds

function update(dt) {
  const g = SS.game;
  SS.hold.update(g, dt);
  SS.crane.update(g, dt);
  SS.sway.update(g, dt);
  SS.combo.update(g, dt);
  SS.fall.update(g, dt);
  SS.miss.update(g, dt);
  SS.collapse.update(g, dt);
  SS.dust.update(g, dt);
  SS.tenants.update(g, dt);
  SS.stars.update(g, dt);
  SS.twinkles.update(g, dt);
  SS.camera.update(g, dt);
  SS.ending.update(g, dt);
}

// Back to front.
function render() {
  const g = SS.game;
  ctx.setTransform(view.m, 0, 0, view.m, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const camY = g.camY;   // not rounded: the scene scrolls smoothly between pixels
  SS.sky.draw(camY);
  SS.city.draw(camY);
  SS.ground.draw(camY);
  SS.tower.draw(g, camY);
  SS.miss.draw(g, camY);
  SS.collapse.draw(g, camY);
  SS.fall.draw(g, camY);
  SS.dust.draw(g, camY);
  SS.twinkles.draw(g, camY);
  SS.tenants.draw(g, camY);
  SS.stars.draw(g, camY);
  SS.rigging.draw(g);
}

let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  SS.time += dt;
  acc += dt;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  SS.hud.frame(SS.game);
  render();
  requestAnimationFrame(frame);
}

SS.storage.load();
SS.input.setMuted(SS.storage.save.muted);
SS.screen.layout();
SS.round.start();
requestAnimationFrame(frame);
})();
