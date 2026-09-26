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
  focus: [['Off', 0], ['Soft', 14], ['Strong', 30]],     // depth of field: blur radius in px at full defocus
  weather: ['clear', 'cloudy', 'wind', 'rain', 'fog', 'storm', 'snow'],
};
const photo = { yaw: 0, pitch: 0.6, dist: 200, target: new T.Vector3(), lens: 1, filter: 0, tod: 0, wx: 0, focus: 0, dof: 0, ui: true, drag: null };

/* ---------------- Depth of field: the scene into a texture with depth, then a disc blur that
   grows with each pixel's distance from the focus (what the camera orbits). ---------------- */
let dofRT = null, dofQuad = null, dofScene = null, dofCam = null;
function dofSetup(w, h) {
  if (!dofRT) {
    dofRT = new T.WebGLRenderTarget(w, h, { depthBuffer: true });
    dofRT.texture.encoding = T.sRGBEncoding;            // materials write display-ready colour, like the canvas
    dofRT.depthTexture = new T.DepthTexture(w, h); dofRT.depthTexture.type = T.UnsignedIntType;
    const taps = [];
    for (let i = 0; i < 32; i++) { const r = Math.sqrt((i + 0.5) / 32), a = i * 2.39996; taps.push(`vec2(${(r * Math.cos(a)).toFixed(4)}, ${(r * Math.sin(a)).toFixed(4)})`); }
    dofQuad = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({
      uniforms: { tColor: { value: dofRT.texture }, tDepth: { value: dofRT.depthTexture }, uRes: { value: new T.Vector2(w, h) }, uFocus: { value: 100 }, uMax: { value: 20 }, uNear: { value: 1 }, uFar: { value: 9000 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: [
        'uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uRes; uniform float uFocus; uniform float uMax; uniform float uNear; uniform float uFar; varying vec2 vUv;',
        'float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }',
        // Autofocus on whatever sits in the middle of the frame.
        'float coc(vec2 uv, float f){ float z = lin(texture2D(tDepth, uv).x); return clamp(abs(z - f) / max(z, 1.0) * 0.9, 0.0, 1.0) * uMax; }',
        'void main(){',
        '  float f = lin(texture2D(tDepth, vec2(0.5)).x);',
        '  float c0 = coc(vUv, f); vec3 acc = texture2D(tColor, vUv).rgb; float wsum = 1.0;',
        '  if (c0 > 0.5) {',
        `    vec2 T[32]; ${taps.map((t, i) => `T[${i}] = ${t};`).join(' ')}`,
        '    for (int i = 0; i < 32; i++) {',
        '      vec2 o = T[i] * c0 / uRes; vec2 uv = vUv + o;',
        '      float cs = coc(uv, f); float w = clamp(cs - length(T[i]) * c0 + 1.0, 0.0, 1.0);',   // a sample only spreads as far as its own blur
        '      acc += texture2D(tColor, uv).rgb * w; wsum += w;',
        '    }',
        '  }',
        '  gl_FragColor = vec4(acc / wsum, 1.0);',
        '}'].join('\n'),
      depthTest: false, depthWrite: false,
    }));
    dofQuad.frustumCulled = false;
    dofScene = new T.Scene(); dofScene.add(dofQuad); dofCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  if (dofRT.width !== w || dofRT.height !== h) { dofRT.setSize(w, h); dofQuad.material.uniforms.uRes.value.set(w, h); }
}
const dofSize = new T.Vector2();
function renderDof() {
  renderer.getDrawingBufferSize(dofSize);
  dofSetup(dofSize.x, dofSize.y);
  const U = dofQuad.material.uniforms;
  U.uFocus.value = camera.position.distanceTo(photo.target); U.uMax.value = photo.dof * renderer.getPixelRatio(); U.uNear.value = camera.near; U.uFar.value = camera.far;
  renderer.setRenderTarget(dofRT); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.render(dofScene, dofCam);
}
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
  set('focus', PHOTO.focus[photo.focus][0]);
  photo.dof = PHOTO.focus[photo.focus][1];
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
  else if (k === 'focus') photo.focus = (photo.focus + 1) % PHOTO.focus.length;
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
    if (photo.dof) renderDof(); else renderer.render(scene, camera);
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
  } else offerPicture(url, `SkylineForge_${dayKey()}_${Date.now() % 100000}.png`);
}
// On the web: through the viewer's save prompt when the page is hosted as a claude.ai artifact
// (plain download links do nothing there), otherwise an ordinary download link.
let downloadsNs;
async function offerPicture(url, name) {
  if (window.claude && typeof window.claude.use === 'function') {
    if (downloadsNs === undefined) downloadsNs = await window.claude.use('downloads').catch(() => null);
    if (downloadsNs) {
      const bin = atob(url.slice(url.indexOf(',') + 1)), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      try { await downloadsNs.save({ filename: name, data: new Blob([bytes]) }); toast('Picture saved', 'good'); }
      catch (e) { if (!e || e.code !== 'declined') toast('Could not save the picture here'); }
      return;
    }
  }
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  toast('Picture saved to your downloads', 'good');
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
