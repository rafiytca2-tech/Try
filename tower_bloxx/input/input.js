// Controls: press and hold (tap, click, Space, Enter or Down) and let go to drop a floor; the
// longer the hold, the faster the swing (hold/hold.js). Drag up (or press Up or Esc while
// holding a key) and let go to cancel instead. A press also skips the end-of-round slide. Also
// Play again and Change mode on the results card, the sound button, and keeping the layout right
// when the window changes size. (The main screen's mode buttons are menu/menu.js's.)
(() => {
'use strict';
const { $ } = SS, { stage } = SS.screen;

const KEYS = [' ', 'Enter', 'ArrowDown'];
let pointer = null;     // the pointer holding: { id, y0 }
let key = null;         // the key holding: { key, cancel }

function press() {
  SS.sound.ensure();
  const g = SS.game;
  if (SS.round.state !== 'play' || !g) return false;
  if (SS.camera.skipPan(g)) return false;
  SS.hold.press(g);
  return true;
}
const draggedUp = e => pointer.y0 - e.clientY >= SS.hold.HOLD.cancelDrag;

stage.addEventListener('pointerdown', e => {
  if (e.target.closest('button, .screen')) return;
  if (e.button > 0 || pointer || key) return;
  e.preventDefault();
  if (!press()) return;
  pointer = { id: e.pointerId, y0: e.clientY };
  try { stage.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
});
stage.addEventListener('pointermove', e => {
  if (pointer && e.pointerId === pointer.id && SS.game) SS.hold.aimCancel(SS.game, draggedUp(e));
});
stage.addEventListener('pointerup', e => {
  if (!pointer || e.pointerId !== pointer.id) return;
  const cancel = draggedUp(e);
  pointer = null;
  if (SS.game) SS.hold.release(SS.game, cancel);
});
stage.addEventListener('pointercancel', e => {   // the system took the pointer: keep the floor
  if (!pointer || e.pointerId !== pointer.id) return;
  pointer = null;
  if (SS.game) SS.hold.release(SS.game, true);
});

window.addEventListener('keydown', e => {
  if (SS.round.state !== 'play') return;
  if (key && (e.key === 'ArrowUp' || e.key === 'Escape')) { e.preventDefault(); key.cancel = true; SS.hold.aimCancel(SS.game, true); return; }
  if (!KEYS.includes(e.key)) return;
  e.preventDefault();
  if (e.repeat || key || pointer) return;
  if (press()) key = { key: e.key, cancel: false };
});
window.addEventListener('keyup', e => {
  if (!key || e.key !== key.key) return;
  const cancel = key.cancel;
  key = null;
  if (SS.game) SS.hold.release(SS.game, cancel);
});
window.addEventListener('blur', () => {           // the page lost focus: keep the floor
  if (!pointer && !key) return;
  pointer = null; key = null;
  if (SS.game) SS.hold.release(SS.game, true);
});
$('btnAgain').addEventListener('click', () => { SS.sound.ensure(); SS.round.start(); });
$('btnModes').addEventListener('click', () => { SS.sound.ensure(); SS.round.menu(); });

function setMuted(m) {
  SS.storage.save.muted = m; SS.sound.muted = m;
  $('soundBtn').setAttribute('aria-pressed', String(m));
  $('soundBtn').setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
}
$('soundBtn').addEventListener('click', () => { setMuted(!SS.storage.save.muted); SS.storage.persist(); SS.sound.ensure(); });

window.addEventListener('resize', () => {
  SS.screen.layout();
  if (SS.game) SS.camera.onResize(SS.game, SS.round.state === 'play');
});

SS.input = { setMuted };
})();
