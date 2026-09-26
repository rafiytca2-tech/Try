'use strict';
/* ==================================================================== *
 * Photo Mode (GDD §15): a free camera over your city, with time of     *
 * day, weather, lens and filter controls, hidden UI and a high-        *
 * resolution capture that saves to the gallery in the Android app.     *
 * ==================================================================== */

const PHOTO = {
  lenses: [['18mm', 62], ['35mm', 40], ['60mm', 24], ['100mm', 14]],
  filters: [['Natural', ''], ['Warm', 'sepia(.25) saturate(1.25) contrast(1.05)'], ['Cool', 'hue-rotate(-12deg) saturate(1.1) brightness(1.03)'], ['Vivid', 'saturate(1.5) contrast(1.1)'], ['Mono', 'grayscale(1) contrast(1.15)'], ['Vintage', 'sepia(.55) contrast(.92) brightness(1.05) saturate(.8)']],
  tods: ['day', 'sunset', 'night'],
  weather: ['clear', 'cloudy', 'wind', 'rain', 'fog', 'storm', 'snow'],
};
const photo = { yaw: 0, pitch: 0.6, dist: 200, target: new T.Vector3(), lens: 1, filter: 0, tod: 0, wx: 0, ui: true, drag: null };
const photoPose = { pos: new T.Vector3(), look: new T.Vector3() };
function photoCamPose(out) {
  const p = photo, cp = Math.cos(p.pitch);
  out.look.copy(p.target);
  out.pos.set(p.target.x + Math.sin(p.yaw) * cp * p.dist, p.target.y + Math.sin(p.pitch) * p.dist, p.target.z + Math.cos(p.yaw) * cp * p.dist);
  return out;
}
function enterPhoto() {
  closeSheet(); $('modal').hidden = true; modalClose = null; selectRing(null);
  photo.target.copy(cam.look); photo.dist = cam.pos.distanceTo(cam.look);
  const d = tmpD.subVectors(cam.pos, cam.look);
  photo.yaw = Math.atan2(d.x, d.z); photo.pitch = Math.asin(clamp(d.y / Math.max(1, d.length()), -1, 1));
  photo.tod = Math.max(0, PHOTO.tods.indexOf(todName));
  photo.wx = Math.max(0, PHOTO.weather.indexOf(wxShown));
  photo.ui = true;
  state = 'photo';
  $('hub').hidden = true; $('photo').hidden = false; $('photo').classList.remove('bare');
  renderPhotoBar();
}
function exitPhoto() {
  if (state !== 'photo') return;
  todForce = null; applyTimeOfDay();
  wxForce = null;
  camera.fov = FOV; camera.updateProjectionMatrix();
  $('fx').style.filter = ''; canvas.style.filter = '';
  $('photo').hidden = true;
  // Back to the city view above wherever the photo was aimed.
  hubCam.tx = photo.target.x; hubCam.tz = photo.target.z; hubCam.d = clamp(photo.dist, HUB_BOUNDS.d0, HUB_BOUNDS.d1); clampHub();
  state = 'fly';
  flyTo(hubPose, 0.8, () => enterHub());
}
function renderPhotoBar() {
  const set = (k, v) => { const el = $('photo').querySelector(`[data-p="${k}"] b`); if (el) el.textContent = v; };
  set('tod', { day: 'Day', sunset: 'Sunset', night: 'Night' }[PHOTO.tods[photo.tod]]);
  set('wx', WEATHER[PHOTO.weather[photo.wx]].name);
  set('lens', PHOTO.lenses[photo.lens][0]);
  set('filter', PHOTO.filters[photo.filter][0]);
  todForce = PHOTO.tods[photo.tod]; applyTimeOfDay();
  wxForce = PHOTO.weather[photo.wx];
  camera.fov = PHOTO.lenses[photo.lens][1]; camera.updateProjectionMatrix();
  canvas.style.filter = PHOTO.filters[photo.filter][1];
}
function photoCycle(k) {
  if (k === 'tod') photo.tod = (photo.tod + 1) % PHOTO.tods.length;
  else if (k === 'wx') photo.wx = (photo.wx + 1) % PHOTO.weather.length;
  else if (k === 'lens') photo.lens = (photo.lens + 1) % PHOTO.lenses.length;
  else if (k === 'filter') photo.filter = (photo.filter + 1) % PHOTO.filters.length;
  renderPhotoBar();
}
// Render one frame at up to 4K, apply the filter and a small caption, and hand it to the platform.
function capturePhoto(share) {
  const w = window.innerWidth, h = window.innerHeight, dpr = renderer.getPixelRatio();
  const scale = Math.min(3, 3840 / Math.max(w, h));
  let url = '';
  try {
    renderer.setPixelRatio(scale);
    renderer.setSize(w, h, false);
    renderer.render(scene, camera);
    const src = renderer.domElement, out = canvasOf(src.width, src.height), g = out.getContext('2d');
    g.filter = PHOTO.filters[photo.filter][1] || 'none';
    g.drawImage(src, 0, 0);
    g.filter = 'none';
    const fs = Math.round(out.height * 0.022);
    g.font = `700 ${fs}px "Barlow Condensed", sans-serif`; g.textBaseline = 'bottom';
    const cap = `SKYLINE FORGE · ${regionNow().name.toUpperCase()}${population() ? ` · ${fmt(population())} RESIDENTS` : ''}`;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillText(cap, fs * 1.1 + 2, out.height - fs * 0.9 + 2);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.fillText(cap, fs * 1.1, out.height - fs * 0.9);
    url = out.toDataURL('image/png');
  } catch (e) { url = ''; }
  renderer.setPixelRatio(dpr); layout();
  if (!url) { Sound.deny(); toast('Could not capture this picture'); return; }
  // Shutter flash
  const fl = $('flash'); fl.hidden = false; fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); setTimeout(() => { fl.hidden = true; }, 500);
  Sound.hiss(0.12, { type: 'highpass', freq: 3000, vol: 0.12 }); Sound.tone(1800, 0.05, { type: 'square', vol: 0.03, delay: 0.08 });
  save.stats.photos = (save.stats.photos || 0) + 1; persist(); bus.emit('photo', save.stats.photos);
  if (window.SkylineNative && window.SkylineNative.savePhoto) {
    const where = window.SkylineNative.savePhoto(url, !!share);
    toast(where ? `Saved to ${where}` : 'Could not save the picture', where ? 'good' : '');
  } else {
    const a = document.createElement('a');
    a.href = url; a.download = `SkylineForge_${dayKey()}_${Date.now() % 100000}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    toast('Picture saved to your downloads', 'good');
  }
}

/* ---------------- Input: drag to orbit, pinch or scroll to zoom, two fingers to pan ---------------- */
const photoPointers = new Map();
function photoDown(e) {
  photoPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = [...photoPointers.values()];
  if (pts.length === 1) photo.drag = { mode: 'tap', x: e.clientX, y: e.clientY, t: e.timeStamp, yaw: photo.yaw, pitch: photo.pitch };
  else if (pts.length === 2) {
    const [a, b] = pts;
    photo.drag = { mode: 'two', dist: Math.hypot(a.x - b.x, a.y - b.y), d0: photo.dist, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, t0: photo.target.clone() };
  }
}
function photoMove(e) {
  if (!photoPointers.has(e.pointerId) || !photo.drag) return;
  photoPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const D = photo.drag, pts = [...photoPointers.values()];
  if (D.mode === 'two' && pts.length >= 2) {
    const [a, b] = pts, dist = Math.hypot(a.x - b.x, a.y - b.y);
    photo.dist = clamp(D.d0 * D.dist / Math.max(20, dist), 12, 900);
    const k = photo.dist * 2 * Math.tan(camera.fov * Math.PI / 360) / window.innerHeight;
    const dx = (a.x + b.x) / 2 - D.mx, dy = (a.y + b.y) / 2 - D.my;
    photo.target.set(D.t0.x - (Math.cos(photo.yaw) * dx + Math.sin(photo.yaw) * dy) * k, D.t0.y, D.t0.z - (-Math.sin(photo.yaw) * dx + Math.cos(photo.yaw) * dy) * k);
    photo.target.x = clamp(photo.target.x, -700, 700); photo.target.z = clamp(photo.target.z, -700, 500);
  } else if (D.mode !== 'two') {
    const dx = e.clientX - D.x, dy = e.clientY - D.y;
    if (D.mode === 'tap' && Math.hypot(dx, dy) > 8) D.mode = 'orbit';
    if (D.mode === 'orbit') { photo.yaw = D.yaw - dx * 0.006; photo.pitch = clamp(D.pitch + dy * 0.005, 0.03, 1.5); }
  }
}
function photoUp(e) {
  const D = photo.drag;
  if (D && D.mode === 'tap' && photoPointers.size === 1 && e.timeStamp - D.t < 400) {
    photo.ui = !photo.ui; $('photo').classList.toggle('bare', !photo.ui);
  }
  photoPointers.delete(e.pointerId);
  if (!photoPointers.size) photo.drag = null;
  else if (D && D.mode === 'two') { const p = [...photoPointers.values()][0]; photo.drag = { mode: 'orbit', x: p.x, y: p.y, yaw: photo.yaw, pitch: photo.pitch }; }
}
function photoKey(k) {
  if (k === 'ArrowLeft') photo.yaw += 0.08; else if (k === 'ArrowRight') photo.yaw -= 0.08;
  else if (k === 'ArrowUp') photo.pitch = clamp(photo.pitch + 0.05, 0.03, 1.5); else if (k === 'ArrowDown') photo.pitch = clamp(photo.pitch - 0.05, 0.03, 1.5);
  else if (k === '+' || k === '=') photo.dist = Math.max(12, photo.dist * 0.88); else if (k === '-') photo.dist = Math.min(900, photo.dist * 1.14);
  else if (k === 'Enter' || k === ' ') capturePhoto(false);
  else if (k === 'h' || k === 'H') { photo.ui = !photo.ui; $('photo').classList.toggle('bare', !photo.ui); }
  else if (k === 'Escape') exitPhoto();
  else return false;
  return true;
}
