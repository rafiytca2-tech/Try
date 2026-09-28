// Lives: three per round. A miss costs one and breaks the combo (no bonus); the last one ends
// the round, and after a short pause the camera slides down to the street for the results.
(() => {
'use strict';

const LIVES = {
  count: 3,
  endDelay: 1.1,          // seconds from the last miss to the slide down
  overSoundDelay: 500,    // ms
};

function init(g) { g.lives = LIVES.count; g.ending = null; g.finished = false; }

function lose(g) {
  g.lives--;
  SS.combo.lose(g);
  SS.sound.miss();
  if (g.lives <= 0) { g.ending = { t: LIVES.endDelay }; setTimeout(() => SS.sound.over(), LIVES.overSoundDelay); }
  else SS.crane.reload(g, true);
  SS.hud.update(g);
}

function update(g, dt) {
  if (g.ending && !g.ending.started) {
    g.ending.t -= dt;
    if (g.ending.t <= 0 && !g.falling) { g.ending.started = true; SS.camera.startPan(g); }
  }
}

SS.lives = { LIVES, init, lose, update };
})();
