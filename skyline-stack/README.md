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

- **Intro**: each round opens on the yellow tower-crane jib with the load on a long rope.
  The camera then slides down to the site, and from then on only the rope shows.
- **Rigging**: a thick black rope ends in a pulley block. The ground floor hangs from a
  two-cable sling, and every floor after it hangs from a hook.
- **Blocks**: square modules with a concrete rim on top, two tall windows that reflect the
  sky, and a glass double door on the ground floor.
- **Crane swing**: the rope swings like a pendulum while the load stays level. The swing gets
  wider and faster as the tower grows. A released floor drops straight down.
- **Landing**:
  - Dead centre (within 5 px) is a **Perfect**: the floor snaps into line and starts the
    combo meter.
  - Off-centre floors still stick but make the building less stable.
  - If a floor's centre lands past the edge, it tips off. A clean miss falls past the tower.
  - Each failed floor costs one of your 3 lives.
- **Sway**: the whole building rocks as one rigid piece about its base, so floors never slide
  over each other. Every imperfect floor adds to the swing. Every Perfect cuts it by more than
  half.
- **Camera**: the tower top stays at the same spot on screen from the first floor on, so the
  street scrolls away as you build. At the end of a round it slides back down to the street.
- **Setting**: grey city blocks behind a building site with a chain-link fence, a wooden
  hoarding, a tree, traffic cones and a concrete slab. Climb past the rooftops into open sky,
  then dusk, stars, the Moon, Saturn and Jupiter.
- **HUD**: a floor gauge at bottom left and the population at bottom right, as on the phone
  version.
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
speed and width, rope length, drop time, the perfect tolerance, sway gain and damping,
camera framing, the intro timing and scoring.
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
