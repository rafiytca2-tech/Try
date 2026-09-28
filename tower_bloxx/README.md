# Skyline Stack

A single-tower crane game in the style of City Bloxx: time the drop from the circling crane, stack the floors straight, keep the combo going. The motion, scoring and HUD are measured frame by frame from a 60 fps City Bloxx phone recording.

Open `index.html` in a browser to play. No build step; it runs from the file system as well as from a server.

## Where everything lives

Each part of the game is its own file, and each file keeps its tuning numbers in a settings block at the top (`CRANE`, `FALL`, `SWAY`, …). To change one thing, edit only the file that owns it.

| To change | Edit |
|---|---|
| How the hook swings: loop size and speed, how evenly it rounds the sides, load tilt, rope pivot, when the next floor appears | `crane/swing.js` |
| How the rope, pulley, hook and hanging floor look | `crane/rigging.js` |
| Letting go and the fall: gravity, sideways carry, straightening, what counts as a hit or a miss | `drop/fall.js` |
| The perfect-drop window (2 px), and what a landing sets off | `landing/landing.js` |
| Misses: tipping over the edge, falling past, crashing on the ground | `miss/miss.js` |
| Number of lives, the pause before the round ends | `lives/lives.js` |
| Collapse: when a bad drop on a shaky tower brings the top down, how many floors go (10 at most), the tip over the edge and the tumble | `collapse/collapse.js` |
| The stack of floors and how it is drawn | `tower/tower.js` |
| Tower sway and steadiness: floors that never move, how the bend grows with height, the landing wobble, how much each perfect drop steadies the tower | `tower/sway.js` |
| Camera: where the tower top rests, the climb after a landing, the end-of-round slide | `camera/camera.js` |
| Residents per floor | `score/residents.js` |
| Combo: bar drain, refills, multiplier, payout | `score/combo.js` |
| How tenants fly in: timing, start and end points, easing | `tenants/flight.js` |
| How tenants look | `tenants/sprite.js` |
| Perfect-drop stars | `effects/stars.js` |
| Combo twinkles on the top floors | `effects/twinkles.js` |
| Dust when a floor crashes | `effects/dust.js` |
| Floor and ground-floor look and size | `art/blocks.js` |
| Sky colours by height, stars, planets, clouds | `scenery/sky.js` |
| The city behind the site and its parallax | `scenery/city.js` |
| The site: slab, fence, tree, hoarding, cones, dirt | `scenery/ground.js` |
| What the HUD shows and when, the payout and population count-up | `hud/hud.js` |
| How the HUD looks: the combo meter and payout animations | `hud/hud.css` |
| Starting a round, the results card | `round/round.js`, `round/result.css` |
| Controls | `input/input.js` |
| Sounds | `audio/sound.js` |
| Screen shape, pixel scale and drawing resolution | `core/screen.js` |
| Shared drawing shapes (rectangles, circles, lines) | `core/pixels.js` |
| What the browser remembers (best tower, mute) | `core/storage.js` |
| Update order and drawing order | `core/loop.js` |
| Page colours, the phone frame, the first-round hint | `styles/page.css` |

## How the files fit together

- `core/namespace.js` creates the `SS` namespace. Every other file adds one part to it (`SS.crane`, `SS.sway`, `SS.tenants`, …) and reads other parts only through it, when it runs, never by copying their numbers.
- Each game part has `init(g)` for its starting state in a new round (called from `round/round.js`), `update(g, dt)` and/or `draw(g, camY)` (called from `core/loop.js` in a fixed order).
- A landing is the one place several parts react together; `landing/landing.js` calls each of them in turn. A collapse (`collapse/collapse.js`) is the other: it takes floors off the tower and tells residents, tenants, sway, lives and the camera.
- `index.html` loads the scripts in order; `core/loop.js` is last and starts the game.

Units are game pixels and seconds. `SS.K` (46/110) converts pixels of the recording to game pixels. The canvas has as many pixels as the screen really has, so everything is drawn sharp and moving things sit between pixels.
