'use strict';
/* ==================================================================== *
 * Megaprojects (GDD §10 multi-stage projects), each on its own island   *
 * and built over several crane sessions. Every stage you top out adds   *
 * a visible part. Harbor Stadium: foundations, two tiers of stands,     *
 * roof masts, the ring roof and the floodlights. Harbor Airport: the    *
 * runway, the terminal, the control tower and the first flights.       *
 * ==================================================================== */

const STADIUM = {
  id: 'stadium', key: 'stadium',
  get name() { return regionNow().id === 'harbor' ? 'Harbor Stadium' : `${regionNow().name} Stadium`; },
  doneText: 'The stadium draws visitors from across the region: tourism, happiness and income for the whole city.',
  site: { id: 'stadium', x: 124, z: 116, pier: true, stadium: true, project: 'stadium' },
  centre: { x: 178, z: 124 },
  island: { x0: 90, x1: 218, z0: 90, z1: 160 },
  stages: [
    { name: 'Foundations',  floors: 8,  style: 'sand',   level: 8,  cost: 2500, mat: 20, mods: {},                              desc: 'Pile caps and the concrete bowl.' },
    { name: 'Lower Stands', floors: 12, style: 'red',    level: 9,  cost: 4000, mat: 35, mods: { swing: 1.1 },                  desc: 'Twenty thousand seats. The crane swings 10% faster.' },
    { name: 'Upper Stands', floors: 16, style: 'navy',   level: 10, cost: 6000, mat: 50, mods: { gravity: 1.2 },                desc: 'A second tier of heavy precast steps.' },
    { name: 'Roof Masts',   floors: 20, style: 'silver', level: 12, cost: 8000, mat: 70, mods: { wind: 6 },                     desc: 'Twelve steel masts, built out in the harbour wind.' },
    { name: 'Ring Roof',    floors: 14, style: 'white',  level: 14, cost: 9000, mat: 80, mods: { swing: 1.15, gravity: 1.15 },  desc: 'A floating ring roof: fast crane, heavy panels.' },
    { name: 'Floodlights',  floors: 10, style: 'gold',   level: 16, cost: 6000, mat: 40, mods: { noRecall: true },              desc: 'The finishing touch. No recalls: every swing counts.' },
  ],
  visitors: 4000,
};
const PROJECTS = { stadium: STADIUM };
const projStage = P => (save[P.key] && save[P.key].stage) || 0;
const projDone = P => projStage(P) >= P.stages.length;
const stadiumStage = () => projStage(STADIUM);
const stadiumDone = () => projDone(STADIUM);

/* ---------------- Islands and bridges ---------------- */
function buildIsland(I, bridgeX) {
  const w = I.x1 - I.x0, d = I.z1 - I.z0;
  const isle = new T.Mesh(new T.BoxGeometry(w, 3.2, d).translate(0, -1.6, 0), new T.MeshStandardMaterial({ map: pavingTex, roughness: 0.95 }));
  isle.position.set((I.x0 + I.x1) / 2, 0, (I.z0 + I.z1) / 2); isle.receiveShadow = true; scene.add(isle);
  const edge = new T.Mesh(new T.BoxGeometry(w + 1.2, 1.2, d + 1.2).translate(0, -2.4, 0), new T.MeshStandardMaterial({ color: lin('#8f8a80'), roughness: 0.9 }));
  edge.position.copy(isle.position); scene.add(edge);
  const bridge = new T.Mesh(new T.BoxGeometry(12, 1.2, I.z0 - QUAY_Z + 2).translate(0, -0.6, 0), deckMat);
  bridge.position.set(bridgeX, 0, (QUAY_Z + I.z0) / 2); bridge.receiveShadow = bridge.castShadow = true; scene.add(bridge);
  for (const x of [bridgeX - 5.5, bridgeX + 5.5]) { const rail = new T.Mesh(new T.BoxGeometry(0.3, 1, I.z0 - QUAY_Z), propMat('#d8d2c4')); rail.position.set(x, 0.5, (QUAY_Z + I.z0) / 2); scene.add(rail); }
  for (let z = QUAY_Z + 8; z < I.z0; z += 12) { const pile = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 6, 6), pileMat); pile.position.set(bridgeX, -4, z); scene.add(pile); }
}
buildIsland(STADIUM.island, 110);
function seatTex(color) {
  const c = canvasOf(64, 64), g = c.getContext('2d');
  rect(g, color, 0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) { rect(g, 'rgba(0,0,0,.35)', 0, y + 6, 64, 2); rect(g, 'rgba(255,255,255,.12)', 0, y, 64, 1); }
  for (let x = 0; x < 64; x += 16) rect(g, 'rgba(0,0,0,.25)', x, 0, 2, 64);   // aisles
  const t = tex(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(36, 3); return t;
}
function pitchTex() {
  const c = canvasOf(256, 256), g = c.getContext('2d');
  for (let i = 0; i < 8; i++) rect(g, i % 2 ? '#3f8f3f' : '#4aa047', i * 32, 0, 32, 256);
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3;
  g.strokeRect(28, 48, 200, 160); g.beginPath(); g.moveTo(128, 48); g.lineTo(128, 208); g.stroke();
  g.beginPath(); g.arc(128, 128, 22, 0, 7); g.stroke();
  g.strokeRect(28, 96, 30, 64); g.strokeRect(198, 96, 30, 64);
  return tex(c);
}
const lathe = (pts, mat) => { const m = new T.Mesh(new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), 56), mat); m.castShadow = m.receiveShadow = true; return m; };
const stadiumRoot = new T.Group(); stadiumRoot.position.set(STADIUM.centre.x, 0, STADIUM.centre.z); stadiumRoot.scale.z = 0.72; scene.add(stadiumRoot);
const pitchTexture = pitchTex();
const pitchMat = new T.MeshStandardMaterial({ map: pitchTexture, roughness: 0.9, emissive: new T.Color('#ffffff'), emissiveMap: pitchTexture, emissiveIntensity: 0 });
const lampMat = new T.MeshStandardMaterial({ color: lin('#fff7dc'), emissive: new T.Color('#fff2c0'), emissiveIntensity: 0.4 });
const STADIUM_PARTS = [
  () => {
    const g = new T.Group();
    g.add(lathe([[0, 0], [31, 0], [31, 1.3], [0, 1.3]], propMat('#bdb3a2')));
    const pitch = new T.Mesh(new T.CylinderGeometry(17.5, 17.5, 0.12, 48), pitchMat); pitch.position.y = 1.36; pitch.receiveShadow = true; g.add(pitch);
    const track = new T.Mesh(new T.RingGeometry(17.5, 19.5, 48).rotateX(-Math.PI / 2), propMat('#b8573a')); track.position.y = 1.4; g.add(track);
    return g;
  },
  () => lathe([[19.5, 1.3], [28, 9], [29.2, 9], [29.2, 1.3]], new T.MeshStandardMaterial({ map: seatTex('#c8342c'), roughness: 0.8 })),
  () => {
    const g = new T.Group();
    g.add(lathe([[26.5, 9.6], [32.4, 18], [33.4, 18], [33.4, 1.3], [29.2, 1.3], [29.2, 9]], new T.MeshStandardMaterial({ map: seatTex('#2f4a7a'), roughness: 0.8 })));
    g.add(lathe([[33.4, 1.3], [33.9, 1.3], [33.9, 18.4], [33.4, 18.4]], propMat('#d9d2c2')));   // outer facade band
    return g;
  },
  () => {
    const g = new T.Group(), mat = new T.MeshStandardMaterial({ color: lin('#c8d2dc'), roughness: 0.35, metalness: 0.7 });
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, m = new T.Mesh(new T.CylinderGeometry(0.45, 0.8, 32, 8).translate(0, 16, 0), mat);
      m.position.set(Math.cos(a) * 35, 0, Math.sin(a) * 35); m.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); m.castShadow = true; g.add(m);
    }
    return g;
  },
  () => {
    const g = new T.Group();
    g.add(lathe([[21, 28.4], [35, 31.2], [35, 32], [21, 29.2]], new T.MeshStandardMaterial({ color: lin('#f4f1ea'), roughness: 0.4, metalness: 0.15, side: T.DoubleSide })));
    return g;
  },
  () => {
    const g = new T.Group();
    for (let k = 0; k < 28; k++) {
      const a = k / 28 * Math.PI * 2, m = new T.Mesh(new T.BoxGeometry(1.4, 0.5, 0.9), lampMat);
      m.position.set(Math.cos(a) * 22, 28.2, Math.sin(a) * 22); m.lookAt(0, 0, 0); g.add(m);
    }
    const sign = new T.Mesh(new T.BoxGeometry(18, 3, 0.4), new T.MeshStandardMaterial({ map: (() => { const c = canvasOf(512, 96), x = c.getContext('2d'); rect(x, '#11161f', 0, 0, 512, 96); x.fillStyle = '#ffc21a'; x.font = 'bold 58px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(STADIUM.name.toUpperCase(), 256, 50); return tex(c); })(), emissive: new T.Color('#ffffff'), emissiveIntensity: 0.25 }));
    sign.position.set(0, 11, 34.2); g.add(sign);
    return g;
  },
];
const stadiumMeshes = [];
STADIUM.rebuild = fresh => rebuildStadium(fresh);
function rebuildStadium(fresh) {
  const n = stadiumStage();
  if (fresh) while (stadiumMeshes.length) { const m = stadiumMeshes.pop(); stadiumRoot.remove(m); disposeTree(m, new Set([pitchMat, lampMat, pitchTexture])); }
  while (stadiumMeshes.length < n) { const m = STADIUM_PARTS[stadiumMeshes.length](); stadiumRoot.add(m); stadiumMeshes.push(m); }
  while (stadiumMeshes.length > n) stadiumRoot.remove(stadiumMeshes.pop());
}
todHooks.push(P => {
  const on = stadiumDone() ? clamp(P.win, 0, 1.2) : 0;
  lampMat.emissiveIntensity = 0.4 + on * 2.2; pitchMat.emissiveIntensity = on * 0.6;
});

/* ---------------- Rules (shared by every megaproject) ---------------- */
function canBuildStage(i, P = STADIUM) {
  const st = P.stages[i];
  if (!st) return { ok: false, reason: 'Finished' };
  if (save.level < st.level) return { ok: false, reason: `City level ${st.level}`, locked: true };
  const paid = save[P.key].paid === i;
  if (paid) return { ok: true, cost: 0, mat: 0, paid };
  if (save.coins < st.cost) return { ok: false, reason: `${fmt(st.cost - save.coins)} more coins`, cost: st.cost, mat: st.mat, short: true };
  const matShort = Math.max(0, st.mat - Math.floor(save.materials));
  if (matShort) return { ok: false, reason: `${fmt(matShort)} more materials`, cost: st.cost, mat: st.mat, matShort };
  return { ok: true, cost: st.cost, mat: st.mat };
}
// A paid stage stays paid until it's topped out, so a failed attempt can be retried for free.
function startStage(P = STADIUM) {
  const i = projStage(P), r = canBuildStage(i, P);
  if (!r.ok) { Sound.deny(); toast(r.reason); return; }
  if (!r.paid) { addCoins(-r.cost); save.materials -= r.mat; save[P.key].paid = i; persistNow(); }
  Sound.resume();
  const st = P.stages[i];
  beginSession('stage', { site: P.site, style: st.style, target: st.floors, mult: 2.5, mods: Object.assign({ weather: 'clear' }, st.mods), stage: i, project: P.id });
}
function completeStage(r) {
  const P = PROJECTS[r.project || 'stadium'], S = save[P.key];
  const i = r.stage, st = P.stages[i], out = { stage: i, name: st.name, project: P.id, coins: 0, prestige: 0, stars: 0, done: r.done };
  if (r.done) {
    out.coins = Math.round(r.floors * 6 + r.perfects * 4);        // a failed attempt is retried for free, so it pays nothing
    out.stars = r.quality >= ECON.stars[1] ? 3 : r.quality >= ECON.stars[0] ? 2 : 1;
    out.coins += Math.round(st.cost * 0.6); out.prestige = 10 * (i + 1) + out.stars * 3;
    S.parts[i] = { quality: r.quality, stars: out.stars, date: Date.now(), perfects: r.perfects };
    S.stage = i + 1; S.paid = null;
    P.rebuild(); recomputeCity(); TowerField.rebuild();
    bus.emit(P.id, S.stage);
  }
  addCoins(out.coins); addPrestige(out.prestige);
  persistNow();
  return out;
}

/* ---------------- Sheet ---------------- */
function openStadiumSheet() { openProjectSheet(STADIUM); }
function openProjectSheet(P) {
  const n = projStage(P), next = P.stages[n], S = save[P.key];
  const rows = P.stages.map((st, i) => {
    const part = S.parts[i], cur = i === n;
    return `<div class="card ${part ? 'done' : ''}" aria-disabled="${!part && !cur}" style="cursor:default"><i class="sw" style="--c:${styleColor(st.style)}"></i>
      <span><b>${i + 1}. ${esc(st.name)}</b><small>${part ? `Built ${new Date(part.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${Math.round(part.quality * 100)}% quality` : `${st.floors} floors · ${esc(st.desc)}`}</small></span>
      ${part ? starsHtml(part.stars) : `<span class="go">${save.level < st.level ? `Level ${st.level}` : ''}</span>`}</div>`;
  }).join('');
  const r = next ? canBuildStage(n, P) : null;
  const btn = !next ? '' : r.ok ? `<button class="btn primary" type="button" id="stageGo">${r.paid ? `Try ${esc(next.name)} again · free` : `Build ${esc(next.name)} · ${fmt(r.cost)} + ${fmt(r.mat)} materials`}</button>`
    : `<button class="btn primary" type="button" id="stageGo" ${r.matShort ? '' : 'disabled'}>${esc(r.reason)}${r.matShort ? ' · buy' : ''}</button>`;
  openSheet(`${head(P.name, projDone(P) ? 'Complete' : `Stage ${n + 1} of ${P.stages.length}`)}
    <p class="lede">${projDone(P) ? P.doneText : `A megaproject in ${P.stages.length} crane sessions. Top out each stage to add it. A paid stage can be retried for free until it stands.`}</p>
    <div class="cards">${rows}</div>${btn}`, s => {
    s.querySelector('[data-close]').addEventListener('click', closeSheet);
    bind(s, '#stageGo', () => {
      const c = canBuildStage(projStage(P), P);
      if (!c.ok && c.matShort) { offerMaterials(c.matShort, c.cost, () => { closeSheet(); startStage(P); }); return; }
      closeSheet(); startStage(P);
    });
  });
}

/* ==================================================================== *
 * Harbor Airport: runway, terminal, control tower, then the first      *
 * flights. Finished, planes take off over the harbour and the city     *
 * gets visitors, tourism and relief for its roads.                     *
 * ==================================================================== */
const AIRPORT = {
  id: 'airport', key: 'airport',
  get name() { return regionNow().id === 'harbor' ? 'Harbor Airport' : `${regionNow().name} Airport`; },
  doneText: 'Flights every few minutes: visitors, tourism and a big lift for the roads.',
  site: { id: 'airport', x: -118, z: 112, pier: true, project: 'airport' },
  centre: { x: -170, z: 126 },
  island: { x0: -242, x1: -88, z0: 90, z1: 164 },
  stages: [
    { name: 'Runway',        floors: 10, style: 'obsidian', level: 15, cost: 12000, mat: 80,  mods: {},                          desc: 'Two and a half kilometres of concrete, one slab at a time.' },
    { name: 'Terminal',      floors: 18, style: 'glass',    level: 16, cost: 16000, mat: 120, mods: { swing: 1.1 },              desc: 'A glass hall for millions of travellers.' },
    { name: 'Control Tower', floors: 28, style: 'white',    level: 18, cost: 14000, mat: 100, mods: { wind: 6 },                 desc: 'Tall and slender, out in the sea wind.' },
    { name: 'First Flights', floors: 12, style: 'sky',      level: 19, cost: 10000, mat: 60,  mods: { noRecall: true },          desc: 'Jet bridges and the fleet. No recalls: every swing counts.' },
  ],
  visitors: 3500,
};
PROJECTS.airport = AIRPORT;
const airportDone = () => projDone(AIRPORT);
buildIsland(AIRPORT.island, -104);
function runwayTex() {
  const c = canvasOf(512, 64), g = c.getContext('2d');
  rect(g, '#34383e', 0, 0, 512, 64);
  g.fillStyle = '#f2f2ee';
  for (let x = 30; x < 480; x += 26) g.fillRect(x, 30, 14, 3);                      // centre line
  for (let y = 8; y < 56; y += 6) { g.fillRect(6, y, 16, 3); g.fillRect(490, y, 16, 3); }   // thresholds
  g.fillRect(0, 2, 512, 2); g.fillRect(0, 60, 512, 2);
  return tex(c);
}
const airRoot = new T.Group(); scene.add(airRoot);
const planeMat = { body: propMat('#f4f6f8'), tail: propMat('#2f7fd8'), dark: propMat('#26394f') };
function planeModel() {
  const g = new T.Group();
  const fus = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 20, 12).rotateZ(Math.PI / 2), planeMat.body);
  const nose = new T.Mesh(new T.SphereGeometry(1.1, 12, 8), planeMat.body); nose.scale.set(2.2, 1, 1); nose.position.x = 10;
  const tailc = new T.Mesh(new T.ConeGeometry(1.1, 4, 12).rotateZ(Math.PI / 2), planeMat.body); tailc.position.x = -12;
  const wing = new T.Mesh(new T.BoxGeometry(4, 0.25, 22), planeMat.body); wing.position.set(0.5, -0.3, 0);
  const fin = new T.Mesh(new T.BoxGeometry(3, 4, 0.25), planeMat.tail); fin.position.set(-11, 2.2, 0);
  const stab = new T.Mesh(new T.BoxGeometry(2, 0.2, 7), planeMat.body); stab.position.set(-11.5, 0.3, 0);
  const winb = new T.Mesh(new T.BoxGeometry(14, 0.35, 2.26), planeMat.dark); winb.position.set(1, 0.45, 0);
  g.add(fus, nose, tailc, wing, fin, stab, winb);
  for (const z of [-5, 5]) { const e = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 2.6, 10).rotateZ(Math.PI / 2), planeMat.dark); e.position.set(1.4, -1, z); g.add(e); }
  g.traverse(o => { o.castShadow = true; });
  return g;
}
const towerCab = new T.MeshStandardMaterial({ color: lin('#9fd4f0'), roughness: 0.1, metalness: 0.5, emissive: new T.Color('#9fe8ff'), emissiveIntensity: 0.2 });
const AIRPORT_PARTS = [
  () => {
    const g = new T.Group();
    const rw = new T.Mesh(new T.BoxGeometry(146, 0.3, 14), new T.MeshStandardMaterial({ map: runwayTex(), roughness: 0.9 })); rw.position.set(-165, 0.15, 152); rw.receiveShadow = true; g.add(rw);
    const tw = new T.Mesh(new T.BoxGeometry(120, 0.25, 6), propMat('#44484e')); tw.position.set(-160, 0.12, 138); tw.receiveShadow = true; g.add(tw);
    return g;
  },
  () => {
    const g = new T.Group();
    const hall = new T.Mesh(new T.BoxGeometry(56, 9, 16).translate(0, 4.5, 0), new T.MeshStandardMaterial({ color: lin('#a8d0ea'), roughness: 0.12, metalness: 0.45, emissive: new T.Color('#ffe2a8'), emissiveIntensity: 0.05 }));
    hall.position.set(-162, 0, 110); hall.castShadow = hall.receiveShadow = true; g.add(hall);
    const roof = new T.Mesh(new T.CylinderGeometry(10, 10, 58, 24, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), new T.MeshStandardMaterial({ color: lin('#e8ebee'), roughness: 0.35, metalness: 0.3, side: T.DoubleSide }));
    roof.scale.set(1, 0.35, 0.85); roof.position.set(-162, 9, 110); roof.castShadow = true; g.add(roof);
    hall.userData.lit = 1;
    return g;
  },
  () => {
    const g = new T.Group(), x = -222, z = 108;
    const shaft = new T.Mesh(new T.CylinderGeometry(1.6, 2.4, 34, 14).translate(0, 17, 0), propMat('#eef1f4')); shaft.position.set(x, 0, z); shaft.castShadow = true; g.add(shaft);
    const cab = new T.Mesh(new T.CylinderGeometry(4.6, 3.4, 4.2, 14).translate(0, 36, 0), towerCab); cab.position.set(x, 0, z); g.add(cab);
    const cap = new T.Mesh(new T.CylinderGeometry(4.9, 4.9, 0.8, 14).translate(0, 38.5, 0), propMat('#3a3f46')); cap.position.set(x, 0, z); g.add(cap);
    const mast = new T.Mesh(new T.CylinderGeometry(0.1, 0.2, 7, 6).translate(0, 42.4, 0), propMat('#c9ced4')); mast.position.set(x, 0, z); g.add(mast);
    const beacon = new T.Mesh(new T.SphereGeometry(0.45, 10, 8), new T.MeshBasicMaterial({ color: '#ff3b2f' })); beacon.position.set(x, 46.1, z); g.add(beacon);
    return g;
  },
  () => {
    const g = new T.Group();
    for (const x of [-180, -150]) { const p = planeModel(); p.position.set(x, 1.6, 124); p.rotation.y = -Math.PI / 2; g.add(p); const br = new T.Mesh(new T.BoxGeometry(2, 2, 7), propMat('#c9ced4')); br.position.set(x + 6, 3.5, 119.5); g.add(br); }
    return g;
  },
];
const airMeshes = [];
const flyer = planeModel(); flyer.visible = false; scene.add(flyer);
AIRPORT.rebuild = fresh => {
  const n = projStage(AIRPORT);
  if (fresh) while (airMeshes.length) { const m = airMeshes.pop(); airRoot.remove(m); disposeTree(m, new Set([towerCab, ...Object.values(planeMat)])); }
  while (airMeshes.length < n) { const m = AIRPORT_PARTS[airMeshes.length](); airRoot.add(m); airMeshes.push(m); }
  while (airMeshes.length > n) airRoot.remove(airMeshes.pop());
};
todHooks.push(P => { towerCab.emissiveIntensity = 0.2 + clamp(P.win, 0, 1.2) * 0.8; });
// A departure every minute once the airport is open: taxi, take-off roll, climb out over the harbour.
function updateProjects(dt, t) {
  flyer.visible = airportDone() && state !== 'play';
  if (!flyer.visible) return;
  const k = (t % 60) / 60;
  if (k < 0.12) { const u = k / 0.12; flyer.position.set(-150 - u * 80, 1.6, lerp(124, 152, smooth(u))); flyer.rotation.set(0, Math.PI - 0.3 * Math.sin(u * Math.PI), 0); }
  else if (k < 0.3) { const u = (k - 0.12) / 0.18; flyer.position.set(-230 + u * u * 150, 1.6 + Math.max(0, u - 0.7) * 30, 152); flyer.rotation.set(0, 0, Math.max(0, u - 0.7) * 0.4); }
  else if (k < 0.7) { const u = (k - 0.3) / 0.4; flyer.position.set(-80 + u * 700, 10 + u * 240, 152 + u * 400); flyer.rotation.set(0, -0.5, 0.25); }
  else { flyer.position.set(0, -500, 0); }
}
