'use strict';
/* ==================================================================== *
 * Interface: HUDs, floating text, sheets, modals and the results card. *
 * ==================================================================== */

const ICON = {
  coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffc928" stroke="#b86a00" stroke-width="1.6"/><circle cx="12" cy="12" r="6.6" fill="#ffe45a" stroke="#d98a00" stroke-width="1.4"/><path d="M12 8.2v7.6" stroke="#b86a00" stroke-width="2" stroke-linecap="round"/></svg>',
  prestige: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9z" fill="#b57bff" stroke="#5a24b0" stroke-width="1.4" stroke-linejoin="round"/><path d="M2 9h20M8 3l-2 6 6 12 6-12-2-6" fill="none" stroke="#e4ccff" stroke-width="1.1"/></svg>',
  mat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l9-4 9 4v9l-9 4-9-4z" fill="#d9a066" stroke="#6e4a2a" stroke-width="1.3" stroke-linejoin="round"/><path d="M3 8l9 4 9-4M12 12v9" fill="none" stroke="#6e4a2a" stroke-width="1.3"/></svg>',
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4-3 5.5-3 10a3 3 0 006 0c0-1.6-.8-2.6-.8-2.6S17 11 17 14.5A5 5 0 017 15c0-5.5 5-7 5-13z" fill="#ff8a2b" stroke="#a33c00" stroke-width="1.2"/></svg>',
  map: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M5 11l12-5 14 5 12-5v31l-12 5-14-5-12 5z" fill="#8fd16a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M17 6v31M31 11v31" fill="none" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M17 6l14 5v31l-14-5z" fill="#5fb3ff"/><path d="M5 11l12-5 14 5 12-5v31l-12 5-14-5-12 5z" fill="none" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M38 14c-3.3 0-6 2.5-6 5.6 0 4.2 6 10.4 6 10.4s6-6.2 6-10.4c0-3.1-2.7-5.6-6-5.6z" fill="#ff4d3d" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="38" cy="19.6" r="2" fill="#fff"/></svg>',
  globe: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="#4fb6ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M13 12c4 1 5 5 9 5s3 5 0 7-6 1-7 5-5 2-7-2c-1-4 1-11 5-15zM29 28c3-1 6 0 8 3s-2 8-6 8-5-4-4-7 0-3 2-4zM27 8c3 0 7 2 9 5-3 1-5 0-7-1s-4-4-2-4z" fill="#6bd05a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  layers: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 30L5 21l19-9 19 9z" fill="#ffb13a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M5 28l19 9 19-9" fill="none" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M24 22L5 13l19-9 19 9z" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M5 35l19 9 19-9" fill="none" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  camera: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="14" width="38" height="26" rx="6" fill="#e9eef7" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M16 14l3-6h10l3 6" fill="#b9c6dc" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="24" cy="27" r="8.5" fill="#2c7ae6" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="21.5" cy="24.5" r="2.5" fill="#fff"/><rect x="34" y="18" width="5" height="3" rx="1.5" fill="#ff4d3d"/></svg>',
  gear: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M21 4h6l1 5 4 2 4-3 4 4-3 4 2 4 5 1v6l-5 1-2 4 3 4-4 4-4-3-4 2-1 5h-6l-1-5-4-2-4 3-4-4 3-4-2-4-5-1v-6l5-1 2-4-3-4 4-4 4 3 4-2z" fill="#c9d3e3" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="24" cy="24" r="7" fill="#7a8aa6" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  buildings: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="18" width="16" height="25" rx="2" fill="#ff8a5a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="20" y="6" width="20" height="37" rx="2" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M25 12h4M31 12h4M25 18h4M31 18h4M25 24h4M31 24h4M25 30h4M31 30h4M10 24h3M15 24h3M10 30h3M15 30h3" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M3 43h42" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  missions: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="7" width="32" height="37" rx="4" fill="#c98a4a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="12" y="11" width="24" height="29" rx="2" fill="#fff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="17" y="4" width="14" height="7" rx="2" fill="#9aa7bd" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M16 20l3 3 5-6M16 31l3 3 5-6" fill="none" stroke="#39b22b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 21h5M27 32h5" stroke="#9aa7bd" stroke-width="2.6" stroke-linecap="round"/></svg>',
  events: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4l6 12.5 13.5 2-9.8 9.5 2.4 13.5L24 35l-12.1 6.5 2.4-13.5L4.5 18.5 18 16.5z" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M24 11l3.6 7.5 8 1.2" fill="none" stroke="#fff6b0" stroke-width="2.4" stroke-linecap="round"/></svg>',
  shop: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="20" width="34" height="22" rx="2" fill="#fff3dc" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="20" y="28" width="9" height="14" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M5 12h38l-2 9c-1.5 3-5.5 3-7 0-1.5 3-5.5 3-7 0-1.5 3-5.5 3-7 0-1.5 3-5.5 3-7 0z" fill="#ff4d3d" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M13 12l-1 9M20 12v9M28 12v9M35 12l1 9" stroke="#fff" stroke-width="3"/><path d="M5 12h38l-2 9c-1.5 3-5.5 3-7 0-1.5 3-5.5 3-7 0-1.5 3-5.5 3-7 0-1.5 3-5.5 3-7 0z" fill="none" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M8 7h32l3 5H5z" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  album: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="5" width="32" height="38" rx="4" fill="#2c7ae6" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="8" y="5" width="7" height="38" rx="3" fill="#1b5bc4" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M28 13l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  city: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="22" width="12" height="21" rx="1.5" fill="#ff8a5a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="16" y="8" width="14" height="35" rx="1.5" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="30" y="17" width="14" height="26" rx="1.5" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M20 14h6M20 20h6M20 26h6M20 32h6M8 28h4M8 34h4M34 23h6M34 29h6M34 35h6" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M2 43h44" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5L7.5 12l7 7" fill="none" stroke="#5a3200" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 21v-6a9 9 0 0118 0v6" fill="none" stroke="#123a78" stroke-width="5"/><path d="M15 21v-6a9 9 0 0118 0v6" fill="none" stroke="#c9d3e3" stroke-width="2"/><rect x="9" y="20" width="30" height="23" rx="5" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="24" cy="30" r="3" fill="#8a5200"/><path d="M24 31v5" stroke="#8a5200" stroke-width="3" stroke-linecap="round"/></svg>',
  star: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4l6 12.5 13.5 2-9.8 9.5 2.4 13.5L24 35l-12.1 6.5 2.4-13.5L4.5 18.5 18 16.5z" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  res: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 22L24 8l16 14" fill="#ff4d3d" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="11" y="21" width="26" height="21" fill="#fff3dc" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M6 23L24 7l18 16" fill="none" stroke="#123a78" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><rect x="20" y="30" width="8" height="12" fill="#c98a4a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="14" y="25" width="5" height="5" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="29" y="25" width="5" height="5" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  com: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="20" width="32" height="22" fill="#fff3dc" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M6 12h36l-2 8H8z" fill="#39b22b" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M14 12l-1 8M22 12v8M30 12v8M36 12l1 8" stroke="#fff" stroke-width="2.4"/><rect x="13" y="26" width="10" height="9" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="27" y="26" width="8" height="16" fill="#c98a4a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  off: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 43V9l20-4v38z" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M19 13l10-2M19 19l10-2M19 25l10-2M19 31l10-2M19 37l10-1" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M8 43h32" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  ind: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M5 42V24l10-6v6l10-6v6l10-6v24z" fill="#ffb13a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="35" y="8" width="7" height="34" fill="#c9d3e3" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="40" cy="5" r="3" fill="#e9eef7"/><rect x="10" y="30" width="5" height="5" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="20" y="30" width="5" height="5" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  svc: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="12" width="32" height="30" rx="3" fill="#fff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M21 17h6v6h6v6h-6v6h-6v-6h-6v-6h6z" fill="#ff4d3d" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  transit: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="8" width="34" height="30" rx="6" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="11" y="13" width="26" height="11" rx="2" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="15" cy="31" r="2.6" fill="#fff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="33" cy="31" r="2.6" fill="#fff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M13 38v4M35 38v4" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  util: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M27 7L14 27h9l-3 14 14-21h-9z" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  special: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M20 43V16l4-11 4 11v27z" fill="#c9d3e3" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M14 43V26h6M34 43V26h-6" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M24 20v18" stroke="#5fb3ff" stroke-width="3" stroke-linecap="round"/><path d="M10 43h28" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  studio: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="30" width="36" height="10" rx="2" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" transform="rotate(-35 24 35)"/><path d="M30 6l6 6-20 20-8 2 2-8z" fill="#ff8a5a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M27 9l6 6" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  trophy: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 6h20v12a10 10 0 01-20 0z" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M14 10H7v3a7 7 0 007 7M34 10h7v3a7 7 0 01-7 7" fill="none" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M20 28h8l1 7h-10z" fill="#e79a09" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="14" y="35" width="20" height="7" rx="2" fill="#c98a4a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  calendar: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="9" width="36" height="33" rx="5" fill="#fff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M6 14a5 5 0 015-5h26a5 5 0 015 5v5H6z" fill="#ff4d3d" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M15 5v8M33 5v8" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M24 23l2.5 5 5.5.8-4 3.9 1 5.4-5-2.6-5 2.6 1-5.4-4-3.9 5.5-.8z" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="9" fill="#fff" stroke="#123a78" stroke-width="2"/><path d="M12 8v5l3 2" fill="none" stroke="#ff4d3d" stroke-width="2.2" stroke-linecap="round"/><path d="M9 2.5h6" stroke="#123a78" stroke-width="2.2" stroke-linecap="round"/></svg>',
  chest: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 20a8 8 0 018-8h20a8 8 0 018 8v4H6z" fill="#e79a09" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="6" y="24" width="36" height="17" rx="2" fill="#c98a4a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M6 24h36M16 12v29M32 12v29" fill="none" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="20" y="20" width="8" height="10" rx="2" fill="#ffe45a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  people: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="17" cy="16" r="7" fill="#ffd9a8" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M4 41c0-8 6-13 13-13s13 5 13 13z" fill="#4fa3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="33" cy="18" r="6" fill="#ffd9a8" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M26 41c1-7 4-11 8-11 6 0 10 5 10 11z" fill="#ff6a5a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  jobs: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="15" width="38" height="26" rx="4" fill="#c98a4a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M17 15v-4a3 3 0 013-3h8a3 3 0 013 3v4" fill="none" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M5 25h38" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="20" y="22" width="8" height="6" rx="1.5" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  income: '<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="20" cy="36" rx="13" ry="5" fill="#e79a09" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="20" cy="30" rx="13" ry="5" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="20" cy="24" rx="13" ry="5" fill="#ffe45a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="34" cy="17" r="10" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M34 12v10" stroke="#b86a00" stroke-width="2.6" stroke-linecap="round"/></svg>',
  heart: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 42S5 30 5 17a10 10 0 0119-4 10 10 0 0119 4c0 13-19 25-19 25z" fill="#39b22b" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M16 22c2 4 6 6 8 6s6-2 8-6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="18" cy="17" r="2" fill="#fff"/><circle cx="30" cy="17" r="2" fill="#fff"/></svg>',
  floors: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="14" y="6" width="20" height="36" rx="2" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M14 15h20M14 24h20M14 33h20" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M6 8v32M3 11l3-3 3 3M3 37l3 3 3-3" fill="none" stroke="#ffc928" stroke-width="2.6" stroke-linecap="round"/></svg>',
  land: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 8l18 9-18 9-18-9z" fill="#8fd16a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M6 17v8l18 9 18-9v-8" fill="#c98a4a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M15 12.5l18 9M33 12.5l-18 9" stroke="#fff" stroke-width="1.6"/></svg>',
  hand: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M17 26V9a3.5 3.5 0 017 0v12l2-1a3.5 3.5 0 015 2l2-1a3.5 3.5 0 014.8 2.4l1.6-.4a3.5 3.5 0 014.1 3.3V35c0 6-5 10-11 10h-4c-4 0-7-2-9-5l-7-9a3.4 3.4 0 015-4.5z" fill="#fff" stroke="#123a78" stroke-width="2.4" stroke-linejoin="round"/></svg>',
  builder: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="27" r="14" fill="#ffd9a8" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M9 22a15 15 0 0130 0z" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="6" y="20" width="36" height="5" rx="2.5" fill="#e79a09" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="19" cy="30" r="2" fill="#123a78"/><circle cx="29" cy="30" r="2" fill="#123a78"/><path d="M19 35c3 3 7 3 10 0" fill="none" stroke="#123a78" stroke-width="2" stroke-linecap="round"/></svg>',
  gift: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="18" width="34" height="24" rx="3" fill="#ff4d3d" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="5" y="13" width="38" height="8" rx="2" fill="#ff6a5a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M24 13v29" stroke="#ffc928" stroke-width="5"/><path d="M24 13c-4-7-12-6-10-1s10 1 10 1c4-7 12-6 10-1s-10 1-10 1z" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  race: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="16" y="14" width="16" height="29" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M16 23h16M16 33h16" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M24 14V4l10 3-10 3" fill="#ff4d3d" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M8 43h32" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  crane: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 43V10h5v33M4 10h40v4H4z" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M36 14v12" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><rect x="31" y="26" width="10" height="8" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M6 43h18" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  sfx: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 18h8l10-8v28l-10-8H8z" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M32 17c3 4 3 10 0 14M37 12c6 7 6 17 0 24" fill="none" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  music: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 36V10l20-4v26" fill="none" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="13" cy="36" rx="6" ry="5" fill="#ff8a5a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="33" cy="32" rx="6" ry="5" fill="#ff8a5a" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  vibe: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="15" y="6" width="18" height="36" rx="4" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M8 16v16M40 16v16M4 20v8M44 20v8" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  eye: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M3 24s8-13 21-13 21 13 21 13-8 13-21 13S3 24 3 24z" fill="#fff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="24" cy="24" r="7" fill="#2c7ae6" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  text: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 40L17 10h4l11 30M10 30h18" fill="none" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M30 40l6-16h2l6 16M32 34h10" fill="none" stroke="#2c7ae6" stroke-width="2.6" stroke-linecap="round"/></svg>',
  sun: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="9" fill="#ffc928" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M10 38l4-4M34 14l4-4" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  cloud: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 37a8 8 0 010-16 11 11 0 0121-3 8 8 0 015 19z" fill="#fff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  monitor: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="8" width="38" height="26" rx="3" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M18 42h12M24 34v8" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  info: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="#5fb3ff" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M24 21v13" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="14" r="2.6" fill="#fff"/></svg>',
  hand2: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M20 40c-6 0-10-4-10-10V16a3 3 0 016 0v8V9a3 3 0 016 0v14V7a3 3 0 016 0v16V11a3 3 0 016 0v19c0 6-4 10-10 10z" fill="#ffd9a8" stroke="#123a78" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
};
const coinTxt = n => `<span class="coin">${ICON.coin}</span>${fmt(n)}`;
const matTxt = n => `<span class="coin">${ICON.mat}</span>${fmt(n)}`;
const starsHtml = (n, cls = 'small') => `<span class="stars ${cls}">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const styleColor = s => STYLES[s] ? STYLES[s].body : '#888';
for (const el of document.querySelectorAll('[data-icon]')) el.insertAdjacentHTML('afterbegin', ICON[el.dataset.icon] || '');

/* ---------------- Floating text, banners, toasts ---------------- */
const pops = [];
const vProj = new T.Vector3();
function popupAt(text, wx, wy, wz, cls, delay = 0) {
  const el = document.createElement('div');
  el.className = 'pop ' + cls; el.textContent = text; el.style.opacity = '0';
  $('fx').appendChild(el);
  pops.push({ el, wx, wy, wz, t: -delay, life: cls === 'perfect' ? 1.2 : 1 });
}
function updatePops(dt) {
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.t += dt;
    if (p.t >= p.life) { p.el.remove(); pops.splice(i, 1); continue; }
    if (p.t < 0) continue;
    vProj.set(p.wx, p.wy, p.wz).project(camera);
    const k = p.t / p.life, rise = reduceMotion ? 0 : 30 * Math.min(1, k * 1.6);
    const px = (vProj.x * 0.5 + 0.5) * w, py = (-vProj.y * 0.5 + 0.5) * h - rise;
    p.el.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px) translate(-50%,-50%)`;
    p.el.style.opacity = String(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
  }
}
function flushToasts() { const q = toastQueue.splice(0); q.forEach(([t, c], i) => setTimeout(() => toast(t, c), 400 + i * 700)); }
function clearPops() { for (const p of pops) p.el.remove(); pops.length = 0; }
let bannerTimer = 0;
function banner(title, sub) {
  const b = $('banner');
  $('bannerTitle').textContent = title; $('bannerSub').textContent = sub || '';
  b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { b.hidden = true; }, 1950);
}
const toastQueue = [];
function toast(text, cls = '') {
  if (state === 'play' || state === 'pause' || state === 'fly') { toastQueue.push([text, cls]); return; }
  const el = document.createElement('div');
  el.className = 'toast ' + cls; el.textContent = text;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3300);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}

/* ---------------- Construction HUD ---------------- */
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
const LIFE_SVG = '<svg class="life" viewBox="0 0 10 7" aria-hidden="true"><rect x="2" y="1" width="6" height="4" fill="currentColor"/><rect x="0" y="5" width="10" height="2" fill="currentColor"/><rect x="4" y="0" width="2" height="1" fill="currentColor"/></svg>';
function updateBuildHud() {
  const g = game;
  if (!g || g.kind === 'attract') return;
  const n = g.tower.length, goal = g.target;
  if ($('lives').children.length !== g.mods.lives) $('lives').innerHTML = LIFE_SVG.repeat(g.mods.lives);
  $('hudBadge').innerHTML = goal ? `${n}<small>/${goal}</small>` : String(n);
  const ph = g.bp && nextPhase(g.bp, g.tower.length === g.target ? g.tower.length - 1 : g.tower.length);
  setText('hudLabel', g.kind === 'race' ? 'Sky Race' : g.kind === 'daily' ? 'Daily' : g.kind === 'weekly' ? 'Weekly' : g.kind === 'stage' ? PROJECTS[g.project || 'stadium'].stages[g.stage].name : g.bp ? (ph ? `${g.bp.name} · ${ph[1]}` : g.bp.name) : 'Floors');
  $('gaugeBar').hidden = !goal;
  if (goal) {
    $('gaugeFill').style.setProperty('--c', styleColor(floorStyle(g)));
    $('gaugeFill').style.height = `calc(${Math.min(100, n / goal * 100).toFixed(1)}% - 4px)`;
  }
  setText('hudPop', fmt(g.pop));
  $('lives').setAttribute('aria-label', `${g.lives} of ${g.mods.lives} lives left`);
  [...$('lives').children].forEach((el, i) => el.classList.toggle('lost', i >= g.lives));
}
const LEVELS_UI = [['Stable', '●'], ['Moving', '◆'], ['Dangerous', '▲'], ['Critical', '✖']];
function updateLiveHud() {
  const g = game;
  if (!g || g.kind === 'attract') return;
  const c = g.combo, on = c.timer > 0 && state === 'play';
  $('combo').hidden = !on;
  if (on) { $('comboFill').style.width = (c.timer / CFG.comboTime * 100).toFixed(1) + '%'; setText('comboLabel', `Combo ×${c.streak}`); }
  const ch = g.charge, f = g.falling, box = $('mult');
  const showMult = state === 'play' && !!(ch || (f && (f.hold > 1 || f.power > 1)));
  box.hidden = !showMult;
  const special = g.hook.has && nextKind(g) === 'special' && g.bp;
  $('bpName').hidden = showMult;
  const wx = g.kind === 'city' && WEATHER[g.mods.weather];
  setText('bpName', special ? `${g.bp.special.name}: land it Perfect` : g.daily ? dailyConfig(g.daily).name : g.weekly ? weeklyConfig().name : wx && wx.bonus ? `${wx.icon} ${wx.name} · coins +${Math.round(wx.bonus * 100)}%` : '');
  $('bpName').style.color = special ? 'var(--stable)' : '';
  if (showMult) {
    const hm = ch ? FORGE.hold.mult[holdBand(ch.t)] : f.hold, pm = ch ? 1 : f.power;
    setText('multVal', `×${(hm * pm).toFixed(1)}`);
    setText('multLbl', ch ? FORGE.hold.label[holdBand(ch.t)] : (f.power > 1 ? `Power ×${f.power}` : FORGE.hold.label[FORGE.hold.mult.indexOf(f.hold)] || ''));
    $('multBar').style.width = ch ? `${Math.min(100, ch.t / FORGE.hold.cap * 100).toFixed(1)}%` : '100%';
    box.className = 'mult glass' + (ch && ch.t >= FORGE.hold.warn ? ' warn' : '') + (!ch && f.power > 1 ? ' power' : '');
  }
  const lv = String(g.level);
  if ($('stab').dataset.level !== lv) { $('stab').dataset.level = lv; $('stabTxt').textContent = LEVELS_UI[g.level][0]; $('stabIco').textContent = LEVELS_UI[g.level][1]; }
}

/* ---------------- Coach tips (GDD §14 tutorial order) ---------------- */
let lastInput = touchDevice ? 'touch' : 'mouse';
const TIPS = {
  tap:     { touch: '<b>Tap</b> to drop the floor. Land it dead centre.', mouse: '<b>Click</b> to drop the floor. Land it dead centre.', key: 'Press <b>Space</b> to drop the floor. Land it dead centre.' },
  hold:    { touch: '<b>Press and hold</b>: the crane swings faster and your multiplier climbs. Let go to drop.', mouse: '<b>Click and hold</b>: the crane swings faster and your multiplier climbs. Let go to drop.', key: '<b>Hold Space</b>: the crane swings faster and your multiplier climbs. Release to drop.' },
  power:   { touch: 'While holding, <b>swipe down</b> for a Power Drop. It hits harder and multiplies again.', mouse: 'While holding, <b>drag down</b> for a Power Drop. It hits harder and multiplies again.', key: 'While holding Space, press <b>↓</b> for a Power Drop, or <b>Shift ↓</b> for maximum.' },
  recall:  { touch: 'Bad swing? While holding, <b>swipe up</b> to recall the floor. It costs one step of your combo.', mouse: 'Bad swing? While holding, <b>drag up</b> to recall the floor. It costs one step of your combo.', key: 'Bad swing? While holding Space, press <b>↑</b> to recall the floor. It costs one step of your combo.' },
  forced:  'Let go soon. At <b>3 seconds</b> the crane releases on its own.',
  sway:    'The building is swaying. Drop as the top swings back under the rope.',
  recover: 'The tower is swinging hard. <b>Perfect</b> floors calm it down, and a recovery pays a bonus.',
  balance: 'The top is <b>overhanging</b> and starting to creak. Drop the next floor on the <b>other side</b> to counterbalance, or it will topple.',
};
const coach = { id: null, t: 0 };
function showTip(id) {
  if (!save.settings.tips || save.tips[id] || coach.id === id || state !== 'play') return;
  if ((id === 'hold' || id === 'power' || id === 'recall' || id === 'forced') && !featureOn(id === 'forced' ? 'hold' : id)) return;
  if (coach.id && coach.t < 3) return;
  const tip = TIPS[id];
  coach.id = id; coach.t = 0;
  $('coach').innerHTML = typeof tip === 'string' ? tip : (tip[lastInput] || tip.touch);
  $('coach').hidden = false;
}
function doneTip(id) {
  if (!save.tips[id]) { save.tips[id] = true; persist(); }
  if (coach.id === id) { coach.id = null; $('coach').hidden = true; }
}
function hideCoach() { coach.id = null; $('coach').hidden = true; }

/* ---------------- City hub HUD ---------------- */
function updateHubHud() {
  const A = City.A || recomputeCity();
  const lp = levelProgress();
  setText('lvlNum', String(lp.l));
  $('lvlRing').setAttribute('stroke-dashoffset', (81.7 * (1 - lp.frac)).toFixed(1));
  setText('lvlNext', lp.next == null ? 'Top level' : `Level ${lp.l + 1} at ${fmtK(lp.next)}`);
  $('lvlBar').style.setProperty('--p', (lp.frac * 100).toFixed(1) + '%');
  const bank = Math.floor(save.bank);
  $('collectBtn').hidden = bank < 1;
  setText('collectTxt', `Collect ${fmt(bank)}`);
  for (const [k, id] of [['R', 'dR'], ['C', 'dC'], ['O', 'dO']]) {
    const v = A.demand[k], el = $(id);
    el.style.top = v >= 0 ? `${50 - v * 50}%` : '50%';
    el.style.bottom = v >= 0 ? '50%' : `${50 + v * 50}%`;
  }
  setText('happy', `${Math.round(A.happy * 100)}%`);
  setText('income', `${fmtK(City.rate)}/h`);
  $('matChip').hidden = skillLevel() < ECON.renoLevel;
  setText('hubMat', fmtK(Math.floor(save.materials)));
  const load = A.load[A.worstUtil];
  setText('gridLbl', UTIL_NAMES[A.worstUtil]); setText('grid', `${Math.round(load * 100)}%`);
  $('grid').className = load > 1 ? 'bad' : load > 0.85 ? 'warn' : '';
  const tr = A.commute / Math.max(1, A.roadCap);
  setText('traffic', tr < 0.6 ? 'Light' : tr < 1 ? 'Busy' : 'Jammed');
  $('traffic').className = tr >= 1 ? 'bad' : tr > 0.85 ? 'warn' : '';
  setTraffic(A); refreshOverlay();
  const ev = eventNow(), wx = WEATHER[weatherNow()];
  $('evPill').hidden = !ev;
  const evHtml = ev ? `<i>${ev.icon}</i>${esc(ev.name)}<small>${fmtDuration(eventEndsIn())}</small>` : '';
  if (hudCache.ev !== evHtml) { hudCache.ev = evHtml; $('evPill').innerHTML = evHtml; }
  const wxHtml = `<i>${wx.icon}</i>${wx.name}${wx.bonus ? `<small>+${Math.round(wx.bonus * 100)}% coins</small>` : ''}`;
  if (hudCache.wx !== wxHtml) { hudCache.wx = wxHtml; $('wxPill').innerHTML = wxHtml; $('wxPill').classList.toggle('bonus', !!wx.bonus); }
  // Missions: finished contracts, today's chest and unseen achievements. Events: today's challenge.
  const nc = contractsReady() + (loginReady() ? 1 : 0) + (Object.keys(save.ach).length > (save.seenAch || 0) ? 1 : 0);
  $('badgeContracts').hidden = !nc; setText('badgeContracts', String(nc));
  $('badgeDaily').hidden = !(dailyOn() && !dailyCleared());
  $('badgeTrophies').hidden = true;
  const gh = nextGoal();
  if (hudCache.goalHtml !== gh) { hudCache.goalHtml = gh; $('goal').innerHTML = gh; }
}
// Coins, population and prestige count up instead of jumping.
const shown = { coins: null, pop: null, prestige: null };
function animateHubNumbers(dt) {
  const real = { coins: save.coins, pop: population(), prestige: save.prestige };
  for (const k of Object.keys(shown)) {
    if (shown[k] == null || reduceMotion) shown[k] = real[k];
    const d = real[k] - shown[k];
    shown[k] = Math.abs(d) < 0.5 ? real[k] : shown[k] + d * Math.min(1, dt * 5);
  }
  setText('hubPop', fmtK(shown.pop)); setText('hubCoins', fmtK(shown.coins)); setText('hubPrestige', fmtK(shown.prestige));
}
// Always show one clear next step (GDD §11: quickly see progress).
let goalLot = null;                                   // where the Build Here bubble points, when the next step is a new building
function nextGoal() {
  goalLot = null;
  const g = nextGoalText();
  if (g.build) goalLot = g.build === true ? bestEmptyLot() : g.build;
  return g.text || g;
}
function nextGoalText() {
  const A = City.A, B = text => ({ text, build: true });
  if (!buildingsList().length) return { text: 'Tap the glowing lot on <b>Harbor Row</b> to build your first homes.', build: LOT_BY_ID['harbor-C2'] };
  if (contractsReady()) return `A contract is complete. <b>Tap Jobs</b> to claim it.`;
  if (save.bank >= 1 && save.bank >= incomeCap() * 0.99) return `Income storage is <b>full</b>. Collect it so your city keeps earning.`;
  if (save.bank >= 50) return `Your city has earned <b>${fmt(save.bank)}</b> coins. Tap <b>Collect</b>.`;
  const FIX = { power: ['power', 'a <b>Power Plant</b>', 'power'], water: ['water', 'a <b>Water Tower</b>', 'tower'], waste: ['waste handling', 'a <b>Landfill</b>', 'dump'], data: ['connectivity', 'a <b>Cell Tower</b>', 'cell'] };
  const su = A.load[A.worstUtil] > 1 ? A.worstUtil : null, short = su && FIX[su];
  if (short) return save.level >= PLACEABLES[short[2]].level ? `<b>${UTIL_NAMES[su]} shortage</b>: buildings are emptying. Place ${short[1]} on a free lot.` : `The old grid is running out of ${short[0]}. ${short[1]} unlocks at level ${PLACEABLES[short[2]].level}.`;
  const unfinished = buildingsList().find(([, b]) => !b.done);
  if (unfinished) return `<b>${BLUEPRINTS[unfinished[1].bp].name}</b> is unfinished. Tap it to continue building.`;
  if (A.congestion > 0.2) return save.level >= PLACEABLES.bus.level ? '<b>Traffic jams</b> are cutting income. Place a <b>Bus Stop</b> or other transit.' : 'Streets are getting jammed. Transit unlocks at level 5.';
  if (A.pollShare > 0.3) return '<b>Pollution</b> is hurting homes. Keep factories away from housing, or move them to the Dockyards.';
  if (save.level >= BLUEPRINTS.school.level && A.Rcap > 400 && A.svc.edu < 0.4) return B('Families want a <b>school</b>. Build a Harbor School near homes.');
  if (save.level >= BLUEPRINTS.clinic.level && A.Rcap > 600 && A.svc.health < 0.4) return B('Residents need <b>healthcare</b>. Build a Neighbourhood Clinic near homes.');
  if (A.demand.C > 0.3 && save.level >= BLUEPRINTS.market.level) return B('Residents want shops. Build a <b>Corner Market</b> next to your homes.');
  if (A.demand.O > 0.3 && save.level >= BLUEPRINTS.office.level) return B('Residents need jobs. Build an <b>Office Tower</b> near homes and shops.');
  if (A.demand.R > 0.3) return B('Jobs are going unfilled. Build more <b>homes</b>.');
  if (dailyOn() && !dailyCleared()) return "Today's <b>Daily Challenge</b> is waiting.";
  const open = LOTS.filter(l => save.districts[l.d] && !save.lots[l.id]).length;
  if (!open) { const d = DISTRICTS.find(x => !save.districts[x.id]); if (d) return d.level <= save.level ? `Room to grow: buy <b>${d.name}</b> for ${fmt(d.cost)} coins.` : `<b>${d.name}</b> opens at city level ${d.level}.`; }
  if (A.happy < 0.6 && save.level >= PLACEABLES.park.level) return 'Happiness is low. A <b>Park</b> raises it and nearby land value.';
  return B(`Beat your Sky Race record of <b>${save.race.best}</b> floors, or tap an empty lot to build.`);
}
// District and tower labels that follow the city camera.
const labelEls = {};
function labelEl(key, cls) {
  let el = labelEls[key];
  if (!el) { el = labelEls[key] = document.createElement('div'); el.className = cls; $('labels').appendChild(el); }
  return el;
}
function updateLabels(show) {
  const w = window.innerWidth, h = window.innerHeight;
  const place = (el, x, y, z) => {
    vProj.set(x, y, z).project(camera);
    const vis = vProj.z < 1 && Math.abs(vProj.x) < 1.2 && Math.abs(vProj.y) < 1.2;
    el.hidden = !vis;
    if (vis) el.style.transform = `translate(${((vProj.x * 0.5 + 0.5) * w).toFixed(0)}px,${((-vProj.y * 0.5 + 0.5) * h).toFixed(0)}px) translate(-50%,-50%)`;
  };
  for (const d of DISTRICTS) {
    const el = labelEl('d:' + d.id, 'dlabel');
    if (!show) { el.hidden = true; continue; }
    const owned = save.districts[d.id], [sg, sm] = owned ? starsIn(save.lots, d.id) : [0, 0];
    const html = owned ? `${esc(d.name)}<small>${ICON.star}${sg}/${sm}</small>` : `${esc(d.name)}<small>${d.level > save.level ? `${ICON.lock}Lv. ${d.level}` : `${ICON.coin}${fmt(d.cost)}`}</small>`;
    if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; el.classList.toggle('locked', !owned); el.classList.toggle('star', !!owned); }
    const o = districtCentre(d);
    place(el, o.x, 0.5, d.pos ? o.z + (owned ? 38 : 0) : owned ? 38 : 0);
  }
  for (const lot of LOTS) {
    const b = buildingAt(lot.id);
    const el = labelEls['t:' + lot.id];
    if (!b || b.done || !show) { if (el) el.hidden = true; continue; }
    const e2 = labelEl('t:' + lot.id, 'tlabel warn');
    const txt = `${b.xs.length}/${b.target} ▲`;
    if (e2.textContent !== txt) e2.textContent = txt;
    place(e2, lot.x, b.xs.length * H * S + 3, lot.z);
  }
  const bh = labelEl('buildhere', 'buildhere'), gl = show && $('sheet').hidden && $('modal').hidden && goalLot && !save.lots[goalLot.id] ? goalLot : null;
  if (!bh.dataset.init) { bh.dataset.init = 1; bh.innerHTML = `<b>Build Here!</b><i></i>${ICON.hand}`; bh.addEventListener('click', () => { const l = LOT_BY_ID[bh.dataset.lot]; if (l) { Sound.click(); openLotSheet(l); } }); }
  if (!gl) bh.hidden = true; else { bh.dataset.lot = gl.id; place(bh, gl.x, 2, gl.z); }
  for (const P of Object.values(PROJECTS)) {
    const el = labelEl('p:' + P.id, 'dlabel'), n = projStage(P), lvl = P.stages[0].level;
    if (!show) { el.hidden = true; continue; }
    const html = `${P.name}<small>${save.level < lvl ? `Level ${lvl}` : projDone(P) ? 'Open' : `Stage ${n + 1} of ${P.stages.length}`}</small>`;
    if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
    place(el, P.centre.x, 2, P.island.z1 + 2);
  }
  for (const key of ['p:pier', 'p:record']) {
    const el = labelEl(key, 'dlabel');
    if (!show) { el.hidden = true; continue; }
    const rec = key === 'p:record';
    const html = rec ? `Record Pier<small>${save.race.best ? `${save.race.best} floors` : 'Set a Sky Race record'}</small>` : `Challenge Pier<small>Sky Race · Daily</small>`;
    if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
    const p = rec ? RECORD_PIER : PIER;
    place(el, p.x, 1, p.z + 20);
  }
}

/* ---------------- Sheet (lot actions) and modal ---------------- */
let sheetLot = null;
function openSheet(html, onMount) {
  const s = $('sheet');
  s.innerHTML = html; s.hidden = false; $('scrim').hidden = false;
  s.scrollTop = 0;
  if (onMount) onMount(s);
  const b = s.querySelector('.card:not([aria-disabled="true"]), .btn.primary, .btn');
  if (b && !touchDevice) b.focus({ preventScroll: true });
}
function closeSheet() { $('sheet').hidden = true; $('scrim').hidden = true; sheetLot = null; selectRing(null); }
let modalClose = null;
function openModal(html, onMount, onClose) {
  const m = $('modal');
  $('modalPanel').innerHTML = html; m.hidden = false; $('modalPanel').scrollTop = 0;
  modalClose = onClose || null;
  if (onMount) onMount($('modalPanel'));
  const x = $('modalPanel').querySelector('[data-close]');
  if (x) x.addEventListener('click', closeModal);
  const b = $('modalPanel').querySelector('.btn.primary, .btn');
  if (b && !touchDevice) b.focus({ preventScroll: true });
}
function closeModal() {
  if ($('modal').hidden) return;
  $('modal').hidden = true;
  const fn = modalClose; modalClose = null;
  if (fn) fn();
  if (state === 'title' && $('modal').hidden) renderTitle();         // coins or chests may have changed
}
const head = (title, sub) => `<div class="head"><button class="x" type="button" data-close aria-label="Back">${ICON.back}</button><div><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div><span class="hx"></span></div>`;
function bind(root, sel, fn) { for (const el of root.querySelectorAll(sel)) el.addEventListener('click', e => { Sound.click(); fn(el, e); }); }

function estimate(key) { const bp = typeof key === 'string' ? BLUEPRINTS[key] : key; return Math.round(bp.floors * 20 * bp.mult / 10) * 10; }
function lotTitle(lot) { return `${DISTRICT_BY_ID[lot.d].name} · ${lot.row}${lot.col}`; }
function lotPills(lot) {
  const lv = City.lv[lot.id] || 1, c = (City.ctx && City.ctx[lot.id]) || { svc: {}, poll: 0, transit: 0 };
  return `<div class="pills"><span class="${lv > 1.05 ? 'good' : lv < 0.95 ? 'bad' : ''}">Land value ×${lv.toFixed(2)}</span>${lot.water ? '<span class="good">Waterfront</span>' : ''}${DISTRICT_BY_ID[lot.d].maxFloors ? `<span>Max ${DISTRICT_BY_ID[lot.d].maxFloors} floors</span>` : ''}${c.transit ? '<span class="good">Transit</span>' : ''}${SERVICE_ROLES.filter(r => c.svc[r]).map(r => `<span class="good">${SERVICE_NAMES[r]}</span>`).join('')}${c.poll ? '<span class="bad">Polluted</span>' : ''}</div>`;
}
const SVC_ROLES = new Set(['edu', 'health', 'safety', 'ent']);
const UTIL_KEYS = new Set(['power', 'tower', 'solar', 'wind', 'waterworks', 'dump', 'recycling', 'cell', 'datacenter', 'fusion']);
// Unlocked first, then the next couple of locked ones, so the list stays short.
function byLevel(keys, table) {
  const open = keys.filter(k => table[k].level <= save.level).sort((a, b) => table[a].level - table[b].level);
  const locked = keys.filter(k => table[k].level > save.level).sort((a, b) => table[a].level - table[b].level).slice(0, 2);
  return open.concat(locked);
}
function gridLine() {
  const A = City.A;
  return `<p class="sub">Used of supply: power ${fmt(A.powerUse)} / ${fmt(A.power)} · water ${fmt(A.waterUse)} / ${fmt(A.water)} · waste ${fmt(A.wasteUse)} / ${fmt(A.waste)} · data ${fmt(A.dataUse)} / ${fmt(A.data)}</p>`;
}
function openLotSheet(lot, tab = 'homes') {
  sheetLot = lot; selectRing(lot);
  const d = DISTRICT_BY_ID[lot.d], b = save.lots[lot.id];
  if (!save.districts[lot.d]) {
    const r = canBuyDistrict(d);
    openSheet(`${head(d.name, esc(d.trait))}
      <div class="pills"><span>9 lots</span><span>Land value ×${d.lv.toFixed(2)}</span>${d.maxFloors ? `<span>Max ${d.maxFloors} floors</span>` : ''}</div>
      <p class="lede">${r.locked ? `This district opens at <b>city level ${d.level}</b>.` : `Buy the whole block for <b>${fmt(d.cost)}</b> coins.`}</p>
      <button class="btn primary" type="button" id="buyD" ${r.ok ? '' : 'disabled'}>${r.ok ? `Buy for ${fmt(d.cost)}` : esc(r.reason)}</button>`, s => {
      s.querySelector('[data-close]').addEventListener('click', closeSheet);
      bind(s, '#buyD', () => { if (buyDistrict(d)) { Sound.levelUp(); toast(`${d.name} is yours`, 'good'); rebuildLots(); closeSheet(); updateHubHud(); } });
    });
    return;
  }
  if (b && b.place) {
    const P = PLACEABLES[b.place];
    openSheet(`${head(P.name, lotTitle(lot))}${lotPills(lot)}<p class="lede">${esc(P.blurb)}</p>
      <button class="btn danger" type="button" id="rm">Remove (+${fmt(Math.round(P.cost * 0.5))})</button>`, s => {
      s.querySelector('[data-close]').addEventListener('click', closeSheet);
      bind(s, '#rm', el => { if (el.dataset.arm) { clearLot(lot); rebuildLots(); closeSheet(); updateHubHud(); } else { el.dataset.arm = 1; el.textContent = 'Tap again to remove'; } });
    });
    return;
  }
  if (b && b.bp && tab !== 'rebuild') { openBuildingSheet(lot, b); return; }
  const rebuild = tab === 'rebuild';
  if (tab === 'towers') tab = 'homes';
  const TABS = BUILD_TABS.concat(studioOn() ? [['studio', 'Studio', 'studio']] : []);
  let list, extra = '', keys = [];
  if (tab === 'studio') {
    keys = save.custom.map(d => customKey(d.id)).filter(k => BLUEPRINTS[k]);
    list = keys.map(k => bpRow(k, lot, canBuild(k, lot))).join('');
    extra = `<p class="sub">Your own designs (${save.custom.length} of ${STUDIO.max}).</p><div class="btn-row"><button class="btn" type="button" id="stNew" ${save.custom.length >= STUDIO.max ? 'disabled' : ''}>New design</button><button class="btn" type="button" id="stEdit" ${save.custom.length ? '' : 'disabled'}>Edit designs</button></div>`;
  } else if (tab === 'places' || tab === 'utility') {
    list = byLevel(Object.keys(PLACEABLES).filter(k => UTIL_KEYS.has(k) === (tab === 'utility')), PLACEABLES).map(k => placeRow(k, lot)).join('');
    if (tab === 'utility') extra = gridLine();
  } else {
    keys = byLevel(rebuild ? BP_KEYS.slice() : tabKeys(tab), BLUEPRINTS);
    if (!rebuild) keys = keys.concat(tabKeys(tab).filter(k => BLUEPRINTS[k].contract && !keys.includes(k) && save.bpUnlocks[k]));
    list = keys.map(k => bpRow(k, lot, canBuild(k, lot))).join('');
  }
  const lv = City.lv[lot.id] || 1;
  openSheet(`${head(rebuild ? 'Rebuild' : 'Build', lotTitle(lot))}
    <div class="pills"><span class="${lv > 1.05 ? 'good' : lv < 0.95 ? 'bad' : 'gold'}">Land value ${Math.round(lv * 100)}%${lv > 1.05 ? ' ▲' : lv < 0.95 ? ' ▼' : ''}</span>${lotPills(lot).replace(/^<div class="pills"><span[^>]*>[^<]*<\/span>/, '').replace(/<\/div>$/, '')}</div>
    ${rebuild ? '<p class="lede">The new tower replaces the old one only if it is better (finished beats unfinished, then more capacity).</p>' : tabsHtml(TABS, tab)}${extra}
    <div class="cards">${list || '<p class="sub">Nothing here yet. Keep growing your city.</p>'}</div>`, s => {
    s.querySelector('[data-close]').addEventListener('click', closeSheet);
    bind(s, '[data-tab]', el => openLotSheet(lot, el.dataset.tab));
    bind(s, '#stNew', () => showStudio(null, () => openLotSheet(lot, 'studio')));
    bind(s, '#stEdit', () => openModal(`${head('Your designs')}<div class="cards">${save.custom.map(d => `<button class="card" type="button" data-edit="${d.id}"><i class="sw" style="--c:${styleColor(d.style)}"></i><span><b>${esc(d.name)}</b><small>${d.floors} floors · ${STUDIO.roles[d.role].name}${customInUse(d.id) ? ' · standing in your city' : ''}</small></span><span class="go">${customInUse(d.id) ? 'View' : 'Edit'}</span></button>`).join('')}</div>`, p => {
      bind(p, '[data-edit]', el => showStudio(el.dataset.edit, () => openLotSheet(lot, 'studio')));
    }));
    bind(s, '[data-bp]', (el, e) => { e.stopPropagation(); tryBuild(el.dataset.bp, lot); });
    bind(s, '[data-place]', (el, e) => { e.stopPropagation(); doPlace(el.dataset.place, lot); });
    bind(s, '[data-info]', el => showBpInfo(el.dataset.info, keys, lot, rebuild ? () => openLotSheet(lot, 'rebuild') : null));
    bind(s, '[data-pinfo]', el => showPlaceInfo(el.dataset.pinfo, lot));
  });
}
// Short on materials: offer to buy the difference, then carry on.
function offerMaterials(n, alsoCoins, then) {
  const price = matPrice(n), can = save.coins >= price + (alsoCoins || 0);
  openModal(`${head('Not enough materials', `You have ${fmt(Math.floor(save.materials))}. Harbor Works and Perfect floors make more.`)}
    <p class="lede">Buy <b>${fmt(n)}</b> materials for <b class="coin">${fmt(price)}</b> coins${then ? ' and start building' : ''}?</p>
    <div class="btn-row"><button class="btn" type="button" data-close>Not now</button><button class="btn primary" type="button" id="buyM" ${can ? '' : 'disabled'}>${can ? `Buy ${fmt(price)}` : 'Not enough coins'}</button></div>`, p => {
    bind(p, '#buyM', () => { if (buyMaterials(n, true)) { Sound.coin(2); $('modal').hidden = true; modalClose = null; updateHubHud(); if (then) then(); } });
  });
}
function renoCard(lot, b, R) {
  const r = canRenovate(lot, R.id), cost = renoCost(b, R);
  const status = r.done ? '✓ Done' : r.ok ? `${coinTxt(cost)}${R.mat ? `<br>${matTxt(R.mat)}` : ''}` : esc(r.reason);
  return `<button class="card ${r.done ? 'done' : ''}" type="button" data-reno="${R.id}" aria-disabled="${!r.ok}"><i class="sw" style="--c:${r.done ? 'var(--stable)' : 'var(--accent)'}"></i>
    <span><b>${esc(R.name)}</b><small>${esc(R.desc)}</small></span><span class="go">${status}</span></button>`;
}
function openBuildingSheet(lot, b) {
  const bp = BLUEPRINTS[b.bp], caps = capsOf(b), total = capTotal(caps), occ = b.occ ?? 0;
  const roles = Object.entries(caps).filter(([, v]) => v > 0).map(([r, v]) => `<span>${fmt(v * occ)} / ${fmt(v)} ${ROLE_NAMES[r]}</span>`).join('');
  const date = new Date(b.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const cont = !b.done ? canBuild(b.bp, lot, { cont: true }) : null;
  openSheet(`${head(bp.name, `${lotTitle(lot)} · ${ROLE_LABEL[bp.role]}`)}
    <div class="whitebox citycard"><span class="thumb">${imgTag(thumbFor(b.bp, b.style || chosenStyle(b.bp)), bp.name)}</span><span>${starsHtml(b.stars || 0)}<small style="display:block;color:var(--card-muted);font-weight:800">${b.done ? `Topped out · ${b.xs.length} floors` : bp.phases ? `${b.xs.length} of ${bp.floors} floors · next phase: ${(nextPhase(bp, b.xs.length) || [0, ''])[1]}` : `Unfinished · ${b.xs.length} of ${b.target} floors`}</small></span></div>
    ${bp.phases ? `<div class="chips">${bp.phases.map(p => `<span style="${b.xs.length >= p[0] ? '' : 'opacity:.45'}">${esc(p[1])}</span>`).join('')}</div>` : ''}
    <div class="pills">${roles}</div>
    <div class="meter" style="--c:var(--stable)" aria-label="Occupancy"><i style="width:${Math.round(occ * 100)}%"></i></div>
    <p class="sub">${Math.round(occ * 100)}% occupied, heading for ${Math.round((b.occT ?? occ) * 100)}%. ${lotPills(lot).replace(/<\/?div[^>]*>/g, '').replace(/<span[^>]*>/g, '').replace(/<\/span>/g, ' · ')}</p>
    <dl class="stats">
      <dt>Construction quality</dt><dd>${Math.round((b.quality || 0) * 100)}%</dd>
      <dt>Perfect floors</dt><dd>${fmt(b.perfects || 0)}</dd>
      <dt>Longest combo</dt><dd>${b.combo ? `×${b.combo}` : '–'}</dd>
      <dt>Power Perfects</dt><dd>${fmt(b.power || 0)}</dd>
      <dt>Strongest impact</dt><dd>${(b.strongest || 1).toFixed(1)}×</dd>
      ${bp.special ? `<dt>${bp.special.name} bonuses</dt><dd>${b.specials || 0}</dd>` : ''}
      <dt>Started</dt><dd>${date}</dd>
    </dl>
    ${b.recoveries && b.recoveries.length ? `<div class="chips">${b.recoveries.slice(-6).map(n => `<span>${esc(n)}</span>`).join('')}</div>` : ''}
    ${City.A && City.A.util < 0.99 ? `<p class="sub" style="color:var(--danger)">${UTIL_NAMES[City.A.worstUtil]} shortage: people are moving out. Add supply in the Utilities tab of an empty lot.</p>` : ''}
    ${b.done && skillLevel() >= ECON.renoLevel ? `<h3>Renovate</h3><div class="cards">${RENOVATIONS.map(R => renoCard(lot, b, R)).join('')}</div>` : ''}
    <div class="btns">
      ${!b.done ? `<button class="btn primary" type="button" id="cont" ${cont.ok || cont.matShort ? '' : 'disabled'}>${cont.ok || cont.matShort ? (bp.phases ? `Build ${(nextPhase(bp, b.xs.length) || [0, 'next phase'])[1]} · free` : `Continue building · ${fmt(cont.cost)}${cont.mat ? ` + ${fmt(cont.mat)} materials` : ''}`) : esc(cont.reason)}</button>` : ''}
      <div class="btn-row"><button class="btn" type="button" id="rebuild">Rebuild</button><button class="btn danger" type="button" id="demo">Demolish (+${fmt(Math.round(bp.cost * ECON.demolishRefund))})</button></div>
    </div>`, s => {
    s.querySelector('[data-close]').addEventListener('click', closeSheet);
    bind(s, '#cont', () => {
      const c = canBuild(b.bp, lot, { cont: true });
      if (!c.ok && c.matShort) { offerMaterials(c.matShort, c.cost, () => { closeSheet(); startCityBuild(lot, b.bp, true); }); return; }
      closeSheet(); startCityBuild(lot, b.bp, true);
    });
    bind(s, '[data-reno]', el => {
      const R = RENOVATIONS.find(x => x.id === el.dataset.reno), r = canRenovate(lot, R.id);
      if (!r.ok) { if (!r.done) { Sound.deny(); toast(r.reason); } return; }
      renovate(lot, R.id); Sound.place(); rebuildLots(); burst(lot.x, b.xs.length * H * S, lot.z, 26, '#ffd76a', 6, 5, 1.2, 1.6, true);
      toast(`${R.name} done`, 'good'); openBuildingSheet(lot, buildingAt(lot.id)); updateHubHud(); afterCityChange();
    });
    bind(s, '#rebuild', () => openLotSheet(lot, 'rebuild'));
    bind(s, '#demo', el => { if (el.dataset.arm) { demolishFx(lot, b); Sound.demolish(); clearLot(lot); rebuildLots(); closeSheet(); updateHubHud(); vib([40, 30, 80]); } else { el.dataset.arm = 1; el.textContent = 'Tap again to demolish'; } });
  });
}
function openPierSheet(record) {
  if (record) {
    openSheet(`${head('Record Pier', 'Your best Sky Race tower stands here')}
      <div class="big"><div><b>${save.race.best}</b><small>floors</small></div><div><b>${fmtK(save.race.bestPop)}</b><small>best points</small></div></div>
      <p class="lede">Beat your record in Sky Race and the tower here is rebuilt floor for floor.</p>
      <button class="btn primary" type="button" id="race">Play Sky Race</button>`, s => {
      s.querySelector('[data-close]').addEventListener('click', closeSheet);
      bind(s, '#race', () => { closeSheet(); startRace(); });
    });
    return;
  }
  openSheet(`${head('Challenge Pier', 'Practice and challenges, away from your city')}
    <div class="cards">
      <button class="card" type="button" id="race"><i class="sw" style="--c:#3cbf3c"></i><span><b>Sky Race</b><small>The classic endless game. Three misses and it's over. Best: ${save.race.best} floors.</small></span><span class="go">Play</span></button>
      <button class="card" type="button" id="daily" aria-disabled="${!dailyOn()}"><i class="sw" style="--c:#ffc21a"></i><span><b>Daily Challenge</b><small>Same challenge for everyone today. Keep your streak going.</small></span><span class="go">${dailyOn() ? (dailyCleared() ? 'Cleared' : 'Play') : `Level ${FEATURES.daily}`}</span></button>
      <button class="card" type="button" id="weekly" aria-disabled="${!weeklyOn()}"><i class="sw" style="--c:#c9a8ff"></i><span><b>Weekly Challenge</b><small>A long tower with its own weather and crane. Bronze, silver and gold every week.</small></span><span class="go">${weeklyOn() ? `${weeklyState().tiers ? WEEKLY_TIERS[weeklyState().tiers - 1][0] : 'Play'}` : `Level ${FEATURES.weekly}`}</span></button>
    </div>`, s => {
    bind(s, '#weekly', () => { if (!weeklyOn()) { Sound.deny(); toast(`The Weekly Challenge opens at city level ${FEATURES.weekly}`); return; } closeSheet(); showWeekly(); });
    s.querySelector('[data-close]').addEventListener('click', closeSheet);
    bind(s, '#race', () => { closeSheet(); startRace(); });
    bind(s, '#daily', () => { if (!dailyOn()) { Sound.deny(); toast(`The Daily Challenge opens at city level ${FEATURES.daily}`); return; } closeSheet(); showDaily(); });
  });
}

/* ---------------- Modals ---------------- */
function unlockRows(list) {
  const kinds = { bp: 'Blueprint', place: 'Place', district: 'District', feature: 'New move' };
  return list.map(u => `<div><span>${esc(u.name)}</span><small>${kinds[u.type]}</small></div>`).join('');
}
function showLevelUps(ups, then) {
  if (!ups.length) { if (then) then(); return; }
  const u = ups[0];
  Sound.levelUp(); vib([20, 30, 20, 30, 60]);
  if (state === 'hub') fireworks(cam.look.x, 20, cam.look.z - 20, 6);
  openModal(`<div class="lvup panel" style="padding:0;background:none;border:0;backdrop-filter:none">
      <p class="eyebrow">City level</p><div class="num">${u.level}</div>
      ${rankFor(u.level) !== rankFor(u.level - 1) ? `<p class="lede" style="text-align:center">Your city is now a <b>${rankFor(u.level)}</b>.</p>` : ''}
      <div class="rewards"><span>${ICON.coin}+${fmt(u.reward)}</span></div>
      ${u.unlocks.length ? `<h3>Unlocked</h3><div class="unlocks">${unlockRows(u.unlocks)}</div>` : ''}
      <button class="btn primary" type="button" data-close style="width:100%">Great</button></div>`, null, () => showLevelUps(ups.slice(1), then));
}
function showWelcome(info, then) {
  const lines = [];
  if (info.earned >= 1) lines.push(`Your city earned <b class="coin">${fmt(info.earned)}</b> coins while you were away. Tap <b>Collect</b>.`);
  const nc = contractsReady(); if (nc) lines.push(`${plural(nc, 'contract')} ready to claim.`);
  if (dailyOn() && !dailyCleared()) lines.push(`Today's challenge: <b>${esc(dailyConfig().name)}</b>. Streak: ${dailyStreak()}.`);
  const fill = buildingsList().filter(([, b]) => b.occ != null && b.occT - b.occ > 0.05).length;
  if (fill) lines.push(`${plural(fill, 'building')} still filling up.`);
  if (!lines.length) { if (then) then(); return; }
  openModal(`${head('Welcome back', `Away for ${fmtDuration(info.away * 1000)}`)}<div class="unlocks">${lines.map(l => `<div><span>${l}</span></div>`).join('')}</div><button class="btn primary" type="button" data-close>Let's build</button>`, null, then);
}
function showFirstRun() {
  openModal(`<p class="eyebrow">Welcome, builder</p><h2>Your city starts here</h2>
    <p class="lede">Every tower in Skyline Forge is built by you, floor by floor, and stays in your skyline for good. Start with some homes on <b>Harbor Row</b>. The first permit is free.</p>
    <ul class="howto"><li><b>Tap</b><span>Drop the swinging floor.</span></li><li><b>Perfect</b><span>Land it dead centre for more residents and a combo.</span></li><li><b>3 misses</b><span>The build stops. You can continue it later.</span></li></ul>
    <button class="btn primary" type="button" id="first">Build Starter Flats</button>`, p => {
    bind(p, '#first', () => { $('modal').hidden = true; modalClose = null; startCityBuild(LOT_BY_ID['harbor-C2'], 'flats', false); });
  });
}
function showDaily() {
  if (!dailyOn()) { Sound.deny(); toast(`The Daily Challenge opens at city level ${FEATURES.daily}`); return; }
  const cfg = dailyConfig(), key = cfg.key, best = save.daily.best[key] || 0, cleared = save.daily.cleared[key] || 0;
  const streak = dailyStreak(), E = ECON.daily;
  const days = []; for (let i = 6; i >= 0; i--) { const k = addDays(key, -i); days.push(`<span class="${save.daily.cleared[k] ? 'on' : ''} ${i === 0 ? 'today' : ''}"><i></i>${keyToDate(k).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)}</span>`); }
  openModal(`${head(esc(cfg.name), `Daily Challenge · ${keyToDate(key).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`)}
    <div class="streak">${ICON.flame}<span>${streak ? `${streak}-day streak` : 'No streak yet'}</span></div>
    <div class="days">${days.join('')}</div>
    <div class="pills"><span class="gold">Build ${cfg.target} floors</span>${cfg.mods.map(m => `<span>${esc(m.name)}</span>`).join('')}</div>
    <ul class="howto">${cfg.mods.map(m => `<li><b>${esc(m.name)}</b><span>${esc(m.desc)}</span></li>`).join('')}</ul>
    <dl class="stats"><dt>Today's best</dt><dd>${best ? fmt(best) : '–'}</dd><dt>Stars</dt><dd>${starsHtml(cleared)}</dd>
    <dt>First clear today</dt><dd>${cleared ? 'Claimed' : `${coinTxt(E.base + E.perStreak * Math.min(streak + 1, E.streakCap))} + ${E.prestige} ✦`}</dd></dl>
    <p class="sub">★★ at ${fmt(cfg.target * 28)} points, ★★★ at ${fmt(cfg.target * 40)}. Retry as often as you like.</p>
    <button class="btn primary" type="button" id="go">${best ? 'Try again' : 'Start'}</button>`, p => {
    bind(p, '#go', () => { $('modal').hidden = true; modalClose = null; startDaily(); });
  });
}
function showWeekly() {
  const cfg = weeklyConfig(), w = weeklyState(), wx = WEATHER[cfg.weather];
  const tiers = WEEKLY_TIERS.map(([n, c, p], i) => `<div class="${w.tiers > i ? 'on' : ''}"><b>${n}</b><small>${fmt(cfg.tiers[i])} points</small><small class="coin">+${fmt(c)} · +${p} ✦</small></div>`).join('');
  openModal(`${head(esc(cfg.name), `Weekly Challenge · ends in ${fmtDuration(weekEndsIn())}`)}
    <div class="pills"><span class="gold">Build ${cfg.target} floors</span><span>${wx.icon} ${wx.name}</span>${cfg.mods.map(m => `<span>${esc(m.name)}</span>`).join('')}</div>
    <ul class="howto">${cfg.mods.map(m => `<li><b>${esc(m.name)}</b><span>${esc(m.desc)}</span></li>`).join('')}<li><b>${wx.name}</b><span>${esc(wx.desc.replace(/ Build coins.*$/, ''))}</span></li></ul>
    <div class="ach tiers">${tiers}</div>
    <dl class="stats"><dt>Your best this week</dt><dd>${w.best ? fmt(w.best) : '–'}</dd><dt>Weekly golds</dt><dd>${fmt(save.stats.weeklyGolds || 0)}</dd></dl>
    <p class="sub">Top out the tower to earn a tier. Everyone gets the same tower, weather and crane all week.</p>
    <button class="btn primary" type="button" id="go">${w.best ? 'Try again' : 'Start'}</button>`, p => {
    bind(p, '#go', () => { $('modal').hidden = true; modalClose = null; startWeekly(); });
  });
}
function showSettings(onDone) {
  const S2 = save.settings;
  const sw = (id, label, on, small, ic) => `<label class="setting"><span>${ic ? ICON[ic].replace('<svg', '<svg class="sic"') : ''}<span>${label}${small ? `<small>${small}</small>` : ''}</span></span><span class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span></span></span></label>`;
  const sel = (id, ic, label, opts) => `<label class="setting"><span>${ICON[ic].replace('<svg', '<svg class="sic"')}${label}</span><select id="${id}">${opts}</select></label>`;
  const lp = levelProgress();
  openModal(`${head('Settings')}
    <div class="whitebox profile"><span class="ava">${ICON.builder}</span><span style="min-width:0"><b id="pName">${esc(save.profile.name)}</b><small style="display:block;color:var(--card-muted);font-weight:800">Level ${save.level} · ${rankFor(save.level)} · City: ${esc(regionNow().name)}</small><span class="meter" style="display:block;margin-top:4px"><i style="width:${(lp.frac * 100).toFixed(0)}%"></i></span></span><button class="btn small" type="button" id="pEdit" aria-label="Edit name">✎</button></div>
    ${sw('sSfx', 'Sound effects', S2.sfx, '', 'sfx')}${sw('sMusic', 'Music', S2.music, '', 'music')}${sw('sHaptics', 'Vibration', S2.haptics, '', 'vibe')}
    ${sw('sClassic', 'Classic controls', S2.classic, 'Drop the moment you touch, like the phone original. Turns off hold, Power Drop and recall.', 'hand2')}
    ${sw('sShake', 'Camera shake', S2.shake, '', 'camera')}${sw('sTips', 'Tips while building', S2.tips, '', 'info')}${sw('sBig', 'Larger text', S2.bigText, '', 'text')}${sw('sHc', 'High contrast', S2.contrast, 'Solid panels, darker text and outlined labels.', 'eye')}${sw('sLefty', 'Left-handed layout', S2.lefty, 'Mirrors the buttons and readouts so your thumb covers less of the view.', 'hand')}
    ${sel('sTod', 'sun', 'Time of day', '<option value="auto">Match my clock</option><option value="day">Day</option><option value="sunset">Sunset</option><option value="night">Night</option>')}
    ${sel('sWeather', 'cloud', 'Weather', '<option value="live">Live weather</option><option value="off">Always clear</option>')}
    ${sel('sQuality', 'monitor', 'Graphics', '<option value="auto">Auto</option><option value="high">High</option><option value="balanced">Balanced</option><option value="battery">Battery saver</option>')}
    <div class="btn-row"><button class="btn" type="button" id="sHow">How to play</button><button class="btn" type="button" id="sTipsReset">Replay tips</button></div>
    <button class="btn ghost danger" type="button" id="sReset">Reset all progress</button>
    <button class="btn primary" type="button" data-close>Done</button>`, p => {
    bind(p, '#pEdit', () => {
      const b = p.querySelector('#pName'); if (!b) return;
      const inp = document.createElement('input'); inp.maxLength = 18; inp.value = save.profile.name; inp.setAttribute('aria-label', 'Your name'); b.replaceWith(inp); inp.focus(); inp.select();
      const done = () => { save.profile.name = inp.value.trim().slice(0, 18) || 'Builder'; persist(); const nb = document.createElement('b'); nb.id = 'pName'; nb.textContent = save.profile.name; inp.replaceWith(nb); };
      inp.addEventListener('blur', done); inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); e.stopPropagation(); });
    });
    const map = { sClassic: 'classic', sSfx: 'sfx', sMusic: 'music', sHaptics: 'haptics', sShake: 'shake', sTips: 'tips', sBig: 'bigText', sHc: 'contrast', sLefty: 'lefty' };
    for (const [id, key] of Object.entries(map)) p.querySelector('#' + id).addEventListener('change', e => {
      save.settings[key] = e.target.checked; persist(); Sound.apply();
      if (key === 'haptics' && e.target.checked) vib(20);
      if (key === 'bigText') document.body.classList.toggle('big', e.target.checked);
      if (key === 'contrast') document.body.classList.toggle('hc', e.target.checked);
      if (key === 'lefty') document.body.classList.toggle('lefty', e.target.checked);
    });
    p.querySelector('#sTod').value = S2.tod; p.querySelector('#sQuality').value = S2.quality; p.querySelector('#sWeather').value = S2.weather;
    p.querySelector('#sWeather').addEventListener('change', e => { save.settings.weather = e.target.value; persist(); });
    p.querySelector('#sTod').addEventListener('change', e => { save.settings.tod = e.target.value; persist(); applyTimeOfDay(); });
    p.querySelector('#sQuality').addEventListener('change', e => { save.settings.quality = e.target.value; persist(); applyQuality(); });
    bind(p, '#sHow', () => showHowto(() => showSettings(onDone)));
    bind(p, '#sTipsReset', el => { save.tips = {}; save.settings.tips = true; persist(); el.textContent = 'Tips reset'; });
    bind(p, '#sReset', el => {
      if (el.dataset.arm) { try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem('skyline-forge/v2'); } catch (e) { /* ignore */ } location.reload(); }
      else { el.dataset.arm = 1; el.textContent = 'Tap again: this erases your city'; }
    });
  }, onDone);
}
function showHowto(onDone) {
  openModal(`${head('How to play')}
    <ul class="howto">
      <li><b>Tap</b><span>Drop the floor. It falls straight down from where it hangs.</span></li>
      <li><b>Perfect</b><span>Land within a hair of centre for bonus points and a combo. Perfects calm a swaying tower.</span></li>
      <li><b>Hold</b><span>Level ${FEATURES.hold}: the crane swings faster and your multiplier climbs to ×4. Let go to drop. At 3 seconds it drops itself.</span></li>
      <li><b>Hold + swipe ↓</b><span>Level ${FEATURES.power}: Power Drop, ×1.25 to ×2.5. Heavy and risky off centre, but a centred one settles the tower.</span></li>
      <li><b>Hold + swipe ↑</b><span>Level ${FEATURES.recall}: recall the floor for another swing. Costs one combo step.</span></li>
      <li><b>Keyboard</b><span>Space to drop (hold to charge), ↓ for Power Drop, ↑ to recall, Esc to pause.</span></li>
    </ul>
    <h3>Your city</h3>
    <p class="lede">Every tower you top out moves people in. Homes need jobs and shops nearby, offices need workers. Watch the <b>R C O</b> demand bars, keep people happy with parks and transit, and collect income when you come back. Population raises your city level and unlocks new blueprints, districts and moves.</p>
    <button class="btn primary" type="button" data-close>Got it</button>`, null, onDone);
}
/* ---------------- Map overlays ---------------- */
function setOverlayUI() {
  const O = OVERLAYS[save.overlay];
  $('ovKey').hidden = !O; $('btnMap').classList.toggle('on', !!O);
  if (O) {
    setText('ovName', O.name); setText('ovLo', O.lo); setText('ovHi', O.hi);
    const r = $('ovRamp').style; r.setProperty('--a', O.cols[0]); r.setProperty('--b', O.cols[1]); r.setProperty('--c', O.cols[2]);
  }
  refreshOverlay();
}
function cycleOverlay() {
  save.overlay = OVERLAY_ORDER[(OVERLAY_ORDER.indexOf(save.overlay) + 1) % OVERLAY_ORDER.length]; persist();
  setOverlayUI();
}

/* ---------------- Results ---------------- */
function showResults(r, sum) {
  const bp = r.bp ? BLUEPRINTS[r.bp] : null;
  let eyebrow, title, capLabel, stars = 0, primary, secondary, note = '';
  const rewards = [];
  const rows = [];
  const q = Math.round(r.quality * 100);
  if (r.kind === 'city') {
    eyebrow = `${bp.name} · ${lotTitle(LOT_BY_ID[r.site.id])}`;
    title = r.done ? 'Topped out!' : sum.phase ? `${sum.phase} complete` : 'Construction stopped';
    stars = sum.stars;
    const roles = Object.keys(sum.caps).filter(k => sum.caps[k] > 0);
    capLabel = roles.length === 1 ? ROLE_NAMES[roles[0]] : 'capacity';
    rewards.push(`<span>${ICON.coin}+${fmt(sum.coins)}</span>`);
    if (sum.prestige) rewards.push(`<span>${ICON.prestige}+${fmt(sum.prestige)}</span>`);
    if (sum.materials) rewards.push(`<span>${ICON.mat}+${fmt(sum.materials)}</span>`);
    note = sum.phase && !r.done ? `Phase complete. The next phase, ${nextPhase(bp, r.xs.length)[1]}, continues for free.` : sum.kept ? `Your earlier ${BLUEPRINTS[sum.prev.bp].name} was better, so it stays.` : !r.xs.length ? 'Nothing was built on this lot.' : r.done ? (sum.firstTop ? `First ${bp.name}! Residents are moving in.` : 'Residents are moving in.') : 'The unfinished tower still counts. Tap it in the city to continue.';
    primary = ['Back to city', () => leaveSession()];
    const canCont = !r.done && sum.saved;
    secondary = !canCont ? ['Build another', () => leaveSession(true)] : ['Continue now', () => { const lot = LOT_BY_ID[r.site.id]; const c = canBuild(r.bp, lot, { cont: true }); if (c.ok) startCityBuild(lot, r.bp, true); else { Sound.deny(); toast(c.reason); } }];
  } else if (r.kind === 'race') {
    eyebrow = 'Sky Race'; title = sum.record ? 'New record!' : `${r.floors} floors`;
    capLabel = 'points';
    rewards.push(`<span>${ICON.coin}+${fmt(sum.coins)}</span>`);
    note = sum.record ? 'Your Record Tower on the pier has been rebuilt to match.' : `Record: ${sum.best} floors.`;
    primary = ['Race again', () => startRace()]; secondary = ['City', () => leaveSession()];
  } else if (r.kind === 'weekly') {
    const cfg = weeklyConfig(r.weekly);
    eyebrow = `Weekly Challenge · ${cfg.name}`; title = sum.newTiers.length ? `${sum.newTiers[sum.newTiers.length - 1]} tier!` : r.done ? 'Topped out' : 'Not this time';
    stars = sum.tier; capLabel = 'points';
    if (sum.coins) rewards.push(`<span>${ICON.coin}+${fmt(sum.coins)}</span>`);
    if (sum.prestige) rewards.push(`<span>${ICON.prestige}+${fmt(sum.prestige)}</span>`);
    note = sum.stale ? 'A new week began during this run, so it was not scored. This week has a new tower.' : sum.tier < 3 ? `Next tier at ${fmt(cfg.tiers[sum.tier])} points. Best this week: ${fmt(sum.best)}.` : `Gold this week. Best: ${fmt(sum.best)}.`;
    primary = ['Try again', () => startWeekly()]; secondary = ['City', () => leaveSession()];
  } else if (r.kind === 'stage') {
    const P = PROJECTS[r.project || 'stadium'], st = P.stages[r.stage];
    eyebrow = `${P.name} · stage ${r.stage + 1} of ${P.stages.length}`; title = r.done ? `${st.name} complete` : 'Stage not finished';
    stars = sum.stars; capLabel = 'points';
    rewards.push(`<span>${ICON.coin}+${fmt(sum.coins)}</span>`);
    if (sum.prestige) rewards.push(`<span>${ICON.prestige}+${fmt(sum.prestige)}</span>`);
    note = r.done ? (projDone(P) ? `${P.name} is finished.` : `Next: ${P.stages[r.stage + 1].name} (level ${P.stages[r.stage + 1].level}).`) : 'The stage is still paid for. Try again for free.';
    primary = ['Back to city', () => leaveSession()];
    secondary = r.done ? ['See it in the city', () => leaveSession()] : ['Try again', () => startStage(P)];
  } else {
    const cfg = dailyConfig(r.daily);
    eyebrow = `Daily Challenge · ${cfg.name}`; title = r.done ? 'Challenge cleared' : 'Not this time';
    stars = sum.stars; capLabel = 'points';
    if (sum.coins) rewards.push(`<span>${ICON.coin}+${fmt(sum.coins)}</span>`);
    if (sum.prestige) rewards.push(`<span>${ICON.prestige}+${fmt(sum.prestige)}</span>`);
    if (sum.first) rewards.push(`<span>${ICON.flame}${sum.streak}-day streak</span>`);
    note = sum.newBest ? `New best today: ${fmt(sum.best)}.` : `Today's best: ${fmt(sum.best)}.`;
    primary = ['Try again', () => startDaily()]; secondary = ['City', () => leaveSession()];
  }
  rows.push(['Construction quality', `${q}%`], ['Structural stability', `${Math.round((1 - r.peakSway) * 100)}%`], ['Perfect floors', r.perfects], ['Longest combo', r.maxCombo ? `×${r.maxCombo}` : '–']);
  if (r.collapses) rows.push(['Collapses', `${r.collapses} (${plural(r.floorsLost, 'floor')} lost)`]);
  if (r.powerPerfects) rows.push(['Power Perfects', r.powerPerfects]);
  if (r.strongest > 1.05) rows.push(['Strongest impact', `${r.strongest.toFixed(1)}×`]);
  if (r.bestRisk > 1.01) rows.push(['Highest risk', `×${r.bestRisk.toFixed(1)}`]);
  if (bp && bp.special && r.specialPerfects) rows.push([`${bp.special.name} bonuses`, `+${Math.round(r.specialPerfects * FORGE.specialBonus * 100)}%`]);
  if (sum.bonus > 1.001 && r.kind === 'city') rows.push(['Capacity bonus', `+${Math.round((sum.bonus - 1) * 100)}%`]);
  if (sum.wxBonus) rows.push([`${WEATHER[r.mods.weather].name} bonus`, `+${Math.round(sum.wxBonus * 100)}% coins`]);
  if (sum.eventCoins) rows.push([`${eventNow() ? eventNow().name : 'Event'} bonus`, `+${fmt(sum.eventCoins)} coins`]);
  $('resEyebrow').textContent = eyebrow; $('resTitle').textContent = title;
  $('resHeight').textContent = r.target ? `${r.floors}/${r.target}` : String(r.floors);
  $('resHeightSub').textContent = `floors · ${Math.round(r.floors * H * S)} m`;
  $('resCap').textContent = fmt(r.kind === 'city' ? (sum.kept ? r.pts : capTotal(sum.caps)) : r.pts);
  $('resCapSub').textContent = r.kind === 'city' && sum.cont ? `${capLabel} in total` : capLabel;
  $('resRewards').innerHTML = rewards.join('');
  const dl = $('resStats'); dl.innerHTML = '';
  for (const [k, v] of rows) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = String(v); dl.append(dt, dd); }
  $('resChips').innerHTML = r.recoveries.map(n => `<span>${esc(n)}</span>`).join('');
  $('resChips').hidden = !r.recoveries.length;
  $('resNote').textContent = note;
  $('resStars').hidden = r.kind === 'race';
  const st = [...$('resStars').children];
  st.forEach(i => i.classList.remove('on'));
  st.forEach((el, i) => { if (i < stars) setTimeout(() => { el.classList.add('on'); Sound.star(i); vib(15); }, 450 + i * 380); });
  $('resPrimary').textContent = primary[0]; $('resPrimary').onclick = () => { Sound.click(); primary[1](); };
  $('resSecondary').textContent = secondary[0]; $('resSecondary').onclick = () => { Sound.click(); secondary[1](); };
  show('result');
}
function renderTitle() {
  const has = buildingsList().length, lp = levelProgress();
  $('titleLede').innerHTML = has
    ? `Welcome back, <b>${esc(save.profile.name)}</b>. ${esc(regionNow().name)} is a ${rankFor(save.level).toLowerCase()} of <b>${fmt(population())}</b>.`
    : 'Drop floors from the swinging crane, stack them straight, and build a whole city tower by tower.';
  $('tLvl').textContent = String(lp.l);
  $('tLvlNext').textContent = lp.next == null ? 'Top level' : `Level ${lp.l + 1} at ${fmtK(lp.next)}`;
  $('tLvlBar').style.setProperty('--p', (lp.frac * 100).toFixed(1) + '%');
  $('tCoins').textContent = fmtK(save.coins); $('tGems').textContent = fmtK(save.prestige);
  $('tBadgeM').hidden = !(contractsReady() || loginReady());
  $('tBadgeE').hidden = !(dailyOn() && !dailyCleared());
  const bits = [];
  if (save.race.best) bits.push(`Sky Race record ${save.race.best} floors`);
  if (dailyOn()) bits.push(dailyCleared() ? `Daily cleared · ${dailyStreak()}-day streak` : dailyStreak() ? `Daily ready · keep your ${dailyStreak()}-day streak` : 'Daily Challenge ready');
  $('bestLine').textContent = bits.join(' · ');
}
