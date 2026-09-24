# Gesture Control — Kinect v2 + webcam

Control your computer with your **hands, face, head and body**. The input comes from an
**Xbox One Kinect (Kinect v2)** and/or an ordinary **webcam**, at the same time.

- **Hands**: 21-point hand tracking. It recognises 12 static poses (fist, open palm, point,
  victory, thumbs up/down, OK, pinch …) and motion gestures (swipes, push/pull, wave).
- **Face**: smile, mouth open, raised eyebrows, winks, blinks, double blink, eyes closed,
  plus any MediaPipe blendshape you want to use (pucker, cheek puff …).
- **Head**: yaw/pitch/roll head pose, nod (yes), shake (no), turn/look/tilt.
- **Kinect body**: the SDK's 25-joint skeleton and native open/closed/lasso hand states,
  raised hands, and metric depth for push/pull and for ignoring people in the background.
- **Fusion**: when both cameras see the same gesture it fires once. A held gesture stays
  held while *either* camera still sees it.
- **Actions**: key presses and shortcuts, held keys, mouse clicks, drag, scroll,
  shell commands, typing text.
- **Mouse pointer**: steer it with your hand (webcam or Kinect skeleton) or your head.
- **Output**: a JSON-over-UDP stream of events and tracking data, for Unity, Godot,
  TouchDesigner or your own code.

```
 webcam ──► capture thread ──► MediaPipe hands/face ──► gesture engine ──┐
                                                                          ├─► fusion ─► actions (keys, mouse, commands)
 Kinect ──► capture thread ──► colour+depth+skeleton ─► gesture engine ──┘        └─► UDP JSON / preview window
```

Each camera runs in its own thread, so a slow or missing camera never blocks the other one.

---

## 1. Install

You need 64-bit Python 3.9 – 3.12.

```bash
git clone https://github.com/rafiytca2-tech/Try.git gesture-control
cd gesture-control
python -m venv .venv
# Windows: .venv\Scripts\activate      Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
```

The MediaPipe models (about 12 MB) download automatically the first time you run it. To
fetch them in advance, run `python -m gesture_control --download-models`.

### Kinect v2 drivers

Hardware: the Xbox One Kinect needs the **Kinect Adapter for Windows** (power supply +
USB 3.0 breakout) and a **USB 3.0** port. Intel and Renesas USB 3 controllers work best.

**Windows (recommended: full skeleton + depth)**

1. Install the [Kinect for Windows SDK 2.0](https://www.microsoft.com/en-us/download/details.aspx?id=44561).
   Plug the sensor in and check it with *Kinect Configuration Verifier* or *Kinect Studio*.
2. Install PyKinect2:
   ```bash
   pip install comtypes
   pip install git+https://github.com/Kinect/PyKinect2.git
   ```
   PyKinect2 hasn't been updated in years. gesture_control works around its
   incompatibilities with modern Python/numpy/comtypes when it loads it. If you installed
   the PyPI release instead (`pip install pykinect2`), also run this once:
   ```bash
   python tools/patch_pykinect2.py
   ```

**Linux / macOS (colour + depth, no skeleton)**

Build [libfreenect2](https://github.com/OpenKinect/libfreenect2), then its Python binding:

```bash
sudo apt install build-essential cmake pkg-config libusb-1.0-0-dev libturbojpeg0-dev libglfw3-dev
git clone https://github.com/OpenKinect/libfreenect2.git && cd libfreenect2
mkdir build && cd build && cmake .. -DCMAKE_INSTALL_PREFIX=$HOME/freenect2 && make -j4 && make install
sudo cp ../platform/linux/udev/90-kinect2.rules /etc/udev/rules.d/   # then re-plug the Kinect
./bin/Protonect                                                       # should show the camera
export LIBFREENECT2_INSTALL_PREFIX=$HOME/freenect2
export LD_LIBRARY_PATH=$HOME/freenect2/lib:$LD_LIBRARY_PATH
pip install pylibfreenect2      # if this fails, build github.com/r9y9/pylibfreenect2 from source
```

**No drivers?** With the SDK installed, Windows also exposes the Kinect's colour camera as a
normal webcam. Set `backend: uvc` and that camera's index as `device` to use it (colour only).

### Check your setup

```bash
python -m gesture_control --check
```

This lists the cameras it found, whether the Kinect SDK / PyKinect2 / libfreenect2 work,
whether keyboard/mouse output is available, and where the models are.

---

## 2. Run

```bash
python -m gesture_control                      # webcam + Kinect with the default bindings
python -m gesture_control --dry-run            # show what WOULD be pressed, press nothing
python -m gesture_control --no-kinect          # webcam only
python -m gesture_control --no-webcam          # Kinect only
python -m gesture_control --webcam 1           # a different camera (or a video file / URL)
python -m gesture_control --cursor hand        # move the mouse with your right hand
python -m gesture_control --cursor head        # ... or with your head
python -m gesture_control --udp 5005           # stream JSON to 127.0.0.1:5005
python -m gesture_control --config config/presentation.yaml
```

The preview window shows every camera with its tracking overlay and the most recent
gestures and actions. Keys in the preview window:

| Key | |
|---|---|
| `Q` / `Esc` | quit |
| `P` | pause / resume all actions (the preview keeps tracking) |
| `K` | toggle mouse-pointer control |
| `C` | calibrate the head: your current head pose becomes "straight ahead" |
| `D` | overlay Kinect depth |
| `M` | toggle the face mesh |

**Start with `--dry-run`**. Gestures are real key presses sent to whatever window has
focus. The default bindings are harmless (arrow keys, media keys), and the ROCK 🤘 pose
pauses/resumes actions.

### Left and right

Every camera preview should look like a **mirror**: raise your right hand and it appears
on the right. Then "left/right" means *your* left/right everywhere: hand sides, swipe
directions, winks, head turns. Webcams are flipped for you (`mirror: true`). Kinect v2
frames usually arrive mirrored already (`mirror: false`). If a preview isn't a mirror,
change that source's `mirror` option.

---

## 3. Gestures

| Category | Gesture | Kind | Notes |
|---|---|---|---|
| **Hand poses** (per hand) | `FIST` `OPEN_PALM` `POINT` `VICTORY` `THREE` `FOUR` `THUMBS_UP` `THUMBS_DOWN` `ROCK` `CALL_ME` `OK` `PINCH` | start / end | Uses finger straightness from 3D landmarks, so it works at any hand rotation |
| **Hand motion** (per hand) | `SWIPE_LEFT` `SWIPE_RIGHT` `SWIPE_UP` `SWIPE_DOWN` | trigger | A fast, straight movement of about ¼ of the frame |
| | `PUSH` `PULL` | trigger | Kinect: ≥ 12 cm toward/away from the sensor. Webcam: the palm grows/shrinks by 30 % |
| | `WAVE` | trigger | ≥ 4 side-to-side strokes with an open hand |
| **Face** | `SMILE` `MOUTH_OPEN` `BROWS_RAISED` `EYES_CLOSED` `WINK_LEFT` `WINK_RIGHT` `PUCKER` `CHEEK_PUFF` | start / end | Each has a threshold and a minimum hold time |
| | `BLINK` `DOUBLE_BLINK` | trigger | |
| **Head** | `NOD` `SHAKE` | trigger | |
| | `TURN_LEFT` `TURN_RIGHT` `LOOK_UP` `LOOK_DOWN` `TILT_LEFT` `TILT_RIGHT` | start / end | Relative to the calibrated neutral pose (`C`) |
| **Kinect body** (per hand) | `HAND_OPEN` `HAND_CLOSED` `HAND_LASSO` | start / end | The SDK's own hand-state classifier. Works at 1–4 m |
| | `RAISE_HAND` (per hand), `BOTH_HANDS_UP` | start / end | Hand above the head |

With `body.motion: true`, the Kinect skeleton hands also produce `SWIPE_*`, `PUSH/PULL` and
`WAVE`. These work at room scale, where the hands are too small in the image for MediaPipe.

Every threshold is in the config (`hands`, `face`, `head`, `body` sections).

## 4. Bindings

Bindings map gestures to actions. The defaults:

| Gesture | Action |
|---|---|
| `SWIPE_LEFT/RIGHT/UP/DOWN` | arrow keys |
| `PUSH` | space |
| `VICTORY` ✌ | play/pause media |
| `THUMBS_UP` / `THUMBS_DOWN` | volume up / down |
| `ROCK` 🤘 | pause / resume all actions |
| `PINCH` (right) or Kinect `HAND_CLOSED` (right) | hold the left mouse button, *only while cursor control is on* (so pinch = click/drag) |
| `NOD`, `SHAKE`, `DOUBLE_BLINK`, `WAVE` | log only (try them!) |

Write your own:

```bash
python -m gesture_control --write-config my.yaml      # a fully commented copy of the defaults
python -m gesture_control --config my.yaml
```

```yaml
bindings:
  - {gesture: SWIPE_LEFT, action: key, keys: "ctrl+win+right"}      # next virtual desktop
  - {gesture: FIST, hand: left, action: key_hold, keys: shift}       # hold shift while fist is held
  - {gesture: PINCH, hand: right, action: mouse_hold, button: left}  # pinch-drag
  - {gesture: SMILE, action: command, cmd: "notepad", cooldown: 5}   # run a program
  - {gesture: MOUTH_OPEN, action: type, text: "hello"}
  - {gesture: BROWS_RAISED, action: scroll, dy: 3, cooldown: 0.3}
  - {gesture: THUMBS_UP, source: kinect, action: click, button: left, on: end}
  - {gesture: DOUBLE_BLINK, action: toggle_cursor}
```

Binding fields: `gesture`, optional `hand` (`left`/`right`/`any`), `source` (a camera name),
`on` (`start`/`end`/`trigger`), `cooldown` (seconds), `requires_cursor`, and the action with
its parameters. Actions: `key`, `key_hold`, `type`, `click`, `mouse_hold`, `scroll`,
`command`, `log`, `toggle_actions`, `toggle_cursor`, `calibrate_head`. The config is checked
at start-up, so a typo in a gesture or key name gives a clear error.

Ready-made configs are in [`config/`](config):
- [`presentation.yaml`](config/presentation.yaml): slide control by swipe or head turn.
- [`head_mouse.yaml`](config/head_mouse.yaml): hands-free mouse. Head moves the pointer,
  winks click, open mouth drags, eyebrows scroll.
- [`kinect_room.yaml`](config/kinect_room.yaml): room-scale control with the skeleton.
  Grab to drag, push to press space.
- [`webcam_only.yaml`](config/webcam_only.yaml): no Kinect.

## 5. Mouse pointer

`--cursor hand`: your right palm steers the pointer. The central part of the frame
(`cursor.region`) maps to the whole screen, and the movement is smoothed with a One-Euro
filter. Make a **fist** to freeze the pointer while you reposition. **Pinch** to click, and
keep pinching to drag. On the Kinect, the skeleton hand is used when MediaPipe can't see
your hand.

`--cursor head`: head yaw/pitch acts as a joystick (`head_mode: relative`) or maps
directly to screen positions (`absolute`). Press `C` while looking at the centre of the
screen to calibrate.

## 6. Streaming to other programs (UDP)

`--udp 5005` sends one JSON object per datagram:

```json
{"type": "event", "name": "SWIPE_LEFT", "category": "hand", "phase": "trigger",
 "source": "webcam", "side": "right", "timestamp": 1234.5, "data": {"dx": -0.27, "dy": 0.01}}
{"type": "tracking", "source": "kinect", "frame": 812, "size": [1920, 1080],
 "hands": [{"side": "right", "pose": "POINT", "depth_mm": 1240.0, "landmarks": [[x, y, z], ...]}],
 "faces": [{"head": {"yaw": 3.1, "pitch": -2.0, "roll": 0.4}, "metrics": {"smile": 0.1, ...}}],
 "bodies": [{"tracking_id": 72057594037927936, "hand_states": {"left": "open", "right": "closed"},
             "joints": {"Head": [0.02, 0.45, 2.1], ...}}]}
```

See [`examples/udp_receiver.py`](examples/udp_receiver.py). Turn off per-frame tracking with
`output.udp.tracking: false`.

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `could not open the Kinect v2` | Run `--check`. Windows: is the SDK installed and does *Kinect Studio* see the sensor? Linux: does `Protonect` work, and are the udev rules installed? Use a USB 3.0 port. |
| `PyKinect2 failed its 32-bit struct size check` | `python tools/patch_pykinect2.py` |
| Left and right are swapped | The preview is not a mirror. Flip that source's `mirror` option. If only winks are swapped, set `face.swap_eyes: true`. |
| Hands not detected on the Kinect far away | MediaPipe needs the hand to be reasonably large in the image. Beyond ~1.5 m use the Kinect skeleton gestures (`HAND_CLOSED`, skeleton swipes/push), or raise `process_width` (costs CPU). |
| Slow / laggy | Lower `process_width`. Give each camera only the trackers it needs (e.g. face on the webcam only). Use `max_hands: 1`. |
| Accidental triggers | Raise `pose_min_on`, the swipe `min_distance`, or add a `cooldown`. `P` or ROCK pauses everything. |
| No key presses on Linux | pynput needs an X11 session (Wayland blocks synthetic input). `--check` shows whether output works. |
| Head angles are offset | Press `C` while looking straight at the screen. |

## 8. Development

```bash
pip install pytest
python -m pytest            # unit tests: poses, motion, face/head, fusion, actions, config, sources
```

Layout:

```
gesture_control/
  sources/      webcam.py, kinect_v2.py (pykinect2 / libfreenect2 / uvc), pykinect2_compat.py
  perception/   MediaPipe trackers, head pose + face metrics, depth lookup, per-camera pipeline
  gestures/     hand_pose.py (static), hand_motion.py, face_gestures.py, head_gestures.py,
                body_gestures.py, engine.py (per camera), signal.py (debounce/hysteresis/zig-zag)
  fusion.py     merges events from several cameras
  actions/      bindings executor, pynput backend, cursor controller
  output/       UDP publisher
  app.py        threads, main loop, preview window      cli.py  command line
tools/patch_pykinect2.py
```

You can test without hardware by passing a recorded video as the webcam:
`python -m gesture_control --webcam clip.mp4 --no-kinect --dry-run`.
