'use strict';
/* ==================================================================== *
 * Renderer, sky and time of day, block textures and module meshes,     *
 * particles, and the classic view/rig layout.                          *
 * ==================================================================== */

const canvas = $('gl');
let renderer;
try {
  renderer = new T.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance', stencil: false });
} catch (e) { fatal('This device could not start WebGL, which the 3D city needs.'); throw e; }
renderer.outputEncoding = T.sRGBEncoding;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fatal('The graphics context was lost. Reload the page to keep building.'); });
const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new T.Scene();
scene.fog = new T.FogExp2(0xe8d4ba, 0.0012);     // r128 applies fog after encoding, so fog colours are sRGB
const FOV = 40, TAN_HALF = Math.tan(FOV * Math.PI / 360);
const camera = new T.PerspectiveCamera(FOV, 1, 1, 9000);

/* ---------------- Time of day (GDD §12) ---------------- */
const TOD = {
  day:    { sun: '#ffe4c0', sunI: 2.3,  dir: [0.52, 0.5, 0.69],  hs: '#dbe8ff', hg: '#6d5d4c', hI: 0.6,  top: '#3d7ccc', mid: '#8fbfe8', hor: '#e8d4ba', exp: 1.02, win: 0,   lit: 0.05, stars: 0,   fog: 0.0012, water: '#1d5577', glint: 1 },
  sunset: { sun: '#ffa865', sunI: 2.0,  dir: [0.8, 0.2, 0.56],   hs: '#f3c7a6', hg: '#4a3a3a', hI: 0.5,  top: '#34487f', mid: '#d88c6c', hor: '#f4b777', exp: 1.05, win: 0.55, lit: 0.3, stars: 0.1, fog: 0.0013, water: '#3a4466', glint: 1.2 },
  night:  { sun: '#aebfff', sunI: 0.5,  dir: [-0.35, 0.62, 0.7], hs: '#56689a', hg: '#15161c', hI: 0.45, top: '#030713', mid: '#0b1530', hor: '#1c2a4b', exp: 1.12, win: 1.25, lit: 0.55, stars: 1, fog: 0.0016, water: '#0d1b2e', glint: 0.45 },
};
const SPACE = { top: '#04060f', mid: '#0a1030', hor: '#141d44' };
const ALT_MIX = [[0, 0], [210, 0.1], [390, 0.45], [540, 0.78], [720, 1]];   // the classic's sky darkening, metres
let todName = 'day', fogBoost = 0;
// Weather's effect on light and sky (events.js eases these toward the current weather).
const wxVis = { grey: 0, sun: 1, fog: 1, rain: 0, snow: 0, wind: 1, flash: 0 };
const regionSky = { hor: null };   // a region can warm or cool the horizon (world.js applyRegionLook)
function currentTod() {
  const pref = save.settings.tod;
  if (pref !== 'auto') return TOD[pref] ? pref : 'day';
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  return h >= 6.5 && h < 17.5 ? 'day' : (h >= 17.5 && h < 19.5) || (h >= 5.5 && h < 6.5) ? 'sunset' : 'night';
}

const sunDir = new T.Vector3(0.52, 0.5, 0.69).normalize();
const skyMat = new T.ShaderMaterial({
  uniforms: { cTop: { value: new T.Color() }, cMid: { value: new T.Color() }, cHor: { value: new T.Color() }, sun: { value: sunDir }, sunK: { value: 1 } },
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: [
    'uniform vec3 cTop; uniform vec3 cMid; uniform vec3 cHor; uniform vec3 sun; uniform float sunK; varying vec3 vD;',
    'void main(){',
    '  vec3 d = normalize(vD); float h = d.y;',
    '  vec3 c = mix(cHor, cMid, smoothstep(-0.02, 0.22, h));',
    '  c = mix(c, cTop, smoothstep(0.22, 0.8, h));',
    '  float s = max(dot(d, sun), 0.0);',
    '  c += vec3(1.0, 0.86, 0.62) * (pow(s, 600.0) * 1.4 + pow(s, 10.0) * 0.2) * sunK;',
    '  c = mix(c, cHor * 0.9, smoothstep(0.0, -0.25, h));',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'].join('\n'),
  side: T.BackSide, depthWrite: false, fog: false,
});
const sky = new T.Mesh(new T.SphereGeometry(4000, 32, 16), skyMat);
sky.frustumCulled = false; sky.renderOrder = -2; scene.add(sky);

const stars = (() => {
  const r = mulberry32(5), n = 700, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos[i * 3] = Math.cos(a) * s * 3500; pos[i * 3 + 1] = Math.abs(u) * 3500; pos[i * 3 + 2] = Math.sin(a) * s * 3500;
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
  const p = new T.Points(g, new T.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  p.frustumCulled = false; p.renderOrder = -1; scene.add(p);
  return p;
})();

const hemi = new T.HemisphereLight(0xffffff, 0x000000, 0.6);
const sun = new T.DirectionalLight(0xffffff, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 20, far: 520 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(hemi, sun, sun.target);

const skyTmp = { top: new T.Color(), mid: new T.Color(), hor: new T.Color() }, colA = new T.Color(), colB = new T.Color();
const winMats = [];            // block materials whose windows light up at night
const todHooks = [];           // world.js registers city-window and water updates here
function applyTimeOfDay() {
  todName = currentTod();
  const P = TOD[todName];
  hemi.color.copy(lin(P.hs)); hemi.groundColor.copy(lin(P.hg)); hemi.intensity = P.hI;
  sun.color.copy(lin(P.sun)); sun.intensity = P.sunI * wxVis.sun; hemi.intensity = P.hI * (0.8 + 0.2 * wxVis.sun);
  sunDir.set(...P.dir).normalize();
  renderer.toneMappingExposure = P.exp;
  for (const m of winMats) m.emissiveIntensity = P.win;
  for (const fn of todHooks) fn(P);
}
function altMix(alt) {
  for (let i = 1; i < ALT_MIX.length; i++) if (alt <= ALT_MIX[i][0]) { const a = ALT_MIX[i - 1], b = ALT_MIX[i]; return lerp(a[1], b[1], (alt - a[0]) / (b[0] - a[0])); }
  return 1;
}
// alt: camera height in metres. The sky darkens toward space as the tower climbs (from the classic).
function applySky(alt) {
  const P = TOD[todName], k = altMix(Math.max(0, alt));
  for (const key of ['top', 'mid', 'hor']) {
    skyTmp[key].set(P[key]);
    if (regionSky.hor && key !== 'top') skyTmp[key].lerp(colA.set(regionSky.hor), (key === 'hor' ? 0.35 : 0.12) * (todName === 'night' ? 0.25 : 1));
    if (wxVis.grey > 0.001) { const c = skyTmp[key], l = (0.3 * c.r + 0.55 * c.g + 0.15 * c.b) * (1 - 0.4 * wxVis.grey); c.lerp(colA.setRGB(l, l * 1.02, l * 1.06), wxVis.grey); }
    skyTmp[key].lerp(colB.set(SPACE[key]), k);
  }
  skyMat.uniforms.cTop.value.copy(skyTmp.top); skyMat.uniforms.cMid.value.copy(skyTmp.mid); skyMat.uniforms.cHor.value.copy(skyTmp.hor);
  skyMat.uniforms.sunK.value = (todName === 'night' ? 0.15 : 1) * (1 - clamp((alt - 400) / 300, 0, 0.8)) * (1 - wxVis.grey);
  scene.fog.color.copy(skyTmp.hor);
  scene.fog.density = fogBoost || P.fog * wxVis.fog * (1 - clamp((alt - 150) / 500, 0, 0.8));
  renderer.toneMappingExposure = P.exp * (1 - 0.1 * wxVis.grey) + wxVis.flash * 1.3;
  stars.material.opacity = Math.max(P.stars, clamp((alt - 270) / 240, 0, 1));
}

/* ---------------- Textures ---------------- */
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c) { const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = maxAniso; return t; }
function rect(g, color, x, y, w, h) { g.fillStyle = color; g.fillRect(x, y, w, h); }

// The classic block design (City Bloxx), painted at 6x so it stays crisp on a 3D face.
const NAVY = '#0b1733', NAVY_2 = '#22427f';
const GLASS = [['#c4e8ff', 7], ['#86c7f5', 7], ['#58a6e8', 5], ['#428fd4', 3], ['#3ea37c', 4]];   // sky reflection, top to bottom
function paintGlass(g, x, y, w, h) {
  let yy = y;
  for (const [c, n] of GLASS) { const rows = Math.min(Math.round(n * h / 26), y + h - yy); if (rows > 0) rect(g, c, x, yy, w, rows); yy += rows; }
  if (yy < y + h) rect(g, GLASS[GLASS.length - 1][0], x, yy, w, y + h - yy);
  rect(g, '#eef9ff', x, y + 1, 1, Math.round(h * 0.4));
}
function litGlass(g, x, y, w, h) {   // night: warm interior light in the same window shapes
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, '#ffe2a8'); gr.addColorStop(1, '#ffb45a');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
}
function paintPlants(g, x, y, w, h) {
  paintGlass(g, x, y, w, h);
  const r = mulberry32(x * 31 + y);
  for (let i = 0; i < 9; i++) { g.fillStyle = ['#2e8a3a', '#3fae4a', '#5cc85a'][i % 3]; g.beginPath(); g.arc(x + 2 + r() * (w - 4), y + h * 0.45 + r() * h * 0.45, 2 + r() * 2.5, 0, 7); g.fill(); }
  rect(g, '#7a5532', x, y + h - 4, w, 4);
}
// kind: foundation | floor | special. mode: 'color' | 'lit' (night emissive) | 'height' (relief for normals).
function reliefOf(st, c) {
  if (c === st.outline) return 0.62;
  if (c === NAVY || c === NAVY_2) return 0.78;               // window frames stand proud
  if (c === '#efe0b2' || c === '#d4bb7c') return 0.9;         // the slab edge sticks out most
  if (c === '#8c7644') return 0.55;
  if (c === st.light) return 0.8;
  if (c === st.dark) return 0.6;
  return 0.72;                                                 // wall
}
function paintBlock(g, st, kind, mode) {
  const lit = mode === 'lit' || mode === true, height = mode === 'height';
  const R = lit ? () => {} : height ? (c, x, y, w, h) => { const v = Math.round(reliefOf(st, c) * 255); rect(g, `rgb(${v},${v},${v})`, x, y, w, h); } : (c, x, y, w, h) => rect(g, c, x, y, w, h);
  const G = lit ? (x, y, w, h) => litGlass(g, x, y, w, h) : height ? (x, y, w, h) => rect(g, '#4a4a4a', x, y, w, h) : (x, y, w, h) => paintGlass(g, x, y, w, h);
  if (lit) rect(g, '#000000', 0, 0, W, H);
  R(st.outline, 0, 0, W, H);
  R(st.body, 1, 1, W - 2, H - 2);
  R(st.light, 1, 5, 2, H - 9);
  R(st.dark, W - 3, 5, 2, H - 9);
  R(st.dark, 1, H - 4, W - 2, 3);
  R('#efe0b2', 1, 1, W - 2, 1);          // concrete floor slab along the top
  R('#d4bb7c', 1, 2, W - 2, 2);
  R('#8c7644', 1, 4, W - 2, 1);
  if (kind === 'foundation') {
    R(NAVY, 7, 8, 26, H - 11);
    R(NAVY_2, 8, 9, 24, 1);
    G(9, 10, 22, 5);                       // transom
    R(NAVY, 9, 15, 22, 2);
    G(9, 17, 10, H - 21);                  // door leaves
    G(21, 17, 10, H - 21);
    R('#d8e6f5', 17, 28, 1, 3); R('#d8e6f5', 22, 28, 1, 3);
  } else if (kind === 'special') {
    R(NAVY, 4, 8, 32, 31);
    if (lit) litGlass(g, 5, 9, 30, 29); else if (height) rect(g, '#6a6a6a', 5, 9, 30, 29); else paintPlants(g, 5, 9, 30, 29);
    R(st.light, 4, 39, 32, 1);
  } else if (st.win === 'ribbon') {
    for (const y of [8, 24]) {
      R(NAVY, 4, y, 32, 14);
      G(5, y + 1, 30, 12);
      for (let x = 11; x < 35; x += 7) R(NAVY, x, y + 1, 1, 12);
      R(st.light, 4, y + 14, 32, 1);
    }
  } else {
    for (const x of [6, 22]) {
      R(NAVY, x, 8, 12, 31);
      R(NAVY_2, x + 1, 9, 10, 1);
      G(x + 2, 10, 8, 27);
      R(st.light, x, 39, 12, 1);
    }
    if (st.win === 'balcony') { R(st.dark, 3, 30, 34, 2); for (let x = 4; x < 37; x += 4) R(st.dark, x, 32, 1, 6); R(st.dark, 3, 37, 34, 1); }
  }
}
function blockTexture(st, kind, lit) {
  const K = 6, c = canvasOf(W * K, H * K), g = c.getContext('2d');
  g.scale(K, K); paintBlock(g, st, kind, lit ? 'lit' : 'color');
  return tex(c);
}
// Normal map from the painted relief (Sobel), so frames and the slab edge catch the light.
function blockNormal(st, kind) {
  const K = 6, w = W * K, h = H * K, c = canvasOf(w, h), g = c.getContext('2d');
  g.scale(K, K); paintBlock(g, st, kind, 'height');
  const src = g.getImageData(0, 0, w, h).data, out = g.createImageData(w, h), d = out.data;
  const hAt = (x, y) => src[((clamp(y, 0, h - 1) * w) + clamp(x, 0, w - 1)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (hAt(x + 1, y) - hAt(x - 1, y)) * 2.2, dy = (hAt(x, y + 1) - hAt(x, y - 1)) * 2.2;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.setTransform(1, 0, 0, 1, 0, 0); g.putImageData(out, 0, 0);
  const t = new T.CanvasTexture(c); t.anisotropy = maxAniso;
  return t;
}
const topTex = (() => {
  const c = canvasOf(128, 128), g = c.getContext('2d'), r = mulberry32(3);
  rect(g, '#cdb57f', 0, 0, 128, 128);
  for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.08)'; g.fillRect(r() * 128, r() * 128, 2, 2); }
  return tex(c);
})();
const latticeTex = (() => {
  const c = canvasOf(128, 128), g = c.getContext('2d');
  g.strokeStyle = '#ffffff'; g.lineWidth = 14; g.strokeRect(7, 7, 114, 114);
  g.lineWidth = 9; g.beginPath(); g.moveTo(7, 7); g.lineTo(121, 121); g.moveTo(121, 7); g.lineTo(7, 121); g.stroke();
  const t = tex(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
})();
function latticeMat(color, rx, ry) {
  const t = latticeTex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry);
  return new T.MeshStandardMaterial({ map: t, color: lin(color), alphaTest: 0.5, side: T.DoubleSide, roughness: 0.55, metalness: 0.25 });
}
const puffTex = (() => {
  const c = canvasOf(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return tex(c);
})();
const cloudTex = (() => {
  const c = canvasOf(256, 128), g = c.getContext('2d'), r = mulberry32(11);
  for (let i = 0; i < 14; i++) {
    const x = 256 * (0.18 + r() * 0.64), y = 128 * (0.45 + r() * 0.25), rad = 128 * (0.16 + r() * 0.2);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  return tex(c);
})();
function planetTex(draw) { const c = canvasOf(256, 256), g = c.getContext('2d'); draw(g); return tex(c); }

/* ---------------- Modules: the classic blocks in 3D ---------------- */
const geoModule = new T.BoxGeometry(W * S, H * S, DEPTH);
const matTop = new T.MeshStandardMaterial({ map: topTex, roughness: 0.9 });
const matBottom = new T.MeshStandardMaterial({ color: lin('#3a3325'), roughness: 1 });
const MATS = {};   // style -> kind -> [6 materials]; built on first use to save memory
function matsFor(style, kind) {
  const k = kind === 'roof' ? 'floor' : kind;
  const m = MATS[style] || (MATS[style] = {});
  if (!m[k]) {
    const st = STYLES[style];
    const side = new T.MeshStandardMaterial({ map: blockTexture(st, k, false), emissiveMap: blockTexture(st, k, true), normalMap: save.settings.quality === 'battery' ? null : blockNormal(st, k), emissive: new T.Color(0xffffff), emissiveIntensity: TOD[todName].win, roughness: 0.5, metalness: 0.06 });
    if (side.normalMap) side.normalScale.set(0.9, 0.9);
    winMats.push(side);
    m[k] = [side, side, matTop, matBottom, side, side];
  }
  return m[k];
}
const propCache = {};
function propMat(c) { return propCache[c] || (propCache[c] = new T.MeshStandardMaterial({ color: lin(c), roughness: 0.6 })); }
// Roof cap (classic ROOF_H = 10 px) with a prop per style. Built once per style, then cloned, so
// rebuilding the city never allocates new geometry.
const roofTemplates = {};
function roofProps(style) { return (roofTemplates[style] || (roofTemplates[style] = buildRoofProps(style))).clone(); }
function buildRoofProps(style) {
  const st = STYLES[style], g = new T.Group(), top = H * S / 2;
  const add = (geo, mat, x, y, z) => { const o = new T.Mesh(geo, mat); o.position.set(x, top + y, z); o.castShadow = true; g.add(o); return o; };
  add(new T.BoxGeometry(W * S + 0.2, 0.45, DEPTH + 0.2), propMat(st.outline), 0, 0.22, 0);
  if (style === 'blue' || style === 'cream') {
    add(new T.CylinderGeometry(0.85, 0.85, 1.3, 12), propMat('#7a5530'), 1.3, 1.1, 0);
    add(new T.CylinderGeometry(0.05, 0.05, 2.2, 6), propMat('#2a2a2a'), -1.8, 1.5, 0);
    add(new T.SphereGeometry(0.14, 8, 6), new T.MeshBasicMaterial({ color: '#ff5a4a' }), -1.8, 2.65, 0);
  } else if (style === 'red' || style === 'violet') {
    add(new T.BoxGeometry(4.4, 1.2, 0.18), propMat('#fff1e0'), 0, 1.2, 0);
    add(new T.BoxGeometry(4.6, 0.14, 0.24), propMat(st.outline), 0, 1.86, 0);
  } else if (style === 'green' || style === 'teal') {
    add(new T.BoxGeometry(4.2, 0.6, 4.2), new T.MeshStandardMaterial({ color: lin('#9fe8ff'), roughness: 0.2, metalness: 0.4 }), 0, 0.75, 0);
    add(new T.BoxGeometry(2.4, 0.5, 2.4), new T.MeshStandardMaterial({ color: lin('#d8f7ff'), roughness: 0.2, metalness: 0.4 }), 0, 1.3, 0);
  } else if (style === 'silver') {                      // Skyline Spire: observation deck and a needle spire
    const glass = new T.MeshStandardMaterial({ color: lin('#9fd4f0'), roughness: 0.12, metalness: 0.5, emissive: new T.Color('#ffd89a'), emissiveIntensity: 0.25 });
    add(new T.CylinderGeometry(4.3, 3.2, 2.6, 16), glass, 0, 1.6, 0);
    add(new T.CylinderGeometry(4.6, 4.6, 0.4, 16), propMat(st.light), 0, 3.1, 0);
    add(new T.CylinderGeometry(2.2, 3.4, 3.2, 12), propMat(st.body), 0, 4.9, 0);
    add(new T.ConeGeometry(1.6, 16, 8), propMat('#e8edf2'), 0, 14.5, 0);
    add(new T.CylinderGeometry(0.1, 0.18, 8, 6), propMat('#c9ced4'), 0, 26, 0);
    add(new T.SphereGeometry(0.35, 10, 8), new T.MeshBasicMaterial({ color: '#ff3b2f' }), 0, 30.2, 0);
  } else if (style === 'obsidian') {                    // Forge Megatower: stepped gold crown with a beacon
    const gold = new T.MeshStandardMaterial({ color: lin('#e8c55e'), roughness: 0.3, metalness: 0.7, emissive: new T.Color('#ffb640'), emissiveIntensity: 0.15 });
    add(new T.BoxGeometry(5.6, 1.2, 5.6), gold, 0, 1.0, 0);
    add(new T.BoxGeometry(4.2, 1.6, 4.2), propMat(st.body), 0, 2.4, 0);
    add(new T.BoxGeometry(3.4, 1.2, 3.4), gold, 0, 3.8, 0);
    add(new T.ConeGeometry(2.2, 7, 4), gold, 0, 7.9, 0).rotation.y = Math.PI / 4;
    add(new T.SphereGeometry(0.5, 12, 10), new T.MeshBasicMaterial({ color: '#fff1c2' }), 0, 11.8, 0);
  } else if (style === 'brick') {                      // Harbor Works: sawtooth skylights and a smoking chimney
    for (const x of [-1.8, 0, 1.8]) add(new T.BoxGeometry(1.6, 0.9, 4.6), propMat('#8a4a33'), x, 0.8, 0).rotation.z = 0.35;
    for (const x of [-1.8, 0, 1.8]) add(new T.BoxGeometry(0.1, 0.7, 4.4), new T.MeshStandardMaterial({ color: lin('#9fd4f0'), roughness: 0.2, metalness: 0.4 }), x + 0.62, 0.95, 0).rotation.z = 0.35;
    add(new T.CylinderGeometry(0.4, 0.55, 5.4, 12), propMat('#6e3322'), 2.2, 3.1, -2);
    add(new T.CylinderGeometry(0.47, 0.47, 0.5, 12), propMat('#f2f2ee'), 2.2, 5.0, -2);
    const smoke = new T.Object3D(); smoke.position.set(2.2, top + 5.9, -2); smoke.userData.smoke = 1; g.add(smoke);
  } else if (style === 'mint') {                        // School: rooftop sports court and a flag
    const court = add(new T.BoxGeometry(5, 0.12, 5), new T.MeshStandardMaterial({ map: courtTex(), roughness: 0.8 }), 0, 0.5, 0); court.castShadow = false;
    for (const [x, z] of [[-2.5, 0], [2.5, 0]]) add(new T.BoxGeometry(0.06, 1.2, 5), propMat('#2f6b45'), x, 1.1, z);
    add(new T.CylinderGeometry(0.05, 0.05, 3.4, 6), propMat('#d8d2c4'), -2.6, 2.2, 2.6);
    add(new T.BoxGeometry(1.4, 0.8, 0.04), propMat('#2f7fd8'), -1.9, 3.5, 2.6);
  } else if (style === 'white') {                       // Clinic and hospital: helipad and a red cross
    add(new T.CylinderGeometry(2.6, 2.6, 0.2, 24), new T.MeshStandardMaterial({ map: helipadTex(), roughness: 0.7 }), 0, 0.55, 0).rotation.y = Math.PI / 2;
    add(new T.BoxGeometry(0.5, 1.6, 0.14), propMat('#d8352a'), 2.4, 1.3, 3.05);
    add(new T.BoxGeometry(1.6, 0.5, 0.14), propMat('#d8352a'), 2.4, 1.3, 3.05);
  } else if (style === 'navy') {                        // Fire and police: light bar and radio mast
    add(new T.BoxGeometry(3, 0.9, 2), propMat('#d8d2c4'), -1, 0.9, -1);
    add(new T.BoxGeometry(0.9, 0.35, 0.5), new T.MeshBasicMaterial({ color: '#ff3b2f' }), -1.5, 1.55, -1);
    add(new T.BoxGeometry(0.9, 0.35, 0.5), new T.MeshBasicMaterial({ color: '#2f7fff' }), -0.5, 1.55, -1);
    add(new T.CylinderGeometry(0.06, 0.12, 6, 6), propMat('#c9ced4'), 2, 3.2, 1.5);
    add(new T.BoxGeometry(0.9, 0.08, 0.08), propMat('#c9ced4'), 2, 4.6, 1.5);
  } else if (style === 'orange') {                      // Arena: floodlight masts around a curved roof
    const dome = add(new T.SphereGeometry(3.1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: lin('#f4efe6'), roughness: 0.4, metalness: 0.2 }), 0, 0.45, 0); dome.scale.y = 0.4;
    for (const [x, z] of [[-2.7, -2.7], [2.7, -2.7], [-2.7, 2.7], [2.7, 2.7]]) {
      add(new T.CylinderGeometry(0.08, 0.12, 4.4, 6), propMat('#3a3f46'), x, 2.6, z);
      add(new T.BoxGeometry(1, 0.6, 0.2), new T.MeshStandardMaterial({ color: lin('#fff7dc'), emissive: new T.Color('#fff2c0'), emissiveIntensity: 0.8 }), x, 4.9, z).lookAt(0, 0, 0);
    }
  } else if (style === 'sand') {                        // University: clock cupola
    add(new T.BoxGeometry(2.6, 2.6, 2.6), propMat(st.light), 0, 1.75, 0);
    add(new T.ConeGeometry(2.2, 2.4, 4), propMat('#6e3322'), 0, 4.25, 0).rotation.y = Math.PI / 4;
    add(new T.CylinderGeometry(0.75, 0.75, 0.08, 20).rotateX(Math.PI / 2), propMat('#fbf6ea'), 0, 1.9, 1.34);
    add(new T.BoxGeometry(0.06, 0.55, 0.04), propMat('#2a2a2a'), 0, 2.1, 1.4);
    add(new T.CylinderGeometry(0.05, 0.05, 1.6, 6), propMat('#c9a86a'), 0, 6.2, 0);
  } else if (style === 'sky') {                         // Tech campus: glass pavilion and a dish
    add(new T.BoxGeometry(3.6, 1.6, 3.6), new T.MeshStandardMaterial({ color: lin('#a8e4f8'), roughness: 0.1, metalness: 0.5, emissive: new T.Color('#9fe8ff'), emissiveIntensity: 0.18 }), -0.6, 1.25, -0.4);
    const dish = add(new T.SphereGeometry(1.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), new T.MeshStandardMaterial({ color: lin('#eef1f4'), roughness: 0.4, side: T.DoubleSide }), 2, 1.6, 2); dish.rotation.x = -0.9;
    add(new T.CylinderGeometry(0.08, 0.08, 1.1, 6), propMat('#8d99a6'), 2, 1, 2);
  } else {
    add(new T.BoxGeometry(4.2, 0.45, 4.2), propMat(st.light), 0, 0.67, 0);
    add(new T.BoxGeometry(2.6, 0.45, 2.6), propMat(st.body), 0, 1.1, 0);
    add(new T.ConeGeometry(0.6, 2.4, 4), propMat('#fff3c9'), 0, 2.5, 0);
  }
  return g;
}
function courtTex() {
  const c = canvasOf(128, 128), g = c.getContext('2d');
  rect(g, '#3f8f5a', 0, 0, 128, 128); rect(g, '#c85a3a', 12, 12, 104, 104);
  g.strokeStyle = '#f4f4f0'; g.lineWidth = 3; g.strokeRect(14, 14, 100, 100); g.beginPath(); g.moveTo(64, 14); g.lineTo(64, 114); g.stroke();
  g.beginPath(); g.arc(64, 64, 14, 0, 7); g.stroke();
  return tex(c);
}
function helipadTex() {
  const c = canvasOf(128, 128), g = c.getContext('2d');
  rect(g, '#3a3f46', 0, 0, 128, 128);
  g.strokeStyle = '#f2f2ee'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke();
  g.fillStyle = '#f2f2ee'; g.fillRect(40, 34, 12, 60); g.fillRect(76, 34, 12, 60); g.fillRect(40, 58, 48, 12);
  return tex(c);
}
// Renovation extras on a finished roof: a green planter border and rows of solar panels.
const renoTemplates = {};
function renoProps(kind) { return (renoTemplates[kind] || (renoTemplates[kind] = buildRenoProps(kind))).clone(); }
function buildRenoProps(kind) {
  const g = new T.Group(), top = H * S / 2 + 0.45;
  if (kind === 'garden') {
    const leaf = new T.MeshStandardMaterial({ color: lin('#4f9d3f'), roughness: 0.9, flatShading: true });
    for (const z of [-2.55, 2.55]) {
      const bed = new T.Mesh(new T.BoxGeometry(5.6, 0.35, 0.8), propMat('#7a5532')); bed.position.set(0, top + 0.17, z); g.add(bed);
      for (let x = -2.3; x <= 2.3; x += 1.15) { const b = new T.Mesh(new T.IcosahedronGeometry(0.42, 0), leaf); b.position.set(x, top + 0.55, z); b.castShadow = true; g.add(b); }
    }
  } else if (kind === 'solar') {
    const panel = new T.MeshStandardMaterial({ color: lin('#1f3b66'), roughness: 0.18, metalness: 0.6 });
    for (const x of [-2.45, 2.45]) for (const z of [-1.2, 1.2]) { const p = new T.Mesh(new T.BoxGeometry(0.9, 0.08, 2), panel); p.position.set(x, top + 0.35, z); p.rotation.z = x < 0 ? 0.35 : -0.35; g.add(p); }
  }
  return g;
}
function makeModule(style, kind, roofStyle) {
  const g = new T.Group();
  const body = new T.Mesh(geoModule, matsFor(style, kind));
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  if (kind === 'roof') g.add(roofProps(roofStyle || style));
  return g;
}

/* ---------------- Rods (rope, slings, crane pendants) ---------------- */
const rodGeo = new T.CylinderGeometry(1, 1, 1, 6);
const steelMat = new T.MeshStandardMaterial({ color: lin('#15171b'), roughness: 0.5, metalness: 0.5 });
const UP = new T.Vector3(0, 1, 0), tmpA = new T.Vector3(), tmpB = new T.Vector3(), tmpD = new T.Vector3();
function rod(r, parent) { const m = new T.Mesh(rodGeo, steelMat); m.userData.r = r; (parent || scene).add(m); return m; }
function placeRod(m, a, b) {
  tmpD.subVectors(b, a); const len = tmpD.length();
  if (len < 1e-4) { m.visible = false; return; }
  m.visible = true;
  m.position.copy(a).addScaledVector(tmpD, 0.5);
  m.scale.set(m.userData.r, len, m.userData.r);
  m.quaternion.setFromUnitVectors(UP, tmpD.multiplyScalar(1 / len));
}

/* ---------------- Particles ---------------- */
const bursts = [];
function burst(x, y, z, count, color, speed, up, life, size, additive) {
  const n = reduceMotion ? Math.ceil(count / 3) : count;
  const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = x + (Math.random() - 0.5) * 1.2; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z + (Math.random() - 0.5) * 1.2;
    const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
    vel[i * 3] = Math.cos(a) * s; vel[i * 3 + 1] = up * (0.3 + Math.random() * 0.7); vel[i * 3 + 2] = Math.sin(a) * s;
  }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  const mat = new T.PointsMaterial({ map: puffTex, color, size, transparent: true, opacity: 0.9, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending });
  const pts = new T.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  bursts.push({ pts, vel, t: 0, life, grav: additive ? -4 : -2.5 });
}
function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i]; b.t += dt;
    if (b.t >= b.life) { scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); continue; }
    const p = b.pts.geometry.attributes.position.array;
    for (let k = 0; k < p.length; k += 3) { b.vel[k + 1] += b.grav * dt; p[k] += b.vel[k] * dt; p[k + 1] += b.vel[k + 1] * dt; p[k + 2] += b.vel[k + 2] * dt; b.vel[k] *= 0.985; b.vel[k + 2] *= 0.985; }
    b.pts.geometry.attributes.position.needsUpdate = true;
    b.pts.material.opacity = 0.9 * (1 - b.t / b.life);
  }
}
function clearBursts() { for (const b of bursts) b.t = b.life; }
// Fireworks for topping out and records.
function fireworks(x, y, z, n = 5) {
  const cols = ['#ffd76a', '#ff6a5a', '#7fd9ff', '#b8ff7a', '#ff9ef0'];
  for (let k = 0; k < n; k++) setTimeout(() => burst(x + (Math.random() - 0.5) * 30, y + 8 + Math.random() * 14, z + (Math.random() - 0.5) * 8, 40, cols[k % cols.length], 14, 4, 1.4, 2.2, true), k * 260);
}

/* ---------------- Classic view and rig ---------------- */
// The classic sized its screen at 240x320 or more; the 3D camera frames exactly that view.
const view = { w: 270, h: 360 };
let RIG = null;
function layout() {
  const w = window.innerWidth, h = window.innerHeight, dpr = window.devicePixelRatio || 1;
  const devW = Math.round(w * dpr), devH = Math.round(h * dpr);
  const s = Math.max(1, Math.floor(Math.min(devW / 240, devH / 320)));
  view.w = Math.ceil(devW / s); view.h = Math.ceil(devH / s);
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  pausedFrames = 0;           // resizing clears the canvas, so draw again even while paused
  const topScreen = Math.round(view.h * CFG.towerTopRatio);
  const gap = Math.max(CFG.minGap, Math.round(view.h * CFG.gapRatio));
  const ropeEnd = topScreen - gap - H - HANG.floor;
  const L = Math.max(Math.round(view.h * CFG.ropeRatio), ropeEnd + 40);
  RIG = { topScreen, gap, ropeEnd, L, pivot: ropeEnd - L, lowerDist: Math.min(L - 10, ropeEnd + H + HANG.foundation + 30) };
}
