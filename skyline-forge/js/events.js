'use strict';
/* ==================================================================== *
 * Weather and city events (GDD §10, §12). Both run on the clock and    *
 * are the same for every player at the same time, so they need no      *
 * save state: weather every two hours, a city event every three.       *
 * ==================================================================== */

/* ---------------- Weather schedule ---------------- */
const regionKey = () => (typeof regionNow === 'function' ? regionNow().id : 'harbor');
function weatherAt(ms) {
  if (save.settings.weather === 'off') return 'clear';
  const slot = Math.floor(ms / (WEATHER_HOURS * 3600e3));
  const rng = mulberry32(hashStr(`wx:${slot}:${regionKey()}`));
  const weights = (typeof regionNow === 'function' && regionNow().weather) || {};
  const keys = Object.keys(WEATHER), w = keys.map(k => weights[k] ?? WEATHER[k].w);
  let r = rng() * w.reduce((s, v) => s + v, 0);
  for (let i = 0; i < keys.length; i++) { r -= w[i]; if (r <= 0) return keys[i]; }
  return 'clear';
}
const weatherNow = () => weatherAt(Date.now());
const weatherChangesIn = () => { const p = WEATHER_HOURS * 3600e3; return p - Date.now() % p; };
// A city build carries the weather it started in, so a change mid-build never surprises you.
function weatherMods() { const id = weatherNow(); return Object.assign({ weather: id }, WEATHER[id].mods || {}); }

/* ---------------- City events ---------------- */
function eventAt(ms) {
  if (skillLevel() < EVENT_LEVEL) return null;
  const slot = Math.floor(ms / (EVENT_HOURS * 3600e3)), n = EVENTS.length, epoch = Math.floor(slot / n);
  const order = EVENTS.map((e, i) => i), rng = mulberry32(hashStr('ev:' + epoch));
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return EVENTS[order[((slot % n) + n) % n]];
}
const eventNow = () => eventAt(Date.now());
const eventEndsIn = () => { const p = EVENT_HOURS * 3600e3; return p - Date.now() % p; };
const eventNext = () => eventAt(Date.now() + eventEndsIn() + 1000);
const eventInc = k => { const e = eventNow(), inc = (e && e.inc) || {}; return (inc[k] || 1) * (inc.all || 1); };

/* ---------------- Weather you can see and hear ---------------- */
const WXV = {
  clear:  { grey: 0,    sun: 1,    fog: 1,   rain: 0,   snow: 0, wind: 1 },
  cloudy: { grey: 0.35, sun: 0.72, fog: 1.25, rain: 0,  snow: 0, wind: 1.4 },
  wind:   { grey: 0.12, sun: 0.92, fog: 1,   rain: 0,   snow: 0, wind: 4 },
  rain:   { grey: 0.55, sun: 0.5,  fog: 1.9, rain: 0.7, snow: 0, wind: 1.6 },
  fog:    { grey: 0.4,  sun: 0.62, fog: 4.2, rain: 0,   snow: 0, wind: 0.6 },
  storm:  { grey: 0.78, sun: 0.34, fog: 2.3, rain: 1,   snow: 0, wind: 4.5, storm: 1 },
  snow:   { grey: 0.45, sun: 0.72, fog: 2.2, rain: 0,   snow: 1, wind: 1 },
};
let wxForce = null;                   // photo mode can pick the weather
let wxShown = 'clear';
function visibleWeather() {
  if (wxForce) return wxForce;
  if (game && game.kind === 'city') return game.mods.weather || 'clear';
  if (game && (game.kind === 'race' || game.kind === 'daily')) return game.mods.fog ? 'fog' : 'clear';
  return weatherNow();
}
// Rain streaks and snowflakes live in a box around whatever the camera is looking at.
const RAIN_N = 1400, SNOW_N = 1300;
const rainSeed = new Float32Array(RAIN_N * 3).map(() => Math.random());
const rainPos = new Float32Array(RAIN_N * 6);
const rainGeo = new T.BufferGeometry(); rainGeo.setAttribute('position', new T.BufferAttribute(rainPos, 3));
const rainMesh = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: '#c3cdd8', transparent: true, opacity: 0, depthWrite: false, fog: false }));
rainMesh.frustumCulled = false; rainMesh.visible = false; scene.add(rainMesh);
const snowSeed = new Float32Array(SNOW_N * 3).map(() => Math.random());
const snowPos = new Float32Array(SNOW_N * 3);
const snowGeo = new T.BufferGeometry(); snowGeo.setAttribute('position', new T.BufferAttribute(snowPos, 3));
const snowMesh = new T.Points(snowGeo, new T.PointsMaterial({ map: puffTex, color: '#ffffff', size: 6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
snowMesh.frustumCulled = false; snowMesh.visible = false; scene.add(snowMesh);
// Lightning: a jagged bolt far out over the harbour, a flash, and thunder a moment later.
const boltPos = new Float32Array(16 * 6);
const boltGeo = new T.BufferGeometry(); boltGeo.setAttribute('position', new T.BufferAttribute(boltPos, 3));
const boltMesh = new T.LineSegments(boltGeo, new T.LineBasicMaterial({ color: '#f4f0ff', transparent: true, opacity: 0, fog: false }));
boltMesh.frustumCulled = false; scene.add(boltMesh);
let boltTimer = 6, boltLife = 0, todRefresh = 0;
const wxCentre = new T.Vector3(), wxFwd = new T.Vector3();
function strike() {
  let x = (Math.random() - 0.5) * 1400, y = 520, z = -700 - Math.random() * 600;
  if (Math.random() < 0.5) z = 500 + Math.random() * 700;
  for (let i = 0; i < 16; i++) {
    const nx = x + (Math.random() - 0.5) * 60, ny = y - 30 - Math.random() * 12;
    boltPos.set([x, y, z, nx, ny, z], i * 6); x = nx; y = ny;
  }
  boltGeo.attributes.position.needsUpdate = true;
  boltLife = 0.18; wxVis.flash = 1;
  Sound.thunder(0.6 + Math.random() * 1.4);
}
function updateWeather(dt, t) {
  const name = visibleWeather(), V = WXV[name] || WXV.clear;
  wxShown = name;
  const k = 1 - Math.exp(-dt * 0.9);
  let changed = false;
  for (const key of ['grey', 'sun', 'fog', 'rain', 'snow', 'wind']) {
    const d = V[key] - wxVis[key];
    if (Math.abs(d) > 0.002) { wxVis[key] += d * k; changed = true; } else wxVis[key] = V[key];
  }
  todRefresh -= dt;
  if (changed && todRefresh <= 0) { todRefresh = 0.4; applyTimeOfDay(); }
  wxVis.flash *= Math.exp(-dt * 9);
  // The box follows the camera's point of interest.
  const dist = camera.position.distanceTo(cam.look);
  camera.getWorldDirection(wxFwd);
  wxCentre.copy(camera.position).addScaledVector(wxFwd, Math.min(dist, 60));
  const L = clamp(dist * 0.8, 36, 260);
  rainMesh.visible = wxVis.rain > 0.02;
  if (rainMesh.visible) {
    rainMesh.material.opacity = 0.55 * wxVis.rain;
    const len = L * 0.028, slant = 0.25 * wxVis.wind * len, n = Math.round(RAIN_N * Math.min(1, 0.4 + wxVis.rain));
    for (let i = 0; i < RAIN_N; i++) {
      const o = i * 6;
      if (i >= n) { rainPos[o + 1] = rainPos[o + 4] = -1e4; continue; }
      const x = wxCentre.x + (rainSeed[i * 3] - 0.5) * L, z = wxCentre.z + (rainSeed[i * 3 + 2] - 0.5) * L;
      const y = wxCentre.y + L * 0.5 - ((rainSeed[i * 3 + 1] + t * 30 / L) % 1) * L;
      rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z; rainPos[o + 3] = x + slant; rainPos[o + 4] = y + len; rainPos[o + 5] = z;
    }
    rainGeo.attributes.position.needsUpdate = true;
  }
  snowMesh.visible = wxVis.snow > 0.02;
  if (snowMesh.visible) {
    snowMesh.material.opacity = 0.85 * wxVis.snow;
    for (let i = 0; i < SNOW_N; i++) {
      const j = i * 3;
      snowPos[j] = wxCentre.x + (snowSeed[j] - 0.5) * L + Math.sin(t * 0.7 + i) * 1.2;
      snowPos[j + 1] = wxCentre.y + L * 0.5 - ((snowSeed[j + 1] + t * 2.2 / L) % 1) * L;
      snowPos[j + 2] = wxCentre.z + (snowSeed[j + 2] - 0.5) * L + Math.cos(t * 0.5 + i) * 1.2;
    }
    snowGeo.attributes.position.needsUpdate = true;
  }
  if (V.storm && !reduceMotion) { boltTimer -= dt; if (boltTimer <= 0) { boltTimer = 5 + Math.random() * 9; strike(); } }
  boltLife -= dt; boltMesh.material.opacity = boltLife > 0 ? 1 : 0;
  if (Sound.ctx) Sound.setRain(state === 'pause' ? 0 : wxVis.rain);
}
