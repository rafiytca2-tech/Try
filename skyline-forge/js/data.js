'use strict';
/* ==================================================================== *
 * Every tuning table in one place. DESIGN.md explains the reasoning.   *
 * ==================================================================== */

/* ---- CLASSIC BASE: the retro Skyline Stack engine, unchanged. Units are
   classic screen pixels (y down) and seconds. ---- */
const CFG = {
  blockW: 40,
  blockH: 46,
  towerTopRatio: 0.58,   // the tower top always sits this far down the screen
  gapRatio: 0.14,        // hanging block bottom -> tower top
  minGap: 60,
  ropeRatio: 0.48,       // rope length; the crane stays above the top edge during play
  dropTime: 0.36,        // seconds to fall the gap (sets gravity per screen size)
  releaseMomentum: 0,    // 0 = the block drops straight down from where you let go
  swingReach: { start: 30, perFloor: 0.6, max: 62 },    // px either side of centre
  swingSpeed: { start: 2.3, perFloor: 0.03, max: 3.8 },  // phase speed, rad/s
  hookLowerTime: 0.5,
  nextDelay: 0.2,
  perfectTol: 5,         // px from dead centre that still counts as perfect
  slabHalf: 52,          // half-width of the concrete slab the first floor must land on
  sway: {
    period: 2.8,         // seconds per full swing of the building
    gain: 0.7,           // top-of-tower sway added per px of misalignment
    perfectKeep: 0.45,   // a perfect drop keeps this share of the sway
    max: 30,             // px at the top of the tower
    maxTilt: 0.06,       // radians; short towers can only lean this far
  },
  residents: { base: 6, accuracy: 14, perfect: 25 },
  comboTime: 4.2,
  comboBonus: 8,
  lives: 3,
  cameraRate: 7,
  intro: { hold: 0.55, pan: 1.35, craneAt: 0.11 },   // show the crane, then slide down to the rope
};
const W = CFG.blockW, H = CFG.blockH, ROOF_H = 10;
const HANG = { foundation: 24, floor: 15, special: 15, roof: 15 };   // rope end -> block top
const extraTop = kind => (kind === 'roof' ? ROOF_H : 0);
const S = 0.15, DEPTH = 6;       // 3D: one classic pixel is 0.15 m, so a block is 6 x 6.9 x 6 m

/* ---- FORGE LAYER: the GDD's construction features, on top of the base. ---- */
const FORGE = {
  hold: {
    band: 0.5, cap: 3.0, warn: 2.2,
    speed: [1, 1.15, 1.4, 1.8, 2.5, 3.5],
    mult:  [1, 1.2, 1.5, 2.0, 2.8, 4.0],
    label: ['Safe', 'Low risk', 'Committed', 'High risk', 'Very high risk', 'Extreme'],
  },
  // [min swipe speed px/ms, multiplier, name]; boost adds downward speed in units of a normal landing
  power: { tiers: [[0, 1.25, 'Light'], [0.6, 1.5, 'Strong'], [1.2, 2.0, 'Fast'], [2.2, 2.5, 'Maximum']], swipe: 34, boost: 1.6, shove: 0.12 },
  recallSwipe: 44,
  //          name        max |dx|/W  quality
  ratings: [['Perfect',   0,    1.0],
            ['Excellent', 0.15, 0.92],
            ['Great',     0.25, 0.82],
            ['Good',      0.35, 0.7],
            ['Rough',     0.45, 0.55],
            ['Dangerous', 0.5,  0.4]],
  stability: [0.25, 0.5, 0.75],      // tower-top sway as a share of CFG.sway.max
  settleKeep: 0.6,                   // a centred heavy Power Drop keeps this share of the sway
  specialBonus: 0.03,                // capacity per special floor landed Perfect
  //          name                  bonus pts  prestige
  recovery: [['Close Call',            50,  1],
             ['Structural Save',      150,  2],
             ['Master Recovery',      300,  4],
             ['Impossible Recovery',  600,  8],
             ['Legendary Recovery',  1200, 15]],
};
const holdBand = t => Math.min(FORGE.hold.speed.length - 1, Math.floor(t / FORGE.hold.band));

/* ---- Block styles: the classic four keep the City Bloxx colours and windows. ---- */
const STYLES = {
  blue:     { body: '#3b7fe0', light: '#86b6f5', dark: '#2356a8', outline: '#0c2250', win: 'twin' },
  red:      { body: '#dc4a3a', light: '#f39185', dark: '#9c2b1e', outline: '#3f0e08', win: 'twin' },
  green:    { body: '#3cbf3c', light: '#86e486', dark: '#23862a', outline: '#0d3a0d', win: 'twin' },
  gold:     { body: '#ecbd2f', light: '#f8e07e', dark: '#a67d12', outline: '#402f05', win: 'twin' },
  cream:    { body: '#e6cf9f', light: '#f7ecd2', dark: '#b3935e', outline: '#4a3a1e', win: 'balcony' },
  violet:   { body: '#8e5bd6', light: '#c3a3f0', dark: '#5f3a9c', outline: '#24123f', win: 'twin' },
  teal:     { body: '#27a7a4', light: '#7fd9d6', dark: '#177472', outline: '#07302f', win: 'ribbon' },
  silver:   { body: '#c8d2dc', light: '#eef3f8', dark: '#8d99a6', outline: '#2b333c', win: 'ribbon' },
  obsidian: { body: '#343946', light: '#6a7386', dark: '#1d2029', outline: '#07080b', win: 'ribbon' },
  brick:    { body: '#a4553a', light: '#cf8a6a', dark: '#6e3322', outline: '#2a120a', win: 'ribbon' },
  mint:     { body: '#5fc39a', light: '#a6e8cb', dark: '#358a67', outline: '#0e3526', win: 'twin' },
  white:    { body: '#eef1f4', light: '#ffffff', dark: '#b8c1ca', outline: '#46505a', win: 'ribbon' },
  navy:     { body: '#2f4a7a', light: '#6f8fc4', dark: '#1d2f52', outline: '#0a1428', win: 'twin' },
  orange:   { body: '#ef8a3c', light: '#f8bd8a', dark: '#b35a1c', outline: '#3d1a05', win: 'ribbon' },
  sand:     { body: '#d8c29a', light: '#f2e6cc', dark: '#a68f63', outline: '#473a22', win: 'balcony' },
  sky:      { body: '#4fb4d8', light: '#a6dcf0', dark: '#2a7a99', outline: '#0a2a38', win: 'ribbon' },
};
const STYLE_KEYS = Object.keys(STYLES);

/* ---- Blueprints (GDD §7). role: res | com | off | hot | landmark | mixed ---- */
const BLUEPRINTS = {
  flats:     { name: 'Starter Flats',     role: 'res', floors: 8,   level: 1,  cost: 100,   mult: 1.0, style: 'blue',
               blurb: 'Small homes to get the city started.' },
  market:    { name: 'Corner Market',     role: 'com', floors: 10,  level: 2,  cost: 250,   mult: 1.5, style: 'red', needs: ['res'],
               blurb: 'Shops and jobs. Residents nearby want somewhere to spend.' },
  residence: { name: 'Skyline Residence', role: 'res', floors: 20,  level: 4,  cost: 700,   mult: 1.3, style: 'cream', special: { every: 10, name: 'Sky Garden' },
               blurb: 'The flagship residential tower. Land its Sky Garden Perfect.' },
  office:    { name: 'Office Tower',      role: 'off', floors: 16,  level: 4,  cost: 900,   mult: 2.0, style: 'green', needs: ['res', 'com'],
               blurb: 'Jobs for your residents. Needs homes and shops nearby.' },
  hotel:     { name: 'Grand Hotel',       role: 'hot', floors: 22,  level: 8,  cost: 2200,  mult: 2.4, style: 'violet', needs: ['parkOrWater'], mat: 20,
               blurb: 'Guests pay well. Needs a park nearby or a waterfront lot.' },
  luxury:    { name: 'Luxury Tower',      role: 'res', floors: 30,  level: 10, cost: 3500,  mult: 3.0, style: 'gold', needs: ['res', 'com', 'off'], rich: true, mat: 40,
               blurb: 'High-income residents. Needs homes, shops and offices nearby.' },
  hq:        { name: 'Corporate HQ',      role: 'off', floors: 40,  level: 13, cost: 7000,  mult: 2.6, style: 'teal', needs: ['com', 'off'], special: { every: 10, name: 'Sky Lobby' }, mat: 80,
               blurb: 'A headquarters tower with a Sky Lobby every ten floors.' },
  spire:     { name: 'Skyline Spire',     role: 'landmark', floors: 60, level: 16, cost: 15000, mult: 4.0, style: 'silver', unique: true, special: { every: 15, name: 'Observation Deck' }, mat: 150,
               blurb: 'A landmark. Raises land value and draws visitors across the city.' },
  mega:      { name: 'Forge Megatower',   role: 'mixed', floors: 100, level: 20, cost: 40000, mult: 5.0, style: 'obsidian', unique: true, special: { every: 10, name: 'Sky Garden' }, mat: 400,
               sections: [[10, 'red', 'com'], [50, 'green', 'off'], [90, 'blue', 'res'], [100, 'gold', 'res']],
               blurb: 'A vertical city: shops, offices and homes, with a gold crown.' },
  works:     { name: 'Harbor Works',      role: 'ind', floors: 8,   level: 3,  cost: 400,   mult: 1.4, style: 'brick', pollution: 60,
               blurb: 'Factory jobs and building materials. It pollutes, so keep it away from homes.' },
  school:    { name: 'Harbor School',     role: 'edu', floors: 6,   level: 4,  cost: 500,   mult: 1.2, style: 'mint', radius: 90, needs: ['res'],
               blurb: 'Education within 90 m: happier families and a skilled workforce for offices.' },
  clinic:    { name: 'Neighbourhood Clinic', role: 'health', floors: 6, level: 5, cost: 650, mult: 1.2, style: 'white', radius: 90, needs: ['res'],
               blurb: 'Healthcare within 90 m: residents stay, and land value rises.' },
  station:   { name: 'Fire & Police',     role: 'safety', floors: 5, level: 6, cost: 700,   mult: 1.2, style: 'navy', radius: 100,
               blurb: 'Safety within 100 m: land value and happiness go up.' },
  arena:     { name: 'Harbor Arena',      role: 'ent', floors: 12,  level: 9,  cost: 3000,  mult: 2.2, style: 'orange', needs: ['res', 'com'], mat: 30,
               blurb: 'Concerts and games: tourists, jobs and a happier city.' },
  university: { name: 'University',       role: 'edu', floors: 18,  level: 11, cost: 6000,  mult: 2.0, style: 'sand', radius: 170, mat: 40,
               blurb: 'Education across a wide area, and Tech Campus unlocks nearby.' },
  hospital:  { name: 'General Hospital',  role: 'health', floors: 20, level: 12, cost: 6500, mult: 2.0, style: 'white', radius: 170, mat: 40,
               blurb: 'Healthcare across a wide area.' },
  tech:      { name: 'Tech Campus',       role: 'off', floors: 24,  level: 14, cost: 9000,  mult: 2.9, style: 'sky', needs: ['edu'], mat: 60, rich: true,
               blurb: 'High-paying jobs. Needs a school or university nearby.' },
};
const BP_KEYS = Object.keys(BLUEPRINTS);
function styleAt(bp, i) {
  if (!bp.sections) return bp.style;
  for (const [end, style] of bp.sections) if (i < end) return style;
  return bp.style;
}
function roleAt(bp, i) {
  if (!bp.sections) return bp.role;
  for (const [end, , role] of bp.sections) if (i < end) return role;
  return 'res';
}
// The facade a floor wears: a mastery variant (or a custom blueprint) replaces the single style;
// sectioned towers keep their sections. Roofs follow the blueprint's own roof.
const floorStyleOf = (bp, i, style) => (bp && bp.sections ? styleAt(bp, i) : style || (bp ? bp.style : 'green'));
const roofStyleOf = (bp, style) => (bp && (bp.roof || (bp.sections ? bp.style : null))) || (bp && bp.style) || style || 'green';
// Mastery (GDD §7): building a blueprint again unlocks facade variants and a small capacity bonus.
const STYLE_VARIANTS = {
  flats: ['blue', 'sky', 'mint'], market: ['red', 'orange', 'brick'], residence: ['cream', 'sand', 'white'], office: ['green', 'teal', 'navy'],
  hotel: ['violet', 'navy', 'obsidian'], luxury: ['gold', 'white', 'obsidian'], hq: ['teal', 'silver', 'navy'], spire: ['silver', 'white', 'sky'],
  works: ['brick', 'sand', 'orange'], school: ['mint', 'sky', 'cream'], clinic: ['white', 'mint', 'sky'], station: ['navy', 'red', 'obsidian'],
  arena: ['orange', 'violet', 'red'], university: ['sand', 'brick', 'cream'], hospital: ['white', 'silver', 'mint'], tech: ['sky', 'obsidian', 'violet'],
};
const MASTERY_TIERS = [0, 2, 5];           // topped out this many times to unlock each facade
const masteryTier = key => { const m = save.mastery[key]; const n = m ? m.built : 0; return MASTERY_TIERS.filter(t => n >= t).length - 1; };
const isSpecial = (bp, i) => !!(bp && bp.special && i > 0 && i < bp.floors - 1 && i % bp.special.every === 0);
const ROLE_NAMES = { res: 'residents', com: 'shop jobs', off: 'office jobs', hot: 'guests', landmark: 'visitors', mixed: 'residents & jobs', ind: 'factory jobs', edu: 'students & staff', health: 'patients & staff', safety: 'officers', ent: 'visitors' };
const ROLE_LABEL = { res: 'Residential', com: 'Commercial', off: 'Office', hot: 'Hospitality', landmark: 'Landmark', mixed: 'Mixed use', ind: 'Industrial', edu: 'Education', health: 'Healthcare', safety: 'Safety', ent: 'Entertainment' };
const SERVICE_ROLES = ['health', 'edu', 'safety'];
const SERVICE_NAMES = { health: 'Healthcare', edu: 'Education', safety: 'Safety' };

/* ---- Blueprint Studio (GDD §7): late-game custom towers. The game derives cost, materials and
   capacity from the design, and the player still has to build every floor. ---- */
const STUDIO = {
  max: 6,
  floors: [12, 100],
  roles: {
    res:   { name: 'Homes',     mult: 1.25, needs: [] },
    com:   { name: 'Shops',     mult: 1.5,  needs: ['res'] },
    off:   { name: 'Offices',   mult: 2.0,  needs: ['res', 'com'] },
    hot:   { name: 'Hotel',     mult: 2.3,  needs: ['parkOrWater'] },
    mixed: { name: 'Mixed use', mult: 2.4,  needs: ['com', 'off'] },
  },
  specials: { none: '', garden: 'Sky Garden', lobby: 'Sky Lobby', pool: 'Sky Pool', deck: 'Observation Deck' },
  roofs: { blue: 'Water tank', red: 'Billboard', green: 'Glass crown', silver: 'Needle spire', obsidian: 'Gold crown', white: 'Helipad', sand: 'Clock cupola', sky: 'Glass pavilion', orange: 'Floodlit dome', navy: 'Radio mast', mint: 'Sports court', brick: 'Chimney' },
};
function deriveBlueprint(d) {
  const R = STUDIO.roles[d.role] || STUDIO.roles.res, F = clamp(Math.round(d.floors), STUDIO.floors[0], STUDIO.floors[1]);
  const bp = {
    name: d.name || 'My Tower', role: d.role, floors: F, level: FEATURES.studio, style: d.style, roof: d.roof, custom: true,
    cost: Math.round(Math.pow(F, 1.6) * 9.6 * R.mult / 10) * 10, mat: Math.round(F * (F > 40 ? 2.2 : 1.5)),
    mult: Math.round(R.mult * (1 + F / 200) * 100) / 100, needs: R.needs.slice(),
    blurb: `Your design: ${F} floors of ${R.name.toLowerCase()}${d.special && d.special !== 'none' ? `, a ${STUDIO.specials[d.special]} every ${d.every} floors` : ''}.`,
  };
  if (d.special && d.special !== 'none') bp.special = { every: d.every || 10, name: STUDIO.specials[d.special] };
  if (d.role === 'mixed') bp.sections = [[Math.max(2, Math.round(F * 0.2)), d.style, 'com'], [Math.round(F * 0.65), d.style, 'off'], [F, d.style, 'res']];
  return bp;
}

/* ---- Placeables: no crane, placed instantly on a lot. ---- */
const PLACEABLES = {
  park:  { name: 'Park',          level: 3,  cost: 150,  radius: 36,  lv: 0.15, happy: 0.05, blurb: 'Trees and lawns. Nearby land value +15%, happier residents.' },
  plaza: { name: 'Plaza',         level: 6,  cost: 600,  radius: 36,  lv: 0.10, happy: 0.05, tourism: 0.1, blurb: 'A fountain square. Land value +10% nearby and more tourists.' },
  bus:   { name: 'Bus Stop',      level: 5,  cost: 900,  radius: 60,  lv: 0.10, transit: 1, cap: 250, blurb: 'Transit within 60 m: land value +10%, eases traffic.' },
  tram:  { name: 'Tram Stop',     level: 8,  cost: 1800, radius: 80,  lv: 0.15, transit: 1, cap: 450, blurb: 'Transit within 80 m: land value +15%, eases traffic.' },
  ferry: { name: 'Ferry Terminal', level: 9, cost: 2500, radius: 90,  lv: 0.15, transit: 1, cap: 400, tourism: 0.1, waterfront: true, blurb: 'Waterfront lots only. Transit and tourists from across the harbour.' },
  metro: { name: 'Metro Station', level: 12, cost: 5000, radius: 110, lv: 0.25, transit: 2, cap: 900, blurb: 'Transit within 110 m: land value +25%, big traffic relief.' },
  rail:  { name: 'Rail Station',  level: 15, cost: 9000, radius: 140, lv: 0.25, transit: 2, cap: 1500, tourism: 0.1, blurb: 'Intercity rail: land value +25% within 140 m, tourists, huge traffic relief.' },
  power: { name: 'Power Plant',   level: 4,  cost: 800,  power: 150, pollution: 70, blurb: '+150 power. Pollutes the lots around it.' },
  tower: { name: 'Water Tower',   level: 4,  cost: 600,  water: 160, blurb: '+160 water.' },
  solar: { name: 'Solar Farm',    level: 9,  cost: 2600, power: 120, blurb: '+120 clean power.' },
  wind:  { name: 'Wind Turbines', level: 12, cost: 4200, power: 240, blurb: '+240 clean power.' },
  waterworks: { name: 'Water Works', level: 10, cost: 3200, water: 420, blurb: '+420 water.' },
};
// Utilities (GDD §6): every floor uses power and water; the old grid supplies the first few towers.
const UTIL = { basePower: 80, baseWater: 80, perFloor: 1, heavyPerFloor: 2 };

/* ---- Districts: city blocks along the harbour, bought as the city grows. ---- */
const DISTRICTS = [
  { id: 'harbor',    name: 'Harbor Row',         col: 0,  level: 1,  cost: 0,     lv: 1.00, trait: 'Where it all starts. Front-row lots face the water.' },
  { id: 'market',    name: 'Market Street',      col: -1, level: 3,  cost: 1500,  lv: 1.00, bonus: { com: 0.15 }, trait: 'Commercial capacity +15%.' },
  { id: 'oldtown',   name: 'Old Town',           col: 1,  level: 5,  cost: 4000,  lv: 1.10, maxFloors: 16, tourism: 0.3, trait: 'Historic: towers up to 16 floors, tourism +30%.' },
  { id: 'downtown',  name: 'Downtown',           col: -2, level: 7,  cost: 9000,  lv: 1.30, bonus: { off: 0.2 }, trait: 'Office capacity +20%.' },
  { id: 'watereast', name: 'Waterfront East',    col: 2,  level: 9,  cost: 15000, lv: 1.25, bonus: { hot: 0.2, luxury: 0.2 }, trait: 'Hotels and luxury towers +20%.' },
  { id: 'tech',      name: 'Tech Park',          col: -3, level: 11, cost: 25000, lv: 1.15, bonus: { off: 0.15 }, trait: 'Office capacity +15%.' },
  { id: 'financial', name: 'Financial District', col: 3,  level: 13, cost: 40000, lv: 1.40, bonus: { hq: 0.25 }, trait: 'Corporate HQ capacity +25%.' },
  { id: 'uptown',    name: 'Uptown',             col: 4,  level: 15, cost: 60000, lv: 1.35, bonus: { res: 0.2 }, trait: 'Residential capacity +20%.' },
  { id: 'dockyards', name: 'Dockyards',          col: 5,  level: 4,  cost: 2500,  lv: 0.90, bonus: { ind: 0.3 }, docks: true, trait: 'Industrial harbour: factories +30%, and their pollution stays in the docks.' },
  { id: 'unihill',   name: 'University Hill',    col: -4, level: 12, cost: 20000, lv: 1.20, bonus: { edu: 0.3 }, trait: 'Schools and universities +30%, covering half again as far.' },
];
const DISTRICT_BY_ID = Object.fromEntries(DISTRICTS.map(d => [d.id, d]));

/* ---- Renovations (GDD §5): one of each per topped-out building. cost = share of the permit. ---- */
const RENOVATIONS = [
  { id: 'facade',    name: 'Facade refresh',  cost: 0.25, mat: 0,  desc: 'Land value +0.1 on this lot.' },
  { id: 'amenities', name: 'Amenities',       cost: 0.35, mat: 0,  desc: 'Occupancy +8%.' },
  { id: 'garden',    name: 'Rooftop garden',  cost: 0.2,  mat: 5,  desc: 'A green roof: happiness up, occupancy +3%.' },
  { id: 'solar',     name: 'Solar roof',      cost: 0.3,  mat: 5,  desc: 'Makes its own power: +1 power per floor.' },
  { id: 'lights',    name: 'Feature lighting', cost: 0.15, mat: 0, desc: 'Lit up at night: tourism up.' },
];
const RANKS = [[1, 'Hamlet'], [3, 'Village'], [5, 'Town'], [8, 'City'], [12, 'Big City'], [16, 'Metropolis'], [21, 'Megacity'], [26, 'Global City']];
const rankFor = level => { let r = RANKS[0][1]; for (const [l, n] of RANKS) if (level >= l) r = n; return r; };

/* ---- Regions (GDD §11): more cities in other climates. Coins, materials, skills, blueprints,
   trophies and designs are shared; each city has its own lots, level and income. Every city you
   own adds regional trade income to all of them. ---- */
const REGIONS = [
  { id: 'harbor', name: 'Harbor City',    climate: 'Temperate coast', unlock: 1,  cost: 0,
    trait: 'Where your story starts. Four seasons, a busy harbour.', mods: {},
    look: { grass: ['#6c9a4c', '#5f8c42', '#7eab58'], paving: '#dedad2', street: '#4b4f55', leaf: '#4f7d3f', city: '#ffffff', roof: '#8d9096', water: null, horizon: null, trees: 'round' } },
  { id: 'tropic', name: 'Coral Bay',      climate: 'Tropical island', unlock: 12, cost: 40000,
    trait: 'Tourism +25% and hotels +25%. Warm seas, sudden tropical storms.', mods: { tourism: 0.25, cap: { hot: 0.25 } },
    weather: { clear: 38, cloudy: 12, wind: 10, rain: 18, fog: 2, storm: 16, snow: 0 },
    look: { grass: ['#58b04a', '#4a9c3e', '#6cc45a'], paving: '#ece2c8', street: '#55585c', leaf: '#3aa04a', city: '#fff4ea', roof: '#c9b8a0', water: '#138a9c', horizon: '#ffe0b8', trees: 'palm' } },
  { id: 'desert', name: 'Mirage Springs', climate: 'Desert oasis',    unlock: 16, cost: 100000,
    trait: 'Solar power ×1.8, but water supplies give only 60%. Clear, hot skies.', mods: { solar: 1.8, water: 0.6, lv: 0.1 },
    weather: { clear: 62, cloudy: 6, wind: 22, rain: 2, fog: 0, storm: 4, snow: 0 },
    look: { grass: ['#b9a36a', '#a8925c', '#c9b47a'], paving: '#e6d2ae', street: '#6a5f52', leaf: '#7d8f4a', city: '#ffe6c8', roof: '#c9a878', water: '#2a8fa8', horizon: '#f6d7a6', trees: 'palm' } },
  { id: 'north',  name: 'Fjordheim',      climate: 'Northern fjord',  unlock: 20, cost: 220000,
    trait: 'Heating doubles power use, but wind turbines give ×1.6 and offices +15%. Snow most days.', mods: { heat: 2, wind: 1.6, cap: { off: 0.15 } },
    weather: { clear: 18, cloudy: 22, wind: 16, rain: 0, fog: 10, storm: 4, snow: 30 },
    look: { grass: ['#e8eef2', '#d6e0e6', '#f4f8fa'], paving: '#e9edf0', street: '#5c6168', leaf: '#2f5a3a', city: '#dfe8f4', roof: '#f2f5f8', water: '#0f3a52', horizon: '#dfe9f2', trees: 'pine' } },
];
const REGION_BY_ID = Object.fromEntries(REGIONS.map(r => [r.id, r]));
const TRADE_BONUS = 0.05;          // income for every other city you own

/* ---- City levels: population needed for each level (index 0 = level 1). ---- */
const LEVELS = [0, 40, 150, 350, 650, 1000, 1500, 2100, 2800, 3600, 4500, 5600, 6800, 8200, 9800,
  11600, 13600, 15800, 18200, 21000, 24000, 27500, 31500, 36000, 41000, 47000, 54000, 62000, 71000, 81000];
const MAX_LEVEL = LEVELS.length;
const FEATURES = { hold: 2, contracts: 3, power: 4, recall: 5, daily: 5, weekly: 6, stadium: 8, studio: 14 };
const FEATURE_NAMES = { hold: 'Hold Momentum', contracts: 'Contracts board', power: 'Power Drop', recall: 'Recall', daily: 'Daily Challenge', weekly: 'Weekly Challenge', stadium: 'Harbor Stadium project', studio: 'Blueprint Studio' };

/* ---- Economy ---- */
const ECON = {
  startCoins: 500,
  startMaterials: 50,
  materialsPerCap: 25,       // industrial capacity per material produced per hour at full occupancy
  materialCap: 150,          // storage, plus the same again per industrial building
  materialPrice: 12,         // coins per material bought outright
  matPerPerfect: 1,          // every Perfect floor in a city build saves one material
  renoLevel: 3,
  incomeCapHours: 8,
  occTauMin: 20,             // minutes for occupancy to ease most of the way to its target
  newOccShare: 0.8,          // a new building starts at this share of its target occupancy
  continueFee: 0.5,          // share of the permit to continue an unfinished tower
  demolishRefund: 0.2,
  levelReward: lvl => 100 * lvl,
  build: { perFloor: 5, perPerfect: 3, perPowerPerfect: 10, completion: 0.8, perStarFloor: 3 },
  race: { perFloor: 4, perPerfect: 3 },
  contractRefillMin: 15,
  contractReplace: 50,
  daily: { base: 150, perStreak: 50, streakCap: 7, prestige: 5, perStar: 20 },
  stars: [0.8, 0.92],        // quality for 2 and 3 stars (1 star = topped out)
  masteryBonus: 0.02,        // capacity per mastery tier
};

/* ---- Daily challenge modifiers (GDD §10 challenge modifiers) ---- */
const DAILY_MODS = [
  { id: 'wind',    name: 'Windy',         desc: 'The tower never fully stops swaying.', apply: m => { m.wind = 9; } },
  { id: 'rapid',   name: 'Rapid Crane',   desc: 'The crane swings 25% faster.', apply: m => { m.swing = 1.25; } },
  { id: 'heavy',   name: 'Heavy Modules', desc: 'Floors fall 35% harder.', apply: m => { m.gravity = 1.35; } },
  { id: 'oneshot', name: 'One Shot',      desc: 'One miss and it is over.', apply: m => { m.lives = 1; } },
  { id: 'purist',  name: 'Purist',        desc: 'Classic drops only: no hold, no Power Drop.', apply: m => { m.noHold = true; } },
  { id: 'norecall', name: 'No Recall',    desc: 'Every swing counts.', apply: m => { m.noRecall = true; } },
  { id: 'fog',     name: 'Fog',           desc: 'Thick fog over the harbour.', apply: m => { m.fog = true; } },
];

/* ---- Weather (GDD §12): changes every two hours, same for everyone. It sets the mood, and in city
   builds it adds a readable challenge that pays a bonus. You can always wait for it to change. ---- */
const WEATHER = {
  clear:  { name: 'Clear',        icon: '☀', w: 34, bonus: 0,    desc: 'Calm and clear.' },
  cloudy: { name: 'Cloudy',       icon: '☁', w: 20, bonus: 0,    desc: 'Grey skies, no effect on building.' },
  wind:   { name: 'Windy',        icon: '≋', w: 14, bonus: 0.15, desc: 'Towers never fully stop swaying. Build coins +15%.', mods: { wind: 5 } },
  rain:   { name: 'Rain',         icon: '☂', w: 14, bonus: 0.1,  desc: 'Wet steel lands a little harder. Build coins +10%.', mods: { gravity: 1.08 } },
  fog:    { name: 'Fog',          icon: '▒', w: 9,  bonus: 0.15, desc: 'Sea fog rolls in over the harbour. Build coins +15%.', mods: { fog: true } },
  storm:  { name: 'Storm',        icon: 'ϟ', w: 9,  bonus: 0.35, desc: 'Wind, rain and lightning. Build coins +35%.', mods: { wind: 8, gravity: 1.08 } },
  snow:   { name: 'Snow',         icon: '❄', w: 0,  bonus: 0.2,  desc: 'Snow on the steel: the crane swings a touch faster. Build coins +20%.', mods: { swing: 1.1 } },
};
const WEATHER_HOURS = 2;

/* ---- City events (GDD §10): one runs at a time, rotating every three hours. Opportunities, never punishments. ---- */
const EVENTS = [
  { id: 'boom',     name: 'Housing Boom',        icon: '⌂', desc: 'Homes built now move in fuller: residential capacity +20%.', cap: { res: 0.2 } },
  { id: 'expand',   name: 'Corporate Expansion', icon: '▤', desc: 'Office capacity +20% on new builds, and jobs pay ×1.3.', cap: { off: 0.2 }, inc: { jobs: 1.3 } },
  { id: 'festival', name: 'Tourism Festival',    icon: '✺', desc: 'Hotels, arenas and landmarks earn ×1.5.', inc: { guests: 1.5, visitors: 1.5 } },
  { id: 'market',   name: 'Market Week',         icon: '◈', desc: 'Shop capacity +20% on new builds, and the whole city spends ×1.15.', cap: { com: 0.2 }, inc: { all: 1.15 } },
  { id: 'final',    name: 'Championship Final',  icon: '⚑', desc: 'Visitors earn ×1.4, and every Perfect pays +5 coins.', inc: { visitors: 1.4 }, perfectCoins: 5 },
  { id: 'contest',  name: 'Construction Contest', icon: '⚒', desc: 'Every Perfect pays +8 coins and every Power Perfect +25.', perfectCoins: 8, powerCoins: 25 },
  { id: 'steel',    name: 'Steel Delivery',      icon: '▣', desc: 'Harbor Works output ×2, and materials cost half price.', matRate: 2, matPrice: 0.5 },
  { id: 'tech',     name: 'Tech Conference',     icon: '⌘', desc: 'School and university capacity +20% on new builds, and jobs pay ×1.2.', cap: { edu: 0.2 }, inc: { jobs: 1.2 } },
];
const EVENT_HOURS = 3, EVENT_LEVEL = 3;

/* ---- Contracts (GDD §10). make() returns the goal for a player's level. ---- */
const CONTRACTS = [
  { id: 'topout',   min: 1, w: 3, make: (r, c) => { const bp = pick(r, c.bps); return { type: 'topout', bp, target: 1, text: `Top out a ${BLUEPRINTS[bp].name}`, coins: Math.round(BLUEPRINTS[bp].cost * 0.6 + 120), prestige: 4 }; } },
  { id: 'quality',  min: 2, w: 2, make: r => { const q = pick(r, [0.8, 0.85, 0.9]); return { type: 'quality', q, target: 1, text: `Top out any building with ${Math.round(q * 100)}%+ quality`, coins: Math.round(250 + (q - 0.8) * 4000), prestige: 6 }; } },
  { id: 'perfects', min: 1, w: 3, make: (r, c) => { const n = pick(r, c.level < 4 ? [4, 6] : [6, 8, 10, 12]); return { type: 'perfects', n, target: 1, text: `Land ${n} Perfects in one build`, coins: 60 + n * 30, prestige: 3 }; } },
  { id: 'combo',    min: 1, w: 2, make: (r, c) => { const n = pick(r, c.level < 4 ? [3, 4] : [5, 6, 8]); return { type: 'combo', n, target: 1, text: `Reach a Perfect combo of ×${n}`, coins: 80 + n * 40, prestige: 4 }; } },
  { id: 'hold',     min: 2, w: 2, make: r => { const m = pick(r, [1.5, 2, 2.8]); return { type: 'hold', m, target: 1, text: `Land a Perfect while holding at ×${m}+`, coins: Math.round(120 + m * 90), prestige: 5 }; } },
  { id: 'power',    min: 4, w: 2, make: r => { const n = pick(r, [1, 2, 3]); return { type: 'power', target: n, text: `Land ${plural(n, 'Power Perfect')}`, coins: 150 * n + 100, prestige: 4 + n * 2 }; } },
  { id: 'recovery', min: 3, w: 1, make: r => { const k = pick(r, [0, 1]); return { type: 'recovery', k, target: 1, text: `Earn a ${FORGE.recovery[k][0]} (or better)`, coins: 200 + k * 200, prestige: 5 + k * 3 }; } },
  { id: 'race',     min: 1, w: 2, make: (r, c) => { const h = Math.max(10, Math.round((c.raceBest * 0.8 + 6) / 5) * 5); return { type: 'race', h, target: 1, text: `Reach ${h} floors in Sky Race`, coins: 40 + h * 8, prestige: 3 }; } },
  { id: 'floors',   min: 1, w: 2, make: r => { const n = pick(r, [20, 30, 50]); return { type: 'floors', target: n, text: `Place ${n} floors anywhere`, coins: n * 7, prestige: 3 }; } },
  { id: 'pop',      min: 2, w: 1, make: (r, c) => { const p = Math.max(100, Math.round(c.pop * 1.3 / 50) * 50); return { type: 'pop', p, target: 1, text: `Grow the city to ${fmt(p)} residents`, coins: Math.round(p * 0.4), prestige: 5 }; } },
  { id: 'parks',    min: 3, w: 1, make: r => { const n = pick(r, [1, 2]); return { type: 'parks', target: n, text: `Place ${plural(n, 'park')}`, coins: 180 * n, prestige: 3 }; } },
  { id: 'daily',    min: 5, w: 1, make: () => ({ type: 'daily', target: 1, text: "Clear today's Daily Challenge", coins: 300, prestige: 6 }) },
  { id: 'reno',     min: 4, w: 1, make: r => { const n = pick(r, [1, 2]); return { type: 'reno', target: n, text: `Renovate ${plural(n, 'building')}`, coins: 260 * n, prestige: 4 }; } },
  { id: 'weather',  min: 3, w: 1, make: () => ({ type: 'weather', target: 1, text: 'Top out a building in wind, rain, fog or a storm', coins: 420, prestige: 6 }) },
  { id: 'transit',  min: 5, w: 1, make: () => ({ type: 'transit', target: 1, text: 'Open a new transit stop', coins: 500, prestige: 4 }) },
];

/* ---- Achievements: each pays prestige once. ---- */
const ACHIEVEMENTS = [
  { id: 'perfect1',  name: 'Dead Centre',        desc: 'Land your first Perfect.', pr: 2 },
  { id: 'combo5',    name: 'In the Groove',      desc: 'Reach a Perfect combo of ×5.', pr: 4 },
  { id: 'combo10',   name: 'Metronome',          desc: 'Reach a Perfect combo of ×10.', pr: 10 },
  { id: 'combo20',   name: 'Unshakeable',        desc: 'Reach a Perfect combo of ×20.', pr: 25 },
  { id: 'hold4',     name: 'All In',             desc: 'Land a Perfect at the ×4.0 hold band.', pr: 10 },
  { id: 'power1',    name: 'Heavy Hand',         desc: 'Land a Power Perfect.', pr: 4 },
  { id: 'power3',    name: 'Pile Driver',        desc: 'Land 3 Power Perfects in one build.', pr: 10 },
  { id: 'risk8',     name: 'Daredevil',          desc: 'Land a Perfect at ×8 total risk.', pr: 15 },
  { id: 'save',      name: 'Steady Hands',       desc: 'Earn a Structural Save.', pr: 4 },
  { id: 'master',    name: 'Master Builder',     desc: 'Earn a Master Recovery.', pr: 8 },
  { id: 'legend',    name: 'Legend of the Crane', desc: 'Earn a Legendary Recovery.', pr: 30 },
  { id: 'topout1',   name: 'Topping Out',        desc: 'Top out your first building.', pr: 3 },
  { id: 'topout10',  name: 'Skyline Maker',      desc: 'Top out 10 buildings.', pr: 10 },
  { id: 'topout25',  name: 'Master Planner',     desc: 'Top out 25 buildings.', pr: 20 },
  { id: 'star3',     name: 'Flawless',           desc: 'Earn 3 stars on a building.', pr: 6 },
  { id: 'star3x10',  name: 'Craftsman',          desc: 'Earn 3 stars on 10 buildings.', pr: 20 },
  { id: 'race25',    name: 'Sky Racer',          desc: 'Reach 25 floors in Sky Race.', pr: 5 },
  { id: 'race50',    name: 'Cloud Scraper',      desc: 'Reach 50 floors in Sky Race.', pr: 12 },
  { id: 'race100',   name: 'Edge of Space',      desc: 'Reach 100 floors in Sky Race.', pr: 30 },
  { id: 'pop1k',     name: 'Town',               desc: 'Reach 1,000 residents.', pr: 5 },
  { id: 'pop10k',    name: 'City',               desc: 'Reach 10,000 residents.', pr: 15 },
  { id: 'pop50k',    name: 'Metropolis',         desc: 'Reach 50,000 residents.', pr: 40 },
  { id: 'level10',   name: 'Rising City',        desc: 'Reach city level 10.', pr: 10 },
  { id: 'level20',   name: 'World City',         desc: 'Reach city level 20.', pr: 25 },
  { id: 'district3', name: 'Expansion',          desc: 'Own 3 districts.', pr: 6 },
  { id: 'district8', name: 'Harbour Empire',     desc: 'Own every district on the harbour.', pr: 30 },
  { id: 'spire',     name: 'Landmark',           desc: 'Top out the Skyline Spire.', pr: 20 },
  { id: 'mega',      name: 'Vertical City',      desc: 'Top out the Forge Megatower.', pr: 50 },
  { id: 'daily3',    name: 'Regular',            desc: 'Clear the Daily Challenge 3 days in a row.', pr: 6 },
  { id: 'daily7',    name: 'Dedicated',          desc: 'Clear the Daily Challenge 7 days in a row.', pr: 15 },
  { id: 'daily30',   name: 'Institution',        desc: 'Clear the Daily Challenge 30 days in a row.', pr: 50 },
  { id: 'contract10', name: 'Contractor',        desc: 'Complete 10 contracts.', pr: 10 },
  { id: 'stage1',    name: 'Groundbreaking',     desc: 'Finish the first stage of Harbor Stadium.', pr: 10 },
  { id: 'stadium',   name: 'Full House',         desc: 'Finish Harbor Stadium.', pr: 40 },
  { id: 'weekly1',   name: 'Weekly Winner',      desc: 'Earn Gold in a Weekly Challenge.', pr: 15 },
  { id: 'storm',     name: 'Storm Chaser',       desc: 'Top out a building in a storm.', pr: 10 },
  { id: 'reno5',     name: 'Makeover',           desc: 'Carry out 5 renovations.', pr: 8 },
  { id: 'designer',  name: 'Architect',          desc: 'Top out a tower of your own design.', pr: 15 },
  { id: 'variant',   name: 'Signature Style',    desc: 'Unlock a facade variant.', pr: 5 },
  { id: 'clean',     name: 'Clean Energy',       desc: 'Run solar and wind power together.', pr: 8 },
  { id: 'metro',     name: 'Underground',        desc: 'Open a Metro Station.', pr: 6 },
  { id: 'event',     name: 'Opportunist',        desc: 'Earn bonus coins from a city event.', pr: 4 },
  { id: 'photo1',    name: 'Say Cheese',         desc: 'Take a picture in Photo mode.', pr: 3 },
  { id: 'region2',   name: 'Sister City',        desc: 'Found a city in a second region.', pr: 20 },
  { id: 'region4',   name: 'World Builder',      desc: 'Build a city in every region.', pr: 60 },
];

/* ---- Cosmetics: crane paint, unlocked by prestige. ---- */
const CRANE_PAINTS = [
  { id: 'yellow',   name: 'Classic Yellow', color: '#f2b90f', need: 0 },
  { id: 'red',      name: 'Signal Red',     color: '#d8412f', need: 40 },
  { id: 'blue',     name: 'Harbor Blue',    color: '#2f7fd8', need: 120 },
  { id: 'graphite', name: 'Graphite',       color: '#4a4f58', need: 300 },
  { id: 'gold',     name: 'Gold Leaf',      color: '#e8c55e', need: 800 },
];
