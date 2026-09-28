// The HUD, laid out like the phone original: the combo meter across the top (a multiplier chip
// that pops on every step up and a draining bar that flashes on a refill and pulses when it is
// about to run out), the combo payout (it springs in, counts up, then floats away), the floors
// built (with a bar filling toward the next ten) and three hearts bottom-left, the population
// bottom-right (it counts up and bumps as each resident gets in, shakes when they fall), the hold
// meter while the button is held (multiplier, risk and how long until it drops by itself), the
// sound button, the first-round hint, and at the end of a round the number of floors built (it
// pops up and counts up). Styles are in hud/hud.css.
(() => {
'use strict';
const { $, fmt, clamp, easeOut } = SS;

const HUD = {
  countUp: 0.45,      // seconds the payout and the floors-built count take to count up
  popRate: 12,        // 1/s: how fast the population shown catches up with the real count
  low: 0.25,          // bar share left at which the combo bar starts to pulse
};

SS.screen.stage.insertAdjacentHTML('beforeend', `
  <div id="hud">
    <button class="icon-btn" id="soundBtn" type="button" aria-label="Mute sound" aria-pressed="false">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path class="spk" d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z"/><path class="on" d="M15.6 9.2a4 4 0 0 1 0 5.6M18.2 6.6a7.6 7.6 0 0 1 0 10.8"/><path class="off" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>
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
      <div class="stat floors" id="gauge">
        <svg class="stat-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V5.5A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V21M15 10h3.5a1.5 1.5 0 0 1 1.5 1.5V21M3 21h18M8.5 8h3M8.5 12h3M8.5 16h3"/></svg>
        <span class="floors-body">
          <span class="stat-num"><b id="floorsNum">0</b><small>/<span id="gaugeBadge">10</span></small></span>
          <span class="floors-bar"><i id="gaugeFill"></i></span>
        </span>
      </div>
      <div class="stat lives" id="lives"></div>
    </div>
    <div class="hud-br stat" aria-label="Residents">
      <svg class="stat-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3.3 19.5c.6-3.4 2.9-5.4 5.7-5.4s5.1 2 5.7 5.4"/><circle cx="17" cy="9.2" r="2.5"/><path d="M15.4 14.5c.5-.2 1-.2 1.6-.2 2.2 0 4 1.6 4.5 4.4"/></svg>
      <span class="stat-num hud-pop" id="hudPop">0</span>
      <span class="pop-loss" id="popLoss" aria-hidden="true"></span>
    </div>
  </div>
  <p class="tip" id="tip">Tap to drop · hold to swing faster<small>Drag up and let go to cancel</small></p>`);

const hud = $('hud');
const HEART = '<svg class="life" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.6-4.6-9.3-9.4C1.6 7.7 3.6 4.3 7.1 4.3c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.5 0 5.5 3.4 4.4 6.6-1.7 4.8-9.3 9.4-9.3 9.4z"/></svg>';
$('lives').innerHTML = HEART.repeat(SS.lives.LIVES.count);
$('bonus').style.setProperty('--bonus-time', SS.combo.COMBO.bonusShow + 's');

const now = () => performance.now() / 1000;
// Restart a one-off CSS animation on an element.
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// The population shown follows the real count every frame (quickly, a step at a time), so it
// never falls behind however many residents arrive.
const pop = { shown: 0, to: 0, last: 0 };
function setPop(value, instant) {
  if (instant) { pop.shown = pop.to = value; $('hudPop').textContent = fmt(value); return; }
  if (value === pop.to) return;
  replay($('hudPop'), value > pop.to ? 'bump' : 'drop');
  pop.to = value;
}
// Residents lost when floors fell: the number floats up from the population in red.
function popLoss(n) {
  if (n <= 0) return;
  $('popLoss').textContent = '−' + n;
  replay($('popLoss'), 'show');
}

// Floors, population and lives: called whenever one of them changes.
function update(g) {
  const n = g.tower.length, goal = (Math.floor(n / 10) + 1) * 10;
  $('floorsNum').textContent = n;
  $('gaugeBadge').textContent = goal;                       // the next ten floors, like the original's target gauge
  $('gaugeFill').style.width = (n % 10) * 10 + '%';
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
    const { HOLD: H, WARN_AT, CAP } = SS.hold, warn = ch.t >= WARN_AT, text = '×' + H.mult[ch.step].toFixed(1);
    const label = ch.cancel ? 'Let go to cancel' : warn ? `Drops in ${Math.max(0, CAP - ch.t).toFixed(1)}s` : H.label[ch.step];
    if ($('holdX').textContent !== text) { $('holdX').textContent = text; if (ch.step) replay($('holdX'), 'pop'); }
    if ($('holdLabel').textContent !== label) $('holdLabel').textContent = label;
    $('holdFill').style.width = Math.min(100, ch.t / CAP * 100).toFixed(1) + '%';
    $('hold').dataset.step = ch.step;
    $('hold').classList.toggle('warn', warn);
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
  const dt = Math.min(0.1, t - pop.last); pop.last = t;
  if (pop.shown !== pop.to) {
    const gap = pop.to - pop.shown, step = Math.max(1, Math.round(Math.abs(gap) * Math.min(1, dt * HUD.popRate)));
    pop.shown += Math.sign(gap) * Math.min(step, Math.abs(gap));
    $('hudPop').textContent = fmt(pop.shown);
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

SS.hud = { HUD, update, frame, showBonus, showBuilt, popLoss, hideTip, show };
})();
