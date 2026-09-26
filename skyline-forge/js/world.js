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
const land = new T.Mesh(new T.PlaneGeometry(6000, 3000 + QUAY_Z), new T.MeshStandardMaterial({ color: lin('#4d5157'), roughness: 1 }));
land.rotation.x = -Math.PI / 2; land.position.set(0, -0.45, (QUAY_Z - 3000) / 2); land.receiveShadow = true; scene.add(land);
const waterMat = new T.MeshStandardMaterial({ color: lin(TOD.day.water), roughness: 0.18, metalness: 0.2 });
const water = new T.Mesh(new T.PlaneGeometry(6000, 3000), waterMat);
water.rotation.x = -Math.PI / 2; water.position.set(0, WATER_Y, QUAY_Z + 1500); scene.add(water);
const quay = new T.Mesh(new T.BoxGeometry(6000, 2.2, 2), new T.MeshStandardMaterial({ color: lin('#8f8a80'), roughness: 0.9 }));
quay.position.set(0, -0.9, QUAY_Z); quay.receiveShadow = true; scene.add(quay);
todHooks.push(P => waterMat.color.copy(lin(P.water)));

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
const blocks = [], buildings = [], roofBoxes = [], trees = [];
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
      const pal = ['#a9b0b8', '#98a2ad', '#8793a0', '#b3aa9d', '#7b8896', '#a0968a', '#6b798a', '#bbb8b2', '#5c7087'];
      const col = pal[Math.floor(cityRand() * pal.length)];
      if (h > 80 && cityRand() < 0.7) {
        const split = h * (0.45 + cityRand() * 0.2);
        buildings.push({ x: lx, z: lz, w, d, y: 0, h: split, c: col });
        buildings.push({ x: lx, z: lz, w: w * 0.72, d: d * 0.72, y: split, h: h - split, c: col });
        roofBoxes.push({ x: lx, z: lz, w: w * 0.34, d: d * 0.34, y: h, h: 3 + cityRand() * 4 });
      } else {
        buildings.push({ x: lx, z: lz, w, d, y: 0, h, c: col });
        if (cityRand() < 0.6) roofBoxes.push({ x: lx + (cityRand() - 0.5) * w * 0.3, z: lz + (cityRand() - 0.5) * d * 0.3, w: w * 0.3, d: d * 0.3, y: h, h: 2 + cityRand() * 2.5 });
      }
    }
  }
}
instanced(unitBox, new T.MeshStandardMaterial({ roughness: 0.95 }), blocks, b => { vPos.set(b.x, -0.45, b.z); vScale.set(60, 0.35, 60); }).receiveShadow = true;
// Facade windows are computed in world space, so every building shares the same storey rhythm.
const cityUniforms = { uLit: { value: 0.05 }, uWin: { value: 0.3 } };
const cityMat = new T.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 });
cityMat.onBeforeCompile = sh => {
  sh.uniforms.uLit = cityUniforms.uLit; sh.uniforms.uWin = cityUniforms.uWin;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vFP;\nvarying vec3 vFN;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 fpw = modelMatrix * instanceMatrix * vec4(position, 1.0);\nvFP = fpw.xyz;\nvFN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uLit;\nuniform float uWin;\nvarying vec3 vFP;\nvarying vec3 vFN;\nfloat fWin = 0.0;\nfloat fLit = 0.0;\nfloat fHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
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
      '} else { diffuseColor.rgb *= 0.72; }'].join('\n'))
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.16, fWin);')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.8, 0.5) * fLit * uWin;');
};
cityMat.customProgramCacheKey = () => 'city-windows-2';
todHooks.push(P => { cityUniforms.uLit.value = P.lit; cityUniforms.uWin.value = 0.3 + P.win * 0.9; });
instanced(unitBox, cityMat, buildings, b => { vPos.set(b.x, b.y - 0.25, b.z); vScale.set(b.w, b.h, b.d); }, true);
instanced(unitBox, new T.MeshStandardMaterial({ color: lin('#8d9096'), roughness: 0.8 }), roofBoxes, r => { vPos.set(r.x, r.y - 0.25, r.z); vScale.set(r.w, r.h, r.d); });
const treeTopGeo = new T.IcosahedronGeometry(2.4, 0).translate(0, 4.2, 0), trunkGeo = new T.CylinderGeometry(0.22, 0.3, 2.4, 5).translate(0, 1.2, 0);
const leafMat = new T.MeshStandardMaterial({ color: lin('#4f7d3f'), roughness: 0.9, flatShading: true }), barkMat = new T.MeshStandardMaterial({ color: lin('#5a4634'), roughness: 1 });
instanced(treeTopGeo, leafMat, trees, t => { vPos.set(t.x, -0.25, t.z); vScale.setScalar(t.s); }, true);
instanced(trunkGeo, barkMat, trees, t => { vPos.set(t.x, -0.25, t.z); vScale.setScalar(t.s); });

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
    c.pos += c.v * dt;
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
  for (const c of clouds) { c.material.opacity = fade; if (!c.visible) continue; c.position.x += c.userData.v * dt; if (c.position.x > 1100) c.position.x -= 2200; }
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
const grassTex = (() => {
  const c = canvasOf(64, 64), g = c.getContext('2d'); rect(g, '#6c9a4c', 0, 0, 64, 64);
  const r = mulberry32(4); for (let i = 0; i < 260; i++) { g.fillStyle = r() < 0.5 ? '#5f8c42' : '#7eab58'; g.fillRect(r() * 64, r() * 64, 2, 2); }
  return tex(c);
})();
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
function placeableModel(key) {
  const g = new T.Group();
  const box = (w, h, d, c, x = 0, y = 0, z = 0) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d).translate(0, h / 2, 0), propMat(c)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  if (key === 'park') {
    const lawn = new T.Mesh(new T.BoxGeometry(17, 0.35, 17).translate(0, -0.1, 0), new T.MeshStandardMaterial({ map: grassTex, roughness: 1 })); lawn.receiveShadow = true; g.add(lawn);
    box(2.2, 0.08, 17, '#d9ccb0', 0, 0.1, 0); box(17, 0.08, 2.2, '#d9ccb0', 0, 0.1, 0);
    const r = mulberry32(key.length * 7);
    for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5], [-6, 0.5], [6, -0.5]]) {
      const s = 0.55 + r() * 0.3, t = new T.Mesh(treeTopGeo, leafMat), k = new T.Mesh(trunkGeo, barkMat);
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
    for (const lot of LOTS) { const b = save.lots[lot.id]; if (b && b.bp && b.xs && b.xs.length) out.push({ id: lot.id, x: lot.x, z: lot.z, bp: BLUEPRINTS[b.bp], xs: b.xs, done: b.done }); }
    if (save.race.xs && save.race.xs.length) out.push({ id: 'record', x: RECORD_PIER.x, z: RECORD_PIER.z, bp: { style: save.race.style }, xs: save.race.xs, done: true });
    return out;
  },
  rebuild() {
    const buckets = {};
    for (const r of this.roofs) scene.remove(r);
    this.roofs.length = 0;
    for (const t of this.towers()) {
      if (this.hidden.has(t.id)) continue;
      const n = t.xs.length;
      for (let i = 0; i < n; i++) {
        const kind = floorKind(t.bp, i, n, t.done), style = styleAt(t.bp, i);
        const key = style + '|' + (kind === 'roof' ? 'floor' : kind);
        (buckets[key] || (buckets[key] = [])).push(t.x + t.xs[i] * S, (i * H + H / 2) * S, t.z);
        if (kind === 'roof') { const r = roofProps(style); r.position.set(t.x + t.xs[i] * S, (i * H + H / 2) * S, t.z); r.traverse(o => { o.castShadow = true; }); scene.add(r); this.roofs.push(r); }
      }
    }
    for (const key of Object.keys(this.pools)) this.pools[key].mesh.count = 0;
    for (const [key, arr] of Object.entries(buckets)) {
      const p = this.pool(key, arr.length / 3);
      for (let k = 0; k < arr.length; k += 3) p.mesh.setMatrixAt(k / 3, mtx.compose(vPos.set(arr[k], arr[k + 1], arr[k + 2]), q0, vScale.set(1, 1, 1)));
      p.mesh.count = arr.length / 3;
      p.mesh.instanceMatrix.needsUpdate = true;
    }
  },
};

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
  carMesh.count = q.cars;
  clouds.forEach((c, i) => { c.visible = i < q.clouds; });
}
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
