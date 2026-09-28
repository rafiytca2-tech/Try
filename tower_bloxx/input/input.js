// Controls: tap, click, Space, Enter or Down drops a floor (and skips the end-of-round slide),
// Play again, the sound button, and keeping the layout right when the window changes size.
(() => {
'use strict';
const { $ } = SS, { stage } = SS.screen;

const KEYS = [' ', 'Enter', 'ArrowDown'];

function tapAction() {
  SS.sound.ensure();
  const g = SS.game;
  if (SS.round.state !== 'play' || !g) return;
  if (SS.camera.skipPan(g)) return;
  SS.fall.drop(g);
}

stage.addEventListener('pointerdown', e => {
  if (e.target.closest('button, .screen')) return;
  if (e.button > 0) return;
  e.preventDefault();
  tapAction();
});
window.addEventListener('keydown', e => {
  if (SS.round.state !== 'play') return;
  if (KEYS.includes(e.key)) { e.preventDefault(); if (!e.repeat) tapAction(); }
});
$('btnAgain').addEventListener('click', () => { SS.sound.ensure(); SS.round.start(); });

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
