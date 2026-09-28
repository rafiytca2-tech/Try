// The HUD, laid out like the phone original: the combo bar with its xN across the top, the
// blinking combo payout, the floor gauge (badge shows the next ten) and three life squares
// bottom-left, the five-digit population bottom-right, the sound button, and the first-round
// hint. Styles are in hud/hud.css.
(() => {
'use strict';
const { $, pad } = SS;

SS.screen.stage.insertAdjacentHTML('beforeend', `
  <div id="hud">
    <button class="icon-btn" id="soundBtn" type="button" aria-label="Mute sound" aria-pressed="false">
      <svg viewBox="0 0 9 9" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="3" width="2" height="3" fill="currentColor"/><rect x="2" y="2" width="1" height="5" fill="currentColor"/><rect x="3" y="1" width="1" height="7" fill="currentColor"/><g class="on"><rect x="5" y="3" width="1" height="3" fill="currentColor"/><rect x="7" y="2" width="1" height="5" fill="currentColor"/></g><g class="off"><rect x="5" y="3" width="1" height="1" fill="currentColor"/><rect x="6" y="4" width="1" height="1" fill="currentColor"/><rect x="7" y="5" width="1" height="1" fill="currentColor"/><rect x="7" y="3" width="1" height="1" fill="currentColor"/><rect x="5" y="5" width="1" height="1" fill="currentColor"/></g></svg>
    </button>
    <div class="combo" id="combo" hidden>
      <span class="combo-x outline" id="comboLabel"></span>
      <div class="combo-track"><i id="comboFill"></i></div>
    </div>
    <div class="bonus outline" id="bonus" hidden></div>
    <div class="hud-bl">
      <div class="gauge" id="gauge">
        <span class="gauge-badge" id="gaugeBadge">10</span>
        <span class="gauge-bar"><i id="gaugeFill"></i></span>
      </div>
      <div class="lives" id="lives"></div>
    </div>
    <div class="hud-br" aria-label="Residents">
      <svg viewBox="0 0 13 10" shape-rendering="crispEdges" aria-hidden="true"><rect x="1" y="0" width="4" height="4" fill="#ffb21a"/><rect x="0" y="4" width="6" height="4" fill="#f59a0c"/><rect x="1" y="8" width="1" height="2" fill="#f59a0c"/><rect x="4" y="8" width="1" height="2" fill="#f59a0c"/><rect x="2" y="1" width="1" height="1" fill="#6b3a05"/><rect x="8" y="0" width="4" height="4" fill="#ffb21a"/><rect x="7" y="4" width="6" height="4" fill="#f59a0c"/><rect x="8" y="8" width="1" height="2" fill="#f59a0c"/><rect x="11" y="8" width="1" height="2" fill="#f59a0c"/><rect x="10" y="1" width="1" height="1" fill="#6b3a05"/></svg>
      <span class="hud-pop outline" id="hudPop">00000</span>
    </div>
  </div>
  <p class="tip" id="tip">Tap, click or press Space to drop</p>`);

const hud = $('hud');
$('lives').innerHTML = '<i class="life"></i>'.repeat(SS.lives.LIVES.count);

// Floors, population and lives: called whenever one of them changes.
function update(g) {
  const n = g.tower.length, goal = (Math.floor(n / 10) + 1) * 10;
  $('gaugeBadge').textContent = goal;                       // the next ten floors, like the original's target gauge
  $('gaugeFill').style.height = `calc(${(n % 10) * 10}% - 2px)`;
  $('gauge').setAttribute('aria-label', `${n} ${n === 1 ? 'floor' : 'floors'}`);
  $('hudPop').textContent = pad(g.pop, 5);
  $('lives').setAttribute('aria-label', `${g.lives} of ${SS.lives.LIVES.count} lives left`);
  [...$('lives').children].forEach((el, i) => el.classList.toggle('lost', i >= g.lives));
}

// The combo bar and the payout: every frame.
let lastComboText = '';
function frame(g) {
  const c = g && g.combo, on = !!(c && c.n > 0 && SS.round.state === 'play');
  $('combo').hidden = !on;
  $('bonus').hidden = !(g && g.bonusT > 0);
  if (!on) return;
  $('comboFill').style.width = (Math.max(0, Math.min(1, c.left)) * 100).toFixed(1) + '%';
  const text = c.n >= 2 ? `x${c.n}` : '';
  if (text !== lastComboText) { $('comboLabel').textContent = text; lastComboText = text; }
}

function showBonus(amount) { $('bonus').textContent = '+' + pad(amount, 3); }
function hideTip() { $('tip').hidden = true; }
function show(on) { hud.hidden = !on; }

SS.hud = { update, frame, showBonus, hideTip, show };
})();
