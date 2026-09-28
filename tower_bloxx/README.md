# Skyline Stack

A single-tower crane game in the style of City Bloxx: time the drop from the circling crane, stack the floors straight, keep the combo going. Hold the button to swing faster for a bigger multiplier; let go to drop, or drag up and let go to cancel. The motion, scoring and HUD are measured frame by frame from a 60 fps City Bloxx phone recording.

Open `index.html` in a browser to play. No build step; it runs from the file system as well as from a server.

## Where everything lives

Each part of the game is its own file, and each file keeps its tuning numbers in a settings block at the top (`CRANE`, `FALL`, `SWAY`, …). To change one thing, edit only the file that owns it.

| To change | Edit |
|---|---|
| How the hook swings: loop size and speed, how evenly it rounds the sides, load tilt, rope pivot, when the next floor appears, which floors are balcony floors, winding the rope up at the end | `crane/swing.js` |
| How the rope, pulley, hook and hanging floor look | `crane/rigging.js` |
| Press and hold: swing speed and size steps, extra momentum, multipliers, the 2 s warning and auto-drop, cancelling | `hold/hold.js` |
| Letting go and the fall: gravity, sideways carry, straightening, what counts as a hit or a miss | `drop/fall.js` |
| The perfect-drop window (2 px), what a landing sets off, the dust from under it | `landing/landing.js` |
| Misses: tipping over the edge, falling past, landing off the slab | `miss/miss.js` |
| Loose floors: how they tumble, knock into each other and the tower, what a knock throws off and cracks, crumbling away | `rubble/rubble.js` |
| The physics under that: gravity, bounce, friction, contacts between boxes | `physics/rigid.js` |
| Number of lives | `lives/lives.js` |
| The end of a round: settling on what is left standing, the floors-built count, the rope winding up, the slide down to the street | `round/ending.js` |
| Collapse: when a bad drop on a shaky tower brings the top down, how many floors go (1 to 10, from the blow; perfect floors never), the tip over the edge and the tumble | `collapse/collapse.js` |
| The stack of floors and how it is drawn, its shadow on the ground | `tower/tower.js` |
| Tower sway and steadiness: floors that never move, how the bend grows with height, the landing wobble, how much perfect drops steady the tower (3 in a row: 90%, 4: still) | `tower/sway.js` |
| Camera: where the tower top rests, the climb after a landing, the end-of-round slide | `camera/camera.js` |
| Residents per floor, the share that moves in (half), where a combo's residents go | `score/residents.js` |
| Combo: bar drain, refills, multiplier, payout | `score/combo.js` |
| How tenants fly in: one per resident, timing, start and window end points, how much each flight varies, the window lighting up, turning back | `tenants/flight.js` |
| How tenants look | `tenants/sprite.js` |
| Perfect-drop stars | `effects/stars.js` |
| Combo twinkles on the top floors | `effects/twinkles.js` |
| Dust clouds and grit from knocks and landings | `effects/dust.js` |
| Chips knocked off floors | `effects/chips.js` |
| Screen jolt on heavy knocks | `effects/shake.js` |
| Darkened edges of the view | `effects/vignette.js` |
| Floor, ground-floor and balcony-floor look and size; the 2.5D depth (how far back floors go, roof and wall faces) | `art/blocks.js` |
| Cracks and chipped corners | `art/damage.js` |
| Sky colours by height, sunset glow, the sun, stars, planets, soft clouds, how dark it is | `scenery/sky.js` |
| The city behind the site, its parallax and haze | `scenery/city.js` |
| The site: slab, fence, tree, hoarding, cones, dirt | `scenery/ground.js` |
| What the HUD shows and when, the payout, population and floors-built count-ups | `hud/hud.js` |
| How the HUD looks: glass chips, icons, hearts, the combo meter, hold meter, payout and floors-built animations | `hud/hud.css` |
| Starting a round, the results card and how it pops up | `round/round.js`, `round/result.css` |
| Controls: press, hold, drag, let go | `input/input.js` |
| Sounds | `audio/sound.js` |
| Screen shape, pixel scale and drawing resolution | `core/screen.js` |
| Shared drawing shapes (rectangles, circles, lines) | `core/pixels.js` |
| What the browser remembers (best tower, mute) | `core/storage.js` |
| Update order and drawing order | `core/loop.js` |
| Page colours, fonts, the glass panel look, the phone frame, the first-round hint | `styles/page.css` |

## How the files fit together

- `core/namespace.js` creates the `SS` namespace. Every other file adds one part to it (`SS.crane`, `SS.sway`, `SS.tenants`, …) and reads other parts only through it, when it runs, never by copying their numbers.
- Each game part has `init(g)` for its starting state in a new round (called from `round/round.js`), `update(g, dt)` and/or `draw(g, camY)` (called from `core/loop.js` in a fixed order).
- A landing is the one place several parts react together; `landing/landing.js` calls each of them in turn. A collapse (`collapse/collapse.js`) is the other: it takes floors off the tower and tells residents, tenants, sway, lives and the camera.
- `index.html` loads the scripts in order; `core/loop.js` is last and starts the game.

Units are game pixels and seconds. `SS.K` (46/110) converts pixels of the recording to game pixels. The canvas has as many pixels as the screen really has, so everything is drawn sharp and moving things sit between pixels.
