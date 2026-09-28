// A round: setting up a fresh game from every part's starting state, and the results card at
// the end of the sequence round/ending.js plays out (floors, then residents, perfect drops,
// longest combo and best tower with their icons, and a badge for a new record). Styles are in
// round/result.css.
(() => {
'use strict';
const { $, fmt } = SS;

// Line icons for the results card (24 x 24, drawn with the stroke).
const ICON = {
  floors: '<path d="M5 21V5.5A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V21M15 10h3.5a1.5 1.5 0 0 1 1.5 1.5V21M3 21h18M8.5 8h3M8.5 12h3M8.5 16h3"/>',
  residents: '<circle cx="9" cy="8" r="3.2"/><path d="M3.3 19.5c.6-3.4 2.9-5.4 5.7-5.4s5.1 2 5.7 5.4"/><circle cx="17" cy="9.2" r="2.5"/><path d="M15.4 14.5c.5-.2 1-.2 1.6-.2 2.2 0 4 1.6 4.5 4.4"/>',
  perfect: '<path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>',
  combo: '<path d="M12 21c-3.8 0-6.4-2.6-6.4-6.1 0-3.2 2.2-5.2 3.7-7 .4 1.7 1.4 2.8 2.4 3.2.1-3.3 1.3-6 3.6-8 .2 3 1.5 4.6 2.7 6.3 1 1.4 1.9 3 1.9 5.3 0 3.6-3.2 6.3-7.9 6.3z"/>',
  best: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5.5A2.5 2.5 0 0 0 8 10M16 6h2.5A2.5 2.5 0 0 1 16 10M12 13v3.5M8.5 20.5h7M9.5 20.5c0-2.2 1.1-4 2.5-4s2.5 1.8 2.5 4"/>',
  again: '<path d="M20 12a8 8 0 1 1-2.35-5.65M20 4.5V9h-4.5"/>',
};
const icon = (name, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

SS.screen.stage.insertAdjacentHTML('beforeend', `
  <section id="result" class="screen" hidden>
    <div class="card" role="dialog" aria-labelledby="resTitle">
      <p class="eyebrow">Game over</p>
      <h2 class="res-title" id="resTitle"><b id="resFloors">0</b><span id="resFloorsWord">floors</span></h2>
      <p class="note" id="resNote"></p>
      <ul class="stats" id="resStats"></ul>
      <button id="btnAgain" class="btn" type="button">${icon('again')}Play again</button>
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
  SS.rubble.init(g);
  SS.chips.init(g);
  SS.shake.init(g);
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
  $('resFloors').textContent = n;
  $('resFloorsWord').textContent = n === 1 ? 'floor' : 'floors';
  const stats = [
    ['residents', 'Residents', fmt(g.pop)],
    ['perfect', 'Perfect drops', g.perfects],
    ['combo', 'Longest combo', g.maxCombo > 1 ? `×${g.maxCombo}` : '—'],
    ['best', 'Best tower', `${save.best.floors} ${save.best.floors === 1 ? 'floor' : 'floors'}`],
  ];
  $('resStats').innerHTML = '';
  for (const [key, label, value] of stats) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="stat-badge">${icon(key)}</span><span class="stat-k"></span><b class="stat-v"></b>`;
    li.querySelector('.stat-k').textContent = label;
    li.querySelector('.stat-v').textContent = value;
    $('resStats').append(li);
  }
  $('resNote').innerHTML = bestF || bestP ? `${icon('best')}<span></span>` : '';
  if (bestF || bestP) $('resNote').querySelector('span').textContent = bestF ? 'New tallest tower' : 'New population record';
  round.state = 'result';
  SS.hud.show(false);
  $('result').hidden = false;
  $('btnAgain').focus({ preventScroll: true });
}

SS.round = round;
})();
