import math

import numpy as np
import pytest

from conftest import face_obs
from gesture_control.config import load_default_config
from gesture_control.gestures.face_gestures import FaceGestures
from gesture_control.gestures.head_gestures import HeadGestures
from gesture_control.perception.face_geometry import (CHIN, EYE_IMG_LEFT, EYE_IMG_RIGHT, FOREHEAD,
                                                      face_metrics, head_pose)
from gesture_control.types import END, START, TRIGGER, HeadPose

CFG = load_default_config()


def feed_face(seq, cfg=None):
    """seq: list of (t, metrics-dict or None)."""
    fg = FaceGestures(cfg or CFG["face"])
    out = []
    for t, metrics in seq:
        face = face_obs(t, metrics=metrics).faces[0] if metrics is not None else None
        out += [(t, name, phase) for name, phase, _ in fg.update(face, t)]
    return out


def frames(duration, metrics, t0=0.0, fps=30):
    return [(t0 + i / fps, metrics) for i in range(int(duration * fps))]


def test_smile_start_and_end_with_min_on():
    seq = frames(0.1, {"smile": 0.9}) + frames(0.2, {"smile": 0.0}, 0.1)
    assert all(name != "SMILE" for _, name, _ in feed_face(seq))  # too short
    seq = frames(0.5, {"smile": 0.9}) + frames(0.3, {"smile": 0.1}, 0.5)
    events = [(n, p) for _, n, p in feed_face(seq) if n == "SMILE"]
    assert events == [("SMILE", START), ("SMILE", END)]


def test_wink_left_and_right():
    events = feed_face(frames(0.5, {"eye_left": 0.9, "eye_right": 0.05}))
    assert ("WINK_LEFT", START) in [(n, p) for _, n, p in events]
    assert "WINK_RIGHT" not in [n for _, n, _ in events]
    swapped = {**CFG["face"], "swap_eyes": True}
    events = feed_face(frames(0.5, {"eye_left": 0.9, "eye_right": 0.05}), swapped)
    assert "WINK_RIGHT" in [n for _, n, _ in events]


def test_blink_double_blink_and_eyes_closed():
    closed, opened = {"eye_left": 0.9, "eye_right": 0.9}, {"eye_left": 0.0, "eye_right": 0.0}
    seq = (frames(0.2, opened) + frames(0.15, closed, 0.2) + frames(0.2, opened, 0.35)
           + frames(0.15, closed, 0.55) + frames(0.3, opened, 0.7))
    names = [n for _, n, p in feed_face(seq) if p == TRIGGER]
    assert names == ["BLINK", "BLINK", "DOUBLE_BLINK"]
    names = [n for _, n, _ in feed_face(frames(0.2, opened) + frames(1.0, closed, 0.2) + frames(0.3, opened, 1.2))]
    assert "EYES_CLOSED" in names and "BLINK" not in names and "WINK_LEFT" not in names


def test_face_lost_ends_states():
    seq = frames(0.5, {"mouth_open": 0.9}) + [(0.6, None)]
    events = [(n, p) for _, n, p in feed_face(seq)]
    assert events[-1] == ("MOUTH_OPEN", END)


def test_blendshape_gestures():
    fg = FaceGestures(CFG["face"])
    got = []
    for i in range(20):
        obs = face_obs(i / 30, blendshapes={"mouthPucker": 0.9})
        got += [n for n, p, _ in fg.update(obs.faces[0], i / 30) if p == START]
    assert got == ["PUCKER"]


def run_head(poses, cfg=None):
    hg = HeadGestures(cfg or CFG["head"])
    out = []
    for i, pose in enumerate(poses):
        out += [(name, phase) for name, phase, _ in hg.update(pose, i / 30)]
    return out


def test_nod_and_shake():
    nod = [HeadPose(0, -12 * math.sin(i / 30 * 2 * math.pi * 1.5), 0) for i in range(30)]
    assert ("NOD", TRIGGER) in run_head(nod)
    shake = [HeadPose(15 * math.sin(i / 30 * 2 * math.pi * 1.5), 0, 0) for i in range(36)]
    events = run_head(shake)
    assert ("SHAKE", TRIGGER) in events and ("NOD", TRIGGER) not in events


def test_head_direction_states():
    turned = [HeadPose(25, 0, 0)] * 15 + [HeadPose(0, 0, 0)] * 10
    events = run_head(turned)
    assert events[:1] == [("TURN_RIGHT", START)] and ("TURN_RIGHT", END) in events
    assert ("TILT_LEFT", START) in run_head([HeadPose(0, 0, -20)] * 15)
    assert ("LOOK_UP", START) in run_head([HeadPose(0, 15, 0)] * 15)


def synthetic_face(yaw=0.0, pitch=0.0, roll=0.0):
    """478 landmarks with just the ones head_pose/face_metrics use, rotated."""
    pts = np.zeros((478, 3))
    model = {
        EYE_IMG_LEFT[0]: (-45, -30, 10), EYE_IMG_RIGHT[0]: (45, -30, 10),
        FOREHEAD: (0, -80, 0), CHIN: (0, 90, 0), 1: (0, 10, -40),
    }
    y, p, r = (math.radians(a) for a in (yaw, pitch, roll))
    # image axes: x right, y down, z away. yaw about y, pitch about x, roll about z
    ry = np.array([[math.cos(y), 0, -math.sin(y)], [0, 1, 0], [math.sin(y), 0, math.cos(y)]])
    rx = np.array([[1, 0, 0], [0, math.cos(p), math.sin(p)], [0, -math.sin(p), math.cos(p)]])
    rz = np.array([[math.cos(r), -math.sin(r), 0], [math.sin(r), math.cos(r), 0], [0, 0, 1]])
    rot = rz @ ry @ rx
    for idx, v in model.items():
        q = rot @ np.array(v, float)
        pts[idx] = [0.5 + q[0] / 640, 0.5 + q[1] / 480, q[2] / 640]
    return pts


@pytest.mark.parametrize("yaw, pitch, roll", [(20, 0, 0), (-20, 0, 0), (0, 15, 0), (0, -15, 0), (0, 0, 12), (0, 0, -12)])
def test_head_pose_signs(yaw, pitch, roll):
    hp = head_pose(synthetic_face(yaw, pitch, roll), 640, 480)
    assert hp.yaw == pytest.approx(yaw, abs=1.5)
    assert hp.pitch == pytest.approx(pitch, abs=1.5)
    assert hp.roll == pytest.approx(roll, abs=1.5)


def test_face_metrics_uses_ear_to_pick_the_closed_eye():
    lm = np.zeros((478, 3))
    # image-left eye wide open, image-right eye nearly shut
    for idx, opening in ((EYE_IMG_LEFT, 0.012), (EYE_IMG_RIGHT, 0.002)):
        outer, up1, up2, inner, low2, low1 = idx
        sign = -1 if idx is EYE_IMG_LEFT else 1
        cx = 0.5 + sign * 0.1
        lm[outer] = [cx + sign * 0.03, 0.4, 0]
        lm[inner] = [cx - sign * 0.03, 0.4, 0]
        for u, l, dx in ((up1, low1, 0.01), (up2, low2, -0.01)):
            lm[u] = [cx + dx, 0.4 - opening, 0]
            lm[l] = [cx + dx, 0.4 + opening, 0]
    m = face_metrics(lm, 640, 480, {"eyeBlinkLeft": 0.85, "eyeBlinkRight": 0.05})
    assert m["eye_right"] == pytest.approx(0.85) and m["eye_left"] == pytest.approx(0.05)
    m = face_metrics(lm, 640, 480, {"eyeBlinkLeft": 0.05, "eyeBlinkRight": 0.85})
    assert m["eye_right"] == pytest.approx(0.85)  # same answer whichever name carries it
    m = face_metrics(lm, 640, 480, None)  # geometric fallback
    assert m["eye_right"] > 0.8 and m["eye_left"] < 0.2
