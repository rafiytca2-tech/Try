'use strict';
/* ==================================================================== *
 * Blueprint Studio: the player's own tower designs. Each design is a   *
 * normal blueprint once registered, so the city, the engine and the    *
 * save treat it like any other; only the studio can create or delete. *
 * ==================================================================== */

const customKey = id => 'custom-' + id;
const studioOn = () => skillLevel() >= FEATURES.studio;
function registerCustoms() {
  for (const d of save.custom) BLUEPRINTS[customKey(d.id)] = deriveBlueprint(d);
  // A building whose blueprint has vanished (a damaged save) is dropped rather than crashing the city.
  for (const [id, b] of Object.entries(save.lots)) if (b && b.bp && !BLUEPRINTS[b.bp]) delete save.lots[id];
}
const customInUse = id => Object.values(save.lots).some(b => b && b.bp === customKey(id)) || (save.pending && save.pending.bp === customKey(id));
function saveDesign(d) {
  if (!d.id) {
    if (save.custom.length >= STUDIO.max) return false;
    d.id = String(Date.now().toString(36)); d.created = Date.now(); save.custom.push(d);
  } else {
    const i = save.custom.findIndex(x => x.id === d.id); if (i < 0) return false;
    if (customInUse(d.id)) return false;               // a standing tower keeps the design it was built from
    save.custom[i] = d;
  }
  BLUEPRINTS[customKey(d.id)] = deriveBlueprint(d);
  persistNow(); bus.emit('design', d);
  return true;
}
function deleteDesign(id) {
  if (customInUse(id)) return false;
  save.custom = save.custom.filter(x => x.id !== id); delete BLUEPRINTS[customKey(id)]; persistNow();
  return true;
}

/* ---------------- Elevation preview, painted with the real block art ---------------- */
const previewCache = {};
function blockArt(style, kind) {
  const k = style + kind;
  if (!previewCache[k]) { const c = canvasOf(W, H); paintBlock(c.getContext('2d'), STYLES[style], kind === 'roof' ? 'floor' : kind, 'color'); previewCache[k] = c; }
  return previewCache[k];
}
function drawPreview(cv, d) {
  const g = cv.getContext('2d'), bp = deriveBlueprint(d), F = bp.floors;
  g.clearRect(0, 0, cv.width, cv.height);
  const fh = Math.min(22, (cv.height - 26) / F), fw = Math.max(fh * W / H, 18), x0 = (cv.width - fw) / 2;
  g.imageSmoothingEnabled = fh > 10;
  for (let i = 0; i < F; i++) {
    const kind = i === 0 ? 'foundation' : isSpecial(bp, i) ? 'special' : 'floor';
    g.drawImage(blockArt(floorStyleOf(bp, i, d.style), kind), x0, cv.height - 6 - (i + 1) * fh, fw, fh);
  }
  const top = cv.height - 6 - F * fh;
  g.fillStyle = STYLES[d.roof].outline; g.fillRect(x0 - 1, top - 3, fw + 2, 3);
  g.fillStyle = STYLES[d.roof].body; g.fillRect(x0 + fw * 0.3, top - 8, fw * 0.4, 5);
  if (d.roof === 'silver' || d.roof === 'navy') { g.fillStyle = '#e8edf2'; g.fillRect(x0 + fw / 2 - 1, top - 22, 2, 14); }
  g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, cv.height - 6, cv.width, 1);
}

/* ---------------- The studio ---------------- */
function showStudio(editId, onDone) {
  if (!studioOn()) { Sound.deny(); toast(`The Blueprint Studio opens at city level ${FEATURES.studio}`); return; }
  const src = editId ? save.custom.find(x => x.id === editId) : null;
  const d = src ? { ...src } : { name: `Tower ${save.custom.length + 1}`, role: 'res', floors: 36, style: 'violet', special: 'garden', every: 10, roof: 'green' };
  const locked = !!(src && customInUse(src.id));
  const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(typeof v === 'string' ? v : v.name)}</option>`).join('');
  openModal(`${head(src ? 'Edit design' : 'Blueprint Studio', locked ? 'This design is standing in your city, so it can only be viewed.' : 'Design it here. Then build every floor yourself.')}
    <div class="studio">
      <canvas id="stPrev" width="96" height="330" aria-label="Elevation preview"></canvas>
      <div class="stForm">
        <label class="setting">Name<input id="stName" maxlength="20" value="${esc(d.name)}"></label>
        <label class="setting">Function<select id="stRole">${opt(STUDIO.roles, d.role)}</select></label>
        <label class="setting"><span>Height <b id="stFl">${d.floors}</b> floors</span><input id="stFloors" type="range" min="${STUDIO.floors[0]}" max="${STUDIO.floors[1]}" step="4" value="${d.floors}"></label>
        <div class="setting">Facade</div>
        <div class="variants wrap">${STYLE_KEYS.map(st => `<button class="vsw ${st === d.style ? 'on' : ''}" type="button" data-st="${st}" aria-label="${st} facade" style="--c:${styleColor(st)}"></button>`).join('')}</div>
        <label class="setting">Special floor<select id="stSpecial">${opt(STUDIO.specials, d.special)}</select></label>
        <label class="setting">Special floor every<select id="stEvery">${[8, 10, 15, 20].map(n => `<option value="${n}" ${n === d.every ? 'selected' : ''}>${n} floors</option>`).join('')}</select></label>
        <label class="setting">Roof<select id="stRoof">${opt(STUDIO.roofs, d.roof)}</select></label>
      </div>
    </div>
    <dl class="stats" id="stStats"></dl>
    <div class="btn-row">${src && !locked ? '<button class="btn danger" type="button" id="stDel">Delete</button>' : '<button class="btn" type="button" data-close>Close</button>'}<button class="btn primary" type="button" id="stSave" ${locked ? 'disabled' : ''}>${src ? 'Save changes' : 'Save design'}</button></div>`, p => {
    const cv = p.querySelector('#stPrev');
    const refresh = () => {
      d.name = p.querySelector('#stName').value.trim() || 'My Tower';
      d.role = p.querySelector('#stRole').value; d.floors = +p.querySelector('#stFloors').value;
      d.special = p.querySelector('#stSpecial').value; d.every = +p.querySelector('#stEvery').value; d.roof = p.querySelector('#stRoof').value;
      p.querySelector('#stFl').textContent = d.floors;
      const bp = deriveBlueprint(d), diff = Math.min(5, 1 + Math.floor(d.floors / 22));
      p.querySelector('#stStats').innerHTML = `<dt>Permit</dt><dd>${fmt(bp.cost)} coins + ${fmt(bp.mat)} materials</dd><dt>Capacity estimate</dt><dd>≈${fmt(estimate(bp))} ${ROLE_NAMES[bp.role].split(' ')[0]}</dd>
        <dt>Difficulty</dt><dd>${'●'.repeat(diff)}${'○'.repeat(5 - diff)}</dd><dt>Needs nearby</dt><dd>${bp.needs.length ? bp.needs.map(n => n === 'parkOrWater' ? 'park or water' : NEED_TEXT[n]).join(', ') : 'nothing'}</dd>`;
      drawPreview(cv, d);
    };
    for (const el of p.querySelectorAll('input, select')) { el.addEventListener('input', refresh); el.addEventListener('change', refresh); el.disabled = locked; }
    bind(p, '[data-st]', el => { if (locked) return; d.style = el.dataset.st; for (const b of p.querySelectorAll('[data-st]')) b.classList.toggle('on', b === el); refresh(); });
    bind(p, '#stSave', () => {
      if (!saveDesign(d)) { Sound.deny(); toast(save.custom.length >= STUDIO.max ? `You can keep ${STUDIO.max} designs` : 'This design is in use'); return; }
      Sound.bonus(); toast(`${d.name} saved. Find it in the Studio tab of any empty lot.`, 'good');
      closeModal(); if (onDone) onDone();
    });
    bind(p, '#stDel', el => { if (el.dataset.arm) { deleteDesign(d.id); closeModal(); if (onDone) onDone(); } else { el.dataset.arm = 1; el.textContent = 'Tap again to delete'; } });
    refresh();
  });
}
