// A round: setting up a fresh game from every part's starting state, and the results card at
// the end of the sequence round/ending.js plays out (floors, residents, perfect drops, longest
// combo, best tower). Styles are in round/result.css.
(() => {
'use strict';
const { $, fmt } = SS;

SS.screen.stage.insertAdjacentHTML('beforeend', `
  <section id="result" class="screen" hidden>
    <div class="card">
      <p class="eyebrow">Game over</p>
      <h2 id="resTitle">0 floors</h2>
      <dl class="stats" id="resStats"></dl>
      <p class="note" id="resNote"></p>
      <button id="btnAgain" class="btn" type="button">Play again</button>
    </div>
  </section>`);

const round = { state: 'play', start, finish };   // state: 'play' | 'result'

// Every part adds its own starting state to the new round.
function newGame(prev) {
  const g = {};
  SS.tower.init(g);
  SS.crane.init(g, prev);
  SS.hold.init(g);
  SS.fall.init(g);
  SS.miss.init(g);
  SS.lives.init(g);
  SS.ending.init(g);
  SS.landing.init(g);
  SS.residents.init(g);
  SS.combo.init(g);
  SS.sway.init(g);
  SS.tenants.init(g);
  SS.stars.init(g);
  SS.twinkles.init(g);
  SS.dust.init(g);
  SS.collapse.init(g);
  SS.camera.init(g);
  return g;
}

function start() {
  SS.game = newGame(SS.game);
  round.state = 'play';
  $('result').hidden = true;
  SS.hud.show(true);
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  SS.hud.update(SS.game);
}

function finish(g) {
  if (g.finished) return;
  g.finished = true;
  const { save, persist } = SS.storage;
  const n = g.tower.length;
  const bestF = n > save.best.floors, bestP = g.pop > save.best.pop;
  if (bestF) save.best.floors = n;
  if (bestP) save.best.pop = g.pop;
  persist();
  $('resTitle').textContent = `${n} ${n === 1 ? 'floor' : 'floors'}`;
  const stats = [
    ['Residents', fmt(g.pop)],
    ['Perfect drops', g.perfects],
    ['Longest combo', g.maxCombo > 1 ? `x${g.maxCombo}` : 'none'],
    ['Best tower', `${save.best.floors} ${save.best.floors === 1 ? 'floor' : 'floors'}`],
  ];
  $('resStats').innerHTML = '';
  for (const [k, v] of stats) {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = k; dd.textContent = v;
    $('resStats').append(dt, dd);
  }
  $('resNote').textContent = bestF ? 'New tallest tower.' : bestP ? 'New population record.' : '';
  round.state = 'result';
  SS.hud.show(false);
  $('result').hidden = false;
  $('btnAgain').focus({ preventScroll: true });
}

SS.round = round;
})();
