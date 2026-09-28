// The main screen: the game's name and, under it, a card for each game mode (mode/mode.js) with
// its icon, what it's about and the best tower built in it, all in the middle of the screen (the
// cards side by side when there's room). Picking one starts a round in that mode (round/round.js).
// The scene stays live behind it, the hook swinging over an empty site. The mode last played has
// the focus, so Enter or Space plays it again. Styles are in menu/menu.css.
(() => {
'use strict';
const { $ } = SS;

const MENU = {
  title: 'Skyline Stack',
  sub: 'Pick how you want to build',
};
// Each mode's icon (24 x 24, drawn with the stroke): a calm leaf, and a stopwatch.
const ICON = {
  relaxed: '<path d="M5 19c0-8 5.5-13 14-14-.5 8.5-5.5 14-13.5 14"/><path d="M5 19c3-4 6-6.5 9.5-8.5"/>',
  quick: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.8M10 3h4M12 3v2.5M18.2 6.8l1.4-1.4"/><path d="M12 13.5l2.6 1.8"/>',
};

SS.screen.stage.insertAdjacentHTML('beforeend', `
  <section id="menu" class="screen menu" hidden aria-labelledby="menuTitle">
    <div class="menu-box">
      <header class="menu-head">
        <h1 class="menu-title" id="menuTitle"></h1>
        <p class="menu-sub" id="menuSub"></p>
      </header>
      <div class="modes" id="modes" role="group" aria-label="Game mode"></div>
    </div>
  </section>`);
$('menuTitle').textContent = MENU.title;
$('menuSub').textContent = MENU.sub;

for (const id of SS.mode.ORDER) {
  const M = SS.mode.MODES[id], b = document.createElement('button');
  b.type = 'button'; b.className = 'mode'; b.dataset.mode = id;
  b.innerHTML = `<span class="mode-ico"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[id] || ''}</svg></span>
    <span class="mode-text"><b class="mode-name"></b><span class="mode-blurb"></span></span>
    <span class="mode-best"><small>Best</small><b></b></span>`;
  b.querySelector('.mode-name').textContent = M.name;
  b.querySelector('.mode-blurb').textContent = M.blurb;
  b.addEventListener('click', () => { SS.sound.ensure(); SS.round.start(id); });
  $('modes').append(b);
}

function show() {
  for (const b of $('modes').children) {
    const best = SS.storage.best(b.dataset.mode).floors;
    b.querySelector('.mode-best b').textContent = best || '—';
    b.querySelector('.mode-best').setAttribute('aria-label', best ? `Best tower ${best} ${best === 1 ? 'floor' : 'floors'}` : 'No tower yet');
  }
  $('menu').hidden = false;
  const last = $('modes').querySelector(`[data-mode="${SS.mode.id}"]`) || $('modes').firstElementChild;
  last.focus({ preventScroll: true });
}
function hide() { $('menu').hidden = true; }

SS.menu = { MENU, show, hide };
})();
