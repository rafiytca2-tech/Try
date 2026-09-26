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
- **The city**:
  - Tap a lot to build. Needs you to build **homes**, **shops** and **offices** that keep one
    another busy.
  - Watch the **R/C/O demand** bars and the **happiness** meter.
  - Place **parks, plazas, bus stops and metro stations** to raise land value.
  - Buy **eight districts** along the harbour, including historic Old Town with its height limit.
  - Income builds up while you're away, for up to 8 hours. **Collect** it when you return.
- **Coming back**:
  - Three **contracts** at a time, refilling every 15 minutes.
  - A seeded **Daily Challenge** with modifiers and a streak.
  - **Sky Race**, the endless classic mode. Your best run stands as the **Record Tower** on the
    pier.
  - **Achievements**, blueprint mastery stars, and crane paint unlocked with prestige.
- **Progression**:
  - 30 city levels unlock 9 blueprints, from Starter Flats up to the 100-floor Forge Megatower,
    and the districts.
  - New moves unlock in the design document's tutorial order.

## Controls in the city

- **Pan**: drag.
- **Zoom**: pinch or scroll.
- **Open a lot, building or pier**: tap it.
- **Keyboard**: arrows pan, `+`/`-` zoom, `Esc` closes sheets and pauses builds.

## Files

- **`index.html`**: markup and styles.
- **`js/`**: the game, as classic scripts that share one global scope:
  - `core` and `data`: helpers and the tuning tables;
  - `audio` and `gfx`: sound, rendering and textures;
  - `world`: the city map and the crane;
  - `engine`: the classic construction engine and the Forge moves;
  - `city` and `meta`: the simulation, economy and reasons to come back;
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
- Back closes sheets, pauses a build, returns to the title, or exits from the title screen.

It's signed with the committed **debug** key (`android/debug.keystore`, password
`android`), so a newer build installs over an older one. Use your own key before publishing
it anywhere.
