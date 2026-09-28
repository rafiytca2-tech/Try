// Lives: three per round. A miss costs one and breaks the combo (no bonus); the last one ends
// the round (round/ending.js plays out the end). Quick Finger (mode/mode.js) has none: a miss
// knocks time off its clock instead (score/combo.js).
(() => {
'use strict';

const LIVES = {
  count: 3,
  overSoundDelay: 500,    // ms
};

function init(g) { g.lives = SS.mode.rules().lives ? LIVES.count : 0; g.finished = false; }

function lose(g) {
  SS.sound.miss();
  if (!SS.mode.rules().lives) { SS.combo.knock(g); SS.crane.reload(g, true); return; }
  g.lives--;
  SS.combo.lose(g);
  if (g.lives <= 0) { SS.ending.start(g); setTimeout(() => SS.sound.over(), LIVES.overSoundDelay); }
  else SS.crane.reload(g, true);
  SS.hud.update(g);
}

SS.lives = { LIVES, init, lose };
})();
