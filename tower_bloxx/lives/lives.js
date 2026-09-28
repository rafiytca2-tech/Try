// Lives: three per round. A miss costs one and breaks the combo (no bonus); the last one ends
// the round (round/ending.js plays out the end).
(() => {
'use strict';

const LIVES = {
  count: 3,
  overSoundDelay: 500,    // ms
};

function init(g) { g.lives = LIVES.count; g.finished = false; }

function lose(g) {
  g.lives--;
  SS.combo.lose(g);
  SS.sound.miss();
  if (g.lives <= 0) { SS.ending.start(g); setTimeout(() => SS.sound.over(), LIVES.overSoundDelay); }
  else SS.crane.reload(g, true);
  SS.hud.update(g);
}

SS.lives = { LIVES, init, lose };
})();
