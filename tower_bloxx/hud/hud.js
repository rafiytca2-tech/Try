// The HUD, laid out like the phone original: the combo meter across the top (a multiplier chip
// that pops on every step up and a draining bar that flashes on a refill and pulses when it is
// about to run out), the combo payout (it springs in, counts up, then floats away), the floor
// gauge (badge shows the next ten) and three life squares bottom-left, the five-digit population
// bottom-right (it counts up and bumps as each resident gets in, shakes when they fall), the hold
// meter while the button is held (multiplier, risk and how long until it drops by itself), the
// sound button, the first-round hint, and at the end of a round the number of floors built (it
// pops up and counts up). Styles are in hud/hud.css.
(() => {
'use strict';
const { $, pad, clamp, easeOut } = SS;

const HUD = {
  countUp: 0.45,      // seconds the payout and the population take to count up
  low: 0.25,          // bar share left at which the combo bar starts to pulse
};

SS.screen.stage.insertAdjacentHTML('beforeend', `
  <div id="hud">
    <button class="icon-btn" id="soundBtn" type="button" aria-label="Mute sound" aria-pressed="false">
      <svg viewBox="0 0 9 9" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="3" width="2" height="3" fill="currentColor"/><rect x="2" y="2" width="1" height="5" fill="currentColor"/><rect x="3" y="1" width="1" height="7" fill="currentColor"/><g class="on"><rect x="5" y="3" width="1" height="3" fill="currentColor"/><rect x="7" y="2" width="1" height="5" fill="currentColor"/></g><g class="off"><rect x="5" y="3" width="1" height="1" fill="currentColor"/><rect x="6" y="4" width="1" height="1" fill="currentColor"/><rect x="7" y="5" width="1" height="1" fill="currentColor"/><rect x="7" y="3" width="1" height="1" fill="currentColor"/><rect x="5" y="5" width="1" height="1" fill="currentColor"/></g></svg>
    </button>
    <div class="combo" id="combo" hidden>
      <div class="combo-chip" id="comboChip"><span class="combo-word">Combo</span><b class="combo-x" id="comboLabel">×1</b></div>
      <div class="combo-track" id="comboTrack"><i id="comboFill"></i></div>
    </div>
    <div class="built" id="built" hidden aria-live="polite">
      <b class="built-num" id="builtNum">0</b>
      <span class="built-label" id="builtLabel">floors built</span>
    </div>
    <div class="hold" id="hold" hidden>
      <b class="hold-x" id="holdX">×1.0</b>
      <span class="hold-label" id="holdLabel">Safe</span>
      <span class="hold-track"><i id="holdFill"></i></span>
    </div>
    <div class="bonus" id="bonus" hidden aria-live="polite">
      <span class="bonus-ring"></span>
      <span class="bonus-label" id="bonusLabel"></span>
      <b class="bonus-num" id="bonusNum"></b>
    </div>
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
  <p class="tip" id="tip">Tap to drop · hold to swing faster<br>drag up and let go to cancel</p>`);

const hud = $('hud');
$('lives').innerHTML = '<i class="life"></i>'.repeat(SS.lives.LIVES.count);
$('bonus').style.setProperty('--bonus-time', SS.combo.COMBO.bonusShow + 's');

const now = () => performance.now() / 1000;
// Restart a one-off CSS animation on an element.
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// The population counts up (or down) to its new value.
const pop = { shown: 0, from: 0, to: 0, t0: 0 };
function setPop(value, instant) {
  if (value === pop.to && !instant) return;
  if (!instant) replay($('hudPop'), value > pop.to ? 'bump' : 'drop');
  pop.from = instant ? value : pop.shown; pop.to = value; pop.t0 = now();
  if (instant) { pop.shown = value; $('hudPop').textContent = pad(value, 5); }
}

// Floors, population and lives: called whenever one of them changes.
function update(g) {
  const n = g.tower.length, goal = (Math.floor(n / 10) + 1) * 10;
  $('gaugeBadge').textContent = goal;                       // the next ten floors, like the original's target gauge
  $('gaugeFill').style.height = `calc(${(n % 10) * 10}% - 2px)`;
  $('gauge').setAttribute('aria-label', `${n} ${n === 1 ? 'floor' : 'floors'}`);
  setPop(g.pop, g.pop === 0);
  $('lives').setAttribute('aria-label', `${g.lives} of ${SS.lives.LIVES.count} lives left`);
  [...$('lives').children].forEach((el, i) => el.classList.toggle('lost', i >= g.lives));
}

// The combo meter, the payout, the population and floors-built counts: every frame.
let lastN = 0, lastLeft = 0, bonus = null, built = null;
function frame(g) {
  const c = g && g.combo, on = !!(c && c.n > 0 && SS.round.state === 'play'), t = now();
  $('combo').hidden = !on;
  if (on) {
    const left = clamp(c.left, 0, 1);
    $('comboFill').style.width = (left * 100).toFixed(2) + '%';
    $('combo').classList.toggle('low', left < HUD.low);
    if (c.n !== lastN) { $('comboLabel').textContent = '×' + c.n; replay($('comboChip'), 'pop'); }
    if (lastN && left > lastLeft + 0.05) replay($('comboTrack'), 'refill');   // a perfect drop topped it up
    lastN = c.n; lastLeft = left;
  } else { lastN = 0; lastLeft = 0; }

  const ch = g && g.charge;                                   // the hold meter (hold/hold.js)
  $('hold').hidden = !ch;
  if (ch) {
    const H = SS.hold.HOLD, text = '×' + H.mult[ch.step].toFixed(1), label = ch.cancel ? 'Let go to cancel' : H.label[ch.step];
    if ($('holdX').textContent !== text) { $('holdX').textContent = text; if (ch.step) replay($('holdX'), 'pop'); }
    if ($('holdLabel').textContent !== label) $('holdLabel').textContent = label;
    $('holdFill').style.width = Math.min(100, ch.t / H.cap * 100).toFixed(1) + '%';
    $('hold').dataset.step = ch.step;
    $('hold').classList.toggle('warn', ch.t >= H.warn);
    $('hold').classList.toggle('cancel', ch.cancel);
  }

  $('bonus').hidden = !(g && g.bonusT > 0 && bonus);
  if (bonus && !$('bonus').hidden) {
    const v = Math.round(bonus.amount * easeOut(clamp((t - bonus.t0) / HUD.countUp, 0, 1)));
    if (v !== bonus.v) { bonus.v = v; $('bonusNum').textContent = '+' + v; }
  }
  if (built && built.v !== built.n) {
    const v = Math.round(built.n * easeOut(clamp((t - built.t0) / HUD.countUp, 0, 1)));
    if (v !== built.v) { built.v = v; $('builtNum').textContent = v; }
  }
  if (pop.shown !== pop.to) {
    const k = clamp((t - pop.t0) / HUD.countUp, 0, 1);
    pop.shown = k >= 1 ? pop.to : Math.round(pop.from + (pop.to - pop.from) * easeOut(k));
    $('hudPop').textContent = pad(pop.shown, 5);
  }
}

// A combo ran out and paid: amount residents for a combo of lastN.
function showBonus(amount) {
  bonus = { amount, t0: now(), v: -1 };
  $('bonusLabel').textContent = lastN > 1 ? `Combo ×${lastN}` : 'Combo';
  $('bonusNum').textContent = '+0';
  $('bonus').hidden = false;
  replay($('bonus'), 'show');
}
// End of the round: how many floors are standing.
function showBuilt(n) {
  built = { n, t0: now(), v: 0 };
  $('builtNum').textContent = '0';
  $('builtLabel').textContent = n === 1 ? 'floor built' : 'floors built';
  $('built').hidden = false;
  replay($('built'), 'show');
}

function hideTip() { $('tip').hidden = true; }
function show(on) {
  hud.hidden = !on;
  if (on) { $('built').hidden = true; built = null; }
}

SS.hud = { HUD, update, frame, showBonus, showBuilt, hideTip, show };
})();
