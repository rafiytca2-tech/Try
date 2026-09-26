'use strict';
/* ==================================================================== *
 * Menus in the style of the art sheet: world map, build list and info  *
 * card, missions with daily chests, events, city stats, the shop (in-  *
 * game currency only), the collection and the player profile.          *
 * ==================================================================== */

const imgTag = (src, alt = '') => (src ? `<img src="${src}" alt="${esc(alt)}" draggable="false">` : '');
const tabsHtml = (list, cur) => `<div class="tabs" role="tablist">${list.map(([k, n, ic]) => `<button class="tab" role="tab" type="button" data-tab="${k}" aria-selected="${k === cur}">${ic ? ICON[ic] : ''}${n}</button>`).join('')}</div>`;
const coinAmt = n => `<span class="coin">${ICON.coin}</span> ${fmt(n)}`;
const pct = v => `${Math.round(v * 100)}%`;

// Menus opened from the title screen that need the city (a lot to build on) go there first.
let afterHub = null;
function hubThen(fn) { if (state === 'hub') { fn(); return; } afterHub = fn; if (state !== 'fly') goToHub(); }
function focusLot(lot) { hubCam.tx = lot.x; hubCam.tz = lot.z + 10; }
// The free lot worth the most, optionally filtered.
function bestEmptyLot(test) {
  let best = null, bv = -1;
  for (const lot of LOTS) {
    if (!save.districts[lot.d] || save.lots[lot.id] || (test && !test(lot))) continue;
    const v = City.lv[lot.id] || 1;
    if (v > bv) { bv = v; best = lot; }
  }
  return best;
}

/* ---------------- Stars: every building's stars, per district and per city ---------------- */
function starsIn(lots, dId) {
  let got = 0, max = 0;
  for (const lot of LOTS) {
    if (lot.d !== dId) continue;
    const b = lots[lot.id];
    if (b && b.place) continue;                    // parks and stations don't need stars
    max += 3; if (b && b.bp) got += Math.min(3, b.stars || 0);
  }
  return [got, max];
}
function cityStars(c = save) {
  let got = 0, max = 0;
  for (const d of DISTRICTS) if (c.districts && c.districts[d.id]) { const [g, m] = starsIn(c.lots || {}, d.id); got += g; max += m; }
  return [got, max];
}

/* ---------------- World map ---------------- */
const WPOS = { harbor: [178, 470], tropic: [86, 382], desert: [272, 330], north: [92, 228], mountain: [262, 138], island: [118, 62] };
function islandSvg(R, owned, pop) {
  const [x, y] = WPOS[R.id] || [180, 280], L = R.look, g = L.grass;
  const parts = [`<ellipse cx="${x + 4}" cy="${y + 8}" rx="70" ry="36" fill="#1565c0" opacity=".45"/>`,
    `<ellipse cx="${x}" cy="${y}" rx="68" ry="36" fill="#f3dfa2" stroke="#fff" stroke-width="3"/>`,
    `<ellipse cx="${x}" cy="${y - 3}" rx="58" ry="28" fill="${g[0]}"/>`, `<ellipse cx="${x - 14}" cy="${y - 8}" rx="30" ry="13" fill="${g[2]}" opacity=".7"/>`];
  const palm = (px, py, s = 1) => `<path d="M${px} ${py}q${2 * s} ${-9 * s} ${-1 * s} ${-18 * s}" stroke="#8a5a2b" stroke-width="${2.6 * s}" fill="none"/><path d="M${px - s} ${py - 18 * s}c${-8 * s} ${-2 * s} ${-12 * s} ${3 * s} ${-13 * s} ${7 * s}M${px - s} ${py - 18 * s}c${8 * s} ${-3 * s} ${12 * s} ${1 * s} ${14 * s} ${6 * s}M${px - s} ${py - 18 * s}c${-3 * s} ${-7 * s} ${-9 * s} ${-9 * s} ${-12 * s} ${-8 * s}M${px - s} ${py - 18 * s}c${4 * s} ${-7 * s} ${10 * s} ${-8 * s} ${13 * s} ${-6 * s}" stroke="#2f9a3a" stroke-width="${3.2 * s}" fill="none" stroke-linecap="round"/>`;
  const pine = (px, py, s = 1) => `<path d="M${px} ${py - 22 * s}l${8 * s} ${14 * s}h${-4 * s}l${6 * s} ${9 * s}h${-20 * s}l${6 * s} ${-9 * s}h${-4 * s}z" fill="#2f6b3a" stroke="#123a2a" stroke-width="1"/><path d="M${px} ${py - 22 * s}l${4 * s} ${7 * s}h${-8 * s}z" fill="#fff"/>`;
  if (R.id === 'tropic') parts.push(palm(x - 26, y + 4), palm(x + 30, y + 2, 0.9), palm(x + 6, y + 12, 0.8));
  if (R.id === 'desert') parts.push(`<path d="M${x - 50} ${y + 6}q20 -22 40 0q18 -18 36 0q10 -10 24 0" fill="#e9c47a" stroke="#c99a4a" stroke-width="1.5"/>`, `<circle cx="${x + 22}" cy="${y - 10}" r="7" fill="#fff4dc" stroke="#c99a4a"/>`);
  if (R.id === 'north') parts.push(pine(x - 30, y + 6), pine(x - 16, y + 10, 0.8), pine(x + 34, y + 6, 0.9));
  if (R.id === 'mountain') parts.push(`<path d="M${x - 52} ${y + 6}l24 -44 24 44zM${x - 10} ${y + 6}l30 -58 30 58z" fill="#8d99a6" stroke="#4a5563" stroke-width="1.5" stroke-linejoin="round"/><path d="M${x - 28} ${y - 38}l8 14h-16zM${x + 20} ${y - 52}l10 19h-20z" fill="#fff"/>`, pine(x + 44, y + 12, 0.7));
  if (R.id === 'island') parts.push(`<ellipse cx="${x}" cy="${y - 3}" rx="36" ry="14" fill="#5fd6e0" stroke="#e8fbff" stroke-width="2"/>`, palm(x - 44, y + 8, 0.8), palm(x + 46, y + 6, 0.8));
  if (R.id === 'harbor') parts.push(`<path d="M${x + 44} ${y + 18}h26" stroke="#8d6a45" stroke-width="4"/>`);
  if (owned) {                                     // a little skyline that grows with the city
    const n = Math.max(2, Math.min(8, Math.round(Math.log10((pop || 0) + 10) * 1.8)));
    const cols = ['#5fb3ff', '#ff8a5a', '#ffc928', '#7fe15b', '#b57bff', '#ff6a5a', '#9fe8ff', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const bx = x - 6 * n + i * 12 + (R.id === 'mountain' ? 18 : 0), h = 10 + ((i * 37) % 7) * 4 + (i === (n >> 1) ? 10 : 0);
      parts.push(`<rect x="${bx}" y="${y + 6 - h}" width="10" height="${h}" rx="1.5" fill="${cols[i % cols.length]}" stroke="#123a78" stroke-width="1.3"/><path d="M${bx + 3} ${y + 10 - h}v${h - 8}M${bx + 7} ${y + 10 - h}v${h - 8}" stroke="#fff" stroke-width="1.2" stroke-dasharray="2 2"/>`);
    }
  }
  return parts.join('');
}
function regionInfo(R) {
  const here = R.id === save.region, away = save.regions[R.id], f = canFound(R);
  if (here) return { cls: 'here', pop: population(), level: save.level, stars: cityStars(save), label: 'You are here', act: 'Go to city' };
  if (away) return { cls: '', pop: away.pop || 0, level: away.level, stars: cityStars(away), label: 'Travel', act: `Travel · ${fmt(awayBank(away))} waiting` };
  if (f.locked) return { cls: 'locked', locked: true, label: `Unlock at Lv. ${R.unlock}`, act: `Opens at city level ${R.unlock}` };
  return { cls: 'new', label: fmtK(R.cost), act: f.ok ? `Found for ${fmt(R.cost)}` : f.reason, can: f.ok };
}
function showWorldMap(sel = save.region) {
  const W = 360, Hh = 540;
  const route = REGIONS.map(R => WPOS[R.id] || [180, 280]).map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  const waves = []; for (let i = 0; i < 26; i++) { const x = (i * 97) % 340 + 10, y = (i * 61) % 520 + 10; waves.push(`<path d="M${x} ${y}q5 -4 10 0q5 4 10 0" stroke="#fff" stroke-width="2" fill="none" opacity=".45"/>`); }
  const clouds = [[300, 250], [40, 150], [220, 30], [320, 470], [30, 480]].map(([x, y]) => `<g opacity=".85"><ellipse cx="${x}" cy="${y}" rx="22" ry="10" fill="#fff"/><ellipse cx="${x + 14}" cy="${y - 6}" rx="14" ry="10" fill="#fff"/><ellipse cx="${x - 12}" cy="${y - 3}" rx="10" ry="8" fill="#fff"/></g>`).join('');
  const islands = REGIONS.map(R => { const I = regionInfo(R); return islandSvg(R, !I.locked && I.cls !== 'new', I.pop); }).join('');
  const svg = `<svg viewBox="0 0 ${W} ${Hh}" aria-hidden="true">${waves.join('')}<path d="${route}" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round" opacity=".9"/>${islands}${clouds}</svg>`;
  const nodes = REGIONS.map(R => {
    const [x, y] = WPOS[R.id], I = regionInfo(R);
    const sub = I.stars ? `${ICON.star.replace('viewBox', 'width="14" height="14" viewBox')}${I.stars[0]}/${I.stars[1]}` : I.locked ? `${ICON.lock.replace('viewBox', 'width="14" height="14" viewBox')}${esc(I.label)}` : `${ICON.coin}${I.label}`;
    return `<button class="wnode ${I.cls} ${R.id === sel ? 'sel' : ''}" type="button" data-region="${R.id}" style="left:${(x / W * 100).toFixed(1)}%;top:${((y + 44) / Hh * 100).toFixed(1)}%">${esc(R.name)}<small>${sub}</small></button>`;
  }).join('');
  const [px, py] = WPOS[save.region] || [180, 280];
  const pin = `<svg class="wpin" viewBox="0 0 34 46" style="left:${(px / W * 100).toFixed(1)}%;top:${((py - 30) / Hh * 100).toFixed(1)}%"><path d="M17 2C9 2 3 8 3 16c0 11 14 27 14 27s14-16 14-27C31 8 25 2 17 2z" fill="#ff4d3d" stroke="#fff" stroke-width="3"/><circle cx="17" cy="16" r="5.5" fill="#fff"/></svg>`;
  const R = REGION_BY_ID[sel] || regionNow(), I = regionInfo(R), n = ownedCities();
  const detail = `<div class="whitebox"><h3>${esc(R.name)}</h3><p class="sub" style="color:var(--card-muted);margin:0 0 6px">${esc(R.climate)} · ${esc(R.trait)}</p>
    ${I.stars ? `<div class="starbar">${ICON.star}<span class="meter"><i style="width:${I.stars[1] ? Math.round(I.stars[0] / I.stars[1] * 100) : 0}%"></i></span>${I.stars[0]}/${I.stars[1]}</div><p class="sub" style="color:var(--card-muted);margin:4px 0 0">${fmt(I.pop)} residents · level ${I.level}</p>` : ''}
    <button class="btn ${I.cls === 'here' ? 'primary' : I.locked || (I.cls === 'new' && !I.can) ? '' : 'go'}" type="button" id="wGo" style="width:100%;margin-top:10px" ${I.locked || (I.cls === 'new' && !I.can) ? 'disabled' : ''}>${esc(I.act)}</button></div>`;
  openModal(`${head('World Map', `${n} of ${REGIONS.length} cities · trade +${Math.round(TRADE_BONUS * (n - 1) * 100)}% income everywhere`)}<div class="wmap">${svg}${nodes}${pin}</div>${detail}`, p => {
    p.classList.add('wide');
    bind(p, '[data-region]', el => { const id = el.dataset.region; if (id !== sel) showWorldMap(id); else regionAct(id); });
    bind(p, '#wGo', () => regionAct(sel));
  }, () => $('modalPanel').classList.remove('wide'));
}
const showRegions = () => showWorldMap();
function regionAct(id) {
  const R = REGION_BY_ID[id], shut = () => { $('modal').hidden = true; modalClose = null; $('modalPanel').classList.remove('wide'); };
  if (id === save.region) { shut(); hubThen(() => {}); return; }
  if (save.regions[id]) { shut(); hubThen(() => regionTransition(() => travelTo(id))); return; }
  const f = canFound(R);
  if (!f.ok) { Sound.deny(); toast(f.locked ? `${R.name} opens when any of your cities reaches level ${R.unlock}` : f.reason); return; }
  shut(); hubThen(() => regionTransition(() => { foundRegion(id); toast(`Welcome to ${R.name}. Your first permit is free.`, 'good'); }));
}

/* ---------------- Build list and the building info card ---------------- */
const BUILD_TABS = [['homes', 'Homes', 'res'], ['business', 'Business', 'off'], ['services', 'Services', 'svc'], ['special', 'Special', 'special'], ['places', 'Transit', 'transit'], ['utility', 'Utilities', 'util']];
const TAB_ROLES = { homes: ['res', 'hot'], business: ['com', 'off', 'ind'], services: ['edu', 'health', 'safety', 'ent'] };
function bpTab(key) {
  const bp = BLUEPRINTS[key];
  if (bp.role === 'landmark' || bp.role === 'mixed' || bp.unique) return 'special';
  for (const [t, roles] of Object.entries(TAB_ROLES)) if (roles.includes(bp.role)) return t;
  return 'special';
}
const tabKeys = tab => BP_KEYS.filter(k => bpTab(k) === tab);
const difficulty = bp => (bp.floors <= 12 ? 1 : bp.floors <= 36 ? 2 : 3);
function bpRow(key, lot, check) {
  const bp = BLUEPRINTS[key], locked = bp.level > save.level || (bp.contract && !save.bpUnlocks[key]);
  const cost = check.cost ?? permitCost(key), mat = check.mat ?? matCost(key);
  const lockTxt = bp.contract && !save.bpUnlocks[key] ? 'Contract' : `Lv. ${bp.level}`;
  return `<div class="row ${locked ? 'locked' : ''}" role="button" tabindex="0" data-info="${key}">
    <span class="thumb">${imgTag(thumbFor(key, chosenStyle(key)), bp.name)}</span>
    <span><b>${esc(bp.name)}</b><small>${ROLE_LABEL[bp.role]} · ${bp.floors} floors · ≈${fmt(estimate(key))} ${ROLE_NAMES[bp.role].split(' ')[0]}</small>
      <span class="cost">${ICON.coin}${cost ? fmt(cost) : 'Free'}${mat ? ` ${ICON.mat}${fmt(mat)}` : ''}</span>
      ${!locked && !check.ok ? `<small style="color:#c0392b">${esc(check.reason)}</small>` : ''}</span>
    ${locked ? `<span class="lock">${ICON.lock}${lockTxt}</span>` : `<button class="btn go small act" type="button" data-bp="${key}" ${check.ok || check.matShort ? '' : 'aria-disabled="true"'}>Build</button>`}</div>`;
}
function placeRow(key, lot) {
  const P = PLACEABLES[key], r = canPlace(key, lot), locked = P.level > save.level;
  return `<div class="row ${locked ? 'locked' : ''}" data-pinfo="${key}">
    <span class="thumb">${imgTag(thumbFor('place:' + key), P.name)}</span>
    <span><b>${esc(P.name)}</b><small>${esc(P.blurb)}</small><span class="cost">${ICON.coin}${fmt(P.cost)}</span>${!locked && !r.ok ? `<small style="color:#c0392b">${esc(r.reason)}</small>` : ''}</span>
    ${locked ? `<span class="lock">${ICON.lock}Lv. ${P.level}</span>` : `<button class="btn go small act" type="button" data-place="${key}" ${r.ok ? '' : 'aria-disabled="true"'}>Place</button>`}</div>`;
}
function tryBuild(key, lot) {
  const c = canBuild(key, lot);
  if (!c.ok && c.matShort) { offerMaterials(c.matShort, c.cost, () => { closeSheet(); startCityBuild(lot, key, false); }); return; }
  if (!c.ok) { Sound.deny(); toast(c.reason); return; }
  closeSheet(); $('modal').hidden = true; modalClose = null; startCityBuild(lot, key, false);
}
// The info card: a big thumbnail you can page through, the facts, facade choices and Build.
function showBpInfo(key, keys, lot, back) {
  const bp = BLUEPRINTS[key]; if (!bp) return;
  keys = (keys && keys.length ? keys : [key]).filter(k => BLUEPRINTS[k]);
  const i = Math.max(0, keys.indexOf(key)), m = save.mastery[key] || { built: 0, stars: 0 };
  const locked = bp.level > save.level || (bp.contract && !save.bpUnlocks[key]);
  const check = lot ? canBuild(key, lot) : null, tier = masteryTier(key), cur = chosenStyle(key);
  const fact = (ic, label, val) => `<div class="fact">${ICON[ic]}<span>${label}<b>${val}</b></span></div>`;
  const vars = (STYLE_VARIANTS[key] || []).map((st, k) => `<button class="vsw ${st === cur ? 'on' : ''}" type="button" data-var="${key}:${st}" aria-disabled="${k > tier}" aria-label="${st} facade" style="--c:${styleColor(st)}"></button>`).join('');
  const needs = (bp.needs || []).map(n => n === 'parkOrWater' ? 'a park or the waterfront' : NEED_TEXT[n]).join(' + ');
  const html = `${head(esc(bp.name), `${ROLE_LABEL[bp.role]}${bp.unique ? ' · one per city' : ''}${bp.contract ? ' · contract exclusive' : ''}`)}
    <div class="info">
      <div class="hero">${imgTag(thumbFor(key, cur), bp.name)}${keys.length > 1 ? `<button class="nav l" type="button" data-step="-1" aria-label="Previous">‹</button><button class="nav r" type="button" data-step="1" aria-label="Next">›</button>` : ''}</div>
      <div class="facts">${starsHtml(m.stars || 0)}
        ${fact('floors', 'Floors', bp.floors)}${fact('people', 'Base capacity', `≈${fmt(estimate(key))}`)}
        <div class="fact">${ICON.star}<span>Difficulty${starsHtml(difficulty(bp))}</span></div>
        ${lot ? fact('land', 'Land value', `${Math.round((City.lv[lot.id] || 1) * 100)}%`) : fact('land', 'Unlocks', locked ? (bp.contract && !save.bpUnlocks[key] ? 'By contract' : `Level ${bp.level}`) : 'Unlocked')}
        ${fact('coin', 'Cost', `${fmt(check ? check.cost : permitCost(key))}${matCost(key) ? ` + ${fmt(matCost(key))} mat.` : ''}`)}</div>
    </div>
    <p class="lede">${esc(bp.blurb || '')}${needs ? ` Needs ${esc(needs)} nearby.` : ''}${bp.phases ? ` Built in ${bp.phases.length} phases: ${bp.phases.map(p => p[1]).join(', ')}.` : ''}</p>
    ${m.built ? `<p class="sub">Topped out ${plural(m.built, 'time')}${tier > 0 ? ` · +${Math.round(tier * ECON.masteryBonus * 100)}% capacity` : ''}</p>` : ''}
    ${vars ? `<div><p class="sub">Facades (top out ${MASTERY_TIERS[1]} and ${MASTERY_TIERS[2]} times to unlock more)</p><span class="variants">${vars}</span></div>` : ''}
    ${keys.length > 1 ? `<div class="strip">${keys.map(k => { const b2 = BLUEPRINTS[k], lk = b2.level > save.level || (b2.contract && !save.bpUnlocks[k]); return `<button type="button" class="${k === key ? 'on' : ''} ${lk ? 'locked' : ''}" data-pick="${k}" aria-label="${esc(b2.name)}">${imgTag(thumbFor(k, chosenStyle(k)))}</button>`; }).join('')}</div>` : ''}
    ${lot ? `<button class="btn go" type="button" id="iBuild" ${check.ok || check.matShort ? '' : 'disabled'}>${check.ok || check.matShort ? `Build here` : esc(check.reason)}</button>`
    : `<button class="btn go" type="button" id="iBuild" ${locked ? 'disabled' : ''}>${locked ? (bp.contract && !save.bpUnlocks[key] ? 'Earn it from a contract' : `Unlocks at level ${bp.level}`) : 'Find a lot to build'}</button>`}`;
  const mount = p => {
    bind(p, '[data-step]', el => showBpInfo(keys[(i + +el.dataset.step + keys.length) % keys.length], keys, lot, back));
    bind(p, '[data-pick]', el => showBpInfo(el.dataset.pick, keys, lot, back));
    bind(p, '[data-var]', el => {
      const [k, st] = el.dataset.var.split(':');
      if (el.getAttribute('aria-disabled') === 'true') { Sound.deny(); toast(`Top out ${BLUEPRINTS[k].name} ${MASTERY_TIERS[STYLE_VARIANTS[k].indexOf(st)]} times to unlock`); return; }
      (save.mastery[k] || (save.mastery[k] = { built: 0, stars: 0 })).style = st; persist(); showBpInfo(k, keys, lot, back);
    });
    bind(p, '#iBuild', () => {
      if (lot) { tryBuild(key, lot); return; }
      $('modal').hidden = true; modalClose = null;
      hubThen(() => { const l = bestEmptyLot(); if (!l) { toast('No free lot. Buy a new district first.'); return; } focusLot(l); showBpInfo(key, keys, l); });
    });
  };
  if (lot) openSheet(html, s => { sheetLot = lot; selectRing(lot); s.querySelector('[data-close]').addEventListener('click', () => (back ? back() : openLotSheet(lot, bpTab(key)))); mount(s); });
  else openModal(html, mount, back || null);
}
function showPlaceInfo(key, lot) {
  const P = PLACEABLES[key], r = lot ? canPlace(key, lot) : null;
  const html = `${head(esc(P.name), UTIL_KEYS.has(key) ? 'Utility' : P.transit ? 'Transit' : 'Park & plaza')}
    <div class="info"><div class="hero">${imgTag(thumbFor('place:' + key), P.name)}</div>
    <div class="facts">${P.radius ? `<div class="fact">${ICON.land}<span>Reach<b>${P.radius} m</b></span></div>` : ''}${P.lv ? `<div class="fact">${ICON.income}<span>Land value<b>+${Math.round(P.lv * 100)}%</b></span></div>` : ''}
      ${['power', 'water', 'waste', 'data'].filter(u => P[u]).map(u => `<div class="fact">${ICON.util}<span>${UTIL_NAMES[u]}<b>+${fmt(P[u])}</b></span></div>`).join('')}
      <div class="fact">${ICON.coin}<span>Cost<b>${fmt(P.cost)}</b></span></div><div class="fact">${ICON.lock}<span>Unlocks<b>Level ${P.level}</b></span></div></div></div>
    <p class="lede">${esc(P.blurb)}</p>
    ${lot ? `<button class="btn go" type="button" id="iPlace" ${r.ok ? '' : 'disabled'}>${r.ok ? `Place for ${fmt(P.cost)}` : esc(r.reason)}</button>` : ''}`;
  const mount = p => bind(p, '#iPlace', () => doPlace(key, lot));
  if (lot) openSheet(html, s => { sheetLot = lot; selectRing(lot); s.querySelector('[data-close]').addEventListener('click', () => openLotSheet(lot, UTIL_KEYS.has(key) ? 'utility' : 'places')); mount(s); });
  else openModal(html, mount, () => showCollection('places'));
}
function doPlace(key, lot) {
  const r = canPlace(key, lot);
  if (!r.ok) { Sound.deny(); toast(r.reason); return; }
  placeItem(key, lot); Sound.place(); rebuildLots(); burst(lot.x, 2, lot.z, 30, '#d9cfbd', 6, 3, 1.2, 3, false);
  closeSheet(); updateHubHud(); afterCityChange();
}

/* ---------------- Missions: contracts, the daily challenge, chests and achievements ---------------- */
const LOGIN_REWARDS = [{ c: 1 }, { c: 1.5 }, { m: 25 }, { c: 2.5 }, { p: 5 }, { c: 4, m: 25 }, { c: 6, p: 12, m: 60 }];
const loginUnit = () => 150 + 90 * save.level;
function loginState() {
  const L = save.login, today = dayKey();
  const claimedToday = L.last === today, streakAlive = L.last === addDays(today, -1) || claimedToday;
  return { day: streakAlive ? L.day : 0, ready: !claimedToday, claimedToday };
}
const loginReady = () => loginState().ready;
function claimLogin() {
  const st = loginState(); if (!st.ready) return null;
  const R = LOGIN_REWARDS[st.day], u = loginUnit(), got = { coins: Math.round((R.c || 0) * u), mat: R.m || 0, pr: R.p || 0 };
  if (got.coins) addCoins(got.coins);
  if (got.mat) save.materials += got.mat;
  if (got.pr) addPrestige(got.pr);
  save.login = { last: dayKey(), day: (st.day + 1) % LOGIN_REWARDS.length };
  Sound.coin(4); persistNow();
  return got;
}
const msToMidnight = () => { const d = new Date(), e = new Date(d); e.setHours(24, 0, 0, 0); return e - d; };
const C_ICON = { floors: 'floors', combo: 'star', hold: 'hand2', perfects: 'star', power: 'events', topout: 'buildings', quality: 'star', recovery: 'heart', race: 'race', parks: 'map', transit: 'transit', reno: 'studio', daily: 'calendar', pop: 'people', weather: 'cloud', district: 'land', transitHome: 'res', waterHotel: 'res', tall: 'floors' };
function contractGo(c) {
  $('modal').hidden = true; modalClose = null;
  const t = c.type;
  if (t === 'race') { startRace(); return; }
  if (t === 'daily') { showDaily(); return; }
  hubThen(() => {
    if (t === 'parks' || t === 'transit') { const l = bestEmptyLot(); if (l) { focusLot(l); openLotSheet(l, 'places'); } return; }
    if (t === 'reno') { const e = buildingsList().find(([, b]) => b.done); if (e) { focusLot(e[0]); openLotSheet(e[0]); } return; }
    const un = !['topout', 'district', 'transitHome', 'waterHotel', 'tall'].includes(t) && buildingsList().find(([, b]) => !b.done);
    if (un) { focusLot(un[0]); openLotSheet(un[0]); return; }
    const l = bestEmptyLot(x => (t === 'district' ? x.d === c.d : t === 'waterHotel' ? isWater(x) : true));
    if (!l) { toast('No free lot here. Buy a new district first.'); return; }
    focusLot(l);
    if (t === 'topout' && c.bp && BLUEPRINTS[c.bp]) showBpInfo(c.bp, tabKeys(bpTab(c.bp)), l);
    else openLotSheet(l, t === 'waterHotel' || t === 'transitHome' ? 'homes' : undefined);
  });
}
function showMissions(tab = 'daily') {
  let body = '';
  if (tab === 'daily') {
    const rows = [];
    if (!contractsOn()) rows.push(`<div class="row locked" style="cursor:default"><span class="ric">${ICON.missions}</span><span><b>Contracts</b><small>Clients start sending jobs at city level ${FEATURES.contracts}.</small></span><span class="lock">${ICON.lock}Lv. ${FEATURES.contracts}</span></div>`);
    else {
      ensureContracts();
      const now = Date.now();
      save.contracts.slots.forEach((c, i) => {
        if (c.empty) { rows.push(`<div class="row locked" style="cursor:default"><span class="ric">${ICON.clock}</span><span><b>New mission</b><small>Arrives in ${fmtDuration(c.readyAt - now)}</small></span><span></span></div>`); return; }
        rows.push(`<div class="row ${c.done ? 'done' : ''}" style="cursor:default"><span class="ric">${ICON[C_ICON[c.type] || 'missions']}</span>
          <span><b>${esc(c.text)}</b>${c.target > 1 ? `<span class="meter" style="--c:linear-gradient(#63b2ff,#2c7ae6)"><i style="width:${Math.round(c.progress / c.target * 100)}%"></i></span><small>${c.progress}/${c.target}</small>` : ''}
            <span class="cost">${ICON.coin}${fmt(c.coins)} <span style="color:#8a52e0">+${c.prestige} ✦</span></span>${c.unlock && BLUEPRINTS[c.unlock] ? `<small style="color:#2f9a26">Unlocks the ${esc(BLUEPRINTS[c.unlock].name)} blueprint</small>` : ''}</span>
          <span style="display:flex;flex-direction:column;gap:6px;align-items:stretch">${c.done ? `<button class="btn go small" type="button" data-claim="${i}">Claim</button>` : `<button class="btn small" type="button" data-cgo="${i}">Go</button><button class="btn ghost small" type="button" data-swap="${i}" title="Replace for ${ECON.contractReplace} coins" style="font-size:13px;color:var(--card-muted);border-color:var(--card-line)">Swap ${ECON.contractReplace}</button>`}</span></div>`);
      });
    }
    if (dailyOn()) {
      const cfg = dailyConfig();
      rows.push(`<div class="row ${dailyCleared() ? 'done' : ''}" style="cursor:default"><span class="ric">${ICON.calendar}</span><span><b>Daily Challenge: ${esc(cfg.name)}</b><small>Build ${cfg.target} floors · ${dailyStreak() ? `${dailyStreak()}-day streak` : 'start a streak'}</small></span><button class="btn small ${dailyCleared() ? '' : 'go'}" type="button" id="mDaily">${dailyCleared() ? 'Again' : 'Go'}</button></div>`);
    }
    const st = loginState();
    const chests = LOGIN_REWARDS.map((R, k) => { const got = k < st.day || (st.claimedToday && k === st.day - 1), ready = st.ready && k === st.day;
      return `<button class="chest ${got ? 'got' : ''} ${ready ? 'ready' : ''}" type="button" ${ready ? 'id="mChest"' : 'disabled'}>${ICON[k === 6 ? 'gift' : 'chest']}${k + 1}<small>${R.p && !R.c ? `${R.p} ✦` : R.m && !R.c ? `${R.m} mat.` : fmtK(Math.round((R.c || 0) * loginUnit()))}</small></button>`; }).join('');
    body = `<div class="cards">${rows.join('')}</div>
      <div class="whitebox" style="background:rgba(0,30,90,.3);border-color:rgba(255,255,255,.3);color:#fff"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0;color:#fff;text-shadow:var(--outline)">Daily Reward</h3><span class="sub" style="display:flex;align-items:center;gap:4px">${ICON.clock.replace('viewBox', 'width="18" height="18" viewBox')}${st.ready ? 'Ready now' : fmtDuration(msToMidnight())}</span></div><div class="chests">${chests}</div><p class="sub" style="margin-top:8px">Come back every day: miss one and the chests start again.</p></div>`;
  } else if (tab === 'weekly') {
    const rows = [];
    if (weeklyOn()) { const cfg = weeklyConfig(), w = weeklyState(); rows.push(`<div class="row ${w.tiers >= 3 ? 'done' : ''}" style="cursor:default"><span class="ric">${ICON.trophy}</span><span><b>${esc(cfg.name)}</b><small>Weekly challenge · ${w.tiers ? `${WEEKLY_TIERS[w.tiers - 1][0]} earned` : 'no tier yet'} · ends in ${fmtDuration(weekEndsIn())}</small><span class="meter"><i style="width:${Math.round(w.tiers / 3 * 100)}%"></i></span></span><button class="btn go small" type="button" id="mWeekly">Go</button></div>`); }
    else rows.push(`<div class="row locked" style="cursor:default"><span class="ric">${ICON.trophy}</span><span><b>Weekly Challenge</b><small>A long tower with its own weather, every week.</small></span><span class="lock">${ICON.lock}Lv. ${FEATURES.weekly}</span></div>`);
    rows.push(`<div class="row" style="cursor:default"><span class="ric">${ICON.race}</span><span><b>Sky Race</b><small>The classic endless tower. Record: ${save.race.best} floors.</small></span><button class="btn go small" type="button" id="mRace">Go</button></div>`);
    for (const P of Object.values(PROJECTS)) {
      const n = projStage(P), lvl = P.stages[0].level, done = projDone(P);
      rows.push(`<div class="row ${done ? 'done' : save.level < lvl ? 'locked' : ''}" style="cursor:default"><span class="ric">${ICON.special}</span><span><b>${esc(P.name)}</b><small>${done ? 'Finished' : `Stage ${n + 1} of ${P.stages.length}: ${esc(P.stages[n].name)}`}</small><span class="meter"><i style="width:${Math.round(n / P.stages.length * 100)}%"></i></span></span>${save.level < lvl ? `<span class="lock">${ICON.lock}Lv. ${lvl}</span>` : `<button class="btn small" type="button" data-proj="${P.id}">${done ? 'View' : 'Go'}</button>`}</div>`);
    }
    body = `<div class="cards">${rows.join('')}</div>`;
  } else {
    const n = Object.keys(save.ach).length;
    body = `<p class="sub">${n} of ${ACHIEVEMENTS.length} unlocked · ${fmt(save.prestige)} ✦ earned</p><div class="cards">${ACHIEVEMENTS.map(a => `<div class="row ${save.ach[a.id] ? 'done' : 'locked'}" style="cursor:default"><span class="ric" style="${save.ach[a.id] ? '' : 'filter:grayscale(1);opacity:.6'}">${ICON.trophy}</span><span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></span><span class="cost" style="color:#8a52e0">${save.ach[a.id] ? '✓' : `+${a.pr} ✦`}</span></div>`).join('')}</div>`;
    save.seenAch = n; persist();
  }
  const T = [['daily', 'Daily', 'calendar'], ['weekly', 'Weekly', 'trophy'], ['ach', 'Achievements', 'star']];
  openModal(`${head('Missions')}${tabsHtml(T, tab)}${body}`, p => {
    bind(p, '[data-tab]', el => showMissions(el.dataset.tab));
    bind(p, '[data-claim]', el => { const c = claimContract(+el.dataset.claim); if (c) { toast(`+${fmt(c.coins)} coins · +${c.prestige} ✦`, 'good'); ensureContracts(); showMissions('daily'); updateHubHud(); } });
    bind(p, '[data-swap]', el => { if (replaceContract(+el.dataset.swap)) { showMissions('daily'); updateHubHud(); } else { Sound.deny(); toast(`You need ${ECON.contractReplace} coins`); } });
    bind(p, '[data-cgo]', el => contractGo(save.contracts.slots[+el.dataset.cgo]));
    bind(p, '#mChest', () => { const g = claimLogin(); if (g) { toast([g.coins ? `+${fmt(g.coins)} coins` : '', g.mat ? `+${g.mat} materials` : '', g.pr ? `+${g.pr} ✦` : ''].filter(Boolean).join(' · '), 'good'); showMissions('daily'); updateHubHud(); } });
    bind(p, '#mDaily', () => showDaily());
    bind(p, '#mWeekly', () => showWeekly());
    bind(p, '#mRace', () => { $('modal').hidden = true; modalClose = null; startRace(); });
    bind(p, '[data-proj]', el => { $('modal').hidden = true; modalClose = null; const P = PROJECTS[el.dataset.proj] || Object.values(PROJECTS).find(x => x.id === el.dataset.proj); hubThen(() => { hubCam.tx = P.centre.x; hubCam.tz = P.centre.z + 20; openProjectSheet(P); }); });
  });
}
const showContracts = () => showMissions('daily');

/* ---------------- Events ---------------- */
function showEvents() {
  const cards = [];
  const timer = ms => `<span class="timer">${ICON.clock}${fmtDuration(ms)}</span>`;
  if (weeklyOn()) {
    const cfg = weeklyConfig(), w = weeklyState(), gold = WEEKLY_TIERS[2];
    cards.push(`<div class="evcard"><span class="ribbon">Skyscraper Challenge</span>
      <div class="art">${['residence', 'spire', 'office'].map(k => imgTag(thumbFor(k, cfg.style))).join('')}</div>
      <div class="evrow"><span><b>${esc(cfg.name)}</b><small>Top out a ${cfg.target}-floor tower in ${WEATHER[cfg.weather].name.toLowerCase()} weather. Gold at ${fmt(cfg.tiers[2])} points.</small><small style="margin-top:4px">${timer(weekEndsIn())} &nbsp;Rewards: ${ICON.coin.replace('viewBox', 'width="16" height="16" viewBox')} ${fmt(gold[1])} · ${gold[2]} ✦${w.tiers ? ` · ${WEEKLY_TIERS[w.tiers - 1][0]} earned` : ''}</small></span><button class="btn go" type="button" id="eWeekly">Play</button></div></div>`);
  } else cards.push(`<div class="evcard" style="filter:grayscale(.5)"><span class="ribbon">Skyscraper Challenge</span><div class="evrow"><span><b>Weekly Challenge</b><small>A long tower with its own weather and crane, bronze to gold every week.</small></span><span class="timer">${ICON.lock.replace('viewBox', 'width="18" height="18" viewBox')}Lv. ${FEATURES.weekly}</span></div></div>`);
  if (dailyOn()) { const cfg = dailyConfig(); cards.push(`<div class="evcard green"><div class="evrow"><span><b>${ICON.calendar.replace('viewBox', 'width="26" height="26" style="vertical-align:-6px" viewBox')} Daily: ${esc(cfg.name)}</b><small>${cfg.mods.map(m => esc(m.name)).join(' · ') || 'Classic rules'} · build ${cfg.target} floors${dailyStreak() ? ` · ${dailyStreak()}-day streak` : ''}</small><small style="margin-top:4px">${timer(msToMidnight())}</small></span><button class="btn ${dailyCleared() ? '' : 'go'}" type="button" id="eDaily">${dailyCleared() ? 'Again' : 'Play'}</button></div></div>`); }
  const ev = eventNow(), nx = eventNext();
  if (ev) cards.push(`<div class="evcard purple"><div class="evrow"><span><b>${ev.icon} ${esc(ev.name)}</b><small>${esc(ev.desc)}</small><small style="margin-top:4px">${timer(eventEndsIn())}</small></span></div><small>Next: <b style="font-size:15px">${esc(nx.name)}</b> starts in ${fmtDuration(eventEndsIn())}</small></div>`);
  else cards.push(`<div class="evcard purple" style="filter:grayscale(.4)"><div class="evrow"><span><b>City events</b><small>Housing booms, festivals and contests, a new one every ${EVENT_HOURS} hours.</small></span><span class="timer">Lv. ${EVENT_LEVEL}</span></div></div>`);
  const wid = weatherNow(), wx = WEATHER[wid], nwx = WEATHER[weatherAt(Date.now() + weatherChangesIn() + 1000)];
  cards.push(`<div class="evcard blue"><div class="evrow"><span><b>${wx.icon} ${wx.name}</b><small>${esc(wx.desc)}</small><small style="margin-top:4px">${timer(weatherChangesIn())} · then ${nwx.icon} ${nwx.name}</small></span></div></div>`);
  cards.push(`<div class="evcard blue"><div class="evrow"><span><b>${ICON.race.replace('viewBox', 'width="26" height="26" style="vertical-align:-6px" viewBox')} Sky Race</b><small>The classic endless tower on the Challenge Pier. Record: ${save.race.best} floors.</small></span><button class="btn go" type="button" id="eRace">Play</button></div></div>`);
  openModal(`${head('Events', new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }))}<div class="cards">${cards.join('')}</div>`, p => {
    bind(p, '#eWeekly', () => showWeekly());
    bind(p, '#eDaily', () => showDaily());
    bind(p, '#eRace', () => { $('modal').hidden = true; modalClose = null; startRace(); });
  });
}
const showToday = showEvents;

/* ---------------- City stats ---------------- */
function trendOf(k, v) {
  const t = save.trend;
  if (!t || t.region !== save.region || t.key !== dayKey() || !t[k]) return '';
  const d = (v - t[k]) / Math.max(1e-6, Math.abs(t[k]));
  if (Math.abs(d) < 0.001) return '';
  return `<em class="${d < 0 ? 'down' : ''}">${d > 0 ? '+' : ''}${(d * 100).toFixed(1)}% today</em>`;
}
// Called from the city tick: remember the city as it was at the start of the day.
function trackTrend() {
  const A = City.A; if (!A) return;
  if (save.trend.key !== dayKey() || save.trend.region !== save.region) save.trend = { key: dayKey(), region: save.region, pop: A.pop, rate: City.rate, jobs: A.filled, happy: A.happy };
}
function tallestKey() { let best = null, n = 0; for (const [, b] of buildingsList()) if (b.done && b.xs.length > n) { n = b.xs.length; best = b; } return best; }
function showCityInfo(tab = 'overview') {
  const A = City.A || recomputeCity(), lp = levelProgress();
  let body = '';
  if (tab === 'overview') {
    const tb = tallestKey(), [sg, sm] = cityStars();
    const next = []; for (let l = save.level + 1; l <= Math.min(MAX_LEVEL, save.level + 3); l++) for (const u of unlocksAt(l)) next.push({ ...u, name: `${u.name} (level ${l})` });
    const D = [['Homes', 'res', A.demand.R, 'var(--res)'], ['Shops', 'com', A.demand.C, 'var(--com)'], ['Offices', 'off', A.demand.O, 'var(--off)'], ['Industry', 'ind', A.demand.I || 0, 'var(--ind)']];
    body = `<div class="whitebox citycard"><span class="thumb">${imgTag(thumbFor(tb ? tb.bp : 'flats', tb ? tb.style || chosenStyle(tb.bp) : undefined))}</span>
        <span><b>${esc(regionNow().name)}</b><small style="display:block;color:var(--card-muted)">City level ${lp.l} · ${rankFor(lp.l)}${lp.next == null ? '' : ` · ${fmt(population())} of ${fmt(lp.next)} for level ${lp.l + 1}`}</small>
        <span class="starbar">${ICON.star}<span class="meter"><i style="width:${sm ? Math.round(sg / sm * 100) : 0}%"></i></span>${sg}/${sm}</span></span></div>
      <div class="tiles">
        <div class="tile">${ICON.people}<span><small>Population</small><b>${fmt(A.pop)}</b>${trendOf('pop', A.pop)}</span></div>
        <div class="tile">${ICON.jobs}<span><small>Jobs filled</small><b>${fmt(A.filled)}</b>${trendOf('jobs', A.filled)}</span></div>
        <div class="tile">${ICON.income}<span><small>Income</small><b>${fmtK(City.rate)}/h</b>${trendOf('rate', City.rate)}</span></div>
        <div class="tile">${ICON.heart}<span><small>Happiness</small><b>${pct(A.happy)}</b>${trendOf('happy', A.happy)}</span></div></div>
      <h3>Demand</h3><div class="dchart">${D.map(([n, ic, v, c]) => `<div><span class="bar"><i style="--c:${c};height:${Math.round(50 + v * 50)}%"></i></span>${ICON[ic]}${n}</div>`).join('')}</div>
      ${next.length ? `<h3>Coming up</h3><div class="unlocks">${unlockRows(next)}</div>` : ''}`;
  } else if (tab === 'people') {
    const meterRow = (n, v, c) => `<dt>${n}</dt><dd>${pct(v)}</dd><dd style="grid-column:1/-1;margin-top:-4px"><span class="meter" style="--c:${c}"><i style="width:${pct(Math.min(1, v))}"></i></span></dd>`;
    body = `<div class="whitebox"><dl class="stats"><dt>Residents</dt><dd>${fmt(A.pop)}</dd><dt>Hotel guests</dt><dd>${fmt(A.guests)}</dd><dt>Jobs</dt><dd>${fmt(A.filled)} of ${fmt(A.jobs)}</dd><dt>Unemployment</dt><dd>${pct(A.unemployment)}</dd><dt>Tourism</dt><dd>${pct(A.tourism)}</dd></dl></div>
      <div class="whitebox"><h3>Services</h3><dl class="stats">${meterRow('Homes with education', A.svc.edu, '#5fb3ff')}${meterRow('Homes with healthcare', A.svc.health, '#ff6a5a')}${meterRow('Homes with safety', A.svc.safety, '#ffb13a')}</dl></div>
      <div class="whitebox"><h3>Traffic</h3><dl class="stats"><dt>Commuters</dt><dd>${fmt(A.commute)}</dd><dt>Road and transit capacity</dt><dd>${fmt(A.roadCap)}</dd>${meterRow('Road use', A.commute / Math.max(1, A.roadCap), A.commute > A.roadCap ? '#e8402f' : '#39b22b')}</dl></div>`;
  } else if (tab === 'economy') {
    const matOn = skillLevel() >= ECON.renoLevel;
    const util = u => { const use = A[u + 'Use'], sup = A[u], r = use / Math.max(1, sup); return `<dt>${UTIL_NAMES[u]}</dt><dd>${fmt(use)} / ${fmt(sup)}</dd><dd style="grid-column:1/-1;margin-top:-4px"><span class="meter" style="--c:${r > 1 ? '#e8402f' : r > 0.85 ? '#ffb416' : '#39b22b'}"><i style="width:${pct(Math.min(1, r))}"></i></span></dd>`; };
    body = `<div class="tiles"><div class="tile">${ICON.income}<span><small>Income</small><b>${fmt(City.rate)}/h</b></span></div><div class="tile">${ICON.coin}<span><small>Waiting</small><b>${fmt(Math.floor(save.bank))}</b><small>up to ${ECON.incomeCapHours} h</small></span></div></div>
      <div class="whitebox"><h3>Utilities</h3><dl class="stats">${['power', 'water', 'waste', 'data'].map(util).join('')}</dl></div>
      ${matOn ? `<div class="whitebox"><h3>Materials</h3><dl class="stats"><dt>In store</dt><dd>${fmt(Math.floor(save.materials))} / ${fmt(materialCap())}</dd><dt>Harbor Works output</dt><dd>+${A.matRate.toFixed(1)}/hour</dd><dt>Perfect floors</dt><dd>+${ECON.matPerPerfect} each</dd></dl>
        <div class="btn-row" style="margin-top:8px"><button class="btn small" type="button" data-buy="10">Buy 10 · ${fmt(matPrice(10))}</button><button class="btn small" type="button" data-buy="50">Buy 50 · ${fmt(matPrice(50))}</button></div></div>` : ''}`;
  } else if (tab === 'happy') {
    const f = [];
    const add = (on, good, t) => { if (on) f.push(`<span class="${good ? 'good' : 'bad'}">${t}</span>`); };
    add(A.parks, 1, `${plural(A.parks, 'park')}`); add(A.plazas, 1, `${plural(A.plazas, 'plaza')}`); add(A.landmarks, 1, 'Landmarks'); add(A.gardens, 1, 'Rooftop gardens');
    add(A.svc.edu + A.svc.health + A.svc.safety > 1.5, 1, 'Good services'); add(A.svc.edu + A.svc.health + A.svc.safety <= 1.5, 0, 'Missing services');
    add(A.unemployment > 0.05, 0, `Unemployment ${pct(A.unemployment)}`); add(A.pollShare > 0.05, 0, `Pollution near ${pct(A.pollShare)} of homes`);
    add(A.congestion > 0.05, 0, 'Traffic jams'); add(A.util < 0.99, 0, `${UTIL_NAMES[A.worstUtil]} shortage`);
    body = `<div class="whitebox" style="text-align:center"><div style="font:400 56px/1 var(--f-disp);color:${A.happy > 0.75 ? '#2f9a26' : A.happy > 0.55 ? '#e79a09' : '#c0392b'}">${pct(A.happy)}</div><small style="color:var(--card-muted)">of residents are happy</small></div>
      <h3>What people say</h3><div class="pills">${f.join('') || '<span>Nothing to report yet</span>'}</div>
      <p class="sub">Parks, plazas, landmarks and services raise happiness. Jobs going begging, pollution, traffic and shortages lower it. Happier cities fill up faster.</p>`;
  } else {
    const s = save.stats;
    body = `<div class="whitebox"><dl class="stats">
      <dt>Sky Race record</dt><dd>${save.race.best} floors</dd><dt>Best Sky Race points</dt><dd>${fmt(save.race.bestPop)}</dd>
      <dt>Buildings topped out</dt><dd>${fmt(s.toppedOut)}</dd><dt>Three-star buildings</dt><dd>${fmt(s.threeStars)}</dd>
      <dt>Floors placed</dt><dd>${fmt(s.floors)}</dd><dt>Perfect floors</dt><dd>${fmt(s.perfects)}</dd>
      <dt>Power Perfects</dt><dd>${fmt(s.powerPerfects)}</dd><dt>Longest combo</dt><dd>×${s.bestCombo}</dd>
      <dt>Recoveries</dt><dd>${fmt(s.recoveries)}</dd><dt>Daily clears</dt><dd>${fmt(s.dailies)}</dd>
      <dt>Contracts completed</dt><dd>${fmt(s.contracts)}</dd><dt>Districts owned</dt><dd>${Object.keys(save.districts).length} / ${DISTRICTS.length}</dd></dl></div>`;
  }
  const T = [['overview', 'Overview', 'city'], ['people', 'People', 'people'], ['economy', 'Economy', 'income'], ['happy', 'Happiness', 'heart'], ['records', 'Records', 'trophy']];
  openModal(`${head('City Stats')}${tabsHtml(T, tab)}${body}`, p => {
    bind(p, '[data-tab]', el => showCityInfo(el.dataset.tab));
    bind(p, '[data-buy]', el => { if (buyMaterials(+el.dataset.buy)) { Sound.coin(2); showCityInfo('economy'); updateHubHud(); } else { Sound.deny(); toast(save.materials >= materialCap() - 1 ? 'Storage is full. Harbor Works add more room.' : 'Not enough coins'); } });
  });
}

/* ---------------- Shop: coins and prestige you earn by playing, nothing else ---------------- */
const dealSize = () => Math.max(20, Math.round(materialCap() * 0.25 / 5) * 5);
function showShop(tab = 'featured') {
  let body = '';
  const room = Math.max(0, Math.floor(materialCap() - save.materials));
  if (tab === 'featured') {
    const n = Math.min(dealSize(), room), price = Math.ceil(matPrice(n) * 0.6), bought = save.shop.deal === dayKey();
    const nextPaint = CRANE_PAINTS.find(p => !paintUnlocked(p));
    body = `<div class="shopcard gold"><span class="art">${ICON.gift}</span><span><b>Daily Deal</b><small>${fmt(dealSize())} building materials, 40% off. One a day.</small></span><button class="btn go" type="button" id="shDeal" ${bought || !n ? 'disabled' : ''}>${bought ? 'Bought' : !n ? 'Store full' : coinAmt(price)}</button></div>
      <div class="shopcard green"><span class="art">${ICON.mat.replace('viewBox', 'width="52" height="52" viewBox')}</span><span><b>Builder's Crate</b><small>Fill your materials store to the top.</small></span><button class="btn go" type="button" id="shFill" ${room ? '' : 'disabled'}>${room ? coinAmt(matPrice(room)) : 'Full'}</button></div>
      ${nextPaint ? `<div class="shopcard"><span class="art">${ICON.crane}</span><span><b>${esc(nextPaint.name)} crane</b><small>Unlocks at ${nextPaint.need} ✦ prestige. You have ${fmt(save.prestige)}.</small></span><button class="btn" type="button" data-tab="crane">View</button></div>` : ''}
      <div class="shopcard blue"><span class="art">${ICON.coin.replace('viewBox', 'width="52" height="52" viewBox')}</span><span><b>City income</b><small>${fmt(Math.floor(save.bank))} coins are waiting in your city.</small></span><button class="btn go" type="button" id="shCollect" ${save.bank >= 1 ? '' : 'disabled'}>Collect</button></div>`;
  } else if (tab === 'materials') {
    body = `<p class="sub">In store: ${fmt(Math.floor(save.materials))} of ${fmt(materialCap())}. Harbor Works make more and add storage.</p>` + [10, 50, 200].map((n, k) => `<div class="shopcard ${['green', 'blue', 'gold'][k]}"><span class="art">${ICON.mat.replace('viewBox', 'width="52" height="52" viewBox')}</span><span><b>${fmt(n)} materials</b><small>Steel and concrete for big towers.</small></span><button class="btn go" type="button" data-buy="${n}" ${room >= n ? '' : 'disabled'}>${room >= n ? coinAmt(matPrice(n)) : 'No room'}</button></div>`).join('');
  } else {
    body = `<p class="sub">Prestige ✦ from achievements, contracts and stars unlocks new crane paint. You have ${fmt(save.prestige)} ✦.</p><div class="cards">${CRANE_PAINTS.map(p => { const on = paintUnlocked(p), cur = save.cosmetics.crane === p.id;
      return `<button class="card" type="button" data-paint="${p.id}" aria-disabled="${!on}"><i class="sw" style="--c:${p.color}"></i><span><b>${p.name}</b><small>${on ? 'Unlocked' : `Needs ${p.need} ✦`}</small></span><span class="go">${cur ? 'In use' : on ? 'Use' : ''}</span></button>`; }).join('')}</div>`;
  }
  const T = [['featured', 'Featured', 'gift'], ['materials', 'Materials', 'mat'], ['crane', 'Crane', 'crane']];
  openModal(`${head('Shop', 'Paid for with the coins and prestige you earn by building')}${tabsHtml(T, tab)}<div class="cards">${body}</div>`, p => {
    bind(p, '[data-tab]', el => showShop(el.dataset.tab));
    bind(p, '#shDeal', () => { const n = Math.min(dealSize(), Math.floor(materialCap() - save.materials)), price = Math.ceil(matPrice(n) * 0.6);
      if (n > 0 && save.coins >= price && save.shop.deal !== dayKey()) { addCoins(-price); save.materials += n; save.shop.deal = dayKey(); persistNow(); Sound.coin(3); toast(`+${n} materials`, 'good'); showShop('featured'); updateHubHud(); } else { Sound.deny(); toast('Not enough coins'); } });
    bind(p, '#shFill', () => { const n = Math.floor(materialCap() - save.materials); if (buyMaterials(n)) { Sound.coin(3); showShop('featured'); updateHubHud(); } else { Sound.deny(); toast('Not enough coins'); } });
    bind(p, '#shCollect', () => { const n = collectIncome(); if (n) toast(`+${fmt(n)} coins`, 'good'); showShop('featured'); updateHubHud(); });
    bind(p, '[data-buy]', el => { if (buyMaterials(+el.dataset.buy)) { Sound.coin(2); showShop('materials'); updateHubHud(); } else { Sound.deny(); toast('Not enough coins'); } });
    bind(p, '[data-paint]', el => { if (setPaint(el.dataset.paint)) showShop('crane'); else Sound.deny(); });
  });
}

/* ---------------- Collection: every building, landmark and place ---------------- */
function showCollection(tab = 'buildings') {
  let keys, cells;
  if (tab === 'places') {
    keys = Object.keys(PLACEABLES).sort((a, b) => PLACEABLES[a].level - PLACEABLES[b].level);
    const placed = new Set(Object.values(save.lots).filter(b => b && b.place).map(b => b.place));
    cells = keys.map(k => { const P = PLACEABLES[k], lk = P.level > save.level;
      return `<button class="gcell ${lk ? 'locked' : ''}" type="button" data-pk="${k}"><span class="thumb">${imgTag(thumbFor('place:' + k))}</span>${lk ? ICON.lock.replace('<svg', '<svg class="lk"') : ''}<b>${esc(P.name)}</b><small>${lk ? `Lv. ${P.level}` : placed.has(k) ? 'In your city' : 'Unlocked'}</small></button>`; });
  } else {
    const special = k => bpTab(k) === 'special';
    keys = BP_KEYS.filter(k => (tab === 'landmarks') === special(k)).sort((a, b) => BLUEPRINTS[a].level - BLUEPRINTS[b].level);
    if (tab === 'buildings') keys = keys.concat(save.custom.map(d => customKey(d.id)).filter(k => BLUEPRINTS[k]));
    cells = keys.map(k => { const bp = BLUEPRINTS[k], m = save.mastery[k] || { built: 0, stars: 0 }, lk = bp.level > save.level || (bp.contract && !save.bpUnlocks[k]);
      return `<button class="gcell ${lk ? 'locked' : ''}" type="button" data-ck="${k}"><span class="thumb">${imgTag(thumbFor(k, chosenStyle(k)))}</span>${lk ? ICON.lock.replace('<svg', '<svg class="lk"') : ''}<b>${esc(bp.name)}</b>${lk ? `<small>${bp.contract && !save.bpUnlocks[k] ? 'Contract' : `Lv. ${bp.level}`}</small>` : starsHtml(m.stars || 0)}</button>`; });
  }
  const got = tab === 'places' ? keys.filter(k => PLACEABLES[k].level <= save.level).length : keys.filter(k => (save.mastery[k] || {}).built).length;
  const T = [['buildings', 'Buildings', 'buildings'], ['landmarks', 'Landmarks', 'special'], ['places', 'Places', 'map']];
  openModal(`${head('Collection', tab === 'places' ? `${got} of ${keys.length} unlocked` : `${got} of ${keys.length} topped out · tap one for facades`)}${tabsHtml(T, tab)}<div class="grid">${cells.join('')}</div>`, p => {
    bind(p, '[data-tab]', el => showCollection(el.dataset.tab));
    bind(p, '[data-ck]', el => showBpInfo(el.dataset.ck, keys, null, () => showCollection(tab)));
    bind(p, '[data-pk]', el => showPlaceInfo(el.dataset.pk));
  });
}
function showTrophies(tab = 'ach') {
  if (tab === 'crane') showShop('crane');
  else if (tab === 'mastery') showCollection();
  else if (tab === 'stats') showCityInfo('records');
  else showMissions('ach');
}

/* ---------------- Menu, and settings with the player profile ---------------- */
function showMenu() {
  const item = (id, ic, t, s) => `<button class="row" type="button" id="${id}"><span class="ric">${ICON[ic]}</span><span><b>${t}</b><small>${s}</small></span><span class="chev">›</span></button>`;
  openModal(`${head('Menu')}<div class="cards">
    ${item('mSet', 'gear', 'Settings', 'Sound, controls, graphics and your profile')}
    ${item('mRegions', 'globe', 'World Map', skillLevel() >= REGIONS[1].unlock ? 'Found and visit your other cities' : `New regions from level ${REGIONS[1].unlock}`)}
    ${item('mInfo', 'city', 'City Stats', 'Population, jobs, income and demand')}
    ${item('mPhoto', 'camera', 'Photo mode', 'Frame your skyline and save a picture')}
    ${item('mHow', 'info', 'How to play', 'Controls and city basics')}
    ${item('mTitle', 'back', 'Title screen', 'Your city is saved')}</div>`, p => {
    bind(p, '#mInfo', () => showCityInfo()); bind(p, '#mPhoto', () => { $('modal').hidden = true; modalClose = null; enterPhoto(); }); bind(p, '#mRegions', () => showWorldMap()); bind(p, '#mHow', () => showHowto()); bind(p, '#mSet', () => showSettings());
    bind(p, '#mTitle', () => { $('modal').hidden = true; modalClose = null; persistNow(); toTitle(); });
  });
}
