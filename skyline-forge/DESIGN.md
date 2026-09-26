# Skyline Forge 1.2: design spec

This is how the *Skyline Forge Master Game Design Document* (GDD) is realised in the shipping
game. The GDD sets the direction. This file sets the systems and the numbers. All tuning lives in
`js/data.js`, so every value below can be changed in one place.

The one fixed rule: **the construction feel is the classic Skyline Stack engine**. The rope,
drop, 40 × 46 blocks, Perfect tolerance, tip-off rules and rigid sway come from the 2D original.
Version 1.2 changes the classic in four places, all asked for in play-testing: the rope hangs
still until the first floor is in view, swings wider, a dropped floor keeps a little of the
swing's momentum, and a badly balanced tower can now collapse.

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
- **Strategy**: power, water, services, pollution, traffic and materials make *where* and *what*
  you build matter, without adding any new controls to construction.
- **Meta**: missions (contracts), a daily chest track, city events, live weather, a daily and a
  weekly challenge, the Sky Race record, the stadium and airport megaprojects, the 250-floor
  Arcology, mastery facades, a Blueprint Studio, six regions, achievements, a coin shop and a
  collection. These give short- and long-term reasons to come back.

## 2. Construction (GDD §2–4)

### Classic base (unchanged)

Classic pixels, y down, 1 px = 0.15 m in 3D.

- **Block**: 40 × 46 px (6 × 6.9 × 6 m).
- **Swing**: reach 40 px → 72 px (+0.6 per floor) and speed 2.3 → 3.8 rad/s (+0.03 per floor).
  The rope hangs still until the first floor is in view, then builds up its swing over 1.1 s.
- **Drop**: the gap is covered in 0.36 s. The floor keeps 20% of the swing's sideways speed, so
  you lead the drop a little. On landing it slides a few pixels with that speed and, unless it
  was a Perfect or a settling Power Drop, kicks the tower's sway by `|vx| · 0.12`.
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
- **Camera**: the tower top sits 58% down the screen. The intro shows the crane first. From the
  5th floor the camera eases back, up to 40% further by the 40th, so the city stays in view.

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

- **Collapse** (physics, not a rule): after every step the engine checks each joint. For the
  floors above joint k it takes their centre of mass, plus the lean the current sway gives it
  (`height · tan(sway angle)`), and compares it with the joint's grip, `1.25 · W / 2`. A new
  tower is also checked as a whole against its slab and footings (half-width 52 + 20 px). When the centre of mass passes the edge,
  strain builds (faster the further out it is); after 0.3 s the tower breaks at that joint and
  everything above topples as one piece to that side, like a felled tree, costing a life;
  if the whole tower leaves its slab, the session ends.
  Floors from earlier sessions count as anchored. The engine telegraphs it first: the joint
  glows, creaks and sheds dust, the stability readout turns Critical and the phone shivers, and a
  tip suggests counterbalancing on the other side. A collapse is recorded in the report.

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

| Blueprint | Role | Floors | Level | Permit | Materials | Style mult | Nearby needs |
|---|---|---|---|---|---|---|---|
| Starter Flats | Residential | 8 | 1 | 100 (first free) | – | 1.0 | none |
| Corner Market | Commercial | 10 | 2 | 250 | – | 1.5 | Residential |
| Harbor Works | Industrial, pollutes 60 m | 8 | 3 | 400 | – | 1.4 | none |
| Skyline Residence | Residential, Sky Garden every 10 | 20 | 4 | 700 | – | 1.3 | none |
| Office Tower | Office | 16 | 4 | 900 | – | 2.0 | Residential + Commercial |
| Harbor School | Education, covers 90 m | 6 | 4 | 500 | – | 1.2 | Residential |
| Neighbourhood Clinic | Healthcare, covers 90 m | 6 | 5 | 650 | – | 1.2 | Residential |
| Fire & Police | Safety, covers 100 m | 5 | 6 | 700 | – | 1.2 | none |
| Grand Hotel | Hospitality | 22 | 8 | 2,200 | 20 | 2.4 | Park or waterfront |
| Harbor Arena | Entertainment | 12 | 9 | 3,000 | 30 | 2.2 | Residential + Commercial |
| Luxury Tower | Luxury residential | 30 | 10 | 3,500 | 40 | 3.0 | Residential + Commercial + Office |
| University | Education, covers 170 m | 18 | 11 | 6,000 | 40 | 2.0 | none |
| General Hospital | Healthcare, covers 170 m | 20 | 12 | 6,500 | 40 | 2.0 | none |
| Corporate HQ | Office, Sky Lobby every 10 | 40 | 13 | 7,000 | 80 | 2.6 | Commercial + Office |
| Tech Campus | High-paying office | 24 | 14 | 9,000 | 60 | 2.9 | Education |
| Skyline Spire | Landmark (one per city) | 60 | 16 | 15,000 | 150 | 4.0 | none |
| Forge Megatower | Mixed use: retail, office, residential, crown | 100 | 20 | 40,000 | 400 | 5.0 | none |
| City Museum | Landmark-style entertainment, one per city, tourism | 10 | 7 | 2,600 | 15 | 2.0 | none |
| Mega Mall | Commercial, one per city | 16 | 9 | 4,500 | 30 | 2.6 | Residential |
| Convention Centre | Entertainment, one per city | 12 | 11 | 6,000 | 40 | 2.4 | a hotel |
| Opera House | Entertainment, one per city, land value +0.15 within 100 m | 14 | 12 | 8,000 | 60 | 2.6 | none |
| Artist Lofts | Residential, contract reward | 12 | 6 | 1,400 | 10 | 1.9 | none |
| Boutique Hotel | Hospitality, contract reward | 14 | 8 | 2,600 | 20 | 2.9 | none |
| Green HQ | Office, Garden Floor every 6, contract reward | 30 | 12 | 9,000 | 60 | 3.0 | none |
| Sky Club | Entertainment, contract reward, one per city | 26 | 14 | 12,000 | 80 | 3.2 | none |
| Forge Arcology | Mixed use in 7 phases, one per city | 250 | 24 | 150,000 | 1,200 | 5.5 | none |
| Vertical Farm | Clean industry, Grow Floor every 5, happiness | 30 | 25 | 30,000 | 150 | 3.0 | none |

- The first four keep the classic City Bloxx colours (blue, red, green, gold) and neighbour
  rules. "Nearby" means another building within 36 m, so the same block or across one street.
- **Unfinished towers** keep the floors they have, count toward the city at their current size,
  and can be continued later for half the permit (and half the materials).
- **Mastery** (GDD §7): topping a blueprint out 2 and 5 times unlocks two facade variants, chosen
  on the blueprint's card in the Collection, and +2% capacity per tier. Skill still decides the
  building.
- **Contract blueprints**: Lofts, Boutique Hotel, Green HQ and Sky Club can't be bought; a
  contract that names one unlocks it when claimed.
- **The Forge Arcology** is built phase by phase over many sessions: Foundation (25 floors),
  Core (80), Lower City (130), Sky Bridge (150), Upper City (210), Crown (240) and Spire (250).
  Each session aims for the end of the next phase, which ends with its own banner and rewards;
  the permit and materials are paid once and every later phase is free. Its seven sections wear
  their own facades, and the roof is a stepped crown with a glowing halo and a needle.
- **Blueprint Studio** (level 14): the player picks a function (homes, shops, offices, hotel or
  mixed use), 12–100 floors, any facade, a special floor and its spacing, and a roof. The game
  derives the rest:
  - permit `≈ floors^1.6 · 9.6 · role mult`, materials `floors · 1.5` (`· 2.2` above 40 floors);
  - capacity multiplier `role mult · (1 + floors / 200)`;
  - neighbour needs from the function; mixed use splits 20% shops, 45% offices, 35% homes.
  Up to six designs; a design that stands in the city is locked so its tower keeps its meaning.

## 4. City map (GDD §5, §8, §9)

- **Layout**: a 74 m street grid. Your districts are blocks along the south waterfront, each a
  3 × 3 grid of lots 20 m apart; row C faces the water. A procedural skyline fills the rest.
- **Piers and the island**: the Record Pier holds your best Sky Race tower, the Challenge Pier
  hosts the daily and weekly challenges, and a bridge leads to the stadium island.
- **Districts**, bought once the city reaches the level shown:

  | District | Level | Cost | Land value | Trait |
  |---|---|---|---|---|
  | Harbor Row | 1 | free | 1.00 | Waterfront front row |
  | Market Street | 3 | 1,500 | 1.00 | Commercial +15% |
  | Dockyards | 4 | 2,500 | 0.90 | Industrial +30%; factory pollution spreads half as far |
  | Old Town | 5 | 4,000 | 1.10 | Historic: max 16 floors, tourism +30% |
  | Downtown | 7 | 9,000 | 1.30 | Office +20% |
  | Waterfront East | 9 | 15,000 | 1.25 | Hotels and luxury +20% |
  | Tech Park | 11 | 25,000 | 1.15 | Office +15% |
  | University Hill | 12 | 20,000 | 1.20 | Education +30%, and schools reach 50% further |
  | Financial District | 13 | 40,000 | 1.40 | Corporate HQ +25% |
  | Uptown | 15 | 60,000 | 1.35 | Residential +20% |
  | Suburbs | 6 | 6,000 | 0.95 | Max 12 floors, homes +25%, +150 road capacity |
  | Entertainment District | 10 | 30,000 | 1.20 | Arenas and landmarks +35%, shops +15%, tourism +20% |
  | Floating Quarter | 25 | 250,000 | 1.40 | Future era, on pontoons: every lot waterfront, homes and offices +20% |

- **Placeables** take a lot and appear instantly, with no crane:

  | Placeable | Level | Cost | Effect |
  |---|---|---|---|
  | Park | 3 | 150 | Land value +0.15 within 36 m (two parks at most), happiness |
  | Power Plant | 4 | 800 | +150 power, pollutes nearby lots |
  | Water Tower | 4 | 600 | +160 water |
  | Bus Stop | 5 | 900 | Transit within 60 m (land value +0.10), road capacity +250 |
  | Plaza | 6 | 600 | Land value +0.10 within 36 m, tourism |
  | Tram Stop | 8 | 1,800 | Transit within 80 m (+0.15), capacity +450 |
  | Ferry Terminal | 9 | 2,500 | Waterfront only. Transit within 90 m, capacity +400, tourism |
  | Solar Farm | 9 | 2,600 | +120 clean power |
  | Water Works | 10 | 3,200 | +420 water |
  | Metro Station | 12 | 5,000 | Transit within 110 m (+0.25), capacity +900 |
  | Wind Turbines | 12 | 4,200 | +240 clean power |
  | Rail Station | 15 | 9,000 | Transit within 140 m (+0.25), capacity +1,500, tourism |
  | Landfill | 5 | 700 | +160 waste handling, pollutes nearby lots |
  | Cell Tower | 6 | 900 | +180 connectivity |
  | Recycling Centre | 11 | 3,800 | +420 clean waste handling |
  | Data Centre | 13 | 6,000 | +600 connectivity |
  | High-Speed Rail | 18 | 16,000 | Transit within 200 m (+0.30), capacity +2,500, tourism |
  | Autonomous Transit Hub | 26 | 28,000 | Maglev and driverless pods: transit within 240 m (+0.30), capacity +4,000 |
  | Fusion Plant | 27 | 40,000 | +2,500 clean power |

- **Map overlays** (the Layers button): land value, service coverage, pollution and transit,
  drawn as coloured tiles on your lots.
- **Buildings are permanent memories** (GDD §5): they keep their exact floor offsets, history,
  facade and renovations. **Rebuild** replaces a tower only if the new one is better, and
  **Demolish** refunds 20% of the permit with a toppling animation.
- **Renovations** (GDD §5, level 3), one of each per topped-out building, priced as a share of
  its permit: facade (+0.1 land value), amenities (occupancy +8%), rooftop garden (happiness,
  +3%, 5 materials), solar roof (+1 power per floor, 5 materials), feature lighting (LED
  strips at night, tourism). Gardens and solar panels appear on the roof.

## 5. City simulation (GDD §6)

An aggregate model; nothing is simulated agent by agent. `recomputeCity()` runs after any
change, `tickCity()` advances time.

- **Per-lot context**: land value = district value + waterfront 0.1 + parks + plaza + transit +
  0.04 per service covering the lot − 0.15 per polluter in range (max two) + 0.2 near a
  landmark + facade renovation (+ the region's bonus). Minimum 0.5.
- **Capacities**: residential, commercial, office, industrial, hotel guests, services,
  entertainment and landmark visitors, each × occupancy.
- **Utilities**: every floor uses 1 power, 1 water, 1 waste handling and 1 connectivity
  (industry, landmarks and mixed use 2 power; offices 2 connectivity). The old grid supplies 80
  of each. `util` is the worst of the four supply / use ratios; a shortage scales every
  building's target occupancy by `0.5 + 0.5·util` and costs happiness.
- **Jobs and workers**: `W = 0.5·Rcap`; jobs = shops + offices + industry + 0.3·hotel + 0.5·
  services + 0.4·entertainment.
- **Traffic** (GDD §9): commuters `0.9·min(jobs, W)` against road capacity (300 + 60 per district
  + transit). Congestion above 1 costs happiness and up to 10% of income, and the streets fill
  up and slow down.
- **Services**: the share of homes covered by education, healthcare and safety. Each covered
  service lifts residential occupancy 4%; education also makes offices more productive.
- **Pollution**: the share of homes near a factory or power plant.
- **Happiness** `H`, clamped 0.25–1: 0.62 + parks (max 0.25) + plazas (max 0.1) + transit share
  × 0.15 + landmark 0.1 + services × 0.06 each + gardens + arenas + finished stadium 0.06, minus
  unemployment × 0.2, missing shops × 0.1, congestion × 0.12, pollution × 0.12 and shortage × 0.2.
- **Target occupancy** (× land value factor, renovations and utilities, clamped 0.2–1):
  residential `0.45 + 0.35·jobs + 0.2·shops` × (0.8 + 0.4·H); commercial and office by the
  worker balance; industry by workers; hotels, arenas and landmarks by tourism.
- **Filling up**: new buildings start at 80% of their target, then ease toward it with a
  20-minute time constant, offline time included.
- **Income per hour** = `(0.12·pop + 0.06·rich + 0.15·filled jobs + 0.4·guests + 0.25·visitors)
  · (0.7 + 0.5·H) · mean land value · (1 − 0.1·congestion) · (1 + 5% per other city owned)`,
  with city-event multipliers. It accrues live, and for up to 8 hours while away.
- **Materials**: Harbor Works produce `industrial capacity / 25` per hour at full occupancy;
  every Perfect floor in a city build saves one. Storage 150 plus 150 per factory. They can
  always be bought at 12 coins each, so a shortage slows you down but never walls you off.

## 6. Economy and progression (GDD §11)

- **Currencies**: coins (permits, districts, placeables, renovations), materials (big towers)
  and prestige ✦ (never spent; unlocks cosmetics).
- **Start**: 500 coins, 50 materials. The first Starter Flats permit in each city is free.
- **Build reward**: `(floors·5·style + Perfects·3 + Power Perfects·10) · (1 + weather bonus) +
  event bonus`; topped out adds `0.8·permit + stars·floors·3`.
- **City level** comes from population: 40, 150, 350, 700, 1,200, 1,900, 2,800, 4,000, 5,500,
  7,500, 10,000 … 51,000 for level 20 and 220,000 for level 30. Each level pays `100 · level`
  coins and unlocks content.
- **Pacing** (checked with a scripted player that builds 12 minutes, four times a day, at
  ordinary skill): level 5 in the first session, the stadium on day one, the first region around
  day three, level 16 within a week. After that, growth comes from rebuilding lots with taller
  towers and Studio designs, and from skill: Perfect combos can triple a floor's capacity. **Skills and modes follow your best city**, so a
  new region never takes Hold, Power Drop or the challenges away.

  | Level | Unlocks |
  |---|---|
  | 1 | Starter Flats, Sky Race |
  | 2 | Corner Market, **Hold Momentum** |
  | 3 | Harbor Works, Park, Market Street, **Contracts**, renovations and materials, city events |
  | 4 | Skyline Residence, Office Tower, Harbor School, Power Plant, Water Tower, Dockyards, **Power Drop** |
  | 5 | Neighbourhood Clinic, Bus Stop, Old Town, **Recall**, **Daily Challenge** |
  | 6 | Fire & Police, Plaza, **Weekly Challenge** |
  | 7 | Downtown |
  | 8 | Grand Hotel, Tram Stop, **Harbor Stadium** (stage 1) |
  | 9 | Harbor Arena, Ferry Terminal, Solar Farm, Waterfront East, stadium stage 2 |
  | 10 | Luxury Tower, Water Works, stadium stage 3 |
  | 11 | University, Tech Park |
  | 12 | General Hospital, Metro Station, Wind Turbines, University Hill, **Coral Bay** region, stadium stage 4 |
  | 13 | Corporate HQ, Financial District |
  | 14 | Tech Campus, **Blueprint Studio**, stadium stage 5 |
  | 15 | Rail Station, Uptown |
  | 16 | Skyline Spire, **Mirage Springs** region, stadium stage 6 |
  | 15–19 | **Harbor Airport** stages: Runway, Terminal (16), Control Tower (18), First Flights (19); High-Speed Rail (18) |
  | 20 | Forge Megatower, **Fjordheim** region |
  | 22 | **Highpeak** region |
  | 24 | Forge Arcology |
  | 25 | Vertical Farm, Floating Quarter, **Pearl Atoll** region |
  | 26 | Autonomous Transit Hub |
  | 27 | Fusion Plant |

- **Ranks**: Hamlet, Village (3), Town (5), City (8), Big City (12), Metropolis (16), Megacity
  (21), Global City (26).
- **Regions** (GDD §11): new cities on the same harbour plan in other climates, each with its own
  lots, level, stadium and income. Coins, materials, skills, designs and trophies are shared;
  each other city you own adds 5% trade income to all of them, and away cities keep filling up
  and earning.

  | Region | Unlock | Founding | Rules | Weather |
  |---|---|---|---|---|
  | Harbor City | start | – | none | four seasons |
  | Coral Bay | 12 | 40,000 | tourism +25%, hotels +25% | rain and tropical storms |
  | Mirage Springs | 16 | 100,000 | solar ×1.8, water supply ×0.6, land value +0.1 | clear, windy |
  | Fjordheim | 20 | 220,000 | heating doubles power use, wind ×1.6, offices +15% | snow, fog |
  | Highpeak | 22 | 320,000 | land value +0.15, tourism +15%, wind ×1.3, permits +20% | wind, fog, snow |
  | Pearl Atoll | 25 | 450,000 | every lot waterfront, hotels +40%, tourism +30%, materials ×2 | rain, storms |

## 7. Retention (GDD §10, §15)

- **Missions** (contracts): 3 slots drawn from templates tuned to your level (top out a
  blueprint, quality, Perfects, combo, Power Perfects, hold, recoveries, Sky Race height,
  population, parks, the daily challenge, renovations, building in bad weather, new transit, a
  role in a named district, homes served by transit, a waterfront hotel at 85% quality, a tall
  tower with no collapse). From level 6 some pay a contract-only blueprint as well. A claimed
  slot refills after 15 minutes; swapping costs 50 coins. **Go** takes you to a good lot for it.
- **Daily chests**: seven chests, one a day (coins scaled by level, materials, prestige; the
  seventh holds all three). Missing a day starts the track again.
- **City events** (level 3): one runs at a time, a new one every 3 hours, the same for everyone.
  Housing Boom, Corporate Expansion, Tourism Festival, Market Week, Championship Final,
  Construction Contest, Steel Delivery and Tech Conference: capacity bonuses on new builds,
  income multipliers, coins per Perfect, double factory output or half-price materials.
- **Weather** (GDD §12): every two hours, the same for everyone (by region). Clear and cloudy do
  nothing; wind (+15% coins, the tower keeps swaying), rain (+10%, floors land a little harder),
  fog (+15%), storms (+35%, wind, rain and lightning) and snow (+20%, a quicker crane) add a
  readable challenge to city builds. A build keeps the weather it started in, and Settings can
  keep it always clear.
- **Daily challenge**: the same seed for everyone: a style, 12–25 floors and 1–2 modifiers.
  Unlimited retries; the first clear pays `150 + 50·min(streak, 7)` + stars, and keeps the streak.
- **Weekly challenge** (level 6): a 30–50 floor tower with two modifiers and its own weather,
  the same all week. Bronze, silver and gold tiers pay 400/900/1,800 coins and prestige once each.
- **Harbor Stadium** (GDD §10 multi-stage project): six crane sessions on the island
  (foundations, lower stands, upper stands, roof masts, ring roof, floodlights), each with its
  own modifiers and a visible new part. A paid stage can be retried free. Finished, it adds
  tourism, happiness and visitor income, and lights up at night.
- **Harbor Airport**: a second island with four crane stages (runway, terminal, control tower,
  first flights). Finished, it brings visitors and tourism, and planes take off every minute.
- **Sky Race**: the classic endless game. Your best run stands as the Record Tower.
- **Shop**: a daily materials deal at 40% off, a crate that fills your store, material packs and
  crane paint. Everything costs coins or prestige earned by playing; there are no real-money
  purchases.
- **Achievements**: 45, each paying prestige. **Cosmetics**: crane paint by prestige, facade
  variants by mastery. **Photo mode** turns your city into pictures worth sharing.
- **Welcome back**: income earned while away, ready contracts and today's challenge.

## 8. Presentation (GDD §12–14)

- Stylized 3D (three.js r128) with the classic block design painted on every module, normal-
  mapped window frames, a roof prop for every style (tanks, billboards, helipads, a clock cupola,
  sports courts, chimneys with smoke, floodlit domes, a spire and a gold crown), animated wind
  turbines, moored ferries, trams and trains.
- **Time of day** and **weather** change the light, sky, fog, water and clouds; rain streaks,
  snowflakes and lightning are drawn around the camera.
- **Regions** repaint the grass, paving, trees (round, palm, pine), backdrop, roofs, water and
  horizon.
- **Impact moments**: a Power Perfect lands in slow motion with a spark ring and a deep hit.
- **Audio**: cable ratchet, wind by altitude and weather, impacts by energy, the Perfect chime,
  thunder, rain, city murmur, gulls and the ferry horn; generative music that adds layers with the
  combo while building and grows with the city's level in the hub.
- **Photo mode**: free orbit camera, time, weather, lens (18–100 mm) and filters, hidden UI and
  capture up to 4K. In the Android app pictures go to Pictures/Skyline Forge and can be shared
  (Android 10+); older phones keep them in the app's own pictures folder.
- **Photo mode** has depth of field: Soft or Strong blur, autofocused on the middle of the frame.
- **City camera**: drag to pan, pinch or scroll to zoom, two-finger twist (or right-drag) to
  rotate the city; the compass turns it back to north.
- **Interface** (1.2): a bright mobile-game look after the art sheet: blue framed panels with a
  yellow back button, white cards, chunky yellow, green and blue buttons, and the Lilita One and
  Nunito fonts embedded so the app looks the same offline. The title screen has Play, a side
  menu (Map, Buildings, Missions, Events) and a bottom bar (Shop, City, Collection); the city has
  a bottom bar (Shop, Collection, Missions, Events, City) and a rail (World, Layers, Photo,
  Menu). Every building and placeable has a small 3D thumbnail, rendered once from its real
  modules and cached. Screens: a world map with the region islands, stars and locks; the build
  list by category with thumbnails and a Build button; a building card to page through (floors,
  capacity, difficulty, land value, cost, facades); missions with daily chests; events with
  countdowns; city stats (overview tiles with today's change, demand for homes, shops, offices
  and industry, people, economy, happiness, records); the shop; and the collection, with locked
  buildings as silhouettes. District labels show their stars (3 per lot), and a Build Here!
  bubble points at the lot the next goal suggests.
- **Accessibility**: reduced motion, camera shake, vibration, larger text, high contrast, a
  left-handed layout that mirrors the controls, and stability shown with shape and text as well
  as colour.

## 9. Not in this version

These need a server or a different kind of game: multiplayer, friend visits, shared
megaprojects, cloud saves and global leaderboards (§15); a full agent traffic simulation (§9).
The weekly challenge is fair and identical for everyone, but its scores stay on the device.

## 10. Architecture

```
index.html        markup, CSS, script tags (runs as is from file:// or a web server)
js/core.js        utilities, seeded RNG, dates, save/load/migration, event bus
js/data.js        every tuning table: CFG, FORGE, styles, blueprints, districts, weather, events, regions …
js/audio.js       synthesized sound effects, ambience and generative music
js/gfx.js         renderer, sky, time of day, weather light, textures, modules and roofs, particles
js/world.js       city map, backdrop, lots, placeables, player towers, overlays, crane, region looks
js/life.js        lamps, aviation lights, pedestrians, workers, gulls and boats
js/engine.js      the classic engine + Forge layer, session modes, modifiers, 3D sync
js/city.js        simulation, economy, levels, unlocks, placement and renovation rules
js/meta.js        contracts, daily and weekly challenges, Sky Race record, achievements, cosmetics
js/events.js      weather and city event schedules, rain, snow and lightning
js/stadium.js     the stadium and airport megaprojects: islands, models, stages and sheets
js/studio.js      Blueprint Studio: custom designs and the elevation preview
js/photo.js       Photo mode
js/regions.js     regions: founding and travel
js/ui.js          HUD, icons, labels, the build sheet, modals, settings, results, tips
js/menus.js       world map, building card, missions and chests, events, city stats, shop, collection
js/main.js        state machine, cameras, input, main loop
bundle.py         inlines the scripts into one HTML file (APK asset and web artifact)
```

The scripts share one global scope, in load order, the same as one long script. This keeps the
game buildless while splitting it into files of a readable size.
