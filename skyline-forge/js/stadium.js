'use strict';
/* ==================================================================== *
 * Harbor Stadium (GDD §10 multi-stage projects): a landmark on its own  *
 * island, built over six crane sessions. Each stage you top out adds    *
 * a visible part: foundations, two tiers of stands, roof masts, the     *
 * ring roof and the floodlights. Finished, it draws crowds every day.   *
 * ==================================================================== */

const STADIUM = {
  get name() { return regionNow().id === 'harbor' ? 'Harbor Stadium' : `${regionNow().name} Stadium`; },
  site: { id: 'stadium', x: 124, z: 116, pier: true, stadium: true },
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
const stadiumStage = () => save.stadium.stage || 0;
const stadiumDone = () => stadiumStage() >= STADIUM.stages.length;

/* ---------------- The island, the bridge and the stadium model ---------------- */
{
  const I = STADIUM.island, w = I.x1 - I.x0, d = I.z1 - I.z0;
  const isle = new T.Mesh(new T.BoxGeometry(w, 3.2, d).translate(0, -1.6, 0), new T.MeshStandardMaterial({ map: pavingTex, roughness: 0.95 }));
  isle.position.set((I.x0 + I.x1) / 2, 0, (I.z0 + I.z1) / 2); isle.receiveShadow = true; scene.add(isle);
  const edge = new T.Mesh(new T.BoxGeometry(w + 1.2, 1.2, d + 1.2).translate(0, -2.4, 0), new T.MeshStandardMaterial({ color: lin('#8f8a80'), roughness: 0.9 }));
  edge.position.copy(isle.position); scene.add(edge);
  const bridge = new T.Mesh(new T.BoxGeometry(12, 1.2, I.z0 - QUAY_Z + 2).translate(0, -0.6, 0), deckMat);
  bridge.position.set(110, 0, (QUAY_Z + I.z0) / 2); bridge.receiveShadow = bridge.castShadow = true; scene.add(bridge);
  for (const x of [104.5, 115.5]) { const rail = new T.Mesh(new T.BoxGeometry(0.3, 1, I.z0 - QUAY_Z), propMat('#d8d2c4')); rail.position.set(x, 0.5, (QUAY_Z + I.z0) / 2); scene.add(rail); }
  for (let z = QUAY_Z + 8; z < I.z0; z += 12) { const pile = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 6, 6), pileMat); pile.position.set(110, -4, z); scene.add(pile); }
}
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

/* ---------------- Rules ---------------- */
function canBuildStage(i) {
  const st = STADIUM.stages[i];
  if (!st) return { ok: false, reason: 'Finished' };
  if (save.level < st.level) return { ok: false, reason: `City level ${st.level}`, locked: true };
  const paid = save.stadium.paid === i;
  if (paid) return { ok: true, cost: 0, mat: 0, paid };
  if (save.coins < st.cost) return { ok: false, reason: `${fmt(st.cost - save.coins)} more coins`, cost: st.cost, mat: st.mat, short: true };
  const matShort = Math.max(0, st.mat - Math.floor(save.materials));
  if (matShort) return { ok: false, reason: `${fmt(matShort)} more materials`, cost: st.cost, mat: st.mat, matShort };
  return { ok: true, cost: st.cost, mat: st.mat };
}
// A paid stage stays paid until it's topped out, so a failed attempt can be retried for free.
function startStage() {
  const i = stadiumStage(), r = canBuildStage(i);
  if (!r.ok) { Sound.deny(); toast(r.reason); return; }
  if (!r.paid) { addCoins(-r.cost); save.materials -= r.mat; save.stadium.paid = i; persistNow(); }
  Sound.resume();
  const st = STADIUM.stages[i];
  beginSession('stage', { site: STADIUM.site, style: st.style, target: st.floors, mult: 2.5, mods: Object.assign({ weather: 'clear' }, st.mods), stage: i });
}
function completeStage(r) {
  const i = r.stage, st = STADIUM.stages[i], out = { stage: i, name: st.name, coins: 0, prestige: 0, stars: 0, done: r.done };
  if (r.done) {
    out.coins = Math.round(r.floors * 6 + r.perfects * 4);        // a failed attempt is retried for free, so it pays nothing
    out.stars = r.quality >= ECON.stars[1] ? 3 : r.quality >= ECON.stars[0] ? 2 : 1;
    out.coins += Math.round(st.cost * 0.6); out.prestige = 10 * (i + 1) + out.stars * 3;
    save.stadium.parts[i] = { quality: r.quality, stars: out.stars, date: Date.now(), perfects: r.perfects };
    save.stadium.stage = i + 1; save.stadium.paid = null;
    rebuildStadium(); recomputeCity();
    bus.emit('stadium', save.stadium.stage);
  }
  addCoins(out.coins); addPrestige(out.prestige);
  persistNow();
  return out;
}

/* ---------------- Sheet ---------------- */
function openStadiumSheet() {
  const n = stadiumStage(), next = STADIUM.stages[n];
  const rows = STADIUM.stages.map((st, i) => {
    const part = save.stadium.parts[i], cur = i === n;
    return `<div class="card ${part ? 'done' : ''}" aria-disabled="${!part && !cur}" style="cursor:default"><i class="sw" style="--c:${styleColor(st.style)}"></i>
      <span><b>${i + 1}. ${esc(st.name)}</b><small>${part ? `Built ${new Date(part.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${Math.round(part.quality * 100)}% quality` : `${st.floors} floors · ${esc(st.desc)}`}</small></span>
      ${part ? starsHtml(part.stars) : `<span class="go">${save.level < st.level ? `Level ${st.level}` : ''}</span>`}</div>`;
  }).join('');
  const r = next ? canBuildStage(n) : null;
  const btn = !next ? '' : r.ok ? `<button class="btn primary" type="button" id="stageGo">${r.paid ? `Try ${esc(next.name)} again · free` : `Build ${esc(next.name)} · ${fmt(r.cost)} + ${fmt(r.mat)} materials`}</button>`
    : `<button class="btn primary" type="button" id="stageGo" ${r.matShort ? '' : 'disabled'}>${esc(r.reason)}${r.matShort ? ' · buy' : ''}</button>`;
  openSheet(`${head(STADIUM.name, stadiumDone() ? 'Complete · crowds every day' : `Stage ${n + 1} of ${STADIUM.stages.length}`)}
    <p class="lede">${stadiumDone() ? 'The stadium draws visitors from across the region: tourism, happiness and income for the whole city.' : 'A megaproject in six crane sessions. Top out each stage to add it to the stadium. A paid stage can be retried for free until it stands.'}</p>
    <div class="cards">${rows}</div>${btn}`, s => {
    s.querySelector('[data-close]').addEventListener('click', closeSheet);
    bind(s, '#stageGo', () => {
      const c = canBuildStage(stadiumStage());
      if (!c.ok && c.matShort) { offerMaterials(c.matShort, c.cost, () => { closeSheet(); startStage(); }); return; }
      closeSheet(); startStage();
    });
  });
}
