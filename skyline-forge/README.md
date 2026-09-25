# Skyline Forge

The Phase 1 construction prototype from the *Skyline Forge Master Game Design Document*. You
build one tower, the 50-floor Skyline Residence, in stylized 3D (three.js r128). It's a single
`index.html` with no build step, and it runs in any browser with WebGL. An Android APK wrapper
lives in [`android/`](android/).

The older 2D pixel game, with its City mode, is still in [`../skyline-stack/`](../skyline-stack/).

## Controls: the one-finger language

| Gesture | Keyboard | What happens |
|---|---|---|
| Tap / quick release | Tap `Space` | **Normal Drop**. The floor falls straight down. |
| Press and hold | Hold `Space` | **Hold Momentum**. The crane swings faster and the multiplier climbs. |
| Hold + swipe down | `↓` (`Shift ↓` = max) | **Power Drop**. Adds real downward speed. A faster swipe means ×1.25 → ×2.5. |
| Hold + swipe up | `↑` | **Recall**. The floor goes back up for another swing. Costs one step of the Perfect chain. |
| Hold for 3 s | | **Forced Release**. Beeps, a red glow and vibration warn you first. |

Hold bands follow Appendix A:

| Hold | Swing speed | Multiplier | Label |
|---|---|---|---|
| 0–0.5 s | 1.0× | ×1.0 | Safe |
| 0.5–1.0 s | 1.15× | ×1.2 | Low risk |
| 1.0–1.5 s | 1.4× | ×1.5 | Committed |
| 1.5–2.0 s | 1.8× | ×2.0 | High risk |
| 2.0–2.5 s | 2.5× | ×2.8 | Very high risk |
| 2.5–3.0 s | 3.5× | ×4.0 | Extreme |

The hold and Power multipliers multiply together.

## Physics and scoring

- **Ratings** go Perfect, Excellent, Great, Good, Rough, Dangerous, Miss. They're based on
  alignment after the landing. A moving tower drags the floor a little as it lands.
- **Stacking statics**: every joint compares the centre of mass of everything above it with
  the contact area below. Floors offset the same way add up, so you counterbalance by placing
  the next floors toward the other side.
- **Sway**: the whole building rocks as one rigid body. Wind grows with height. Off-centre
  impacts add sway, a Perfect damps it, and a centred Power Drop settles the tower. Short
  buildings barely move.
- **Power impact**: a heavy drop can knock loose poorly supported joints near the top
  ("Floors shifted").
- **Tipping and collapse**: when a joint's margin goes negative, the section above rocks on
  its edge, with creaks, vibration and a red "Critical" readout. Fix it in time and it
  settles back. If not, only the floors above that joint fall (**partial collapse**) and you
  keep building. Failure at the lobby joint is a **full collapse** and ends the run.
- **Recoveries**: pulling the tower back from Dangerous or Critical with new placements
  awards Close Call, Structural Save, Master Recovery, Impossible Recovery or Legendary
  Recovery.
- **Score** = placement points × hold × power × chain multiplier × structural consequence,
  plus recovery and topping-out bonuses.
- **Modules**: 62 are delivered for 50 floors. Misses and collapsed floors use up the spares.
  The run ends when finishing is no longer possible.
- **Quality report**: height, construction quality, structural stability, Perfect floors,
  longest chain, Power Perfects, recoveries, floors lost, capacity and prestige.

**Camera**: level and straight-on, matching the classic side view. It only slides up and down
and moves in and out, never tilting, so alignment always reads as left and right on screen.
- **Title**: shows the crane with the lobby hanging.
- **Intro**: pans straight down to the site.
- **Play**: holds the tower top 58% down the screen from the first floor, pulling back as the
  swing widens.
- **End of a round**: slides back down and pulls back until the whole tower is in view.

All tuning lives in the `CFG` object at the top of the script.

## Performance

- **Graphics setting**: Auto, High, Balanced or Battery saver. Auto watches frame time and
  steps render resolution, shadow-map size, traffic and cloud counts down, and back up again
  when there's headroom.
- **City rendering**: the whole city is drawn with a few instanced meshes. Window patterns
  come from a world-space shader, so there are no per-building textures.
- **Idle cost**: the per-step physics reuses its vectors and result objects, rendering stops
  while paused, and the game pauses automatically when the tab or app goes to the background.

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
