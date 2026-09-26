# Skyline Forge

A crane tower-stacking city builder in stylized 3D. You drop every floor of every building
yourself, using the classic Skyline Stack / City Bloxx feel. Every tower you top out stays in
your harbour city, leans and all, and moves people in.

It runs in any browser with WebGL. It needs no build step and works offline once loaded. An
Android APK wrapper lives in [`android/`](android/).

- **[DESIGN.md](DESIGN.md)**: how the *Skyline Forge Master Game Design Document* maps onto the
  game's systems and numbers.
- **[`../skyline-stack/`](../skyline-stack/)**: the original 2D pixel version.

## How it plays

- **Construction**: the classic engine, unchanged.
  - The crane shows first, then the camera pans down to the rope.
  - The floor swings on the rope and drops straight down.
  - Within 5 px of centre is a Perfect.
  - A floor whose centre lands past the edge tips off, and three misses end the build.
  - Sloppy floors make the whole tower rock. Perfects calm it.
- **The Forge moves**:

  | Gesture | Keyboard | Unlocks | Effect |
  |---|---|---|---|
  | Tap | `Space` | Level 1 | Drop the floor. Until Hold unlocks, it drops the moment you touch, like the original. |
  | Press and hold | Hold `Space` | Level 2 | Hold Momentum: faster swing, multiplier ×1.0 → ×4.0, forced release at 3 s. |
  | Hold + swipe down | `↓` (`Shift ↓` = max) | Level 4 | Power Drop ×1.25 → ×2.5, harder impact. |
  | Hold + swipe up | `↑` | Level 5 | Recall for another swing. Costs a combo step. |

  **Settings → Classic controls** keeps the drop-on-touch feel forever.
- **Each build**:
  - lands special floors, such as a Sky Garden: a Perfect adds 3% capacity;
  - earns recovery bonuses, from Close Call to Legendary Recovery;
  - gets 1–3 stars from its construction quality.
- **The city** (the strategy layer):
  - Tap a lot to build. **Homes**, **shops** and **offices** keep one another busy; watch the
    **R/C/O demand** bars, **happiness**, **power** and **roads** readouts.
  - Supply **power and water** (plants, towers, solar, wind, water works) or buildings empty.
  - Cover homes with **schools, clinics and fire & police**; keep **factories** (which make
    building materials) away from housing, or out in the Dockyards.
  - Relieve **traffic** with bus, tram, ferry, metro and rail stops; raise land value with
    parks and plazas. The **Map** button shows land value, services, pollution and transit.
  - **Renovate** finished towers: facades, amenities, rooftop gardens, solar roofs, lighting.
  - Buy **ten districts** along the harbour, each with its own trait.
  - Income builds up while you're away, for up to 8 hours. **Collect** it when you return.
- **Coming back**:
  - Three **contracts** at a time, refilling every 15 minutes.
  - A rotating **city event** every 3 hours and live **weather** every 2 hours (wind, rain, fog,
    storms, snow) that pays bonus coins for building in it.
  - A seeded **Daily Challenge** with a streak, and a **Weekly Challenge** with bronze, silver
    and gold tiers.
  - The six-stage **Harbor Stadium** megaproject on its own island.
  - **Sky Race**, the endless classic mode. Your best run stands as the **Record Tower** on the
    pier.
  - **Achievements**, **mastery facades**, crane paint, a **Blueprint Studio** for your own
    tower designs, and **Photo mode**.
- **Progression**:
  - 30 city levels unlock 17 blueprints, from Starter Flats up to the 100-floor Forge Megatower,
    plus districts, utilities, transit and services.
  - **Regions**: found new cities in Coral Bay (tropical), Mirage Springs (desert) and Fjordheim
    (northern fjord), each with its own rules, weather and look. Every city you own adds trade
    income to the others.
  - New moves unlock in the design document's tutorial order, and never lock again in a new
    region.

## Controls in the city

- **Pan**: drag.
- **Zoom**: pinch or scroll.
- **Open a lot, building or pier**: tap it.
- **Keyboard**: arrows pan, `+`/`-` zoom, `Esc` closes sheets and pauses builds.
- **Photo mode** (Menu): drag to orbit, pinch or scroll to zoom, two fingers to pan, tap to hide
  the controls; keyboard arrows, `+`/`-`, `Space` to capture, `H` to hide.

## Files

- **`index.html`**: markup and styles.
- **`js/`**: the game, as classic scripts that share one global scope:
  - `core` and `data`: helpers and the tuning tables;
  - `audio` and `gfx`: sound, rendering and textures;
  - `world` and `life`: the city map, the crane, and everything that moves in the city;
  - `engine`: the classic construction engine and the Forge moves;
  - `city` and `meta`: the simulation, economy and reasons to come back;
  - `events`, `stadium`, `studio`, `photo` and `regions`: weather and events, the stadium
    megaproject, the Blueprint Studio, Photo mode and regions;
  - `ui` and `main`: screens and the main loop.

  `index.html` runs as is from a web server or `file://`.
- **`bundle.py`**: inlines the scripts into `dist/skyline-forge.html`, one file for hosting and
  for the APK.

All tuning lives in `js/data.js`.

## Saving

- **Where**: progress is saved in the browser's local storage (`skyline-forge/v3`).
- **Upgrading**: a 0.4 save is carried over. Its best Quick Game becomes the Sky Race record,
  and its City Bloxx buildings move to Harbor Row.
- **Resetting**: Settings → Reset all progress erases the save.

## Performance

- **Graphics setting**: Auto, High, Balanced or Battery saver. Auto watches frame time and
  steps render resolution, shadow-map size, traffic and clouds down, and back up again when
  there's headroom.
- **Draw calls**: the backdrop city, the traffic and all of your towers are drawn with a few
  instanced meshes, so a full city adds only a few draw calls.
- **Idle cost**: rendering stops while paused, and the game pauses when it goes to the
  background.

## Android APK

```bash
python3 skyline-forge/android/build_apk.py   # needs a JDK 17+ and Python 3
# -> skyline-forge/android/dist/SkylineForge.apk
```

The build doesn't need the Android SDK:
- It fetches the Android API stubs, `dx` and `apksig` from Maven Central, and three.js and the
  Barlow fonts from npm. They're cached in `android/.cache/`.
- It compiles the WebView wrapper and writes the binary manifest and resource table itself.
- It signs with APK Signature Scheme v2 and verifies the result.

The app:
- Needs Android 7.0 or newer.
- Works fully offline.
- Runs fullscreen and keeps the screen on while you play.
- Pauses when you leave it.
- Back closes sheets, pauses a build, leaves Photo mode, returns to the title, or exits from the
  title screen.
- Saves Photo mode pictures to Pictures/Skyline Forge (Android 10+; older phones use the app's own
  pictures folder) and can share them.

It's signed with the committed **debug** key (`android/debug.keystore`, password
`android`), so a newer build installs over an older one. Use your own key before publishing
it anywhere.
