# Skyline Stack

A browser remake of the feel of the 2005 mobile game *Tower Bloxx* / *City Bloxx*: a floor
swings from a crane, you drop it onto the tower, and the camera climbs with you. The art,
name and code are new. The mechanics were rebuilt from reviews and gameplay videos, because
the original source isn't public.

Open `index.html` in any modern browser. There is no build step and nothing to install.

## Controls

| Input | Action |
|---|---|
| Tap / click / `Space` / `Enter` / `↓` | Drop the floor |
| `Esc` / `P` | Pause |

## What's recreated

- **Crane swing**: the floor hangs from a rope and swings like a pendulum, tilted with the
  rope. The swing gets wider and faster as the tower grows.
- **Drop**: the floor falls straight down from where you release it.
- **Landing**:
  - Dead centre (within 6 px) is a **Perfect**: the floor snaps into line, starts the combo
    meter and calms the sway.
  - Off-centre floors still stick but make the tower sway more.
  - If a floor's centre lands past the edge, it tips off. A clean miss falls past the tower.
  - Each failed floor costs one of your 3 lives.
- **Tower sway**: the tower bends like a tall building. Wind grows with height, and sloppy
  floors add more sway.
- **Camera**: it starts on the street and climbs one floor at a time once the tower reaches
  the lower part of the screen. At game over it slides back down the whole tower.
- **Altitude**: clouds give way to dusk, then stars, the Moon, Saturn and Jupiter.
- **Residents**: straighter floors house more people. Every drop made while the combo meter
  is running adds a bonus, and chained Perfects raise it.
- **Build City**: a 5×5 grid.
  - Residential (10 floors) can go anywhere.
  - Commercial (20) needs a residential neighbor.
  - Office (30) needs residential and commercial neighbors.
  - Luxury (40) needs all three.
  - The last floor of each tower is its roof. City level goes up to 20.

Rendering happens on a low-resolution buffer (at least 240×320, like the phones of the
time), scaled up with hard pixel edges. On wide screens the game is framed in a portrait
window.

## Tuning

All feel constants are in the `CFG` object at the top of the script. They include swing
speed and width, drop time, the perfect tolerance, sway, camera framing and scoring.
`releaseMomentum` set to `1` makes a released floor keep its swing speed and fly in an arc
instead of dropping straight.

Best scores and your city are saved in the browser's local storage.

## Playing with gestures

The gesture controller in this repo presses Space on `PUSH` by default, so the game works
with gestures as it is. [`config/skyline_stack.yaml`](../config/skyline_stack.yaml) adds
quicker triggers (a fist or a double blink drops a floor):

```bash
python -m gesture_control --config config/skyline_stack.yaml
```
