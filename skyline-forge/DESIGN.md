# Skyline Forge 1.0: design spec

This is how the *Skyline Forge Master Game Design Document* (GDD) is realised in the shipping
game. The GDD sets the direction. This file sets the systems and the numbers. All tuning lives in
`js/data.js`, so every value below can be changed in one place.

The one fixed rule: **the construction feel is the classic Skyline Stack engine**. The rope,
swing, drop, 40 × 46 blocks, Perfect tolerance, tip-off rules, rigid sway and camera framing come
from the 2D original unchanged. Everything else is built around it.

## 1. Core loop (GDD §1)

```
BUILD a tower on a lot ─► residents / jobs move in ─► population grows, city levels up
      ▲                                                        │
      │                                                        ▼
 new blueprints, districts,  ◄── coins, prestige ◄── income, contracts, daily challenge
 parks, transit unlock
```

- **Construction** (30 s to 5 min): the skill layer. You build every tower floor by floor.
- **City** (the hub): a 3D map of your districts. Every tower you finish stands where you built
  it, with its own leans and offsets, and it shows in the background of later builds.
- **Meta**: contracts, a daily challenge with streaks, the Sky Race record, achievements and
  cosmetics. These give short- and long-term reasons to come back.

## 2. Construction (GDD §2–4)

### Classic base (unchanged)

Classic pixels, y down, 1 px = 0.15 m in 3D.

- **Block**: 40 × 46 px (6 × 6.9 × 6 m).
- **Swing**: reach 30 px → 62 px (+0.6 per floor) and speed 2.3 → 3.8 rad/s (+0.03 per floor).
- **Drop**: straight down. The gap is covered in 0.36 s.
- **Landing**:
  - |dx| ≤ 5 px is a Perfect;
  - |dx| ≤ 20 px sticks;
  - between 20 and 40 px, the floor tips off the edge;
  - beyond 40 px, it falls past the tower.
- **Sway**: the whole tower rocks rigidly with a 2.8 s period.
  - Each floor adds `|dx| × 0.7` to the target amplitude, up to 30 px.
  - A Perfect keeps 45% of it.
  - Short towers can only tilt 0.06 rad.
- **Lives**: 3 misses end a session.
- **Camera**: the tower top sits 58% down the screen. The intro shows the crane first.

### Forge layer (GDD §2)

| Input | Effect |
|---|---|
| Tap / quick release | Normal Drop |
| Hold | Momentum bands (Appendix A): swing ×1 → ×3.5, reward ×1 → ×4, forced release at 3 s |
| Hold + swipe down | Power Drop ×1.25 / 1.5 / 2.0 / 2.5 by swipe speed. Adds downward speed. |
| Hold + swipe up | Recall. Costs one combo step. |

Mechanics unlock in the GDD's tutorial order (§14): Tap → Hold (city level 2) → Power Drop
(level 4) → Recall (level 5). *Classic controls* in Settings drops on touch and turns the
gestures off.

### Placement, impact and recovery (GDD §3)

- **Ratings** by |dx| / W:
  - Perfect ≤ 5 px;
  - Excellent ≤ 0.15;
  - Great ≤ 0.25;
  - Good ≤ 0.35;
  - Rough ≤ 0.45;
  - Dangerous ≤ 0.5.
- **Impact energy**: E = (landing speed / normal landing speed)².
  - E scales the sway a floor adds.
  - An off-centre Power Drop shoves the floor out by `1 + 0.12 (E − 1)`.
  - A centred one (≤ 6 px, E > 1.25) settles the tower, removing 40% of the sway.
- **Stability readout**: sway as a share of 30 px, in four bands. Under 25% is Stable, under
  50% Moving, under 75% Dangerous, and anything higher Critical.
- **Recovery ladder**: a danger episode starts at Dangerous and ends back at Stable after at
  least one placement.

  | Tier | Condition | Bonus points | Prestige |
  |---|---|---|---|
  | Close Call | worst = Dangerous | 50 | 1 |
  | Structural Save | worst = Critical | 150 | 2 |
  | Master Recovery | Critical, ≥ 3 floors placed in danger | 300 | 4 |
  | Impossible Recovery | Critical at ≥ 95% sway on a 20+ floor tower | 600 | 8 |
  | Legendary Recovery | Impossible + a Power Perfect during the episode | 1200 | 15 |

- Partial and full collapse are not used. The classic tip-off and three-miss rule keep failure
  readable and recoverable, and an unfinished tower can be continued later (GDD §3:
  "bad placement should not automatically end a run").

### Scoring (GDD §4)

- **Floor points** use the classic formula, then the risk multiplier:
  `(Perfect ? 25 : 6 + 14·accuracy) + 8·combo`, × style multiplier × hold × power.
- **Capacity**: the sum of a tower's floor points. They become residents, jobs or guests,
  depending on the blueprint.
- **Special floors** (Sky Garden, Sky Lobby and so on) come every 10 floors on some blueprints.
  Each one landed Perfect adds 3% capacity.
- **Quality**: the mean rating quality. Perfect counts 1.0, Excellent .92, Great .82, Good .70,
  Rough .55 and Dangerous .40.
- **Stars**:
  - ★ topped out;
  - ★★ quality ≥ 80%;
  - ★★★ quality ≥ 92%.
- **Quality report**: height, quality, structural stability (100% minus peak sway), Perfects,
  longest combo, Power Perfects, recoveries, strongest impact, capacity, prestige and stars.
  All of it persists with the building (GDD §5 building history).

## 3. Blueprints (GDD §7)

| Blueprint | Role | Floors | Level | Permit | Style mult | Nearby needs |
|---|---|---|---|---|---|---|
| Starter Flats | Residential | 8 | 1 | 100 (first free) | 1.0 | none |
| Corner Market | Commercial | 10 | 2 | 250 | 1.5 | Residential |
| Skyline Residence | Residential, Sky Garden every 10 | 20 | 4 | 700 | 1.3 | none |
| Office Tower | Office | 16 | 4 | 900 | 2.0 | Residential + Commercial |
| Grand Hotel | Hospitality | 22 | 8 | 2,200 | 2.4 | Park or waterfront |
| Luxury Tower | Luxury residential | 30 | 10 | 3,500 | 3.0 | Residential + Commercial + Office |
| Corporate HQ | Office, Sky Lobby every 10 | 40 | 13 | 7,000 | 2.6 | Commercial + Office |
| Skyline Spire | Landmark (one per city) | 60 | 16 | 15,000 | 4.0 | none |
| Forge Megatower | Mixed use: retail, office, residential, crown | 100 | 20 | 40,000 | 5.0 | none |

- The first four keep the classic City Bloxx colours (blue, red, green, gold) and neighbour
  rules. "Nearby" means another building within 36 m, so the same block or across one street.
- **Unfinished towers**: they keep the floors they have, count toward the city at their current
  size, and can be continued later for half the permit fee.

## 4. City map (GDD §5, §8, §9)

- **Layout**: the city is a 74 m street grid. Your districts are blocks along the south
  waterfront, each holding a 3 × 3 grid of lots 20 m apart. A procedural skyline fills the
  blocks behind and beside them.
- **Piers**: two piers stand in the harbour, and the construction camera always looks north
  across the water. The Record Pier holds your best Sky Race tower. The Challenge Pier is where
  daily challenges are built.
- **Districts**, bought with coins once the city reaches the level shown:

  | District | Level | Cost | Land value | Trait |
  |---|---|---|---|---|
  | Harbor Row | 1 | free | 1.00 | Waterfront front row |
  | Market Street | 3 | 1,500 | 1.00 | Commercial +15% |
  | Old Town | 5 | 4,000 | 1.10 | Historic: max 16 floors, tourism +30% |
  | Downtown | 7 | 9,000 | 1.30 | Office +20% |
  | Waterfront East | 9 | 15,000 | 1.25 | Hotels and luxury +20% |
  | Tech Park | 11 | 25,000 | 1.15 | Office +15% |
  | Financial District | 13 | 40,000 | 1.40 | Corporate HQ +25% |
  | Uptown | 15 | 60,000 | 1.35 | Residential +20% |

- **Placeables**: these take a lot and are placed instantly with no crane.

  | Placeable | Level | Cost | Effect |
  |---|---|---|---|
  | Park | 3 | 150 | Land value +0.15 within 36 m, happiness |
  | Plaza | 6 | 600 | Land value +0.10 within 36 m, tourism |
  | Bus Stop | 7 | 900 | Transit coverage within 60 m: land value +0.10 |
  | Metro Station | 12 | 5,000 | Transit coverage within 110 m: land value +0.25 |

- **Buildings are permanent memories** (GDD §5):
  - completed towers keep their exact floor offsets;
  - selecting one shows its build date, quality, Perfects, strongest impact and recoveries;
  - **Rebuild** replaces a tower only if the new one scores higher, and **Demolish** refunds
    20% of the permit.

## 5. City simulation (GDD §6)

This is an aggregate model. Nothing is simulated agent by agent.

- **Capacities**:
  - `Rcap` is the total residential capacity, `Ccap` the commercial jobs and `Ocap` the office
    jobs.
  - `Gcap` is hotel guests. Hotel staff count as jobs, at 0.3 × guests.
  - The Megatower splits its capacity 20% commercial, 40% office and 40% residential.
- **Ratios**:
  - `W = 0.5 · Rcap` potential workers;
  - `jobRatio = (Ccap + Ocap + staff) / W`;
  - `shopRatio = Ccap / (0.25 · Rcap)`.
- **Happiness** `H`:
  - base 0.62;
  - parks +0.05 each (max 0.25);
  - plazas +0.05 each (max 0.10);
  - transit coverage share × 0.15;
  - +0.1 with a landmark;
  - minus unemployment × 0.2 and missing shops × 0.1;
  - clamped to 0.25–1, so a young city is never miserable.
- **Target occupancy** (× the lot's land value factor, clamped 0.2–1):
  - residential: `0.45 + 0.35·min(1, jobRatio) + 0.2·min(1, shopRatio)`, × (0.8 + 0.4·H);
  - commercial: `0.3 + 0.7·min(1, 0.25·Rcap / Ccap)`;
  - office: `0.3 + 0.7·min(1, W / jobs)`;
  - hotel: `0.4 + 0.6·tourism`, where tourism comes from landmarks, plazas, waterfront and
    Old Town.
- **Filling up**: a new building starts at 80% of its target occupancy. After that, occupancy
  eases toward the target with a 20-minute time constant, offline time included.
- **Demand bars**, each from −1 to 1:
  - R = (jobs − W) / W;
  - C = (0.25·Rcap − Ccap) / (0.25·Rcap);
  - O = (W − jobs) / W.
- **Population** = Σ residential capacity × occupancy. It drives the city level.
- **Income per hour** = `(0.25·population + 0.3·filled jobs + 0.8·guests) · (0.7 + 0.5·H) ·
  mean land value`.
  - It accrues live while you play.
  - While you're away, it accrues for up to 8 hours and waits for you to **Collect** (GDD §16:
    no energy and no forced waiting; returning is rewarded, never required).

## 6. Economy and progression (GDD §11)

- **Currencies** (GDD §6 keeps them few):
  - **Coins** buy permits, districts and placeables.
  - **Prestige ✦** is never spent. Its thresholds unlock cosmetics.
- **Start**: 500 coins. The first Starter Flats permit is free.
- **Build reward**:
  - `floors·5·style + Perfects·3 + Power Perfects·10`;
  - if topped out, add `0.8·permit + stars·floors·3`.
- **Prestige**:
  - topping out gives stars × floors / 4;
  - recoveries, contracts, daily clears and achievements give more.
- **City level** comes from population, with thresholds 40, 150, 350, 650, 1,000, 1,500 … up
  to level 30 (see `LEVELS`). Each level up pays coins and unlocks content:

  | Level | Unlocks |
  |---|---|
  | 1 | Starter Flats, Sky Race, Harbor Row |
  | 2 | Corner Market, **Hold Momentum** |
  | 3 | Park, Market Street, Contracts board |
  | 4 | Skyline Residence, Office Tower, **Power Drop** |
  | 5 | **Recall**, Daily Challenge, Old Town |
  | 6 | Plaza |
  | 7 | Bus Stop, Downtown |
  | 8 | Grand Hotel |
  | 9 | Waterfront East |
  | 10 | Luxury Tower |
  | 11 | Tech Park |
  | 12 | Metro Station |
  | 13 | Corporate HQ, Financial District |
  | 15 | Uptown |
  | 16 | Skyline Spire |
  | 20 | Forge Megatower |

## 7. Retention (GDD §10, §15)

- **Contracts**:
  - 3 slots. Each is drawn from templates tuned to your level:
    - top out a blueprint;
    - quality ≥ X;
    - N Perfects in one build;
    - combo ×N;
    - Power Perfects;
    - Perfect while holding at ×M;
    - earn a recovery;
    - Sky Race height;
    - reach a population;
    - place parks;
    - clear the daily challenge.
  - A claimed slot refills after 15 minutes.
  - Replacing a contract costs 50 coins.
- **Daily challenge** (GDD §15, fair challenges):
  - Everyone gets the same seed for the date. It sets the block style, a 12–25 floor target and
    1–2 modifiers:
    - Windy (base sway);
    - Rapid Crane (swing ×1.25);
    - Heavy Modules (gravity ×1.35);
    - One Shot (1 life);
    - Purist (no hold);
    - No Recall;
    - Fog.
  - Retries are unlimited and the best score counts.
  - The first clear each day pays `150 + 50·min(streak, 7)` coins + 5 ✦, and advances the
    streak.
- **Sky Race**: the classic endless Quick Game. Your best run is rebuilt floor for floor as the
  **Record Tower** on the Record Pier, so beating it changes your skyline.
- **Achievements**: 30 of them, from First Perfect to Legendary Recovery, a 100-floor Sky Race
  and a 30-day streak. Each pays prestige.
- **Mastery**: each blueprint shows its best star rating and how many times you've built it.
- **Cosmetics**: crane paint (Classic Yellow, Signal Red, Harbor Blue, Graphite, Gold Leaf),
  unlocked by prestige.
- **Welcome back**: returning shows income earned while away, ready contracts and today's
  challenge.

## 8. Presentation (GDD §12–14)

- Stylized 3D (three.js r128), with the classic block design painted on each module.
- **Time of day**: day, sunset or night, set by the device clock or chosen in Settings. Windows
  light up at night.
- **Sky**: it darkens with altitude toward space while you build. Clouds thin out, then stars
  and planets appear (from the classic).
- **Audio**:
  - cable ratchet, wind by altitude, impacts weighted by energy;
  - a rising Perfect chime, with a deeper Power Perfect accent;
  - generative music that adds layers with the combo.
- **Haptics**: small on placement, sharp on Perfect, strong on Power, irregular on instability.
  All of it is optional.
- **HUD**: minimal (GDD §14).
  - Construction shows floor/target, multiplier, combo, stability, lives and points.
  - The city shows level, population, coins, demand, and the Contracts, Daily, Race and
    Trophies buttons.
- **Accessibility**: reduced motion, camera shake, vibration, larger text, and stability shown
  with shape and text as well as colour.

## 9. Not in 1.0

These GDD features would each need a server, much larger content, or a different kind of
game:

- multiplayer, friend visits, shared megaprojects and leaderboards across players (§15);
- regions and the future era (§11);
- a blueprint creator (§7);
- a full transport network with traffic simulation (§9);
- utilities (§6);
- weather other than the Fog and Windy modifiers (§12);
- replay and photo mode (§15).

The data model leaves room for them. The save keeps every building's full floor data.

## 10. Architecture

```
index.html        markup, CSS, script tags (runs as is from file:// or a web server)
js/core.js        utilities, seeded RNG, dates, save/load/migration, event bus
js/data.js        every tuning table: CFG, FORGE, styles, blueprints, districts, levels, …
js/audio.js       synthesized sound effects and generative music
js/gfx.js         renderer, sky and time of day, textures, module meshes, particles, quality
js/world.js       city map: ground, water, streets, backdrop city, lots, piers, player towers,
                  construction site dressing and crane
js/engine.js      the classic engine + Forge layer, session modes, modifiers, 3D sync
js/city.js        simulation, economy, levels, unlocks, placement rules
js/meta.js        contracts, daily challenge, Sky Race record, achievements, cosmetics
js/ui.js          HUD, screens, sheets, modals, tips
js/main.js        state machine, cameras, input, main loop
bundle.py         inlines the scripts into one HTML file (APK asset and web artifact)
```

The scripts share one global scope, in load order, the same as one long script. This keeps the
game buildless while splitting it into files of a readable size.
