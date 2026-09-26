# Skyline Forge

The classic Skyline Stack game running in stylized 3D (three.js r128), with the *Skyline Forge
Master Game Design Document*'s Phase 1 features added on top. It's a single `index.html` with no
build step, and it runs in any browser with WebGL. An Android APK wrapper lives in
[`android/`](android/).

The original 2D pixel version is still in [`../skyline-stack/`](../skyline-stack/).

## The classic base, unchanged

The game runs the 2D version's engine as is. It keeps the same units (classic screen pixels, y
pointing down), the same tuning values and the same rules. The 3D scene only draws that state:
one classic pixel is 0.15 m, so the 40 × 46 px block is a 6 × 6.9 m module.

- **Blocks**: the classic design, painted onto every face of the 3D module:
  - dark outline and tan concrete slab rim;
  - two tall windows with stepped sky reflections;
  - glass doors on the first floor;
  - small roof props on the last floor of a city tower.
- **Rope**: the same pendulum from a pivot above the screen, with the same reach and speed
  growth per floor. The first floor hangs from a four-cable sling and the rest from the hook. The
  load hangs level while the rope swings.
- **Drop**: straight down from where you let go. Gravity is set so a floor falls the gap in
  0.36 s.
- **Landing**:
  - within 5 px of centre is Perfect;
  - a floor sticks if its centre lands on the one below;
  - a floor whose centre is past the edge tips off;
  - a wider miss falls past the tower.
- **Rounds**: three misses end a Quick Game.
- **Sway**: the whole building rocks as one rigid piece. Every sloppy floor makes it swing more
  and a Perfect keeps only 45% of the swing. Short towers can only lean a little.
- **Camera**: level and straight-on, framing exactly the classic screen. At the start it shows
  the crane, then pans down until only the rope is left. It keeps the tower top 58% down the
  screen and slides back down to the street when the round ends.
- **Modes**: Quick Game, and Build City, the 5 × 5 city with Residential, Commercial, Office
  and Luxury towers and their neighbour rules.

## Controls: the Forge layer

None of these change the swing, drop or sway unless you hold, swipe or recall. A quick tap is a
classic drop.

| Gesture | Keyboard | What happens |
|---|---|---|
| Tap | Tap `Space` | **Drop**, the classic way. |
| Press and hold | Hold `Space` | **Hold Momentum**. The crane swings faster and the multiplier climbs. Let go to drop. |
| Hold + swipe down | `↓` (`Shift ↓` = max) | **Power Drop**. Adds downward speed. A faster swipe means ×1.25 → ×2.5. |
| Hold + swipe up | `↑` | **Recall**. The floor is lifted for another swing. Costs one step of the combo. |
| Hold for 3 s | | **Forced Release**. Beeps, a red glow and vibration warn you first. |

**Classic controls** in Settings drops the moment you touch, like the phone original, and turns
the Forge gestures off.

Hold bands follow Appendix A:

| Hold | Swing speed | Multiplier | Label |
|---|---|---|---|
| 0–0.5 s | 1.0× | ×1.0 | Safe |
| 0.5–1.0 s | 1.15× | ×1.2 | Low risk |
| 1.0–1.5 s | 1.4× | ×1.5 | Committed |
| 1.5–2.0 s | 1.8× | ×2.0 | High risk |
| 2.0–2.5 s | 2.5× | ×2.8 | Very high risk |
| 2.5–3.0 s | 3.5× | ×4.0 | Extreme |

## Scoring and feedback

- **Residents**: the classic formula (accuracy, Perfect bonus, combo bonus, tower type), times
  the hold and Power multipliers.
- **Ratings**: Perfect (the classic 5 px), then Excellent, Great, Good, Rough and Dangerous,
  measured by how far off centre the floor lands.
- **Power impact**: a Power Drop lands harder.
  - Off centre, it adds more sway and shoves the floor further out.
  - A Strong or harder one that lands within 6 px of centre settles the tower instead, removing
    40% of the sway.
- **Stability readout**: the sway, shown as Stable, Moving, Dangerous or Critical.
- **Recovery bonuses**: bring the tower from Dangerous back to Stable with new floors to earn a
  Close Call bonus. Starting from Critical earns a Structural Save instead.
- **Report**: height, residents, Perfect drops, longest combo, construction quality, Power
  Perfects, recoveries and highest risk.

Classic tuning lives in `CFG` and the Forge layer's in `FORGE`, both at the top of the script.

## Performance

- **Graphics setting**: Auto, High, Balanced or Battery saver. Auto watches frame time and
  steps render resolution, shadow-map size, traffic and cloud counts down, and back up again
  when there's headroom.
- **City rendering**: the whole city is drawn with a few instanced meshes. Window patterns
  come from a world-space shader, so there are no per-building textures.
- **Simulation**: the engine runs in fixed 120 Hz steps, like the 2D version.
- **Idle cost**: rendering stops while paused, and the game pauses automatically when the tab
  or app goes to the background.

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
- Back pauses the game, steps back through menus, or exits from the title screen.

It's signed with the committed **debug** key (`android/debug.keystore`, password
`android`), so a newer build installs over an older one. Use your own key before publishing
it anywhere.
