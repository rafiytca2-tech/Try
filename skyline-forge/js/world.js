'use strict';
/* ==================================================================== *
 * The city map: harbour, streets, backdrop skyline, your districts and *
 * lots, piers, persistent towers, placeables, the crane and the site.  *
 * World units are metres; north is -z and the harbour is to the south. *
 * ==================================================================== */

const BLOCK = 74, LOT_PITCH = 20, QUAY_Z = 44, WATER_Y = -1.8, CITY_N = 9;

/* ---------------- Lots and sites ---------------- */
// Each district is one block with a 3 x 3 grid of lots. Row A is the back, C faces the water.
const LOTS = [], LOT_BY_ID = {};
for (const d of DISTRICTS) {
  const bx = d.col * BLOCK;
  ['A', 'B', 'C'].forEach((row, r) => {
    for (let c = 0; c < 3; c++) {
      const lot = { id: `${d.id}-${row}${c + 1}`, d: d.id, x: bx + (c - 1) * LOT_PITCH, z: (r - 1) * LOT_PITCH, row, col: c + 1, water: row === 'C' };
      LOTS.push(lot); LOT_BY_ID[lot.id] = lot;
    }
  });
}
const PIER = { id: 'pier', x: BLOCK / 2, z: 86, pier: true };          // Sky Race and the daily challenge
const RECORD_PIER = { id: 'record', x: -BLOCK / 2, z: 86, pier: true }; // your best Sky Race tower
const lotDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const districtCols = new Set(DISTRICTS.map(d => d.col));

/* ---------------- Ground, harbour and streets ---------------- */
// Streets: asphalt with dashed centre lines and zebra crossings. One texture tile per 74 m block
// pitch, aligned so the tile edges run down the middle of every street.
const streetTex = (() => {
  const N = 256, k = N / BLOCK, c = canvasOf(N, N), g = c.getContext('2d'), r = mulberry32(21);
  rect(g, '#4b4f55', 0, 0, N, N);
  for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.05)'; g.fillRect(r() * N, r() * N, 1.5, 1.5); }
  const half = Math.round(7 * k);
  g.fillStyle = '#e3cf78';
  for (let s = half + 5; s < N - half - 10; s += 14) { g.fillRect(s, -1, 8, 2); g.fillRect(s, N - 1, 8, 2); g.fillRect(-1, s, 2, 8); g.fillRect(N - 1, s, 2, 8); }
  g.fillStyle = 'rgba(236,236,232,.85)';
  for (const cx of [0, N]) for (const cy of [0, N]) {
    for (let t = -half + 1; t < half - 1; t += 5) g.fillRect(cx + t, cy + (cy ? -half - 11 : half + 2), 3, 9);
    for (let t = -half + 1; t < half - 1; t += 5) g.fillRect(cx + (cx ? -half - 11 : half + 2), cy + t, 9, 3);
  }
  const t = tex(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
})();
{
  const cols = 80, h = 40 * BLOCK + (QUAY_Z - BLOCK / 2);         // west/north edges sit on street centres
  streetTex.repeat.set(cols, h / BLOCK); streetTex.offset.set(0, 40 - h / BLOCK);
  const land = new T.Mesh(new T.PlaneGeometry(cols * BLOCK, h).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: streetTex, roughness: 0.95 }));
  land.position.set(BLOCK / 2, -0.45, QUAY_Z - h / 2); land.receiveShadow = true; scene.add(land);
}
// Harbour water: rolling waves, the sky reflected at grazing angles, a sun (or moon) glint and foam at the quay.
const waterMat = new T.ShaderMaterial({
  uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, {
    uTime: { value: 0 }, uDeep: { value: new T.Color('#1d5577') }, uSky: { value: new T.Color('#b8d3e6') },
    uSun: { value: new T.Vector3(0.5, 0.5, 0.7) }, uSunCol: { value: new T.Color('#fff2d6') }, uGlint: { value: 1 },
  }]),
  vertexShader: [
    'uniform float uTime; varying vec3 vW;',
    '#include <fog_pars_vertex>',
    'void main() {',
    '  vec4 w = modelMatrix * vec4(position, 1.0);',
    '  w.y += 0.32 * sin(w.x * 0.045 + uTime * 1.1) + 0.22 * sin(w.z * 0.07 - uTime * 1.4) + 0.1 * sin((w.x + w.z) * 0.16 + uTime * 2.3);',
    '  vW = w.xyz;',
    '  vec4 mvPosition = viewMatrix * w;',
    '  gl_Position = projectionMatrix * mvPosition;',
    '  #include <fog_vertex>',
    '}'].join('\n'),
  fragmentShader: [
    'uniform float uTime; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uGlint; varying vec3 vW;',
    '#include <common>',
    '#include <fog_pars_fragment>',
    'void main() {',
    '  vec2 p = vW.xz; float t = uTime;',
    '  float dx = 0.0144 * cos(p.x * 0.045 + t * 1.1) + 0.016 * cos((p.x + p.y) * 0.16 + t * 2.3) + 0.027 * cos(p.x * 0.9 + p.y * 0.3 + t * 3.1) + 0.018 * cos(p.x * 2.1 - t * 4.0);',
    '  float dz = 0.0154 * cos(p.y * 0.07 - t * 1.4) + 0.016 * cos((p.x + p.y) * 0.16 + t * 2.3) + 0.033 * cos(p.y * 1.1 - p.x * 0.2 - t * 2.7) + 0.018 * cos(p.y * 1.9 + t * 3.6);',
    '  vec3 N = normalize(vec3(-dx * 3.0, 1.0, -dz * 3.0));',
    '  vec3 V = normalize(cameraPosition - vW);',
    '  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);',
    '  vec3 col = mix(uDeep, uSky, clamp(0.06 + fres * 0.92, 0.0, 1.0));',
    '  vec3 R = reflect(-V, N);',
    '  col += uSunCol * (pow(max(dot(R, normalize(uSun)), 0.0), 240.0) * 1.8 + pow(max(dot(R, normalize(uSun)), 0.0), 16.0) * 0.08) * uGlint;',
    '  float edge = smoothstep(6.0, 0.0, vW.z - 44.0);',
    '  col = mix(col, vec3(0.9, 0.94, 0.96), edge * (0.3 + 0.25 * sin(vW.x * 0.7 + t * 2.0)));',
    '  gl_FragColor = vec4(col, 1.0);',
    '  #include <fog_fragment>',
    '}'].join('\n'),
  fog: true,
});
waterMat.uniforms.uSun.value = sunDir;
{
  const near = new T.Mesh(new T.PlaneGeometry(6000, 1600, 240, 80).rotateX(-Math.PI / 2), waterMat);
  near.position.set(0, WATER_Y, QUAY_Z + 800); scene.add(near);
  const far = new T.Mesh(new T.PlaneGeometry(12000, 6000).rotateX(-Math.PI / 2), waterMat);
  far.position.set(0, WATER_Y - 0.3, QUAY_Z + 1600 + 3000); scene.add(far);
}
const quay = new T.Mesh(new T.BoxGeometry(6000, 2.2, 2), new T.MeshStandardMaterial({ color: lin('#8f8a80'), roughness: 0.9 }));
quay.position.set(0, -0.9, QUAY_Z); quay.receiveShadow = true; scene.add(quay);
todHooks.push(P => { waterMat.uniforms.uDeep.value.set(P.water); waterMat.uniforms.uSunCol.value.set(P.sun); waterMat.uniforms.uGlint.value = P.glint * wxVis.sun; });
function updateWater(t) {
  waterMat.uniforms.uTime.value = t; waterMat.uniforms.uSky.value.copy(skyMat.uniforms.cHor.value).lerp(skyMat.uniforms.cMid.value, 0.35);
  cityUniforms.uSkyTint.value.copy(skyMat.uniforms.cMid.value).convertSRGBToLinear();   // glass reflects the sky
}

const unitBox = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const mtx = new T.Matrix4(), q0 = new T.Quaternion(), vPos = new T.Vector3(), vScale = new T.Vector3(), col3 = new T.Color();
function instanced(geo, mat, list, place, shadows) {
  const m = new T.InstancedMesh(geo, mat, Math.max(1, list.length));
  m.count = list.length;
  list.forEach((it, i) => { place(it); m.setMatrixAt(i, mtx.compose(vPos, q0, vScale)); if (it.c) m.setColorAt(i, col3.set(it.c).convertSRGBToLinear()); });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.frustumCulled = false;
  if (shadows) { m.castShadow = true; m.receiveShadow = true; }
  scene.add(m);
  return m;
}

/* ---------------- Backdrop skyline (instanced) ---------------- */
const cityRand = mulberry32(2026);
const parks = new Set(['1,-2', '-2,-3', '3,-4', '-5,-2', '6,-3']);
const DT = { x: -90, z: -330 };
const blocks = [], buildings = [], roofBoxes = [], trees = [], spires = [], antennas = [], tanks = [], aviation = [];
for (let i = -CITY_N; i <= CITY_N; i++) {
  for (let j = -CITY_N; j <= 0; j++) {
    const cx = i * BLOCK, cz = j * BLOCK, mine = j === 0 && districtCols.has(i), park = parks.has(`${i},${j}`);
    blocks.push({ x: cx, z: cz, c: mine ? '#bdb6aa' : park ? '#6d8f4e' : '#b5afa4' });
    if (mine) continue;
    if (park) { for (let k = 0; k < 22; k++) trees.push({ x: cx + (cityRand() - 0.5) * 54, z: cz + (cityRand() - 0.5) * 54, s: 0.8 + cityRand() * 0.6 }); continue; }
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
      if (cityRand() < 0.1) continue;
      const lx = cx - 15 + a * 30 + (cityRand() - 0.5) * 3, lz = cz - 15 + b * 30 + (cityRand() - 0.5) * 3;
      const w = 15 + cityRand() * 11, d = 15 + cityRand() * 11;
      const dist = Math.hypot(lx - DT.x, lz - DT.z);
      let h = 9 + cityRand() * 22 + 190 * Math.exp(-((dist / 340) ** 2)) * Math.pow(cityRand(), 0.8);
      if (j === 0) h = Math.min(h, 18 + cityRand() * 16);        // low waterfront rows beside your districts
      else if (j === -1) h = Math.min(h, 30 + cityRand() * 40);
      const glassy = h > 40 && cityRand() < 0.38;
      const pal = glassy ? ['#6f8fa8', '#7d9bb0', '#5f7f99', '#8aa3b4', '#6a8394', '#8c9aa6'] : ['#a9b0b8', '#98a2ad', '#8793a0', '#b3aa9d', '#7b8896', '#a0968a', '#6b798a', '#bbb8b2', '#5c7087', '#c2b49c', '#9c8f84'];
      const col = pal[Math.floor(cityRand() * pal.length)];
      let top = h;
      if (h > 80 && cityRand() < 0.7) {
        const split = h * (0.45 + cityRand() * 0.2);
        buildings.push({ x: lx, z: lz, w, d, y: 0, h: split, c: col, g: glassy });
        buildings.push({ x: lx, z: lz, w: w * 0.72, d: d * 0.72, y: split, h: h - split, c: col, g: glassy });
        roofBoxes.push({ x: lx, z: lz, w: w * 0.34, d: d * 0.34, y: h, h: 3 + cityRand() * 4 });
        top = h + 5;
      } else {
        buildings.push({ x: lx, z: lz, w, d, y: 0, h, c: col, g: glassy });
        if (cityRand() < 0.6) roofBoxes.push({ x: lx + (cityRand() - 0.5) * w * 0.3, z: lz + (cityRand() - 0.5) * d * 0.3, w: w * 0.3, d: d * 0.3, y: h, h: 2 + cityRand() * 2.5 });
        else if (h < 50) tanks.push({ x: lx + (cityRand() - 0.5) * w * 0.4, z: lz + (cityRand() - 0.5) * d * 0.4, y: h, s: 0.8 + cityRand() * 0.6 });
      }
      // Skyscraper tops: spires, antennas, and red aviation lights (GDD §12 rooftop detail).
      if (h > 70) {
        const k = cityRand();
        if (k < 0.35) { const sh = 10 + cityRand() * 22; spires.push({ x: lx, z: lz, y: top, h: sh, r: Math.min(w, d) * 0.22 }); top += sh; }
        else if (k < 0.75) { const ah = 8 + cityRand() * 16; antennas.push({ x: lx, z: lz, y: top, h: ah }); top += ah; }
        aviation.push({ x: lx, y: top + 0.6, z: lz });
      }
    }
  }
}
const pavingCanvas = canvasOf(256, 256);
function paintPaving(base) {
  const N = 256, c = pavingCanvas, g = c.getContext('2d'), r = mulberry32(31);
  rect(g, base, 0, 0, N, N);
  g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 1;
  for (let s = 0; s < N; s += 8) { g.beginPath(); g.moveTo(s, 0); g.lineTo(s, N); g.moveTo(0, s); g.lineTo(N, s); g.stroke(); }
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.08)'; g.fillRect(r() * N, r() * N, 2, 2); }
  g.strokeStyle = '#f4f1ea'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, N - 5, N - 5);       // curb
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.strokeRect(5.5, 5.5, N - 11, N - 11);
}
paintPaving('#dedad2');
const pavingTex = tex(pavingCanvas);
const blockMesh = instanced(unitBox, new T.MeshStandardMaterial({ map: pavingTex, roughness: 0.95 }), blocks, b => { vPos.set(b.x, -0.45, b.z); vScale.set(60, 0.35, 60); });
blockMesh.receiveShadow = true;
// Facade windows are computed in world space, so every building shares the same storey rhythm.
const cityUniforms = { uLit: { value: 0.05 }, uWin: { value: 0.3 }, uSkyTint: { value: new T.Color('#8fbfe8') }, uSnow: { value: 0 } };
const cityMat = new T.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 });
cityMat.onBeforeCompile = sh => {
  sh.uniforms.uLit = cityUniforms.uLit; sh.uniforms.uWin = cityUniforms.uWin; sh.uniforms.uSnow = cityUniforms.uSnow;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vFP;\nvarying vec3 vFN;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 fpw = modelMatrix * instanceMatrix * vec4(position, 1.0);\nvFP = fpw.xyz;\nvFN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uLit;\nuniform float uWin;\nuniform float uSnow;\nvarying vec3 vFP;\nvarying vec3 vFN;\nfloat fWin = 0.0;\nfloat fLit = 0.0;\nfloat fHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
    .replace('#include <color_fragment>', [
      '#include <color_fragment>',
      'if (abs(vFN.y) < 0.5) {',
      '  float fu = abs(vFN.x) > 0.5 ? vFP.z : vFP.x;',
      '  vec2 cell = vec2(fu / 3.2, (vFP.y + 0.25) / 3.4);',
      '  vec2 f = fract(cell);',
      '  float w = step(0.14, f.x) * step(f.x, 0.86) * step(0.2, f.y) * step(f.y, 0.84) * step(1.0, cell.y);',
      '  float r = fHash(floor(cell) + floor(vFP.xz * 0.02) * 3.7);',
      '  vec3 glass = mix(vec3(0.07, 0.1, 0.14), vec3(0.3, 0.4, 0.5), clamp(r * 0.7 + f.y * 0.3, 0.0, 1.0));',
      '  diffuseColor.rgb = mix(diffuseColor.rgb, glass, w * 0.9);',
      '  fWin = w; fLit = w * step(1.0 - uLit, r);',
      '  diffuseColor.rgb *= mix(0.55, 1.0, step(3.6, vFP.y));',
      '} else { diffuseColor.rgb = mix(diffuseColor.rgb * 0.72, vec3(0.92, 0.94, 0.97), uSnow); }'].join('\n'))
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.16, fWin);')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.8, 0.5) * fLit * uWin;');
};
cityMat.customProgramCacheKey = () => 'city-windows-2';
// Glass curtain wall: full-height glazing with mullions and spandrel bands.
const glassMat = new T.MeshStandardMaterial({ roughness: 0.25, metalness: 0.12 });
glassMat.onBeforeCompile = sh => {
  sh.uniforms.uLit = cityUniforms.uLit; sh.uniforms.uWin = cityUniforms.uWin; sh.uniforms.uSkyTint = cityUniforms.uSkyTint; sh.uniforms.uSnow = cityUniforms.uSnow;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vFP;\nvarying vec3 vFN;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 fpw = modelMatrix * instanceMatrix * vec4(position, 1.0);\nvFP = fpw.xyz;\nvFN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uLit;\nuniform float uWin;\nuniform float uSnow;\nuniform vec3 uSkyTint;\nvarying vec3 vFP;\nvarying vec3 vFN;\nfloat gWin = 0.0;\nfloat gLit = 0.0;\nfloat gHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
    .replace('#include <color_fragment>', [
      '#include <color_fragment>',
      'if (abs(vFN.y) < 0.5) {',
      '  float fu = abs(vFN.x) > 0.5 ? vFP.z : vFP.x;',
      '  vec2 cell = vec2(fu / 1.7, (vFP.y + 0.25) / 3.4);',
      '  vec2 f = fract(cell);',
      '  float w = step(0.07, f.x) * step(f.x, 0.93) * step(0.16, f.y) * step(f.y, 0.9) * step(1.0, cell.y);',
      '  float r = gHash(floor(cell) + floor(vFP.xz * 0.02) * 3.7);',
      '  vec3 glass = diffuseColor.rgb * mix(0.75, 1.15, clamp(f.y * 0.7 + r * 0.25, 0.0, 1.0));',
      '  diffuseColor.rgb = mix(diffuseColor.rgb * 0.7, glass, w);',
      '  gWin = w; gLit = w * step(1.0 - uLit * 0.8, r);',
      '  diffuseColor.rgb *= mix(0.6, 1.0, step(3.6, vFP.y));',
      '} else { diffuseColor.rgb = mix(diffuseColor.rgb * 0.7, vec3(0.92, 0.94, 0.97), uSnow); }'].join('\n'))
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.7, 0.12, gWin);')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.86, 0.62) * gLit * uWin + uSkyTint * gWin * 0.22;');
};
glassMat.customProgramCacheKey = () => 'city-glass-2';
todHooks.push(P => { cityUniforms.uLit.value = P.lit; cityUniforms.uWin.value = 0.3 + P.win * 0.9; });
instanced(unitBox, cityMat, buildings.filter(b => !b.g), b => { vPos.set(b.x, b.y - 0.25, b.z); vScale.set(b.w, b.h, b.d); }, true);
instanced(unitBox, glassMat, buildings.filter(b => b.g), b => { vPos.set(b.x, b.y - 0.25, b.z); vScale.set(b.w, b.h, b.d); }, true);
const steelGrey = new T.MeshStandardMaterial({ color: lin('#b8c0c8'), roughness: 0.35, metalness: 0.7 });
instanced(new T.ConeGeometry(1, 1, 8).translate(0, 0.5, 0), steelGrey, spires, s => { vPos.set(s.x, s.y - 0.25, s.z); vScale.set(s.r, s.h, s.r); }, true);
instanced(new T.CylinderGeometry(0.18, 0.35, 1, 6).translate(0, 0.5, 0), steelGrey, antennas, a => { vPos.set(a.x, a.y - 0.25, a.z); vScale.set(1, a.h, 1); });
instanced(new T.CylinderGeometry(1.4, 1.4, 2.6, 10).translate(0, 1.3 + 1.6, 0), new T.MeshStandardMaterial({ color: lin('#8a6a4a'), roughness: 0.9 }), tanks, t => { vPos.set(t.x, t.y - 0.25, t.z); vScale.setScalar(t.s); }, true);
const roofBoxMesh = instanced(unitBox, new T.MeshStandardMaterial({ color: lin('#8d9096'), roughness: 0.8 }), roofBoxes, r => { vPos.set(r.x, r.y - 0.25, r.z); vScale.set(r.w, r.h, r.d); });
const treeTopGeo = new T.IcosahedronGeometry(2.4, 0).translate(0, 4.2, 0), trunkGeo = new T.CylinderGeometry(0.22, 0.3, 2.4, 5).translate(0, 1.2, 0);
// Region trees: round (temperate), palms (tropics and desert), pines (north).
const TREE_GEOS = {
  round: { top: treeTopGeo, trunk: trunkGeo },
  palm: { top: new T.IcosahedronGeometry(2.7, 0).scale(1, 0.32, 1).translate(0, 6.3, 0), trunk: new T.CylinderGeometry(0.16, 0.28, 6.2, 5).translate(0, 3.1, 0) },
  pine: { top: new T.ConeGeometry(2.1, 6.4, 7).translate(0, 5, 0), trunk: new T.CylinderGeometry(0.2, 0.28, 2, 5).translate(0, 1, 0) },
};
let treeGeos = TREE_GEOS.round;
const leafMat = new T.MeshStandardMaterial({ color: lin('#4f7d3f'), roughness: 0.9, flatShading: true }), barkMat = new T.MeshStandardMaterial({ color: lin('#5a4634'), roughness: 1 });
const treeTopMesh = instanced(treeTopGeo, leafMat, trees, t => { vPos.set(t.x, -0.25, t.z); vScale.setScalar(t.s); }, true);
const trunkMesh = instanced(trunkGeo, barkMat, trees, t => { vPos.set(t.x, -0.25, t.z); vScale.setScalar(t.s); });

/* ---------------- Traffic ---------------- */
const cars = [];
for (let k = 0; k < 190; k++) {
  const alongX = cityRand() < 0.55;
  const dir = cityRand() < 0.5 ? 1 : -1;
  // Streets run between blocks; the waterfront avenue (z = 37) passes in front of your districts.
  const line = alongX ? (Math.floor(cityRand() * (CITY_N + 1)) - CITY_N) * BLOCK + BLOCK / 2 : (Math.floor(cityRand() * (CITY_N * 2)) - CITY_N) * BLOCK + BLOCK / 2;
  cars.push({ alongX, line: line + dir * 3.1, pos: (cityRand() - 0.5) * 1400, v: (9 + cityRand() * 7) * dir, c: ['#e4e4e4', '#1f2833', '#a3262a', '#2c5aa0', '#d8b53c', '#6b7178'][Math.floor(cityRand() * 6)] });
}
const carMesh = instanced(new T.BoxGeometry(4.2, 1.4, 1.9).translate(0, 0.7, 0), new T.MeshStandardMaterial({ roughness: 0.4, metalness: 0.4 }), cars, () => { vPos.set(0, -1000, 0); vScale.set(1, 1, 1); });
const carQ = new T.Quaternion().setFromAxisAngle(UP, Math.PI / 2);
function updateCars(dt) {
  for (let k = 0; k < carMesh.count; k++) {
    const c = cars[k];
    c.pos += c.v * dt * trafficSlow;
    if (c.alongX) { if (c.pos > 700) c.pos -= 1400; else if (c.pos < -700) c.pos += 1400; mtx.compose(vPos.set(c.pos, -0.4, c.line), q0, vScale.set(1, 1, 1)); }
    else { if (c.pos > 40) c.pos -= 740; else if (c.pos < -700) c.pos += 740; mtx.compose(vPos.set(c.line, -0.4, c.pos), carQ, vScale.set(1, 1, 1)); }
    carMesh.setMatrixAt(k, mtx);
  }
  carMesh.instanceMatrix.needsUpdate = true;
}

/* ---------------- Sky dressing: clouds and the classic's planets ---------------- */
const clouds = [];
{
  const cr = mulberry32(99);
  for (let k = 0; k < 26; k++) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.85, depthWrite: false, fog: true }));
    const sc = 90 + cr() * 150;
    s.position.set((cr() - 0.5) * 1800, 150 + cr() * 260, -160 - cr() * 900);   // always behind the city
    s.scale.set(sc, sc * 0.5, 1); s.userData.v = 1 + cr() * 2;
    scene.add(s); clouds.push(s);
  }
}
const planets = [
  { tex: planetTex(g => { g.fillStyle = '#e6e2d3'; g.beginPath(); g.arc(128, 128, 100, 0, 7); g.fill(); g.fillStyle = '#c9c4b2'; for (const [x, y, r] of [[95, 100, 22], [160, 150, 16], [140, 80, 9]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } }), pos: [260, 620, -2200], size: 170, from: 280 },
  { tex: planetTex(g => { g.strokeStyle = '#cdb57a'; g.lineWidth = 10; g.beginPath(); g.ellipse(128, 128, 118, 30, 0, 0, 7); g.stroke(); g.fillStyle = '#e3c68a'; g.beginPath(); g.arc(128, 128, 62, 0, 7); g.fill(); g.fillStyle = '#c9a86a'; g.fillRect(66, 118, 124, 8); g.strokeStyle = '#cdb57a'; g.beginPath(); g.ellipse(128, 128, 118, 30, 0, 0, Math.PI); g.stroke(); }), pos: [-380, 900, -2400], size: 280, from: 420 },
  { tex: planetTex(g => { const b = ['#e9d6b3', '#c99a6b', '#f1e3c9', '#b7794d', '#ecd9b8', '#c28e61', '#e9d6b3']; g.save(); g.beginPath(); g.arc(128, 128, 110, 0, 7); g.clip(); b.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, 18 + i * 32, 256, 33); }); g.fillStyle = '#b8503a'; g.beginPath(); g.ellipse(160, 160, 22, 13, 0, 0, 7); g.fill(); g.restore(); }), pos: [120, 1250, -2600], size: 460, from: 560 },
].map(p => { const s = new T.Sprite(new T.SpriteMaterial({ map: p.tex, transparent: true, opacity: 0, depthWrite: false, fog: false })); s.position.set(...p.pos); s.scale.set(p.size, p.size, 1); s.renderOrder = -1; scene.add(s); return { s, from: p.from }; });
function updateSkyDressing(alt, dt) {
  for (const p of planets) p.s.material.opacity = clamp((alt - p.from) / 150, 0, 1);
  const fade = 0.85 * (1 - clamp((alt - 390) / 120, 0, 1));   // the classic's clouds thin out above 390 m
  const g = 1 - 0.55 * wxVis.grey;
  for (const c of clouds) { c.material.opacity = fade * (0.75 + 0.25 * Math.min(1, wxVis.grey * 2)); c.material.color.setRGB(g, g, g * 1.03); if (!c.visible) continue; c.position.x += c.userData.v * dt * wxVis.wind; if (c.position.x > 1100) c.position.x -= 2200; }
}

/* ---------------- Piers ---------------- */
const deckMat = new T.MeshStandardMaterial({ color: lin('#9c8f7c'), roughness: 0.9 });
const pileMat = new T.MeshStandardMaterial({ color: lin('#4a4038'), roughness: 1 });
for (const p of [PIER, RECORD_PIER]) {
  const deck = new T.Mesh(new T.BoxGeometry(26, 1.6, 70), deckMat);   // from the quay out into the harbour
  deck.position.set(p.x, -1.2, p.z - 7); deck.receiveShadow = true; deck.castShadow = true; scene.add(deck);
  for (let k = 0; k < 8; k++) { const pile = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 6, 6), pileMat); pile.position.set(p.x + (k % 2 ? 11 : -11), -4, p.z - 30 + Math.floor(k / 2) * 17); scene.add(pile); }
}
// The Record Pier's plinth.
const plinth = new T.Mesh(new T.BoxGeometry(12, 0.6, 12), new T.MeshStandardMaterial({ color: lin('#d8d2c4'), roughness: 0.6 }));
plinth.position.set(RECORD_PIER.x, -0.3, RECORD_PIER.z); plinth.receiveShadow = true; scene.add(plinth);

/* ---------------- Lot pads and placeables ---------------- */
const padTex = (() => {
  const c = canvasOf(128, 128), g = c.getContext('2d');
  rect(g, '#d6cfbf', 0, 0, 128, 128);
  const r = mulberry32(8); for (let i = 0; i < 300; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.08)'; g.fillRect(r() * 128, r() * 128, 2, 2); }
  g.strokeStyle = '#e8b93a'; g.lineWidth = 5; g.setLineDash([12, 9]); g.strokeRect(6, 6, 116, 116);
  return tex(c);
})();
const grassCanvas = canvasOf(64, 64);
function paintGrass([base, dark, light]) {
  const g = grassCanvas.getContext('2d'); rect(g, base, 0, 0, 64, 64);
  const r = mulberry32(4); for (let i = 0; i < 260; i++) { g.fillStyle = r() < 0.5 ? dark : light; g.fillRect(r() * 64, r() * 64, 2, 2); }
}
paintGrass(['#6c9a4c', '#5f8c42', '#7eab58']);
const grassTex = tex(grassCanvas);
const padGeo = new T.BoxGeometry(17, 0.3, 17).translate(0, -0.15, 0);
const padMats = {
  open: new T.MeshStandardMaterial({ map: padTex, roughness: 0.9 }),
  built: new T.MeshStandardMaterial({ color: lin('#a8a196'), roughness: 0.9 }),
  locked: new T.MeshStandardMaterial({ map: grassTex, roughness: 1 }),
};
const lotPads = {};
for (const lot of LOTS) { const m = new T.Mesh(padGeo, padMats.locked); m.position.set(lot.x, 0, lot.z); m.receiveShadow = true; scene.add(m); lotPads[lot.id] = m; }

// Placeable models, one group per lot.
const placeMeshes = {};
const placeTemplates = {};
function placeableModel(key) { return (placeTemplates[key] || (placeTemplates[key] = buildPlaceable(key))).clone(); }
function buildPlaceable(key) {
  const g = new T.Group();
  const box = (w, h, d, c, x = 0, y = 0, z = 0) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d).translate(0, h / 2, 0), propMat(c)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  if (key === 'park') {
    const lawn = new T.Mesh(new T.BoxGeometry(17, 0.35, 17).translate(0, -0.1, 0), new T.MeshStandardMaterial({ map: grassTex, roughness: 1 })); lawn.receiveShadow = true; g.add(lawn);
    box(2.2, 0.08, 17, '#d9ccb0', 0, 0.1, 0); box(17, 0.08, 2.2, '#d9ccb0', 0, 0.1, 0);
    const r = mulberry32(key.length * 7);
    for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5], [-6, 0.5], [6, -0.5]]) {
      const s = 0.55 + r() * 0.3, t = new T.Mesh(treeGeos.top, leafMat), k = new T.Mesh(treeGeos.trunk, barkMat);
      t.scale.setScalar(s); k.scale.setScalar(s); t.position.set(x, 0, z); k.position.set(x, 0, z); t.castShadow = true; g.add(t, k);
    }
  } else if (key === 'plaza') {
    box(17, 0.2, 17, '#cbbfa6', 0, 0, 0);
    const basin = new T.Mesh(new T.CylinderGeometry(3.4, 3.6, 0.9, 20), propMat('#9a917f')); basin.position.y = 0.45; g.add(basin);
    const pool = new T.Mesh(new T.CylinderGeometry(3.0, 3.0, 0.1, 20), new T.MeshStandardMaterial({ color: lin('#5aa6d6'), roughness: 0.1, metalness: 0.3 })); pool.position.y = 0.92; g.add(pool);
    const jet = new T.Mesh(new T.CylinderGeometry(0.15, 0.4, 3, 8), new T.MeshStandardMaterial({ color: lin('#d8f2ff'), transparent: true, opacity: 0.7 })); jet.position.y = 2.4; g.add(jet);
    for (const [x, z] of [[-6.5, -6.5], [6.5, -6.5], [-6.5, 6.5], [6.5, 6.5]]) { box(0.3, 4, 0.3, '#2a2d33', x, 0, z); box(0.8, 0.5, 0.8, '#ffe3a0', x, 4, z); }
  } else if (key === 'bus') {
    box(17, 0.15, 17, '#b9b2a4', 0, 0, 0);
    box(6, 0.2, 2.2, '#2f5d8a', 0, 2.6, 4); box(0.2, 2.6, 2, '#2a2d33', -2.9, 0, 4); box(0.2, 2.6, 2, '#2a2d33', 2.9, 0, 4); box(5.8, 2.2, 0.1, '#a7d3ef', 0, 0.3, 3);
    box(0.15, 3.4, 0.15, '#2a2d33', 4.2, 0, 6); box(1.2, 1.2, 0.1, '#2f8a4a', 4.2, 3.2, 6);
    const bus = box(8, 2.8, 2.5, '#d8b53c', -1, 0, 7.5); bus.castShadow = true;
  } else if (key === 'metro') {
    box(17, 0.15, 17, '#b9b2a4', 0, 0, 0);
    box(8, 3.2, 6, '#39424e', 0, 0, 0); box(8.4, 0.4, 6.4, '#e8e2d4', 0, 3.2, 0);
    const sign = new T.Mesh(new T.PlaneGeometry(2.2, 2.2), new T.MeshBasicMaterial({ map: (() => { const c = canvasOf(64, 64), g2 = c.getContext('2d'); rect(g2, '#d83a2f', 0, 0, 64, 64); g2.fillStyle = '#fff'; g2.font = 'bold 48px sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('M', 32, 35); return tex(c); })() }));
    sign.position.set(0, 4.8, 3.3); g.add(sign); box(0.2, 1.4, 0.2, '#2a2d33', 0, 3.4, 3.2);
    box(3, 2.2, 0.2, '#101418', 0, 0, 3.05);
  } else if (key === 'tram') {
    box(17, 0.15, 17, '#b9b2a4', 0, 0, 0);
    for (const z of [2.8, 4.2]) box(17, 0.12, 0.22, '#6b6f75', 0, 0.15, z);
    box(12, 0.5, 2.4, '#d9d2c2', 0, 0, -0.4);
    box(7, 0.2, 2.6, '#3a7d5c', 0, 3, -0.6); for (const x of [-3.2, 3.2]) box(0.18, 3, 0.18, '#2a2d33', x, 0, -1.6);
    box(6.6, 2.2, 0.08, '#a7d3ef', 0, 0.6, -1.75);
    box(13.5, 2.5, 2.4, '#c8342c', -0.5, 0.35, 3.5); box(13.7, 0.9, 2.46, '#1d2a38', -0.5, 1.5, 3.5); box(12.8, 0.3, 2, '#e8e2d4', -0.5, 2.85, 3.5);
    box(0.1, 1.4, 0.1, '#2a2d33', 0, 3.15, 3.5); box(2, 0.08, 0.1, '#2a2d33', 0, 4.5, 3.5);
    for (const x of [-7.6, 7.6]) { box(0.2, 5.4, 0.2, '#3a3f46', x, 0, 6.2); box(0.12, 0.12, 3, '#3a3f46', x, 5.2, 4.8); }
    box(17, 0.05, 0.05, '#1a1c20', 0, 4.55, 3.5);
  } else if (key === 'ferry') {
    box(17, 0.15, 17, '#b9b2a4', 0, 0, 0);
    box(11, 3.8, 7, '#ece6d8', 0, 0, -2.5); box(9, 2.6, 0.1, '#a7d3ef', 0, 0.5, 1.05);
    const roof = new T.Mesh(new T.CylinderGeometry(4.4, 4.4, 12, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), propMat('#2f5d8a'));
    roof.scale.set(1, 0.42, 1); roof.position.set(0, 4.7, -2.5); roof.castShadow = true; g.add(roof);
    box(2.4, 0.3, 24, '#8a8f96', 4, 0.1, 18); for (let z = 8; z < 30; z += 4) { box(0.08, 1.1, 0.08, '#3a3f46', 2.9, 0.4, z); box(0.08, 1.1, 0.08, '#3a3f46', 5.1, 0.4, z); }
    const boat = new T.Group(); boat.position.set(-1, WATER_Y + 0.3, 33.5); g.add(boat);
    const hull = new T.Mesh(new T.BoxGeometry(20, 1.8, 6.4).translate(0, 0.3, 0), propMat('#2f5d8a'));
    const deck = new T.Mesh(new T.BoxGeometry(14, 2.4, 5.6).translate(-1, 2.3, 0), propMat('#f2f2ee'));
    const win = new T.Mesh(new T.BoxGeometry(13.2, 0.8, 5.7).translate(-1, 2.6, 0), propMat('#26394f'));
    const bridge = new T.Mesh(new T.BoxGeometry(3.4, 1.4, 4.4).translate(3.6, 4.2, 0), propMat('#f2f2ee'));
    const funnel = new T.Mesh(new T.CylinderGeometry(0.6, 0.7, 2, 10).translate(-4, 4.4, 0), propMat('#d8b53c'));
    for (const m of [hull, deck, win, bridge, funnel]) { m.castShadow = true; boat.add(m); }
    boat.userData.bob = 1;
  } else if (key === 'rail') {
    box(17, 0.15, 17, '#b9b2a4', 0, 0, 0);
    for (const z of [4.6, 5.8, 7.2, 8.4]) box(17, 0.12, 0.2, '#6b6f75', 0, 0.15, z);
    box(17, 0.6, 1.8, '#d9d2c2', 0, 0, 2.6);
    box(17, 0.25, 4.2, '#5a6470', 0, 4.4, 4.6); for (const x of [-7, -2.4, 2.4, 7]) box(0.22, 4.4, 0.22, '#2a2d33', x, 0, 2.8);
    box(12.5, 5.2, 6, '#b88a5a', 0, 0, -4.8); box(13, 0.4, 6.5, '#7a5a3a', 0, 5.2, -4.8);
    const arch = new T.Mesh(new T.CylinderGeometry(3.25, 3.25, 12.6, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), new T.MeshStandardMaterial({ color: lin('#8fb0c4'), roughness: 0.25, metalness: 0.4, side: T.DoubleSide }));
    arch.scale.set(1, 0.6, 1); arch.position.set(0, 5.4, -4.8); arch.castShadow = true; g.add(arch);
    box(4, 3, 0.2, '#101418', 0, 0, -1.72);
    const clock = new T.Mesh(new T.CylinderGeometry(0.8, 0.8, 0.12, 20).rotateX(Math.PI / 2), propMat('#f6f1e4')); clock.position.set(0, 3.9, -1.7); g.add(clock);
    const train = box(16.4, 3, 2.6, '#e8e2d4', 0, 0.3, 5.2); train.castShadow = true;
    box(16.5, 0.5, 2.66, '#d8412f', 0, 1.1, 5.2); box(16.5, 0.8, 2.66, '#1d2a38', 0, 2, 5.2);
  } else if (key === 'power') {
    box(17, 0.15, 17, '#9a948a', 0, 0, 0);
    box(10, 5, 7, '#8f7f6d', -2.5, 0, -1.5); box(10.4, 0.5, 7.4, '#5e544a', -2.5, 5, -1.5);
    for (let x = -6.5; x < 2; x += 2) box(1.2, 1.6, 0.1, '#e8c56a', x, 2.6, 2.02);
    for (const [x, z] of [[5.2, -4.8], [5.2, 1.2]]) {
      const ch = new T.Mesh(new T.CylinderGeometry(0.85, 1.3, 22, 14).translate(0, 11, 0), propMat('#d8d2c8')); ch.position.set(x, 0, z); ch.castShadow = true; g.add(ch);
      for (const y of [16.5, 19.5]) { const band = new T.Mesh(new T.CylinderGeometry(0.98, 1.02, 1.3, 14), propMat('#c8342c')); band.position.set(x, y, z); g.add(band); }
      const smoke = new T.Object3D(); smoke.position.set(x, 22.4, z); smoke.userData.smoke = 1; g.add(smoke);
    }
    box(3, 2.2, 2.4, '#5a6470', 2.5, 0, 5.2); box(3, 2.2, 2.4, '#5a6470', -2, 0, 5.2);
    for (const x of [-7, 7]) { box(0.3, 7, 0.3, '#6b7178', x, 0, 6.5); box(3, 0.2, 0.2, '#6b7178', x, 6.4, 6.5); }
  } else if (key === 'tower') {
    const lawn = new T.Mesh(new T.BoxGeometry(17, 0.35, 17).translate(0, -0.1, 0), new T.MeshStandardMaterial({ map: grassTex, roughness: 1 })); lawn.receiveShadow = true; g.add(lawn);
    for (const [x, z] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) box(0.35, 9.5, 0.35, '#7c8791', x, 0, z);
    for (const y of [3, 6.2]) { box(4.8, 0.18, 0.18, '#7c8791', 0, y, 2.2); box(4.8, 0.18, 0.18, '#7c8791', 0, y, -2.2); box(0.18, 0.18, 4.8, '#7c8791', 2.2, y, 0); box(0.18, 0.18, 4.8, '#7c8791', -2.2, y, 0); }
    const tank = new T.Mesh(new T.CylinderGeometry(3.6, 3.6, 4.4, 20).translate(0, 11.7, 0), propMat('#6fa8c8')); tank.castShadow = true; g.add(tank);
    const band = new T.Mesh(new T.CylinderGeometry(3.66, 3.66, 0.8, 20).translate(0, 12, 0), propMat('#f2f2ee')); g.add(band);
    const cap = new T.Mesh(new T.ConeGeometry(3.9, 2.2, 20).translate(0, 15, 0), propMat('#56809a')); cap.castShadow = true; g.add(cap);
    box(3, 2.4, 3, '#c9c2b4', 5.5, 0, 4.5);
  } else if (key === 'solar') {
    const ground = new T.Mesh(new T.BoxGeometry(17, 0.3, 17).translate(0, -0.1, 0), new T.MeshStandardMaterial({ map: grassTex, roughness: 1, color: lin('#d9d6b0') })); ground.receiveShadow = true; g.add(ground);
    const panel = new T.MeshStandardMaterial({ color: lin('#1f3b66'), roughness: 0.18, metalness: 0.6 });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      const p = new T.Mesh(new T.BoxGeometry(4.6, 0.12, 2.6), panel); p.position.set(-5.4 + c * 5.4, 1.2, -5.4 + r * 3.8); p.rotation.x = -0.5; p.castShadow = true; g.add(p);
      box(0.12, 1, 0.12, '#8a8f96', -5.4 + c * 5.4, 0, -5.4 + r * 3.8 + 0.6);
    }
  } else if (key === 'wind') {
    const lawn = new T.Mesh(new T.BoxGeometry(17, 0.35, 17).translate(0, -0.1, 0), new T.MeshStandardMaterial({ map: grassTex, roughness: 1 })); lawn.receiveShadow = true; g.add(lawn);
    [[-4, -3, 0], [4.2, 3.5, 1.7]].forEach(([x, z, ph]) => {
      const t = new T.Mesh(new T.CylinderGeometry(0.32, 0.7, 26, 10).translate(0, 13, 0), propMat('#f2f4f6')); t.position.set(x, 0, z); t.castShadow = true; g.add(t);
      box(1.2, 1.1, 2.6, '#e8ebee', x, 25.6, z - 0.2);
      const hub = new T.Group(); hub.position.set(x, 26.15, z + 1.25); hub.rotation.z = ph; hub.userData.spin = 1.1; g.add(hub);
      const cone = new T.Mesh(new T.ConeGeometry(0.5, 1, 10).rotateX(Math.PI / 2), propMat('#f2f4f6')); cone.position.z = 0.3; hub.add(cone);
      for (let k = 0; k < 3; k++) { const b = new T.Mesh(new T.BoxGeometry(0.55, 11, 0.14).translate(0, 5.6, 0), propMat('#f7f8f9')); b.rotation.z = k * Math.PI * 2 / 3; b.castShadow = true; hub.add(b); }
    });
  } else if (key === 'waterworks') {
    box(17, 0.15, 17, '#b9b2a4', 0, 0, 0);
    [[-3.8, -3.4], [3.6, 3.2]].forEach(([x, z], k) => {
      const t = new T.Mesh(new T.CylinderGeometry(3.4, 3.4, 1.8, 24).translate(0, 0.9, 0), propMat('#c9c4b8')); t.position.set(x, 0, z); t.castShadow = t.receiveShadow = true; g.add(t);
      const w = new T.Mesh(new T.CylinderGeometry(3.05, 3.05, 0.1, 24), new T.MeshStandardMaterial({ color: lin('#4a8fb0'), roughness: 0.08, metalness: 0.3 })); w.position.set(x, 1.72, z); g.add(w);
      const arm = new T.Group(); arm.position.set(x, 1.9, z); arm.userData.spin = k ? -0.25 : 0.3; arm.userData.axis = 'y'; g.add(arm);
      const bar = new T.Mesh(new T.BoxGeometry(6.6, 0.25, 0.5), propMat('#e8c56a')); arm.add(bar);
    });
    box(5.6, 4, 4, '#dcd5c6', 4.4, 0, -5); box(5.9, 0.35, 4.3, '#2f5d8a', 4.4, 4, -5);
    box(0.5, 0.5, 6, '#2f7fd8', 2.2, 0.6, -1.2); box(5, 0.5, 0.5, '#2f7fd8', -1.5, 0.6, 0.2);
  }
  return g;
}

/* ---------------- Persistent towers (instanced by style and kind) ---------------- */
function floorKind(bp, i, n, done) {
  if (i === 0) return 'foundation';
  if (done && i === n - 1) return 'roof';
  return isSpecial(bp, i) ? 'special' : 'floor';
}
const TowerField = {
  pools: {}, roofs: [], hidden: new Set(),
  pool(key, need) {
    let p = this.pools[key];
    if (p && p.cap >= need) return p;
    const [style, kind] = key.split('|');
    const cap = Math.max(32, Math.ceil(need * 1.5));
    if (p) { scene.remove(p.mesh); if (p.mesh.dispose) p.mesh.dispose(); }
    const mesh = new T.InstancedMesh(geoModule, matsFor(style, kind), cap);
    mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.count = 0;
    scene.add(mesh);
    p = this.pools[key] = { mesh, cap };
    return p;
  },
  // Towers as { id, x, z, bp, xs, done, style? }.
  towers() {
    const out = [];
    for (const lot of LOTS) { const b = save.lots[lot.id]; if (b && b.bp && b.xs && b.xs.length) out.push({ id: lot.id, x: lot.x, z: lot.z, bp: BLUEPRINTS[b.bp], style: b.style, xs: b.xs, done: b.done, reno: b.reno }); }
    if (save.race.xs && save.race.xs.length) out.push({ id: 'record', x: RECORD_PIER.x, z: RECORD_PIER.z, bp: { style: save.race.style }, xs: save.race.xs, done: true });
    return out;
  },
  rebuild() {
    const buckets = {};
    for (const r of this.roofs) scene.remove(r);
    this.roofs.length = 0; lightStrips.length = 0;
    for (const t of this.towers()) {
      if (this.hidden.has(t.id)) continue;
      const n = t.xs.length;
      for (let i = 0; i < n; i++) {
        const kind = floorKind(t.bp, i, n, t.done), style = floorStyleOf(t.bp, i, t.style);
        const key = style + '|' + (kind === 'roof' ? 'floor' : kind);
        (buckets[key] || (buckets[key] = [])).push(t.x + t.xs[i] * S, (i * H + H / 2) * S, t.z);
        if (kind === 'roof') {
          const r = roofProps(roofStyleOf(t.bp, t.style)); r.position.set(t.x + t.xs[i] * S, (i * H + H / 2) * S, t.z);
          if (t.reno && t.reno.garden) r.add(renoProps('garden'));
          if (t.reno && t.reno.solar) r.add(renoProps('solar'));
          r.traverse(o => { o.castShadow = true; }); scene.add(r); this.roofs.push(r);
        }
      }
      // Feature lighting: LED strips up the corners, lit after dark.
      if (t.reno && t.reno.lights && t.done) for (const dx of [-1, 1]) for (const dz of [-1, 1]) lightStrips.push({ x: t.x + t.xs[0] * S + dx * (W * S / 2 + 0.06), z: t.z + dz * (DEPTH / 2 + 0.06), h: n * H * S, c: STYLES[floorStyleOf(t.bp, n - 1, t.style)].light });
    }
    // Unfinished towers wear scaffolding and keep a small crane beside them (GDD §13 site evolution).
    const scaf = [], cranes = [];
    for (const t of this.towers()) {
      if (t.done || this.hidden.has(t.id) || !t.xs.length) continue;
      const n = t.xs.length, top = n * H * S, x = t.x + t.xs[n - 1] * S;
      scaf.push({ x, y: Math.max(0, top - 2 * H * S), z: t.z, h: Math.min(n, 2) * H * S + 1.2 });
      cranes.push({ x: t.x - 7.5, z: t.z - 6.5, h: top + 9 });
    }
    if (typeof stadiumStage === 'function' && stadiumStage() > 0 && !stadiumDone()) cranes.push({ x: STADIUM.centre.x + 38, z: STADIUM.centre.z - 24, h: 46 });
    setScaffolds(scaf, cranes);
    for (const key of Object.keys(this.pools)) this.pools[key].mesh.count = 0;
    for (const [key, arr] of Object.entries(buckets)) {
      const p = this.pool(key, arr.length / 3);
      for (let k = 0; k < arr.length; k += 3) p.mesh.setMatrixAt(k / 3, mtx.compose(vPos.set(arr[k], arr[k + 1], arr[k + 2]), q0, vScale.set(1, 1, 1)));
      p.mesh.count = arr.length / 3;
      p.mesh.instanceMatrix.needsUpdate = true;
    }
    if (typeof refreshAviation === 'function') refreshAviation();
    setLightStrips();
    collectAnimated();
  },
};
const lightStrips = [];
const stripMat = new T.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, opacity: 0 });
const stripMesh = new T.InstancedMesh(new T.BoxGeometry(0.16, 1, 0.16).translate(0, 0.5, 0), stripMat, 160);
stripMesh.count = 0; stripMesh.frustumCulled = false; scene.add(stripMesh);
function setLightStrips() {
  stripMesh.count = Math.min(160, lightStrips.length);
  lightStrips.slice(0, 160).forEach((l, i) => { stripMesh.setMatrixAt(i, mtx.compose(vPos.set(l.x, 0, l.z), q0, vScale.set(1, l.h, 1))); stripMesh.setColorAt(i, col3.set(l.c)); });
  stripMesh.instanceMatrix.needsUpdate = true; if (stripMesh.instanceColor) stripMesh.instanceColor.needsUpdate = true;
}
todHooks.push(P => { stripMat.opacity = clamp(P.win * 0.8, 0, 1); stripMesh.visible = P.win > 0.2; });

/* ---------------- Moving parts: wind turbines, clarifier arms, moored boats and chimney smoke ---------------- */
const spinning = [], bobbing = [], smokeSrc = [];
function collectAnimated() {
  spinning.length = bobbing.length = smokeSrc.length = 0;
  const visit = o => { if (o.userData.spin) spinning.push(o); if (o.userData.bob) bobbing.push(o); if (o.userData.smoke) smokeSrc.push(o); };
  for (const m of Object.values(placeMeshes)) if (m.visible) m.traverse(visit);
  for (const r of TowerField.roofs) r.traverse(visit);
}
const SMOKE_PER = 6, smokeSprites = [];
const smokeTex = puffTex, vSmoke = new T.Vector3();
function updateProps(dt, t) {
  for (const o of spinning) o.rotation[o.userData.axis || 'z'] -= o.userData.spin * dt;
  for (const o of bobbing) { o.position.y = WATER_Y + 0.3 + Math.sin(t * 1.2) * 0.22; o.rotation.x = Math.sin(t * 0.9) * 0.02; }
  const need = Math.min(20, smokeSrc.length) * SMOKE_PER;
  while (smokeSprites.length < need) {
    const sp = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, color: '#d9d5cc', transparent: true, opacity: 0, depthWrite: false, fog: true }));
    scene.add(sp); smokeSprites.push(sp);
  }
  smokeSprites.forEach((sp, i) => {
    const src = smokeSrc[Math.floor(i / SMOKE_PER)];
    if (!src || i >= need) { sp.visible = false; return; }
    const k = ((t * 0.18 + (i % SMOKE_PER) / SMOKE_PER + Math.floor(i / SMOKE_PER) * 0.37) % 1);
    src.getWorldPosition(vSmoke);
    sp.visible = true;
    sp.position.set(vSmoke.x + k * 7 + Math.sin(t + i) * 0.4, vSmoke.y + k * 11, vSmoke.z - k * 2);
    const sc = 1.6 + k * 6.5; sp.scale.set(sc, sc, 1);
    sp.material.opacity = 0.55 * Math.sin(Math.PI * Math.min(1, k * 1.15)) * (todName === 'night' ? 0.5 : 1);
  });
}

/* ---------------- Map overlays (land value, services, pollution, transit) ---------------- */
const OVERLAYS = {
  value:     { name: 'Land value',  lo: 'Low',   hi: 'High',     cols: ['#d8412f', '#f2b90f', '#39d98a'] },
  services:  { name: 'Services',    lo: 'None',  hi: 'All three', cols: ['#6b7178', '#7fb8ff', '#39d98a'] },
  pollution: { name: 'Pollution',   lo: 'Clean', hi: 'Heavy',    cols: ['#39d98a', '#c9a13a', '#8a3a2a'] },
  transit:   { name: 'Transit',     lo: 'None',  hi: 'Metro',    cols: ['#6b7178', '#58a6e8', '#b98aff'] },
};
const OVERLAY_ORDER = ['', 'value', 'services', 'pollution', 'transit'];
const overlayMesh = new T.InstancedMesh(new T.PlaneGeometry(16.4, 16.4).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ transparent: true, opacity: 0.62, depthWrite: false, toneMapped: false }), LOTS.length);
overlayMesh.visible = false; overlayMesh.renderOrder = 3; overlayMesh.frustumCulled = false; scene.add(overlayMesh);
const ovA = new T.Color(), ovB = new T.Color();
function ramp(cols, k) { k = clamp(k, 0, 1); const i = k < 0.5 ? 0 : 1, f = k < 0.5 ? k * 2 : (k - 0.5) * 2; return ovA.set(cols[i]).lerp(ovB.set(cols[i + 1]), f); }
function refreshOverlay() {
  const mode = save.overlay, O = OVERLAYS[mode];
  overlayMesh.visible = !!O && state === 'hub';
  if (!O || !City.ctx) return;
  LOTS.forEach((lot, i) => {
    const c = City.ctx[lot.id], owned = !!save.districts[lot.d];
    const k = mode === 'value' ? (c.lv - 0.8) / 0.8 : mode === 'services' ? Object.keys(c.svc).length / 3 : mode === 'pollution' ? c.poll / 2 : c.transit / 0.25;
    overlayMesh.setMatrixAt(i, mtx.compose(vPos.set(lot.x, 0.12, lot.z), q0, vScale.setScalar(owned ? 1 : 0.0001)));
    overlayMesh.setColorAt(i, ramp(O.cols, k));
  });
  overlayMesh.instanceMatrix.needsUpdate = true; overlayMesh.instanceColor.needsUpdate = true;
}

/* ---------------- Traffic follows the simulation ---------------- */
let trafficK = 0.5, trafficSlow = 1;
function setTraffic(A) {
  trafficK = A ? clamp(0.3 + 0.7 * A.commute / Math.max(1, A.roadCap), 0.3, 1) : 0.5;
  trafficSlow = A ? 1 / (1 + 1.5 * Math.min(1, A.congestion)) : 1;
  carMesh.count = Math.round(carBase * trafficK);
}

// Pads, placeables and towers from the save.
function rebuildLots() {
  for (const lot of LOTS) {
    const b = save.lots[lot.id], owned = !!save.districts[lot.d];
    const pad = lotPads[lot.id];
    pad.material = !owned ? padMats.locked : b ? padMats.built : padMats.open;
    const want = b && b.place ? b.place : null, have = placeMeshes[lot.id];
    if (have && (!want || have.userData.key !== want)) { scene.remove(have); delete placeMeshes[lot.id]; }
    if (want && !placeMeshes[lot.id]) { const m = placeableModel(want); m.userData.key = want; m.position.set(lot.x, 0, lot.z); scene.add(m); placeMeshes[lot.id] = m; }
    pad.visible = !(want === 'park');
    if (placeMeshes[lot.id]) placeMeshes[lot.id].visible = !TowerField.hidden.has(lot.id);
  }
  TowerField.rebuild();
}
// Hide whatever stands between the construction camera and the site (GDD §14: never cover the tower).
function hideOccluders(site, camZ, aspect) {
  const hidden = new Set([site.id]);
  const all = LOTS.concat([RECORD_PIER]);
  for (const lot of all) {
    if (lot.id === site.id || lot.z <= site.z + 4) continue;
    const dz = camZ - lot.z;
    if (dz <= 0) continue;
    const half = dz * TAN_HALF * aspect + 5;
    if (Math.abs(lot.x - site.x) < half) hidden.add(lot.id);
  }
  setHidden(hidden);
}
function setHidden(set) {
  const same = set.size === TowerField.hidden.size && [...set].every(id => TowerField.hidden.has(id));
  if (same) return;
  TowerField.hidden = set;
  for (const [id, m] of Object.entries(placeMeshes)) m.visible = !set.has(id);
  TowerField.rebuild();
}

/* ---------------- Scaffolding and site cranes for unfinished towers ---------------- */
const scafMat = latticeMat('#c9ced4', 3, 2);
const siteCraneMat = latticeMat('#f2b90f', 1, 8);
const scafMesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), scafMat, 80);
const siteMast = new T.InstancedMesh(new T.BoxGeometry(1.3, 1, 1.3).translate(0, 0.5, 0), siteCraneMat, 80);
const siteJib = new T.InstancedMesh(new T.BoxGeometry(18, 1.1, 1.1).translate(5, 0, 0), siteCraneMat, 80);
for (const m of [scafMesh, siteMast, siteJib]) { m.count = 0; m.frustumCulled = false; m.castShadow = true; scene.add(m); }
const jibQ = new T.Quaternion().setFromAxisAngle(UP, Math.atan2(-6.5, 7.5));
function setScaffolds(scaf, cranes) {
  scafMesh.count = Math.min(80, scaf.length);
  scaf.slice(0, 80).forEach((s, i) => scafMesh.setMatrixAt(i, mtx.compose(vPos.set(s.x, s.y, s.z), q0, vScale.set(W * S + 1, s.h, DEPTH + 1))));
  siteMast.count = siteJib.count = Math.min(80, cranes.length);
  cranes.slice(0, 80).forEach((c, i) => {
    siteMast.setMatrixAt(i, mtx.compose(vPos.set(c.x, -0.3, c.z), q0, vScale.set(1, c.h, 1)));
    siteJib.setMatrixAt(i, mtx.compose(vPos.set(c.x, c.h - 0.6, c.z), jibQ, vScale.set(1, 1, 1)));
  });
  for (const m of [scafMesh, siteMast, siteJib]) m.instanceMatrix.needsUpdate = true;
}
// Demolition: the floors topple from the top down in a cloud of dust, instead of vanishing.
const demolishing = [];
function demolishFx(lot, b) {
  const bp = BLUEPRINTS[b.bp], n = b.xs.length;
  for (let i = 0; i < n; i++) {
    const kind = floorKind(bp, i, n, b.done), m = makeModule(floorStyleOf(bp, i, b.style), kind, roofStyleOf(bp, b.style));
    m.position.set(lot.x + b.xs[i] * S, (i * H + H / 2) * S, lot.z);
    scene.add(m);
    demolishing.push({ m, delay: (n - 1 - i) * 0.07, vy: 0, vx: (Math.random() - 0.5) * 4, vz: (Math.random() - 0.5) * 4, spin: (Math.random() - 0.5) * 2, t: 0 });
  }
  for (let k = 0; k < 4; k++) setTimeout(() => burst(lot.x, 2 + k * 3, lot.z, 40, '#cfc6b4', 10, 4, 2.2, 5, false), k * 250);
}
function updateDemolition(dt) {
  for (let i = demolishing.length - 1; i >= 0; i--) {
    const d = demolishing[i];
    d.t += dt; if (d.t < d.delay) continue;
    d.vy -= 26 * dt; d.m.position.y += d.vy * dt; d.m.position.x += d.vx * dt; d.m.position.z += d.vz * dt;
    d.m.rotation.z += d.spin * dt; d.m.rotation.x += d.spin * 0.5 * dt;
    if (d.m.position.y < -4) { scene.remove(d.m); demolishing.splice(i, 1); }
  }
}

/* ---------------- Selection ring (hub) ---------------- */
const ring = new T.Mesh(new T.RingGeometry(10.2, 11.4, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#ffc21a', transparent: true, opacity: 0.9, depthWrite: false }));
ring.visible = false; ring.renderOrder = 2; scene.add(ring);
function selectRing(lot) { ring.visible = !!lot; if (lot) ring.position.set(lot.x, 0.25, lot.z); }

/* ---------------- Construction site dressing ---------------- */
const siteGroup = new T.Group(); scene.add(siteGroup);
{
  const slab = new T.Mesh(new T.BoxGeometry(CFG.slabHalf * S * 2, 0.5, CFG.slabHalf * S * 2).translate(0, -0.25, 0), matTop);
  slab.receiveShadow = true; siteGroup.add(slab);
  const fenceMat = latticeMat('#2f6b45', 3, 1.2);
  for (const [x, z, r] of [[0, -8.2, 0], [-8.2, -1, Math.PI / 2], [8.2, -1, Math.PI / 2]]) {
    const f = new T.Mesh(new T.BoxGeometry(r ? 14 : 16.4, 2, 0.08).translate(0, 1, 0), fenceMat); f.position.set(x, 0, z); f.rotation.y = r; siteGroup.add(f);
  }
}
const floodlight = new T.SpotLight(0xfff0d8, 0, 0, 0.5, 0.6, 1);
floodlight.position.set(-14, 30, 26); scene.add(floodlight, floodlight.target);
function setSite(site) {
  siteGroup.visible = !!site;
  if (!site) { floodlight.intensity = 0; return; }
  siteGroup.position.set(site.x, site.pier ? 0.02 : 0, site.z);
}

/* ---------------- Crane (beside the site, like a real tower crane) ---------------- */
const MAST_DX = -30, MAST_DZ = -10, TROLLEY = 1.6;   // between lot columns and rows, so it never hits a tower
const JIB_REACH = Math.hypot(MAST_DX, MAST_DZ);
const Crane = { root: new T.Group(), head: new T.Group(), mats: [] };
{
  const C = Crane, jl = JIB_REACH + 8, cl = 14;
  scene.add(C.root); C.root.add(C.head);
  const lm = (rx, ry) => { const m = latticeMat('#f2b90f', rx, ry); C.mats.push(m); return m; };
  C.mastMat = lm(1, 10);
  C.mast = new T.Mesh(new T.BoxGeometry(2.4, 1, 2.4).translate(0, 0.5, 0), C.mastMat); C.mast.castShadow = true; C.root.add(C.mast);
  const base = new T.Mesh(new T.BoxGeometry(5, 3, 5).translate(0, -1.3, 0), new T.MeshStandardMaterial({ color: lin('#8f8a80'), roughness: 0.9 })); base.receiveShadow = true; C.root.add(base);
  const jib = new T.Mesh(new T.BoxGeometry(jl, 1.9, 1.9), lm(jl / 1.9, 1)); jib.position.set(jl / 2, 0, 0); jib.castShadow = true;
  const cjib = new T.Mesh(new T.BoxGeometry(cl, 1.5, 1.9), lm(cl / 1.5, 1)); cjib.position.set(-cl / 2, -0.2, 0);
  const apex = new T.Mesh(new T.ConeGeometry(1.6, 8, 4), lm(2, 3)); apex.position.set(0, 4.9, 0); apex.rotation.y = Math.PI / 4;
  const cab = new T.Mesh(new T.BoxGeometry(2.6, 2.3, 2.8), new T.MeshStandardMaterial({ color: lin('#2a3440'), roughness: 0.25, metalness: 0.5 })); cab.position.set(2.6, -2, 1);
  const trolley = new T.Mesh(new T.BoxGeometry(1.9, 0.8, 2.1), new T.MeshStandardMaterial({ color: lin('#3a3f46'), roughness: 0.6, metalness: 0.4 })); trolley.position.set(JIB_REACH, -1.2, 0);
  C.head.add(jib, cjib, apex, cab, trolley);
  const weight = new T.MeshStandardMaterial({ color: lin('#a7a39a'), roughness: 0.9 });
  for (let k = 0; k < 3; k++) { const w = new T.Mesh(new T.BoxGeometry(1.5, 2.6, 2.3), weight); w.position.set(-cl + 1.5 + k * 1.7, -1.9, 0); C.head.add(w); }
  placeRod(rod(0.07, C.head), tmpA.set(0, 8.6, 0), tmpB.set(jl - 0.5, 0.95, 0));
  placeRod(rod(0.07, C.head), tmpA.set(0, 8.6, 0), tmpB.set(-cl + 0.5, 0.75, 0));
  C.head.rotation.y = Math.atan2(MAST_DZ, -MAST_DX);   // local +x points from the mast to the site
}
function setCraneSite(site) {
  Crane.root.visible = !!site;
  if (site) Crane.root.position.set(site.x + MAST_DX, 0, site.z + MAST_DZ);
}
// pivotY: height of the rope pivot (trolley) in metres.
function setCraneHeight(pivotY) {
  const jy = pivotY + TROLLEY;
  Crane.head.position.y = jy;
  Crane.mast.scale.y = Math.max(1, jy + 0.9); Crane.mastMat.map.repeat.y = Crane.mast.scale.y / 2.4;
}
function setCranePaint(id) {
  const p = CRANE_PAINTS.find(c => c.id === id) || CRANE_PAINTS[0];
  for (const m of Crane.mats) m.color.copy(lin(p.color));
}

/* ---------------- Quality and adaptive performance ---------------- */
const QUALITY = {
  high:     { dpr: 2,   shadow: 2048, cars: 190, clouds: 26 },
  balanced: { dpr: 1.5, shadow: 1024, cars: 120, clouds: 16 },
  battery:  { dpr: 1,   shadow: 0,    cars: 50,  clouds: 8 },
};
const LADDER = [['high', 1], ['balanced', 1], ['balanced', 0.8], ['battery', 1], ['battery', 0.75]];
let rung = touchDevice ? 1 : 0;
function applyQuality() {
  const mode = save.settings.quality;
  const [name, scale] = mode === 'auto' ? LADDER[rung] : [mode, 1];
  const q = QUALITY[name] || QUALITY.balanced;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dpr) * scale);
  layout();
  if (q.shadow) {
    sun.castShadow = true;
    if (sun.shadow.mapSize.x !== q.shadow) { sun.shadow.mapSize.set(q.shadow, q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  } else sun.castShadow = false;
  carBase = q.cars; carMesh.count = Math.round(q.cars * trafficK);
  clouds.forEach((c, i) => { c.visible = i < q.clouds; });
}
let carBase = 190;
const perf = { ema: 1 / 60, slow: 0, fast: 0 };
function adapt(dt) {
  if (save.settings.quality !== 'auto' || document.hidden) return;
  perf.ema += (dt - perf.ema) * 0.05;
  if (perf.ema > 1 / 42) { perf.slow += dt; perf.fast = 0; if (perf.slow > 2 && rung < LADDER.length - 1) { rung++; perf.slow = 0; applyQuality(); } }
  else if (perf.ema < 1 / 57) { perf.fast += dt; perf.slow = 0; if (perf.fast > 8 && rung > 0) { rung--; perf.fast = 0; applyQuality(); } }
  else { perf.slow = 0; perf.fast = 0; }
}
// Keep the shadow box around what the camera is looking at.
function aimSun(x, y, z, size) {
  const c = sun.shadow.camera;
  if (c.right !== size) { c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.updateProjectionMatrix(); }
  sun.target.position.set(x, y, z); sun.position.set(x, y, z).addScaledVector(sunDir, 300);
}

/* ---------------- Region looks (GDD §11): the same harbour in another climate ---------------- */
const regionWater = { col: null };
todHooks.push(P => { if (regionWater.col) waterMat.uniforms.uDeep.value.lerp(colA.set(regionWater.col), todName === 'night' ? 0.3 : 0.65); });
function applyRegionLook(L) {
  paintGrass(L.grass); grassTex.needsUpdate = true;
  paintPaving(L.paving); pavingTex.needsUpdate = true;
  leafMat.color.copy(lin(L.leaf));
  cityMat.color.copy(lin(L.city)); glassMat.color.copy(lin(L.city));
  roofBoxMesh.material.color.copy(lin(L.roof));
  cityUniforms.uSnow.value = L.trees === 'pine' ? 0.85 : 0;
  regionSky.hor = L.horizon; regionWater.col = L.water;
  // Park blocks in the backdrop take the region's ground colour.
  blocks.forEach((b, i) => { if (b.c === '#6d8f4e' || b.park) { b.park = true; blockMesh.setColorAt(i, col3.set(L.grass[0]).convertSRGBToLinear()); } });
  blockMesh.instanceColor.needsUpdate = true;
  // Trees: swap the shapes, then rebuild the park models so they match.
  treeGeos = TREE_GEOS[L.trees] || TREE_GEOS.round;
  treeTopMesh.geometry = treeGeos.top; trunkMesh.geometry = treeGeos.trunk;
  for (const k of Object.keys(placeTemplates)) delete placeTemplates[k];
  for (const [id, m] of Object.entries(placeMeshes)) { scene.remove(m); delete placeMeshes[id]; }
  applyTimeOfDay();
}
