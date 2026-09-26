'use strict';
/* ==================================================================== *
 * Interface: HUDs, floating text, sheets, modals and the results card. *
 * ==================================================================== */

const ICON = {
  coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#ffd257"/><circle cx="12" cy="12" r="6.3" fill="none" stroke="#b8860b" stroke-width="1.6"/></svg>',
  prestige: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.6 6.6L21.5 9l-5.3 4.5L18 20.5 12 16.8 6 20.5l1.8-7L2.5 9l6.9-.4z" fill="#c9a8ff"/></svg>',
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4-3 5.5-3 10a3 3 0 006 0c0-1.6-.8-2.6-.8-2.6S17 11 17 14.5A5 5 0 017 15c0-5.5 5-7 5-13z" fill="#ff8a2b"/></svg>',
};
const coinTxt = n => `<span class="coin">${ICON.coin}</span>${fmt(n)}`;
const starsHtml = (n, cls = 'small') => `<span class="stars ${cls}">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const styleColor = s => STYLES[s] ? STYLES[s].body : '#888';

/* ---------------- Floating text, banners, toasts ---------------- */
const pops = [];
const vProj = new T.Vector3();
function popupAt(text, wx, wy, wz, cls, delay = 0) {
  const el = document.createElement('div');
  el.className = 'pop ' + cls; el.textContent = text; el.style.opacity = '0';
  $('fx').appendChild(el);
  pops.push({ el, wx, wy, wz, t: -delay, life: cls === 'perfect' ? 1.2 : 1 });
}
function updatePops(dt) {
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.t += dt;
    if (p.t >= p.life) { p.el.remove(); pops.splice(i, 1); continue; }
    if (p.t < 0) continue;
    vProj.set(p.wx, p.wy, p.wz).project(camera);
    const k = p.t / p.life, rise = reduceMotion ? 0 : 30 * Math.min(1, k * 1.6);
    const px = (vProj.x * 0.5 + 0.5) * w, py = (-vProj.y * 0.5 + 0.5) * h - rise;
    p.el.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px) translate(-50%,-50%)`;
    p.el.style.opacity = String(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
  }
}
function flushToasts() { const q = toastQueue.splice(0); q.forEach(([t, c], i) => setTimeout(() => toast(t, c), 400 + i * 700)); }
function clearPops() { for (const p of pops) p.el.remove(); pops.length = 0; }
let bannerTimer = 0;
function banner(title, sub) {
  const b = $('banner');
  $('bannerTitle').textContent = title; $('bannerSub').textContent = sub || '';
  b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { b.hidden = true; }, 1950);
}
const toastQueue = [];
function toast(text, cls = '') {
  if (state === 'play' || state === 'pause' || state === 'fly') { toastQueue.push([text, cls]); return; }
  const el = document.createElement('div');
  el.className = 'toast ' + cls; el.textContent = text;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3300);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}

/* ---------------- Construction HUD ---------------- */
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
const LIFE_SVG = '<svg class="life" viewBox="0 0 10 7" aria-hidden="true"><rect x="2" y="1" width="6" height="4" fill="currentColor"/><rect x="0" y="5" width="10" height="2" fill="currentColor"/><rect x="4" y="0" width="2" height="1" fill="currentColor"/></svg>';
function updateBuildHud() {
  const g = game;
  if (!g || g.kind === 'attract') return;
  const n = g.tower.length, goal = g.target;
  if ($('lives').children.length !== g.mods.lives) $('lives').innerHTML = LIFE_SVG.repeat(g.mods.lives);
  $('hudBadge').innerHTML = goal ? `${n}<small>/${goal}</small>` : String(n);
  setText('hudLabel', g.kind === 'race' ? 'Sky Race' : g.kind === 'daily' ? 'Daily' : (g.bp ? g.bp.name : 'Floors'));
  $('gaugeBar').hidden = !goal;
  if (goal) {
    $('gaugeFill').style.setProperty('--c', styleColor(floorStyle(g)));
    $('gaugeFill').style.height = `calc(${Math.min(100, n / goal * 100).toFixed(1)}% - 4px)`;
  }
  setText('hudPop', fmt(g.pop));
  $('lives').setAttribute('aria-label', `${g.lives} of ${g.mods.lives} lives left`);
  [...$('lives').children].forEach((el, i) => el.classList.toggle('lost', i >= g.lives));
}
const LEVELS_UI = [['Stable', '●'], ['Moving', '◆'], ['Dangerous', '▲'], ['Critical', '✖']];
function updateLiveHud() {
  const g = game;
  if (!g || g.kind === 'attract') return;
  const c = g.combo, on = c.timer > 0 && state === 'play';
  $('combo').hidden = !on;
  if (on) { $('comboFill').style.width = (c.timer / CFG.comboTime * 100).toFixed(1) + '%'; setText('comboLabel', `Combo ×${c.streak}`); }
  const ch = g.charge, f = g.falling, box = $('mult');
  const showMult = state === 'play' && !!(ch || (f && (f.hold > 1 || f.power > 1)));
  box.hidden = !showMult;
  const special = g.hook.has && nextKind(g) === 'special' && g.bp;
  $('bpName').hidden = showMult;
  setText('bpName', special ? `${g.bp.special.name}: land it Perfect` : (g.daily ? dailyConfig(g.daily).name : ''));
  $('bpName').style.color = special ? 'var(--stable)' : '';
  if (showMult) {
    const hm = ch ? FORGE.hold.mult[holdBand(ch.t)] : f.hold, pm = ch ? 1 : f.power;
    setText('multVal', `×${(hm * pm).toFixed(1)}`);
    setText('multLbl', ch ? FORGE.hold.label[holdBand(ch.t)] : (f.power > 1 ? `Power ×${f.power}` : FORGE.hold.label[FORGE.hold.mult.indexOf(f.hold)] || ''));
    $('multBar').style.width = ch ? `${Math.min(100, ch.t / FORGE.hold.cap * 100).toFixed(1)}%` : '100%';
    box.className = 'mult glass' + (ch && ch.t >= FORGE.hold.warn ? ' warn' : '') + (!ch && f.power > 1 ? ' power' : '');
  }
  const lv = String(g.level);
  if ($('stab').dataset.level !== lv) { $('stab').dataset.level = lv; $('stabTxt').textContent = LEVELS_UI[g.level][0]; $('stabIco').textContent = LEVELS_UI[g.level][1]; }
}

/* ---------------- Coach tips (GDD §14 tutorial order) ---------------- */
let lastInput = touchDevice ? 'touch' : 'mouse';
const TIPS = {
  tap:     { touch: '<b>Tap</b> to drop the floor. Land it dead centre.', mouse: '<b>Click</b> to drop the floor. Land it dead centre.', key: 'Press <b>Space</b> to drop the floor. Land it dead centre.' },
  hold:    { touch: '<b>Press and hold</b>: the crane swings faster and your multiplier climbs. Let go to drop.', mouse: '<b>Click and hold</b>: the crane swings faster and your multiplier climbs. Let go to drop.', key: '<b>Hold Space</b>: the crane swings faster and your multiplier climbs. Release to drop.' },
  power:   { touch: 'While holding, <b>swipe down</b> for a Power Drop. It hits harder and multiplies again.', mouse: 'While holding, <b>drag down</b> for a Power Drop. It hits harder and multiplies again.', key: 'While holding Space, press <b>↓</b> for a Power Drop, or <b>Shift ↓</b> for maximum.' },
  recall:  { touch: 'Bad swing? While holding, <b>swipe up</b> to recall the floor. It costs one step of your combo.', mouse: 'Bad swing? While holding, <b>drag up</b> to recall the floor. It costs one step of your combo.', key: 'Bad swing? While holding Space, press <b>↑</b> to recall the floor. It costs one step of your combo.' },
  forced:  'Let go soon. At <b>3 seconds</b> the crane releases on its own.',
  sway:    'The building is swaying. Drop as the top swings back under the rope.',
  recover: 'The tower is swinging hard. <b>Perfect</b> floors calm it down, and a recovery pays a bonus.',
};
const coach = { id: null, t: 0 };
function showTip(id) {
  if (!save.settings.tips || save.tips[id] || coach.id === id || state !== 'play') return;
  if ((id === 'hold' || id === 'power' || id === 'recall' || id === 'forced') && !featureOn(id === 'forced' ? 'hold' : id)) return;
  if (coach.id && coach.t < 3) return;
  const tip = TIPS[id];
  coach.id = id; coach.t = 0;
  $('coach').innerHTML = typeof tip === 'string' ? tip : (tip[lastInput] || tip.touch);
  $('coach').hidden = false;
}
function doneTip(id) {
  if (!save.tips[id]) { save.tips[id] = true; persist(); }
  if (coach.id === id) { coach.id = null; $('coach').hidden = true; }
}
function hideCoach() { coach.id = null; $('coach').hidden = true; }

/* ---------------- City hub HUD ---------------- */
function updateHubHud() {
  const A = City.A || recomputeCity();
  const lp = levelProgress();
  setText('lvlNum', String(lp.l));
  $('lvlRing').setAttribute('stroke-dashoffset', (94.2 * (1 - lp.frac)).toFixed(1));
  setText('lvlNext', lp.next == null ? 'Top level' : `Level ${lp.l + 1} at ${fmtK(lp.next)}`);
  $('lvlBar').style.setProperty('--p', (lp.frac * 100).toFixed(1) + '%');
  const bank = Math.floor(save.bank);
  $('collectBtn').hidden = bank < 1;
  setText('collectTxt', `Collect ${fmt(bank)}`);
  for (const [k, id] of [['R', 'dR'], ['C', 'dC'], ['O', 'dO']]) {
    const v = A.demand[k], el = $(id);
    el.style.top = v >= 0 ? `${50 - v * 50}%` : '50%';
    el.style.bottom = v >= 0 ? '50%' : `${50 + v * 50}%`;
  }
  setText('happy', `${Math.round(A.happy * 100)}%`);
  setText('income', `${fmtK(City.rate)}/h`);
  const nc = contractsReady();
  $('badgeContracts').hidden = !nc; setText('badgeContracts', String(nc));
  $('btnContracts').style.opacity = contractsOn() ? '' : '0.55';
  $('badgeDaily').hidden = !(dailyOn() && !dailyCleared());
  $('btnDaily').style.opacity = dailyOn() ? '' : '0.55';
  const gh = nextGoal();
  if (hudCache.goalHtml !== gh) { hudCache.goalHtml = gh; $('goal').innerHTML = gh; }
}
// Coins, population and prestige count up instead of jumping.
const shown = { coins: null, pop: null, prestige: null };
function animateHubNumbers(dt) {
  const real = { coins: save.coins, pop: population(), prestige: save.prestige };
  for (const k of Object.keys(shown)) {
    if (shown[k] == null || reduceMotion) shown[k] = real[k];
    const d = real[k] - shown[k];
    shown[k] = Math.abs(d) < 0.5 ? real[k] : shown[k] + d * Math.min(1, dt * 5);
  }
  setText('hubPop', fmtK(shown.pop)); setText('hubCoins', fmtK(shown.coins)); setText('hubPrestige', fmtK(shown.prestige));
}
// Always show one clear next step (GDD §11: quickly see progress).
function nextGoal() {
  const A = City.A;
  if (!buildingsList().length) return 'Tap the glowing lot on <b>Harbor Row</b> to build your first homes.';
  if (contractsReady()) return `A contract is complete. <b>Tap Jobs</b> to claim it.`;
  if (save.bank >= 1 && save.bank >= incomeCap() * 0.99) return `Income storage is <b>full</b>. Collect it so your city keeps earning.`;
  if (save.bank >= 50) return `Your city has earned <b>${fmt(save.bank)}</b> coins. Tap <b>Collect</b>.`;
  const unfinished = buildingsList().find(([, b]) => !b.done);
  if (unfinished) return `<b>${BLUEPRINTS[unfinished[1].bp].name}</b> is unfinished. Tap it to continue building.`;
  if (A.demand.C > 0.3 && save.level >= BLUEPRINTS.market.level) return 'Residents want shops. Build a <b>Corner Market</b> next to your homes.';
  if (A.demand.O > 0.3 && save.level >= BLUEPRINTS.office.level) return 'Residents need jobs. Build an <b>Office Tower</b> near homes and shops.';
  if (A.demand.R > 0.3) return 'Jobs are going unfilled. Build more <b>homes</b>.';
  if (dailyOn() && !dailyCleared()) return "Today's <b>Daily Challenge</b> is waiting.";
  const open = LOTS.filter(l => save.districts[l.d] && !save.lots[l.id]).length;
  if (!open) { const d = DISTRICTS.find(x => !save.districts[x.id]); if (d) return d.level <= save.level ? `Room to grow: buy <b>${d.name}</b> for ${fmt(d.cost)} coins.` : `<b>${d.name}</b> opens at city level ${d.level}.`; }
  if (A.happy < 0.6 && save.level >= PLACEABLES.park.level) return 'Happiness is low. A <b>Park</b> raises it and nearby land value.';
  return `Beat your Sky Race record of <b>${save.race.best}</b> floors, or tap an empty lot to build.`;
}
// District and tower labels that follow the city camera.
const labelEls = {};
function labelEl(key, cls) {
  let el = labelEls[key];
  if (!el) { el = labelEls[key] = document.createElement('div'); el.className = cls; $('labels').appendChild(el); }
  return el;
}
function updateLabels(show) {
  const w = window.innerWidth, h = window.innerHeight;
  const place = (el, x, y, z) => {
    vProj.set(x, y, z).project(camera);
    const vis = vProj.z < 1 && Math.abs(vProj.x) < 1.2 && Math.abs(vProj.y) < 1.2;
    el.hidden = !vis;
    if (vis) el.style.transform = `translate(${((vProj.x * 0.5 + 0.5) * w).toFixed(0)}px,${((-vProj.y * 0.5 + 0.5) * h).toFixed(0)}px) translate(-50%,-50%)`;
  };
  for (const d of DISTRICTS) {
    const el = labelEl('d:' + d.id, 'dlabel');
    if (!show) { el.hidden = true; continue; }
    const owned = save.districts[d.id];
    const html = owned ? esc(d.name) : `${esc(d.name)}<small>${d.level > save.level ? `Level ${d.level}` : `${fmt(d.cost)} coins`}</small>`;
    if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; el.classList.toggle('locked', !owned); }
    place(el, d.col * BLOCK, 0.5, owned ? 38 : 0);
  }
  for (const lot of LOTS) {
    const b = buildingAt(lot.id);
    const el = labelEls['t:' + lot.id];
    if (!b || b.done || !show) { if (el) el.hidden = true; continue; }
    const e2 = labelEl('t:' + lot.id, 'tlabel warn');
    const txt = `${b.xs.length}/${b.target} ▲`;
    if (e2.textContent !== txt) e2.textContent = txt;
    place(e2, lot.x, b.xs.length * H * S + 3, lot.z);
  }
  for (const key of ['p:pier', 'p:record']) {
    const el = labelEl(key, 'dlabel');
    if (!show) { el.hidden = true; continue; }
    const rec = key === 'p:record';
    const html = rec ? `Record Pier<small>${save.race.best ? `${save.race.best} floors` : 'Set a Sky Race record'}</small>` : `Challenge Pier<small>Sky Race · Daily</small>`;
    if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
    const p = rec ? RECORD_PIER : PIER;
    place(el, p.x, 1, p.z + 20);
  }
}

/* ---------------- Sheet (lot actions) and modal ---------------- */
let sheetLot = null;
function openSheet(html, onMount) {
  const s = $('sheet');
  s.innerHTML = html; s.hidden = false; $('scrim').hidden = false;
  s.scrollTop = 0;
  if (onMount) onMount(s);
  const b = s.querySelector('.card:not([aria-disabled="true"]), .btn.primary, .btn');
  if (b && !touchDevice) b.focus({ preventScroll: true });
}
function closeSheet() { $('sheet').hidden = true; $('scrim').hidden = true; sheetLot = null; selectRing(null); }
let modalClose = null;
function openModal(html, onMount, onClose) {
  const m = $('modal');
  $('modalPanel').innerHTML = html; m.hidden = false; $('modalPanel').scrollTop = 0;
  modalClose = onClose || null;
  if (onMount) onMount($('modalPanel'));
  const x = $('modalPanel').querySelector('[data-close]');
  if (x) x.addEventListener('click', closeModal);
  const b = $('modalPanel').querySelector('.btn.primary, .btn');
  if (b && !touchDevice) b.focus({ preventScroll: true });
}
function closeModal() {
  if ($('modal').hidden) return;
  $('modal').hidden = true;
  const fn = modalClose; modalClose = null;
  if (fn) fn();
}
const head = (title, sub) => `<div class="head"><div><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div><button class="x" type="button" data-close aria-label="Close">✕</button></div>`;
function bind(root, sel, fn) { for (const el of root.querySelectorAll(sel)) el.addEventListener('click', e => { Sound.click(); fn(el, e); }); }

function estimate(key) { const bp = BLUEPRINTS[key]; return Math.round(bp.floors * 20 * bp.mult / 10) * 10; }
function bpCard(key, lot, check) {
  const bp = BLUEPRINTS[key];
  const cost = check.cost ?? permitCost(key);
  const status = check.ok ? (cost ? `Build ${coinTxt(cost)}` : 'Build · Free') : esc(check.reason);
  return `<button class="card" type="button" data-bp="${key}" aria-disabled="${!check.ok}">
    <i class="sw" style="--c:${styleColor(bp.style)}"></i>
    <span><b>${bp.name}</b><small>${ROLE_LABEL[bp.role]} · ${bp.floors} floors · ≈${fmt(estimate(key))} ${ROLE_NAMES[bp.role].split(' ')[0]}</small><small>${esc(bp.blurb)}</small></span>
    <span class="go">${status}</span></button>`;
}
function placeCard(key, lot) {
  const P = PLACEABLES[key], r = canPlace(key, lot);
  return `<button class="card" type="button" data-place="${key}" aria-disabled="${!r.ok}">
    <i class="sw" style="--c:${key === 'park' ? '#5c9a45' : key === 'plaza' ? '#cbbfa6' : key === 'bus' ? '#2f5d8a' : '#d83a2f'}"></i>
    <span><b>${P.name}</b><small>${esc(P.blurb)}</small></span>
    <span class="go">${r.ok ? `Place ${coinTxt(P.cost)}` : esc(r.reason)}</span></button>`;
}
function lotTitle(lot) { return `${DISTRICT_BY_ID[lot.d].name} · ${lot.row}${lot.col}`; }
function lotPills(lot) {
  const lv = City.lv[lot.id] || 1;
  return `<div class="pills"><span class="${lv > 1.05 ? 'good' : ''}">Land value ×${lv.toFixed(2)}</span>${lot.water ? '<span class="good">Waterfront</span>' : ''}${DISTRICT_BY_ID[lot.d].maxFloors ? `<span>Max ${DISTRICT_BY_ID[lot.d].maxFloors} floors</span>` : ''}</div>`;
}
function openLotSheet(lot, tab = 'towers') {
  sheetLot = lot; selectRing(lot);
  const d = DISTRICT_BY_ID[lot.d], b = save.lots[lot.id];
  if (!save.districts[lot.d]) {
    const r = canBuyDistrict(d);
    openSheet(`${head(d.name, esc(d.trait))}
      <div class="pills"><span>9 lots</span><span>Land value ×${d.lv.toFixed(2)}</span>${d.maxFloors ? `<span>Max ${d.maxFloors} floors</span>` : ''}</div>
      <p class="lede">${r.locked ? `This district opens at <b>city level ${d.level}</b>.` : `Buy the whole block for <b>${fmt(d.cost)}</b> coins.`}</p>
      <button class="btn primary" type="button" id="buyD" ${r.ok ? '' : 'disabled'}>${r.ok ? `Buy for ${fmt(d.cost)}` : esc(r.reason)}</button>`, s => {
      s.querySelector('[data-close]').addEventListener('click', closeSheet);
      bind(s, '#buyD', () => { if (buyDistrict(d)) { Sound.levelUp(); toast(`${d.name} is yours`, 'good'); rebuildLots(); closeSheet(); updateHubHud(); } });
    });
    return;
  }
  if (b && b.place) {
    const P = PLACEABLES[b.place];
    openSheet(`${head(P.name, lotTitle(lot))}${lotPills(lot)}<p class="lede">${esc(P.blurb)}</p>
      <button class="btn danger" type="button" id="rm">Remove (+${fmt(Math.round(P.cost * 0.5))})</button>`, s => {
      s.querySelector('[data-close]').addEventListener('click', closeSheet);
      bind(s, '#rm', el => { if (el.dataset.arm) { clearLot(lot); rebuildLots(); closeSheet(); updateHubHud(); } else { el.dataset.arm = 1; el.textContent = 'Tap again to remove'; } });
    });
    return;
  }
  if (b && b.bp && tab !== 'rebuild') { openBuildingSheet(lot, b); return; }
  const rebuild = tab === 'rebuild';
  const tabs = rebuild ? '' : `<div class="tabs" role="tablist"><button class="tab" role="tab" data-tab="towers" aria-selected="${tab === 'towers'}">Towers</button><button class="tab" role="tab" data-tab="places" aria-selected="${tab === 'places'}">Parks &amp; transit</button></div>`;
  let list;
  if (tab === 'places') list = Object.keys(PLACEABLES).map(k => placeCard(k, lot)).join('');
  else list = BP_KEYS.map(k => { const c = canBuild(k, lot); if (rebuild && c.reason === 'Lot in use') c.ok = true; return bpCard(k, lot, c); }).join('');
  openSheet(`${head(rebuild ? 'Rebuild' : 'Empty lot', lotTitle(lot))}${lotPills(lot)}${rebuild ? '<p class="lede">The new tower replaces the old one only if it is better (finished beats unfinished, then more capacity).</p>' : ''}${tabs}<div class="cards">${list}</div>`, s => {
    s.querySelector('[data-close]').addEventListener('click', closeSheet);
    bind(s, '[data-tab]', el => openLotSheet(lot, el.dataset.tab));
    bind(s, '[data-bp]', el => {
      const key = el.dataset.bp, c = canBuild(key, lot);
      if (!c.ok && !(rebuild && c.reason === 'Lot in use')) { Sound.deny(); toast(c.reason); return; }
      closeSheet(); startCityBuild(lot, key, false);
    });
    bind(s, '[data-place]', el => {
      const key = el.dataset.place, r = canPlace(key, lot);
      if (!r.ok) { Sound.deny(); toast(r.reason); return; }
      placeItem(key, lot); Sound.place(); rebuildLots(); burst(lot.x, 2, lot.z, 30, '#d9cfbd', 6, 3, 1.2, 3, false);
      closeSheet(); updateHubHud(); afterCityChange();
    });
  });
}
function openBuildingSheet(lot, b) {
  const bp = BLUEPRINTS[b.bp], caps = capsOf(b), total = capTotal(caps), occ = b.occ ?? 0;
  const roles = Object.entries(caps).filter(([, v]) => v > 0).map(([r, v]) => `<span>${fmt(v * occ)} / ${fmt(v)} ${ROLE_NAMES[r]}</span>`).join('');
  const date = new Date(b.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const contCost = Math.round(bp.cost * ECON.continueFee);
  const cont = !b.done ? canBuild(b.bp, lot, { cont: true }) : null;
  openSheet(`${head(bp.name, `${lotTitle(lot)} · ${ROLE_LABEL[bp.role]}`)}
    <div style="display:flex;align-items:center;gap:12px">${starsHtml(b.stars || 0)}<span class="sub">${b.done ? `Topped out · ${b.xs.length} floors` : `Unfinished · ${b.xs.length} of ${b.target} floors`}</span></div>
    <div class="pills">${roles}</div>
    <div class="meter" style="--c:var(--stable)" aria-label="Occupancy"><i style="width:${Math.round(occ * 100)}%"></i></div>
    <p class="sub">${Math.round(occ * 100)}% occupied, heading for ${Math.round((b.occT ?? occ) * 100)}%. ${lotPills(lot).replace(/<\/?div[^>]*>/g, '').replace(/<span[^>]*>/g, '').replace(/<\/span>/g, ' · ')}</p>
    <dl class="stats">
      <dt>Construction quality</dt><dd>${Math.round((b.quality || 0) * 100)}%</dd>
      <dt>Perfect floors</dt><dd>${fmt(b.perfects || 0)}</dd>
      <dt>Longest combo</dt><dd>${b.combo ? `×${b.combo}` : '–'}</dd>
      <dt>Power Perfects</dt><dd>${fmt(b.power || 0)}</dd>
      <dt>Strongest impact</dt><dd>${(b.strongest || 1).toFixed(1)}×</dd>
      ${bp.special ? `<dt>${bp.special.name} bonuses</dt><dd>${b.specials || 0}</dd>` : ''}
      <dt>Started</dt><dd>${date}</dd>
    </dl>
    ${b.recoveries && b.recoveries.length ? `<div class="chips">${b.recoveries.slice(-6).map(n => `<span>${esc(n)}</span>`).join('')}</div>` : ''}
    <div class="btns">
      ${!b.done ? `<button class="btn primary" type="button" id="cont" ${cont.ok ? '' : 'disabled'}>${cont.ok ? `Continue building · ${fmt(contCost)}` : esc(cont.reason)}</button>` : ''}
      <div class="btn-row"><button class="btn" type="button" id="rebuild">Rebuild</button><button class="btn danger" type="button" id="demo">Demolish (+${fmt(Math.round(bp.cost * ECON.demolishRefund))})</button></div>
    </div>`, s => {
    s.querySelector('[data-close]').addEventListener('click', closeSheet);
    bind(s, '#cont', () => { closeSheet(); startCityBuild(lot, b.bp, true); });
    bind(s, '#rebuild', () => openLotSheet(lot, 'rebuild'));
    bind(s, '#demo', el => { if (el.dataset.arm) { clearLot(lot); rebuildLots(); closeSheet(); updateHubHud(); Sound.place(); } else { el.dataset.arm = 1; el.textContent = 'Tap again to demolish'; } });
  });
}
function openPierSheet(record) {
  if (record) {
    openSheet(`${head('Record Pier', 'Your best Sky Race tower stands here')}
      <div class="big"><div><b>${save.race.best}</b><small>floors</small></div><div><b>${fmtK(save.race.bestPop)}</b><small>best points</small></div></div>
      <p class="lede">Beat your record in Sky Race and the tower here is rebuilt floor for floor.</p>
      <button class="btn primary" type="button" id="race">Play Sky Race</button>`, s => {
      s.querySelector('[data-close]').addEventListener('click', closeSheet);
      bind(s, '#race', () => { closeSheet(); startRace(); });
    });
    return;
  }
  openSheet(`${head('Challenge Pier', 'Practice and challenges, away from your city')}
    <div class="cards">
      <button class="card" type="button" id="race"><i class="sw" style="--c:#3cbf3c"></i><span><b>Sky Race</b><small>The classic endless game. Three misses and it's over. Best: ${save.race.best} floors.</small></span><span class="go">Play</span></button>
      <button class="card" type="button" id="daily" aria-disabled="${!dailyOn()}"><i class="sw" style="--c:#ffc21a"></i><span><b>Daily Challenge</b><small>Same challenge for everyone today. Keep your streak going.</small></span><span class="go">${dailyOn() ? (dailyCleared() ? 'Cleared' : 'Play') : `Level ${FEATURES.daily}`}</span></button>
    </div>`, s => {
    s.querySelector('[data-close]').addEventListener('click', closeSheet);
    bind(s, '#race', () => { closeSheet(); startRace(); });
    bind(s, '#daily', () => { if (!dailyOn()) { Sound.deny(); toast(`The Daily Challenge opens at city level ${FEATURES.daily}`); return; } closeSheet(); showDaily(); });
  });
}

/* ---------------- Modals ---------------- */
function unlockRows(list) {
  const kinds = { bp: 'Blueprint', place: 'Place', district: 'District', feature: 'New move' };
  return list.map(u => `<div><span>${esc(u.name)}</span><small>${kinds[u.type]}</small></div>`).join('');
}
function showLevelUps(ups, then) {
  if (!ups.length) { if (then) then(); return; }
  const u = ups[0];
  Sound.levelUp(); vib([20, 30, 20, 30, 60]);
  if (state === 'hub') fireworks(cam.look.x, 20, cam.look.z - 20, 6);
  openModal(`<div class="lvup panel" style="padding:0;background:none;border:0;backdrop-filter:none">
      <p class="eyebrow">City level</p><div class="num">${u.level}</div>
      <div class="rewards"><span>${ICON.coin}+${fmt(u.reward)}</span></div>
      ${u.unlocks.length ? `<h3>Unlocked</h3><div class="unlocks">${unlockRows(u.unlocks)}</div>` : ''}
      <button class="btn primary" type="button" data-close style="width:100%">Great</button></div>`, null, () => showLevelUps(ups.slice(1), then));
}
function showWelcome(info, then) {
  const lines = [];
  if (info.earned >= 1) lines.push(`Your city earned <b class="coin">${fmt(info.earned)}</b> coins while you were away. Tap <b>Collect</b>.`);
  const nc = contractsReady(); if (nc) lines.push(`${plural(nc, 'contract')} ready to claim.`);
  if (dailyOn() && !dailyCleared()) lines.push(`Today's challenge: <b>${esc(dailyConfig().name)}</b>. Streak: ${dailyStreak()}.`);
  const fill = buildingsList().filter(([, b]) => b.occ != null && b.occT - b.occ > 0.05).length;
  if (fill) lines.push(`${plural(fill, 'building')} still filling up.`);
  if (!lines.length) { if (then) then(); return; }
  openModal(`${head('Welcome back', `Away for ${fmtDuration(info.away * 1000)}`)}<div class="unlocks">${lines.map(l => `<div><span>${l}</span></div>`).join('')}</div><button class="btn primary" type="button" data-close>Let's build</button>`, null, then);
}
function showFirstRun() {
  openModal(`<p class="eyebrow">Welcome, builder</p><h2>Your city starts here</h2>
    <p class="lede">Every tower in Skyline Forge is built by you, floor by floor, and stays in your skyline for good. Start with some homes on <b>Harbor Row</b>. The first permit is free.</p>
    <ul class="howto"><li><b>Tap</b><span>Drop the swinging floor.</span></li><li><b>Perfect</b><span>Land it dead centre for more residents and a combo.</span></li><li><b>3 misses</b><span>The build stops. You can continue it later.</span></li></ul>
    <button class="btn primary" type="button" id="first">Build Starter Flats</button>`, p => {
    bind(p, '#first', () => { $('modal').hidden = true; modalClose = null; startCityBuild(LOT_BY_ID['harbor-C2'], 'flats', false); });
  });
}
function showContracts() {
  if (!contractsOn()) { Sound.deny(); toast(`Contracts open at city level ${FEATURES.contracts}`); return; }
  ensureContracts();
  const now = Date.now();
  const cards = save.contracts.slots.map((c, i) => {
    if (c.empty) return `<div class="card" aria-disabled="true"><i class="sw" style="--c:#555"></i><span><b>New contract</b><small>Arrives in ${fmtDuration(c.readyAt - now)}</small></span><span></span></div>`;
    const frac = c.target > 1 ? `${c.progress}/${c.target}` : '';
    return `<div class="card ${c.done ? 'done' : ''}"><i class="sw" style="--c:${c.done ? 'var(--stable)' : 'var(--accent)'}"></i>
      <span><b>${esc(c.text)}</b><small>Reward: <span class="coin">${fmt(c.coins)}</span> coins · <span class="prestige">+${c.prestige} ✦</span> ${frac ? `· ${frac}` : ''}</small>
      ${c.target > 1 ? `<span class="meter" style="--c:var(--accent);margin-top:6px;display:block"><i style="width:${Math.round(c.progress / c.target * 100)}%"></i></span>` : ''}</span>
      ${c.done ? `<button class="btn primary small" type="button" data-claim="${i}">Claim</button>` : `<button class="btn ghost small" type="button" data-swap="${i}" title="Replace for ${ECON.contractReplace} coins">Swap ${ECON.contractReplace}</button>`}</div>`;
  }).join('');
  openModal(`${head('Contracts', 'Clients want these built. New ones arrive every 15 minutes.')}<div class="cards">${cards}</div><p class="sub">Completed: ${fmt(save.stats.contracts)}</p>`, p => {
    bind(p, '[data-claim]', el => { const c = claimContract(+el.dataset.claim); if (c) { toast(`+${fmt(c.coins)} coins · +${c.prestige} ✦`, 'good'); ensureContracts(); showContracts(); updateHubHud(); } });
    bind(p, '[data-swap]', el => { if (replaceContract(+el.dataset.swap)) { showContracts(); updateHubHud(); } else { Sound.deny(); toast(`You need ${ECON.contractReplace} coins`); } });
  });
}
function showDaily() {
  if (!dailyOn()) { Sound.deny(); toast(`The Daily Challenge opens at city level ${FEATURES.daily}`); return; }
  const cfg = dailyConfig(), key = cfg.key, best = save.daily.best[key] || 0, cleared = save.daily.cleared[key] || 0;
  const streak = dailyStreak(), E = ECON.daily;
  const days = []; for (let i = 6; i >= 0; i--) { const k = addDays(key, -i); days.push(`<span class="${save.daily.cleared[k] ? 'on' : ''} ${i === 0 ? 'today' : ''}"><i></i>${keyToDate(k).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)}</span>`); }
  openModal(`${head(esc(cfg.name), `Daily Challenge · ${keyToDate(key).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`)}
    <div class="streak">${ICON.flame}<span>${streak ? `${streak}-day streak` : 'No streak yet'}</span></div>
    <div class="days">${days.join('')}</div>
    <div class="pills"><span class="gold">Build ${cfg.target} floors</span>${cfg.mods.map(m => `<span>${esc(m.name)}</span>`).join('')}</div>
    <ul class="howto">${cfg.mods.map(m => `<li><b>${esc(m.name)}</b><span>${esc(m.desc)}</span></li>`).join('')}</ul>
    <dl class="stats"><dt>Today's best</dt><dd>${best ? fmt(best) : '–'}</dd><dt>Stars</dt><dd>${starsHtml(cleared)}</dd>
    <dt>First clear today</dt><dd>${cleared ? 'Claimed' : `${coinTxt(E.base + E.perStreak * Math.min(streak + 1, E.streakCap))} + ${E.prestige} ✦`}</dd></dl>
    <p class="sub">★★ at ${fmt(cfg.target * 28)} points, ★★★ at ${fmt(cfg.target * 40)}. Retry as often as you like.</p>
    <button class="btn primary" type="button" id="go">${best ? 'Try again' : 'Start'}</button>`, p => {
    bind(p, '#go', () => { $('modal').hidden = true; modalClose = null; startDaily(); });
  });
}
function showTrophies(tab = 'ach') {
  const tabs = [['ach', 'Achievements'], ['mastery', 'Mastery'], ['crane', 'Crane'], ['stats', 'Records']];
  let body = '';
  if (tab === 'ach') {
    const n = Object.keys(save.ach).length;
    body = `<p class="sub">${n} of ${ACHIEVEMENTS.length} unlocked</p><div class="ach">${ACHIEVEMENTS.map(a => `<div class="${save.ach[a.id] ? 'on' : ''}"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small><small class="prestige">+${a.pr} ✦</small></div>`).join('')}</div>`;
  } else if (tab === 'mastery') {
    body = `<div class="cards">${BP_KEYS.map(k => { const bp = BLUEPRINTS[k], m = save.mastery[k] || { built: 0, stars: 0 }, locked = bp.level > save.level;
      return `<div class="card" aria-disabled="${locked}"><i class="sw" style="--c:${styleColor(bp.style)}"></i><span><b>${bp.name}</b><small>${locked ? `Unlocks at level ${bp.level}` : `Topped out ${plural(m.built, 'time')}`}</small></span>${starsHtml(m.stars)}</div>`; }).join('')}</div>`;
  } else if (tab === 'crane') {
    body = `<p class="sub">Prestige unlocks new paint for your crane. You have ${fmt(save.prestige)} ✦.</p><div class="cards">${CRANE_PAINTS.map(p => { const on = paintUnlocked(p), cur = save.cosmetics.crane === p.id;
      return `<button class="card" type="button" data-paint="${p.id}" aria-disabled="${!on}"><i class="sw" style="--c:${p.color}"></i><span><b>${p.name}</b><small>${on ? 'Unlocked' : `Needs ${p.need} ✦`}</small></span><span class="go">${cur ? 'In use' : on ? 'Use' : ''}</span></button>`; }).join('')}</div>`;
  } else {
    const s = save.stats;
    body = `<dl class="stats">
      <dt>Sky Race record</dt><dd>${save.race.best} floors</dd><dt>Best Sky Race points</dt><dd>${fmt(save.race.bestPop)}</dd>
      <dt>Buildings topped out</dt><dd>${fmt(s.toppedOut)}</dd><dt>Three-star buildings</dt><dd>${fmt(s.threeStars)}</dd>
      <dt>Floors placed</dt><dd>${fmt(s.floors)}</dd><dt>Perfect floors</dt><dd>${fmt(s.perfects)}</dd>
      <dt>Power Perfects</dt><dd>${fmt(s.powerPerfects)}</dd><dt>Longest combo</dt><dd>×${s.bestCombo}</dd>
      <dt>Recoveries</dt><dd>${fmt(s.recoveries)}</dd><dt>Daily clears</dt><dd>${fmt(s.dailies)}</dd>
      <dt>Contracts completed</dt><dd>${fmt(s.contracts)}</dd><dt>Districts owned</dt><dd>${Object.keys(save.districts).length} / ${DISTRICTS.length}</dd></dl>`;
  }
  openModal(`${head('Trophies', `${fmt(save.prestige)} prestige ✦`)}<div class="tabs" role="tablist">${tabs.map(([k, n]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${k === tab}">${n}</button>`).join('')}</div>${body}`, p => {
    bind(p, '[data-tab]', el => showTrophies(el.dataset.tab));
    bind(p, '[data-paint]', el => { if (setPaint(el.dataset.paint)) showTrophies('crane'); else Sound.deny(); });
  });
  seenTrophies = Object.keys(save.ach).length;
}
let seenTrophies = 0;
function showSettings(onDone) {
  const S2 = save.settings;
  const sw = (id, label, on, small) => `<label class="setting"><span>${label}${small ? `<small>${small}</small>` : ''}</span><span class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span></span></span></label>`;
  openModal(`${head('Settings')}
    ${sw('sClassic', 'Classic controls', S2.classic, 'Drop the moment you touch, like the phone original. Turns off hold, Power Drop and recall.')}
    ${sw('sSfx', 'Sound effects', S2.sfx)}${sw('sMusic', 'Music', S2.music)}${sw('sHaptics', 'Vibration', S2.haptics)}
    ${sw('sShake', 'Camera shake', S2.shake)}${sw('sTips', 'Tips while building', S2.tips)}${sw('sBig', 'Larger text', S2.bigText)}
    <label class="setting">Time of day<select id="sTod"><option value="auto">Match my clock</option><option value="day">Day</option><option value="sunset">Sunset</option><option value="night">Night</option></select></label>
    <label class="setting">Graphics<select id="sQuality"><option value="auto">Auto</option><option value="high">High</option><option value="balanced">Balanced</option><option value="battery">Battery saver</option></select></label>
    <div class="btn-row"><button class="btn" type="button" id="sHow">How to play</button><button class="btn" type="button" id="sTipsReset">Replay tips</button></div>
    <button class="btn ghost danger" type="button" id="sReset">Reset all progress</button>
    <button class="btn primary" type="button" data-close>Done</button>`, p => {
    const map = { sClassic: 'classic', sSfx: 'sfx', sMusic: 'music', sHaptics: 'haptics', sShake: 'shake', sTips: 'tips', sBig: 'bigText' };
    for (const [id, key] of Object.entries(map)) p.querySelector('#' + id).addEventListener('change', e => {
      save.settings[key] = e.target.checked; persist(); Sound.apply();
      if (key === 'haptics' && e.target.checked) vib(20);
      if (key === 'bigText') document.body.classList.toggle('big', e.target.checked);
    });
    p.querySelector('#sTod').value = S2.tod; p.querySelector('#sQuality').value = S2.quality;
    p.querySelector('#sTod').addEventListener('change', e => { save.settings.tod = e.target.value; persist(); applyTimeOfDay(); });
    p.querySelector('#sQuality').addEventListener('change', e => { save.settings.quality = e.target.value; persist(); applyQuality(); });
    bind(p, '#sHow', () => showHowto(() => showSettings(onDone)));
    bind(p, '#sTipsReset', el => { save.tips = {}; save.settings.tips = true; persist(); el.textContent = 'Tips reset'; });
    bind(p, '#sReset', el => {
      if (el.dataset.arm) { try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem('skyline-forge/v2'); } catch (e) { /* ignore */ } location.reload(); }
      else { el.dataset.arm = 1; el.textContent = 'Tap again: this erases your city'; }
    });
  }, onDone);
}
function showHowto(onDone) {
  openModal(`${head('How to play')}
    <ul class="howto">
      <li><b>Tap</b><span>Drop the floor. It falls straight down from where it hangs.</span></li>
      <li><b>Perfect</b><span>Land within a hair of centre for bonus points and a combo. Perfects calm a swaying tower.</span></li>
      <li><b>Hold</b><span>Level ${FEATURES.hold}: the crane swings faster and your multiplier climbs to ×4. Let go to drop. At 3 seconds it drops itself.</span></li>
      <li><b>Hold + swipe ↓</b><span>Level ${FEATURES.power}: Power Drop, ×1.25 to ×2.5. Heavy and risky off centre, but a centred one settles the tower.</span></li>
      <li><b>Hold + swipe ↑</b><span>Level ${FEATURES.recall}: recall the floor for another swing. Costs one combo step.</span></li>
      <li><b>Keyboard</b><span>Space to drop (hold to charge), ↓ for Power Drop, ↑ to recall, Esc to pause.</span></li>
    </ul>
    <h3>Your city</h3>
    <p class="lede">Every tower you top out moves people in. Homes need jobs and shops nearby, offices need workers. Watch the <b>R C O</b> demand bars, keep people happy with parks and transit, and collect income when you come back. Population raises your city level and unlocks new blueprints, districts and moves.</p>
    <button class="btn primary" type="button" data-close>Got it</button>`, null, onDone);
}
function showCityInfo() {
  const A = City.A, lp = levelProgress();
  const next = []; for (let l = save.level + 1; l <= Math.min(MAX_LEVEL, save.level + 3); l++) for (const u of unlocksAt(l)) next.push({ ...u, name: `${u.name} (level ${l})` });
  openModal(`${head(`City level ${lp.l}`, lp.next == null ? 'Top level reached' : `${fmt(population())} of ${fmt(lp.next)} residents for level ${lp.l + 1}`)}
    <div class="meter"><i style="width:${(lp.frac * 100).toFixed(1)}%"></i></div>
    <dl class="stats">
      <dt>Residents</dt><dd>${fmt(A.pop)}</dd><dt>Jobs filled</dt><dd>${fmt(A.filled)} of ${fmt(A.jobs)}</dd>
      <dt>Hotel guests</dt><dd>${fmt(A.guests)}</dd><dt>Happiness</dt><dd>${Math.round(A.happy * 100)}%</dd>
      <dt>Unemployment</dt><dd>${Math.round(A.unemployment * 100)}%</dd><dt>Income</dt><dd>${fmt(City.rate)} coins/hour</dd>
      <dt>Income storage</dt><dd>up to ${ECON.incomeCapHours} hours</dd></dl>
    ${next.length ? `<h3>Coming up</h3><div class="unlocks">${unlockRows(next)}</div>` : ''}
    <button class="btn primary" type="button" data-close>Close</button>`);
}

/* ---------------- Results ---------------- */
function showResults(r, sum) {
  const bp = r.bp ? BLUEPRINTS[r.bp] : null;
  let eyebrow, title, capLabel, stars = 0, primary, secondary, note = '';
  const rewards = [];
  const rows = [];
  const q = Math.round(r.quality * 100);
  if (r.kind === 'city') {
    eyebrow = `${bp.name} · ${lotTitle(LOT_BY_ID[r.site.id])}`;
    title = r.done ? 'Topped out!' : 'Construction stopped';
    stars = sum.stars;
    const roles = Object.keys(sum.caps).filter(k => sum.caps[k] > 0);
    capLabel = roles.length === 1 ? ROLE_NAMES[roles[0]] : 'capacity';
    rewards.push(`<span>${ICON.coin}+${fmt(sum.coins)}</span>`);
    if (sum.prestige) rewards.push(`<span>${ICON.prestige}+${fmt(sum.prestige)}</span>`);
    note = sum.kept ? `Your earlier ${BLUEPRINTS[sum.prev.bp].name} was better, so it stays.` : r.done ? (sum.firstTop ? `First ${bp.name}! Residents are moving in.` : 'Residents are moving in.') : 'The unfinished tower still counts. Tap it in the city to continue.';
    primary = ['Back to city', () => leaveSession()];
    secondary = r.done ? ['Build another', () => leaveSession(true)] : ['Continue now', () => { const lot = LOT_BY_ID[r.site.id]; const c = canBuild(r.bp, lot, { cont: true }); if (c.ok) startCityBuild(lot, r.bp, true); else { Sound.deny(); toast(c.reason); } }];
  } else if (r.kind === 'race') {
    eyebrow = 'Sky Race'; title = sum.record ? 'New record!' : `${r.floors} floors`;
    capLabel = 'points';
    rewards.push(`<span>${ICON.coin}+${fmt(sum.coins)}</span>`);
    note = sum.record ? 'Your Record Tower on the pier has been rebuilt to match.' : `Record: ${sum.best} floors.`;
    primary = ['Race again', () => startRace()]; secondary = ['City', () => leaveSession()];
  } else {
    const cfg = dailyConfig(r.daily);
    eyebrow = `Daily Challenge · ${cfg.name}`; title = r.done ? 'Challenge cleared' : 'Not this time';
    stars = sum.stars; capLabel = 'points';
    if (sum.coins) rewards.push(`<span>${ICON.coin}+${fmt(sum.coins)}</span>`);
    if (sum.prestige) rewards.push(`<span>${ICON.prestige}+${fmt(sum.prestige)}</span>`);
    if (sum.first) rewards.push(`<span>${ICON.flame}${sum.streak}-day streak</span>`);
    note = sum.newBest ? `New best today: ${fmt(sum.best)}.` : `Today's best: ${fmt(sum.best)}.`;
    primary = ['Try again', () => startDaily()]; secondary = ['City', () => leaveSession()];
  }
  rows.push(['Construction quality', `${q}%`], ['Structural stability', `${Math.round((1 - r.peakSway) * 100)}%`], ['Perfect floors', r.perfects], ['Longest combo', r.maxCombo ? `×${r.maxCombo}` : '–']);
  if (r.powerPerfects) rows.push(['Power Perfects', r.powerPerfects]);
  if (r.strongest > 1.05) rows.push(['Strongest impact', `${r.strongest.toFixed(1)}×`]);
  if (r.bestRisk > 1.01) rows.push(['Highest risk', `×${r.bestRisk.toFixed(1)}`]);
  if (bp && bp.special && r.specialPerfects) rows.push([`${bp.special.name} bonuses`, `+${Math.round(r.specialPerfects * FORGE.specialBonus * 100)}%`]);
  if (sum.bonus > 1.001 && r.kind === 'city') rows.push(['District and floor bonus', `+${Math.round((sum.bonus - 1) * 100)}%`]);
  $('resEyebrow').textContent = eyebrow; $('resTitle').textContent = title;
  $('resHeight').textContent = r.target ? `${r.floors}/${r.target}` : String(r.floors);
  $('resHeightSub').textContent = `floors · ${Math.round(r.floors * H * S)} m`;
  $('resCap').textContent = fmt(r.kind === 'city' ? (sum.kept ? r.pts : capTotal(sum.caps)) : r.pts);
  $('resCapSub').textContent = r.kind === 'city' && sum.cont ? `${capLabel} in total` : capLabel;
  $('resRewards').innerHTML = rewards.join('');
  const dl = $('resStats'); dl.innerHTML = '';
  for (const [k, v] of rows) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = String(v); dl.append(dt, dd); }
  $('resChips').innerHTML = r.recoveries.map(n => `<span>${esc(n)}</span>`).join('');
  $('resChips').hidden = !r.recoveries.length;
  $('resNote').textContent = note;
  $('resStars').hidden = r.kind === 'race';
  const st = [...$('resStars').children];
  st.forEach(i => i.classList.remove('on'));
  st.forEach((el, i) => { if (i < stars) setTimeout(() => { el.classList.add('on'); Sound.star(i); vib(15); }, 450 + i * 380); });
  $('resPrimary').textContent = primary[0]; $('resPrimary').onclick = () => { Sound.click(); primary[1](); };
  $('resSecondary').textContent = secondary[0]; $('resSecondary').onclick = () => { Sound.click(); secondary[1](); };
  show('result');
}
function renderTitle() {
  const has = buildingsList().length;
  $('titleLede').innerHTML = has
    ? `Population <b>${fmt(population())}</b> · level <b>${save.level}</b>. Your city is waiting.`
    : 'Drop floors from the swinging crane, stack them straight, and build a whole city tower by tower.';
  $('btnPlay').textContent = has ? 'Continue' : 'Play';
  $('btnTitleDaily').disabled = !dailyOn();
  const bits = [];
  if (save.race.best) bits.push(`Sky Race record ${save.race.best} floors`);
  if (dailyOn()) bits.push(dailyCleared() ? `Daily cleared · ${dailyStreak()}-day streak` : dailyStreak() ? `Daily ready · keep your ${dailyStreak()}-day streak` : 'Daily Challenge ready');
  $('bestLine').textContent = bits.join(' · ');
}
