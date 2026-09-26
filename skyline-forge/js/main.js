'use strict';
/* ==================================================================== *
 * State machine, cameras, input and the main loop.                     *
 * States: title | hub | fly | play | pause | result                    *
 * ==================================================================== */

let state = 'boot';
let pausedFrames = 0;
let pendingWelcome = null;
let lastSession = null;
let moveIn = null;       // floating "+N residents" over a new tower when we get back to the city

function show(id) { for (const s of ['title', 'pause', 'result']) $(s).hidden = s !== id; }

/* ---------------- Cameras ---------------- */
const cam = { pos: new T.Vector3(), look: new T.Vector3() };
const goalPose = { pos: new T.Vector3(), look: new T.Vector3() };
const hubCam = { tx: 0, tz: 12, d: 190 };
const HUB_BOUNDS = { x0: -330, x1: 410, z0: -90, z1: 130, d0: 45, d1: 560 };
const hubPitch = d => lerp(0.5, 1.05, clamp((d - 45) / 420, 0, 1));
function hubPose(out) {
  const p = hubPitch(hubCam.d);
  out.pos.set(hubCam.tx, hubCam.d * Math.sin(p), hubCam.tz + hubCam.d * Math.cos(p));
  out.look.set(hubCam.tx, 0, hubCam.tz);
  return out;
}
function clampHub() {
  hubCam.tx = clamp(hubCam.tx, HUB_BOUNDS.x0, HUB_BOUNDS.x1);
  hubCam.tz = clamp(hubCam.tz, HUB_BOUNDS.z0, HUB_BOUNDS.z1);
  hubCam.d = clamp(hubCam.d, HUB_BOUNDS.d0, HUB_BOUNDS.d1);
}
let fly = null;
const flyFrom = { pos: new T.Vector3(), look: new T.Vector3() };
function flyTo(poseFn, dur, then) {
  flyFrom.pos.copy(cam.pos); flyFrom.look.copy(cam.look);
  fly = { poseFn, dur: reduceMotion ? 0.01 : dur, t: 0, then };
}
function stepCamera(dt) {
  if (fly) {
    fly.t += dt;
    const k = easeInOut(clamp(fly.t / fly.dur, 0, 1));
    fly.poseFn(goalPose);
    cam.pos.lerpVectors(flyFrom.pos, goalPose.pos, k);
    // Arc upward a little so the camera sweeps over the city instead of through it.
    cam.pos.y += Math.sin(k * Math.PI) * Math.min(60, flyFrom.pos.distanceTo(goalPose.pos) * 0.15);
    cam.look.lerpVectors(flyFrom.look, goalPose.look, k);
    if (fly.t >= fly.dur) { const f = fly; fly = null; if (f.then) f.then(); }
  } else if (state === 'hub') {
    hubPose(goalPose);
    const k = 1 - Math.exp(-10 * dt);
    cam.pos.lerp(goalPose.pos, k); cam.look.lerp(goalPose.look, k);
  } else if (game) {
    buildCamera(game, cam);
  }
  camera.position.copy(cam.pos);
  camera.lookAt(cam.look);
  sky.position.copy(camera.position); stars.position.copy(camera.position);
}

/* ---------------- Flow ---------------- */
function toTitle() {
  closeSheet(); $('modal').hidden = true; modalClose = null; clearPops(); hideCoach();
  if (game) disposeGame(game);
  game = newGame('attract', { site: PIER, style: 'green' });
  setCraneSite(PIER); setSite(PIER); setHidden(new Set());
  $('hud').hidden = true; $('hub').hidden = true;
  state = 'title'; show('title'); renderTitle();
  buildCamera(game, cam);
}
function goToHub() {
  Sound.resume();
  show(null);
  if (game) { disposeGame(game); game = null; }
  setCraneSite(null); setSite(null); setHidden(new Set());
  state = 'fly';
  flyTo(hubPose, 1.6, () => enterHub());
}
function enterHub(openNear) {
  state = 'hub';
  $('hub').hidden = false; $('hud').hidden = true;
  recomputeCity(); updateHubHud(); setOverlayUI(); flushToasts();
  if (moveIn) {
    const m = moveIn; moveIn = null;
    popupAt(m.text, m.lot.x, m.h + 6, m.lot.z, 'bonus');
    if (m.done) setTimeout(() => popupAt('Moving in', m.lot.x, m.h + 14, m.lot.z, 'info'), 250);
    burst(m.lot.x, m.h, m.lot.z, 30, '#ffd76a', 6, 6, 1.2, 1.4, true);
  }
  if (save.ftue === 0 && !buildingsList().length) { showFirstRun(); return; }
  const ups = checkLevelUp();
  const after = () => {
    ensureContracts(); updateHubHud();
    if (openNear) { const lot = nearestEmpty(openNear); if (lot) openLotSheet(lot); }
  };
  if (pendingWelcome) { const w = pendingWelcome; pendingWelcome = null; showWelcome(w, () => showLevelUps(ups, after)); }
  else showLevelUps(ups, after);
}
function nearestEmpty(near) {
  let best = null, bd = Infinity;
  for (const lot of LOTS) if (save.districts[lot.d] && !save.lots[lot.id]) { const d = lotDist(lot, near); if (d < bd) { bd = d; best = lot; } }
  return best;
}
function beginSession(kind, opts) {
  const fromHub = state === 'hub' || state === 'fly' || !game;
  closeSheet(); $('modal').hidden = true; modalClose = null; clearPops(); hideCoach();
  const phase = game ? game.swingPhase : 0;
  const hookE = game && game.kind === 'attract' ? game.hook.e : undefined;
  if (game) disposeGame(game);
  game = newGame(kind, Object.assign({}, opts, { swingPhase: phase, hookE }));
  setCraneSite(game.site); setSite(game.site);
  hideOccluders(game.site, game.site.z + view.h * S / (2 * TAN_HALF), camera.aspect);
  lastSession = { kind, opts };
  show(null); $('hub').hidden = true; updateLabels(false);
  Music.setChain(0); input.down = false; input.pending = false;
  updateBuildHud();
  $('btnRestart').hidden = kind === 'city';
  if (fromHub) { state = 'fly'; flyTo(o => buildCamera(game, o), 1.5, () => { state = 'play'; $('hud').hidden = false; }); }
  else { state = 'play'; $('hud').hidden = false; }
}
function startCityBuild(lot, key, cont) {
  Sound.resume();
  if (!payPermit(key, lot, cont)) { const c = canBuild(key, lot, { cont }); Sound.deny(); toast(c.reason || 'Cannot build here'); return; }
  if (save.ftue === 0) { save.ftue = 1; persist(); }
  const b = buildingAt(lot.id);
  beginSession('city', { site: lot, bp: key, xs: cont && b ? b.xs : null });
}
function startRace() { Sound.resume(); beginSession('race', { site: PIER, style: 'green' }); }
function startDaily() {
  if (!dailyOn()) return;
  Sound.resume();
  const cfg = dailyConfig();
  beginSession('daily', { site: PIER, style: cfg.style, target: cfg.target, mult: cfg.mult, mods: dailyModObject(cfg), daily: cfg.key });
}
function onSessionEnd(r) {
  bus.emit('session', r);
  let sum;
  if (r.kind === 'city') {
    sum = completeBuild(r); if (save.ftue === 1) save.ftue = 2;
    if (!sum.kept && r.xs.length) {
      const roles = Object.entries(sum.caps).filter(([, v]) => v > 0);
      moveIn = { lot: LOT_BY_ID[r.site.id], text: roles.length === 1 ? `+${fmt(roles[0][1])} ${ROLE_NAMES[roles[0][0]]}` : `+${fmt(sum.cap)} capacity`, done: r.done, h: r.xs.length * H * S };
    }
  }
  else if (r.kind === 'race') { sum = recordRace(r); if (sum.record) TowerField.rebuild(); }
  else sum = recordDaily(r);
  checkPopAchievements(); checkPopContracts();
  hideCoach(); input.down = false;
  $('hud').hidden = true;
  state = 'result';
  showResults(r, sum);
  flushToasts();
}
function leaveSession(another) {
  const site = game ? game.site : null;
  if (game) disposeGame(game);
  game = null;
  setSite(null); setCraneSite(null); setHidden(new Set()); rebuildLots(); clearPops();
  show(null); $('hud').hidden = true;
  if (site && !site.pier) { hubCam.tx = site.x; hubCam.tz = site.z + 12; hubCam.d = 150; }
  else { hubCam.tx = 0; hubCam.tz = 30; hubCam.d = 210; }
  clampHub();
  state = 'fly';
  flyTo(hubPose, 1.4, () => enterHub(another && site && !site.pier ? site : null));
}
function pause() {
  if (state !== 'play' || !game || game.finished || game.ending || game.pan) return;
  if (game.charge) game.charge = null;
  input.down = false; input.pending = false;
  state = 'pause';
  const g = game;
  $('pauseInfo').textContent = g.kind === 'city' ? `${g.bp.name}: ${g.tower.length} of ${g.target} floors. Stopping keeps what you've built.` : g.kind === 'race' ? `Sky Race: ${g.tower.length} floors.` : `Daily Challenge: ${g.tower.length} of ${g.target} floors.`;
  show('pause');
}
function resume() { if (state === 'pause') { state = 'play'; show(null); } }
function stopBuilding() {
  if (!game) return;
  state = 'play'; show(null);
  if (game.falling) { siteRoot.remove(game.falling.mesh); game.falling = null; }
  game.ending = { started: true, t: 0 }; game.danger = null;
  finishRound(game);
}
function afterCityChange() {
  checkPopAchievements(); checkPopContracts();
  const ups = checkLevelUp();
  if (ups.length) showLevelUps(ups, () => { ensureContracts(); updateHubHud(); });
  updateHubHud();
}

/* ---------------- Construction input: classic tap, plus the Forge gestures ---------------- */
const input = { down: false, id: null, y0: 0, samples: [], pending: false };
function startCharge() { game.charge = { t: 0, band: 0, beep: 0 }; }
function press(y, t, via) {
  lastInput = via;
  Sound.resume();
  if (state !== 'play' || !game) return;
  if (game.pan) { game.camY = game.pan.to; return; }
  if (game.intro) { game.intro.t = CFG.intro.hold + CFG.intro.pan; return; }
  if (!featureOn('hold')) { drop(null, false); return; }        // classic: drop the moment you touch
  input.down = true; input.y0 = y; input.samples = [[y, t]];
  if (canCharge()) { startCharge(); input.pending = false; } else input.pending = true;
}
function move(y, t) {
  if (!input.down) return;
  const s = input.samples; s.push([y, t]); while (s.length > 2 && t - s[0][1] > 110) s.shift();
  if (!game || !game.charge) return;
  const dy = y - input.y0;
  if (dy > FORGE.power.swipe && featureOn('power')) {
    const v = (s[s.length - 1][0] - s[0][0]) / Math.max(1, s[s.length - 1][1] - s[0][1]);
    let tier = FORGE.power.tiers[0];
    for (const x of FORGE.power.tiers) if (v >= x[0]) tier = x;
    input.down = false; drop(tier, false);
  } else if (dy < -FORGE.recallSwipe && featureOn('recall')) { input.down = false; recall(); }
}
function release() {
  if (!input.down) return;
  input.down = false; input.pending = false;
  if (game && game.charge) drop(null, false);
}
function recall() {
  const g = game;
  if (!g || !g.charge) return;
  g.charge = null; g.hook.recall = true;
  const c = g.combo;
  const y = pivotWorldY(g) + RIG.L + HANG.floor;
  if (c.streak > 0) { c.streak--; if (!c.streak) c.timer = 0; popup('Recalled · combo −1', 0, y, 'info'); } else popup('Recalled', 0, y, 'info');
  Music.setChain(c.streak);
  Sound.recall(); vib(15);
  doneTip('recall');
}

/* ---------------- City input: pan, zoom, tap ---------------- */
const pointers = new Map();
let gesture = null;
const ray = new T.Raycaster(), ndc = new T.Vector2(), pickBox = new T.Box3(), pickHit = new T.Vector3(), groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
function worldPerPx() { return 2 * hubCam.d * TAN_HALF / window.innerHeight; }
function pickAt(cx, cy) {
  ndc.set(cx / window.innerWidth * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const R = ray.ray;
  let best = null, bd = Infinity;
  const test = (id, x, z, h) => { pickBox.min.set(x - 4.5, 0, z - 4.5); pickBox.max.set(x + 4.5, h, z + 4.5); if (R.intersectBox(pickBox, pickHit)) { const d = pickHit.distanceTo(R.origin); if (d < bd) { bd = d; best = id; } } };
  for (const lot of LOTS) { const b = buildingAt(lot.id); if (b) test(lot.id, lot.x, lot.z, b.xs.length * H * S + 2); }
  if (save.race.xs) test('record', RECORD_PIER.x, RECORD_PIER.z, save.race.xs.length * H * S + 2);
  if (best) return best;
  if (R.intersectPlane(groundPlane, pickHit)) {
    for (const lot of LOTS) if (Math.abs(pickHit.x - lot.x) <= 9.5 && Math.abs(pickHit.z - lot.z) <= 9.5) return lot.id;
    for (const p of [PIER, RECORD_PIER]) if (Math.abs(pickHit.x - p.x) <= 13 && pickHit.z >= QUAY_Z && pickHit.z <= p.z + 28) return p.id;
  }
  return null;
}
function tapCity(cx, cy) {
  const id = pickAt(cx, cy);
  Sound.resume();
  if (!id) { closeSheet(); return; }
  Sound.click();
  if (id === 'pier') { selectRing(PIER); openPierSheet(false); return; }
  if (id === 'record') { selectRing(RECORD_PIER); openPierSheet(true); return; }
  openLotSheet(LOT_BY_ID[id]);
}
function hubDown(e) {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) gesture = { mode: 'tap', x0: e.clientX, y0: e.clientY, t0: e.timeStamp, tx: hubCam.tx, tz: hubCam.tz };
  else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; gesture = { mode: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), d: hubCam.d }; }
}
function hubMove(e) {
  if (!pointers.has(e.pointerId) || !gesture) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gesture.mode === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()], dist = Math.hypot(a.x - b.x, a.y - b.y);
    hubCam.d = gesture.d * gesture.dist / Math.max(20, dist); clampHub();
  } else if (gesture.mode !== 'pinch') {
    const dx = e.clientX - gesture.x0, dy = e.clientY - gesture.y0;
    if (gesture.mode === 'tap' && Math.hypot(dx, dy) > 8) gesture.mode = 'pan';
    if (gesture.mode === 'pan') {
      const k = worldPerPx();
      hubCam.tx = gesture.tx - dx * k;
      hubCam.tz = gesture.tz - dy * k / Math.max(0.5, Math.sin(hubPitch(hubCam.d)));
      clampHub();
    }
  }
}
function hubUp(e) {
  if (gesture && gesture.mode === 'tap' && pointers.size === 1 && e.timeStamp - gesture.t0 < 500) tapCity(e.clientX, e.clientY);
  pointers.delete(e.pointerId);
  if (pointers.size === 0) gesture = null;
  else if (gesture && gesture.mode === 'pinch') { const p = [...pointers.values()][0]; gesture = { mode: 'pan', x0: p.x, y0: p.y, tx: hubCam.tx, tz: hubCam.tz }; }
}

const stage = $('stage');
stage.addEventListener('pointerdown', e => {
  if (e.target.closest('button, .screen, .sheet, .modal, .scrim, .hub-top, .rail, .hub-bottom, .collect, label, select')) return;
  if (e.button > 0) return;
  e.preventDefault();
  try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  if (state === 'hub') { hubDown(e); return; }
  input.id = e.pointerId;
  press(e.clientY, e.timeStamp, e.pointerType === 'mouse' ? 'mouse' : 'touch');
});
stage.addEventListener('pointermove', e => { if (state === 'hub') hubMove(e); else if (e.pointerId === input.id) move(e.clientY, e.timeStamp); });
stage.addEventListener('pointerup', e => { if (state === 'hub') hubUp(e); else if (e.pointerId === input.id) release(); });
stage.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); gesture = null; input.down = false; input.pending = false; if (game) game.charge = null; });
stage.addEventListener('wheel', e => { if (state !== 'hub' || e.target.closest('.sheet, .modal, .screen')) return; e.preventDefault(); hubCam.d *= Math.exp(e.deltaY * 0.0012); clampHub(); }, { passive: false });
$('scrim').addEventListener('click', closeSheet);
$('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });

window.addEventListener('keydown', e => {
  const k = e.key;
  if (k === 'Escape') {
    if (!$('modal').hidden) { closeModal(); return; }
    if (!$('sheet').hidden) { closeSheet(); return; }
  }
  if (!$('modal').hidden || !$('sheet').hidden) return;
  if (state === 'play') {
    if (k === ' ' || k === 'Enter') { e.preventDefault(); if (!e.repeat) press(0, e.timeStamp, 'key'); }
    else if (k === 'ArrowDown') {
      e.preventDefault(); if (e.repeat) return;
      if (game && game.charge && featureOn('power')) { input.down = false; drop(e.shiftKey ? FORGE.power.tiers[3] : FORGE.power.tiers[1], false); }
      else { press(0, e.timeStamp, 'key'); release(); }
    } else if (k === 'ArrowUp' && game && game.charge && featureOn('recall')) { e.preventDefault(); input.down = false; recall(); }
    else if (k === 'Escape' || k === 'p' || k === 'P') { e.preventDefault(); pause(); }
  } else if (state === 'pause' && (k === 'Escape' || k === 'p' || k === 'P')) {
    e.preventDefault(); resume();
  } else if (state === 'hub') {
    const step = hubCam.d * 0.15;
    if (k === 'ArrowLeft') hubCam.tx -= step; else if (k === 'ArrowRight') hubCam.tx += step;
    else if (k === 'ArrowUp') hubCam.tz -= step; else if (k === 'ArrowDown') hubCam.tz += step;
    else if (k === '+' || k === '=') hubCam.d *= 0.85; else if (k === '-') hubCam.d *= 1.18;
    else return;
    e.preventDefault(); clampHub();
  }
});
window.addEventListener('keyup', e => { if ((e.key === ' ' || e.key === 'Enter') && input.down) { e.preventDefault(); release(); } });
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); persistNow(); hiddenAt = Date.now(); return; }
  if (!hiddenAt) return;
  const away = (Date.now() - hiddenAt) / 1000; hiddenAt = 0;
  if (away < 2) return;
  const before = save.bank;
  tickCity(Math.min(away, 7 * 24 * 3600));                 // income and occupancy kept going while we were away
  if (away > 600 && state === 'hub' && $('modal').hidden) showWelcome({ away, earned: save.bank - before });
  persist();
});
window.addEventListener('resize', () => { layout(); if (game && state !== 'play' && state !== 'fly') game.camY = game.hold ? endCam() : (game.kind === 'attract' ? introCam(game) : cameraTarget(game)); });

/* ---------------- Buttons ---------------- */
const click = (id, fn) => $(id).addEventListener('click', () => { Sound.click(); fn(); });
click('btnPlay', goToHub);
click('btnTitleRace', startRace);
click('btnTitleDaily', () => showDaily());
click('btnTitleSettings', () => showSettings(renderTitle));
click('pauseBtn', pause);
click('btnResume', resume);
click('btnRestart', () => { if (lastSession && game && game.kind !== 'city') beginSession(lastSession.kind, lastSession.opts); });
click('btnPauseSettings', () => showSettings(() => show('pause')));
click('btnQuit', stopBuilding);
click('collectBtn', () => { const n = collectIncome(); if (n) { toast(`+${fmt(n)} coins`, 'good'); for (let k = 0; k < 5; k++) setTimeout(() => popupAt(`+${fmt(Math.ceil(n / 5))}`, cam.look.x + (Math.random() - 0.5) * 40, 10 + Math.random() * 10, cam.look.z, 'coinpop'), k * 90); } updateHubHud(); });
click('btnContracts', showContracts);
click('btnDaily', showDaily);
click('btnRace', startRace);
click('btnTrophies', () => showTrophies());
click('btnMap', cycleOverlay);
$('gridBox').parentElement.addEventListener('click', () => { Sound.click(); showCityInfo(); });
click('btnMenu', () => openModal(`${head('Menu')}<div class="btns"><button class="btn" type="button" id="mInfo">City statistics</button><button class="btn" type="button" id="mHow">How to play</button><button class="btn" type="button" id="mSet">Settings</button><button class="btn ghost" type="button" id="mTitle">Title screen</button></div>`, p => {
  bind(p, '#mInfo', showCityInfo); bind(p, '#mHow', () => showHowto()); bind(p, '#mSet', () => showSettings());
  bind(p, '#mTitle', () => { $('modal').hidden = true; modalClose = null; persistNow(); toTitle(); });
}));
$('lvlChip').addEventListener('click', () => { Sound.click(); showCityInfo(); });
$('goal').addEventListener('click', () => {
  Sound.click();
  if (!buildingsList().length) { const lot = LOT_BY_ID['harbor-C2']; hubCam.tx = lot.x; hubCam.tz = lot.z + 10; openLotSheet(lot); }
  else if (contractsReady()) showContracts();
  else if (save.bank >= 50) $('collectBtn').click();
  else { const u = buildingsList().find(([, b]) => !b.done); if (u) { hubCam.tx = u[0].x; hubCam.tz = u[0].z + 10; openLotSheet(u[0]); } }
});

// Android back button (called by the APK wrapper).
window.skylineBack = () => {
  if (!$('modal').hidden) { closeModal(); return; }
  if (!$('sheet').hidden) { closeSheet(); return; }
  if (state === 'play') pause();
  else if (state === 'pause') resume();
  else if (state === 'result') leaveSession();
  else if (state === 'hub') toTitle();
  else if (state === 'title') { persistNow(); location.href = 'skyline://exit'; }
};

/* ---------------- Main loop (fixed 120 Hz steps, like the classic) ---------------- */
const STEP = 1 / 120;
let last = performance.now(), acc = 0, hubTimer = 0, slowTimer = 0, todTimer = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (state === 'pause') { if (pausedFrames++ > 1) return; } else pausedFrames = 0;
  adapt(dt);
  if (game && (state === 'title' || state === 'play' || state === 'result')) {
    sceneTime += dt; acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
  } else acc = 0;
  if (game) syncScene(game);
  stepCamera(dt);

  const building = !!game && state !== 'hub';
  const alt = building ? Math.max(0, cam.look.y) : 0;
  applySky(alt);
  updateSkyDressing(alt, dt);
  if (building) {
    const top = game.tower.length * H * S;
    aimSun(game.site.x, Math.max(0, cam.look.y - 12), game.site.z, 60);
    floodlight.intensity = todName === 'night' ? 2.2 : todName === 'sunset' ? 0.8 : 0;
    floodlight.position.set(game.site.x - 14, top + 30, game.site.z + 30); floodlight.target.position.set(game.site.x, top * 0.6, game.site.z);
  } else { aimSun(cam.look.x, 0, cam.look.z, Math.min(260, 60 + hubCam.d * 0.55)); floodlight.intensity = 0; }
  Sound.setWind(state === 'play' ? Math.min(1, alt / 200) : state === 'pause' ? 0 : 0.12);
  updateCars(dt); updateBursts(dt); updateDemolition(dt); updateProps(dt, now / 1000);
  overlayMesh.visible = state === 'hub' && !!OVERLAYS[save.overlay];
  updateWater(now / 1000);
  updateLife(dt, now / 1000, game && state !== 'hub' && game.kind !== 'attract' ? game.site : null);

  // City upkeep: occupancy and income tick in real time.
  hubTimer += dt; slowTimer += dt; todTimer += dt;
  if (hubTimer >= 0.25) {
    tickCity(hubTimer); hubTimer = 0;
    if (state === 'hub') updateHubHud();
  }
  if (slowTimer >= 2) {
    slowTimer = 0;
    checkPopAchievements(); checkPopContracts();
    if (state === 'hub') { ensureContracts(); if ($('modal').hidden) { const ups = checkLevelUp(); if (ups.length) showLevelUps(ups, updateHubHud); } }
    persist();
  }
  if (todTimer >= 60) { todTimer = 0; if (save.settings.tod === 'auto' && currentTod() !== todName) applyTimeOfDay(); }
  updateLabels(state === 'hub');
  if (state === 'hub') animateHubNumbers(dt);
  if (state === 'hub' && $('sheet').hidden && !buildingsList().length) { selectRing(LOT_BY_ID['harbor-C2']); ring.material.opacity = 0.55 + 0.45 * Math.sin(now / 180); }
  else ring.material.opacity = 0.9;

  if (state === 'play') {
    updateLiveHud();
    if (coach.id) { coach.t += dt; if (coach.t > 9 && coach.id !== 'tap') doneTip(coach.id); }
    const n = game.tower.length;
    if (n >= 3 && !save.tips.hold) showTip('hold');
    else if (n >= 6 && save.tips.hold && !save.tips.power) showTip('power');
    else if (n >= 9 && save.tips.power && !save.tips.recall) showTip('recall');
  }
  updatePops(state === 'pause' ? 0 : dt);
  renderer.render(scene, camera);
}

/* ---------------- Boot ---------------- */
loadSave();
document.body.classList.toggle('big', !!save.settings.bigText);
applyQuality();
applyTimeOfDay();
setCranePaint(save.cosmetics.crane);
{
  const refund = refundPending();
  rebuildLots();
  const off = catchUpOffline();
  if (buildingsList().length && off.away > 600) pendingWelcome = off;
  if (refund) setTimeout(() => toast(`Your last build was interrupted. Permit refunded: ${fmt(refund)} coins.`), 800);
}
toTitle();
requestAnimationFrame(frame);
