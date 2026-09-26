'use strict';
/* ==================================================================== *
 * Ambient life (GDD §13, §17): street lamps, aviation lights,          *
 * pedestrians, gulls, boats and workers on the construction site.      *
 * Everything is instanced, so the whole city costs a few draw calls.   *
 * ==================================================================== */

// Merge simple geometries into one non-indexed geometry (position + normal).
function mergeGeos(list) {
  const parts = list.map(g => g.toNonIndexed());
  const n = parts.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3));
  return out;
}
const glowTex = (() => {
  const c = canvasOf(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return tex(c);
})();
function pointsOf(list, color, size, attenuate) {
  const pos = new Float32Array(Math.max(1, list.length) * 3);
  list.forEach((p, i) => { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; });
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  geo.setDrawRange(0, list.length);
  const m = new T.Points(geo, new T.PointsMaterial({ map: glowTex, color, size, sizeAttenuation: attenuate, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: true }));
  m.frustumCulled = false; scene.add(m);
  return m;
}

/* ---------------- Street lamps ---------------- */
const lamps = [];
for (let j = -3; j <= 0; j++) for (let x = -520; x <= 580; x += 24) for (const side of [-1, 1]) lamps.push({ x, z: j * BLOCK + BLOCK / 2 + side * 6.4 });
for (let i = -7; i <= 7; i++) for (let z = -250; z <= 26; z += 24) for (const side of [-1, 1]) lamps.push({ x: i * BLOCK + BLOCK / 2 + side * 6.4, z });
const lampHeadMat = new T.MeshStandardMaterial({ color: lin('#2b2f36'), emissive: new T.Color('#ffd79a'), emissiveIntensity: 0, roughness: 0.5 });
instanced(new T.CylinderGeometry(0.09, 0.13, 6.2, 5).translate(0, 3.1, 0), new T.MeshStandardMaterial({ color: lin('#3a3f46'), roughness: 0.6, metalness: 0.5 }), lamps, l => { vPos.set(l.x, -0.3, l.z); vScale.set(1, 1, 1); });
instanced(new T.BoxGeometry(0.9, 0.25, 0.5).translate(0, 6.0, 0), lampHeadMat, lamps, l => { vPos.set(l.x, -0.3, l.z); vScale.set(1, 1, 1); });
const lampGlow = pointsOf(lamps.map(l => ({ x: l.x, y: 5.6, z: l.z })), '#ffcf8a', 9, true);

/* ---------------- Aviation lights (backdrop + your tall towers) ---------------- */
const aviaStatic = pointsOf(aviation, '#ff3b2f', 7, false);
let aviaTowers = pointsOf([], '#ff3b2f', 7, false);
function refreshAviation() {
  const list = [];
  for (const t of TowerField.towers()) {
    if (t.xs.length < 15 || TowerField.hidden.has(t.id)) continue;
    const i = t.xs.length - 1;
    list.push({ x: t.x + t.xs[i] * S, y: t.xs.length * H * S + (t.done ? (t.bp.style === 'silver' ? 32 : 4) : 1), z: t.z });
  }
  scene.remove(aviaTowers); aviaTowers.geometry.dispose(); aviaTowers.material.dispose();
  aviaTowers = pointsOf(list, '#ff3b2f', 7, false);
}

/* ---------------- Pedestrians ---------------- */
const pedGeo = mergeGeos([new T.CylinderGeometry(0.2, 0.26, 1.15, 6).translate(0, 0.6, 0), new T.SphereGeometry(0.17, 6, 5).translate(0, 1.38, 0)]);
const PED_MAX = 420;
const peds = [];
{
  const r = mulberry32(77), shirts = ['#d8412f', '#2f7fd8', '#f2b90f', '#3cbf3c', '#e6e2d8', '#1f2833', '#8e5bd6', '#e07a3c', '#6fb1c8'];
  for (let k = 0; k < PED_MAX; k++) {
    const promenade = k % 5 === 0;
    const bi = Math.floor(r() * 14) - 6, bj = r() < 0.7 ? 0 : -1;
    peds.push({ promenade, cx: bi * BLOCK, cz: bj * BLOCK, s: r() * 240, v: (0.9 + r() * 0.7) * (r() < 0.5 ? 1 : -1), px: -330 + r() * 700, c: pick(r, shirts), ph: r() * 6.28 });
  }
}
const pedMesh = instanced(pedGeo, new T.MeshStandardMaterial({ roughness: 0.8 }), peds, () => { vPos.set(0, -100, 0); vScale.set(1, 1, 1); });
const pedQ = new T.Quaternion(), yAxis = new T.Vector3(0, 1, 0);
function updatePeds(dt, t, visible) {
  pedMesh.visible = visible;
  if (!visible) return;
  const want = clamp(Math.round(80 + population() / 25), 80, PED_MAX);
  pedMesh.count = Math.min(want, peds.length);
  for (let k = 0; k < pedMesh.count; k++) {
    const p = peds[k];
    let x, z, heading;
    if (p.promenade) {
      p.px += p.v * dt; if (p.px > 380) p.px -= 720; else if (p.px < -340) p.px += 720;
      x = p.px; z = 41 + (k % 3) * 0.9; heading = p.v > 0 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      const half = 28.4, L = 8 * half;
      p.s = (p.s + p.v * dt + L) % L;
      const side = Math.floor(p.s / (2 * half)), u = p.s % (2 * half) - half;
      if (side === 0) { x = p.cx + u; z = p.cz - half; heading = -Math.PI / 2; }
      else if (side === 1) { x = p.cx + half; z = p.cz + u; heading = Math.PI; }
      else if (side === 2) { x = p.cx - u; z = p.cz + half; heading = Math.PI / 2; }
      else { x = p.cx - half; z = p.cz - u; heading = 0; }
      if (p.v < 0) heading += Math.PI;
    }
    const bob = Math.abs(Math.sin(t * 7 + p.ph)) * 0.06;
    pedQ.setFromAxisAngle(yAxis, heading);
    pedMesh.setMatrixAt(k, mtx.compose(vPos.set(x, -0.1 + bob, z), pedQ, vScale.set(1, 1, 1)));
  }
  pedMesh.instanceMatrix.needsUpdate = true;
}

/* ---------------- Site workers in hi-vis ---------------- */
const workers = Array.from({ length: 6 }, (_, k) => ({ a: k * 1.05, r: 6.2 + (k % 3) * 0.7, v: (k % 2 ? 1 : -1) * (0.08 + k * 0.015), pause: 0, c: k % 2 ? '#ff8a1c' : '#ffd21c' }));
const workerMesh = instanced(pedGeo, new T.MeshStandardMaterial({ roughness: 0.6 }), workers, () => { vPos.set(0, -100, 0); vScale.set(1, 1, 1); });
function updateWorkers(dt, t, site) {
  workerMesh.visible = !!site;
  if (!site) return;
  workers.forEach((w, k) => {
    if (w.pause > 0) w.pause -= dt; else { w.a += w.v * dt; if (Math.random() < dt * 0.15) w.pause = 1 + Math.random() * 2; }
    const x = site.x + Math.cos(w.a) * w.r, z = site.z + Math.sin(w.a) * w.r * 0.8 - 1;
    pedQ.setFromAxisAngle(yAxis, -w.a + (w.v > 0 ? 0 : Math.PI));
    workerMesh.setMatrixAt(k, mtx.compose(vPos.set(x, (site.pier ? 0.02 : 0) + (w.pause > 0 ? 0 : Math.abs(Math.sin(t * 6 + k)) * 0.05), z), pedQ, vScale.set(1, 1, 1)));
  });
  workerMesh.instanceMatrix.needsUpdate = true;
}

/* ---------------- Gulls over the harbour ---------------- */
const gullGeo = (() => {
  const g = new T.BufferGeometry();
  const v = [-1.1, 0.35, 0, 0, 0, 0.22, 0, 0, -0.22, 1.1, 0.35, 0, 0, 0, -0.22, 0, 0, 0.22];
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(v), 3)); g.computeVertexNormals();
  return g;
})();
const gulls = Array.from({ length: 18 }, (_, k) => ({ cx: -120 + (k % 6) * 60, cz: 90 + Math.floor(k / 6) * 60, r: 18 + (k * 7) % 30, h: 16 + (k * 13) % 40, w: (0.25 + (k % 5) * 0.05) * (k % 2 ? 1 : -1), a: k * 1.3, f: 6 + (k % 4) }));
const gullMesh = instanced(gullGeo, new T.MeshStandardMaterial({ color: lin('#f4f4f2'), roughness: 0.8, side: T.DoubleSide }), gulls, () => { vPos.set(0, -100, 0); vScale.set(1, 1, 1); });
function updateGulls(dt, t) {
  gulls.forEach((g, k) => {
    g.a += g.w * dt;
    const x = g.cx + Math.cos(g.a) * g.r, z = g.cz + Math.sin(g.a) * g.r, y = g.h + Math.sin(t * 0.7 + k) * 2;
    pedQ.setFromAxisAngle(yAxis, -g.a + (g.w > 0 ? Math.PI : 0));
    const flap = Math.sin(t * g.f + k) * (k % 3 === 0 ? 0.3 : 1);   // some glide
    gullMesh.setMatrixAt(k, mtx.compose(vPos.set(x, y, z), pedQ, vScale.set(1.4, 1.4 * flap, 1.4)));
  });
  gullMesh.instanceMatrix.needsUpdate = true;
}

/* ---------------- Boats and the harbour ferry ---------------- */
const boats = [
  { kind: 'ferry', x: 0, z: 190, v: 7, len: 26, c: '#f2f2ee', trim: '#2f5d8a' },
  { kind: 'sail', cx: -220, cz: 320, rx: 90, rz: 45, w: 0.05, a: 0, c: '#ffffff' },
  { kind: 'sail', cx: 160, cz: 420, rx: 120, rz: 60, w: -0.04, a: 2, c: '#f7f0e0' },
  { kind: 'sail', cx: -40, cz: 520, rx: 150, rz: 70, w: 0.035, a: 4, c: '#ffffff' },
  { kind: 'motor', cx: 60, cz: 260, rx: 110, rz: 40, w: 0.09, a: 1, c: '#d8412f' },
  { kind: 'motor', cx: -300, cz: 230, rx: 70, rz: 30, w: -0.11, a: 3, c: '#f2b90f' },
];
const boatRoot = new T.Group(); scene.add(boatRoot);
for (const b of boats) {
  const g = new T.Group(), L = b.len || (b.kind === 'sail' ? 9 : 8);
  const hull = new T.Mesh(new T.BoxGeometry(L, 1.6, L * 0.32).translate(0, 0.4, 0), propMat(b.kind === 'ferry' ? b.trim : '#f4f4f0'));
  const bow = new T.Mesh(new T.ConeGeometry(L * 0.16, L * 0.25, 4).rotateZ(-Math.PI / 2).rotateX(Math.PI / 4).translate(L / 2 + L * 0.12, 0.4, 0), hull.material);
  g.add(hull, bow);
  if (b.kind === 'ferry') { const deck = new T.Mesh(new T.BoxGeometry(L * 0.7, 2.6, L * 0.28).translate(-L * 0.05, 2.5, 0), propMat(b.c)); const bridge = new T.Mesh(new T.BoxGeometry(L * 0.18, 1.4, L * 0.22).translate(L * 0.18, 4.4, 0), propMat('#26394f')); g.add(deck, bridge); }
  else if (b.kind === 'sail') {
    const mast = new T.Mesh(new T.CylinderGeometry(0.08, 0.1, 9, 5).translate(0, 5.5, 0), propMat('#d8d2c4'));
    const sailShape = new T.Shape(); sailShape.moveTo(0, 1.2); sailShape.lineTo(0, 9.6); sailShape.lineTo(-3.8, 1.2); sailShape.lineTo(0, 1.2);
    const sail = new T.Mesh(new T.ShapeGeometry(sailShape), new T.MeshStandardMaterial({ color: lin(b.c), roughness: 0.8, side: T.DoubleSide }));
    g.add(mast, sail);
  } else { const cabin = new T.Mesh(new T.BoxGeometry(L * 0.35, 1.3, L * 0.26).translate(-L * 0.05, 1.8, 0), propMat(b.c)); g.add(cabin); }
  g.traverse(o => { o.castShadow = true; });
  b.mesh = g; boatRoot.add(g);
}
function updateBoats(dt, t) {
  for (const b of boats) {
    let x, z, heading;
    if (b.kind === 'ferry') {
      b.x += b.v * dt;
      if (b.x > 420 || b.x < -420) { b.v = -b.v; b.x = clamp(b.x, -420, 420); }
      x = b.x; z = b.z; heading = b.v > 0 ? 0 : Math.PI;
    } else {
      b.a += b.w * dt;
      x = b.cx + Math.cos(b.a) * b.rx; z = b.cz + Math.sin(b.a) * b.rz;
      heading = Math.atan2(-Math.cos(b.a) * b.rz * Math.sign(b.w), -Math.sin(b.a) * b.rx * Math.sign(b.w));
    }
    b.mesh.position.set(x, WATER_Y + 0.2 + Math.sin(t * 1.3 + x * 0.05) * 0.25, z);
    b.mesh.rotation.set(Math.sin(t * 1.1 + z) * 0.03, heading, Math.sin(t * 0.9 + x) * 0.05);
  }
}

/* ---------------- Time of day and the per-frame update ---------------- */
todHooks.push(P => {
  const night = P.win;                                    // 0 day, ~0.55 sunset, ~1.25 night
  lampHeadMat.emissiveIntensity = night * 1.6;
  lampGlow.material.opacity = clamp(night * 0.8, 0, 0.9);
  aviaStatic.userData.base = night > 1 ? 1 : 0.55;
});
function updateLife(dt, t, site) {
  updatePeds(dt, t, true);
  updateWorkers(dt, t, site);
  updateGulls(dt, t);
  updateBoats(dt, t);
  const blink = (Math.sin(t * 3.2) > 0.55 ? 1 : 0.12) * (aviaStatic.userData.base || 0.55);
  aviaStatic.material.opacity = blink; aviaTowers.material.opacity = blink;
}
