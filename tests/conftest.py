"""Shared test helpers: a tiny kinematic hand model and observation builders."""

from __future__ import annotations

import math
import sys
from pathlib import Path
from typing import Dict, Iterable, Optional

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from gesture_control.types import Face, Frame, Hand, HeadPose, Observation  # noqa: E402

FINGER_MCP_OFFSETS = {"index": -0.03, "middle": -0.01, "ring": 0.01, "pinky": 0.03}
FINGER_SEGMENTS = {"index": (0.045, 0.025, 0.02), "middle": (0.05, 0.03, 0.02),
                   "ring": (0.045, 0.028, 0.02), "pinky": (0.035, 0.02, 0.018)}
FINGER_BASE = {"index": 5, "middle": 9, "ring": 13, "pinky": 17}
CURL = (60.0, 90.0, 60.0)  # MCP, PIP, DIP bend in degrees


def _rot(v: np.ndarray, axis: np.ndarray, degrees: float) -> np.ndarray:
    """Rodrigues rotation of ``v`` around unit ``axis``."""
    a = math.radians(degrees)
    axis = axis / np.linalg.norm(axis)
    return v * math.cos(a) + np.cross(axis, v) * math.sin(a) + axis * np.dot(axis, v) * (1 - math.cos(a))


def make_hand(extended: Iterable[str] = (), thumb: str = "tucked", orient: str = "up",
              pinch_with_index: bool = False) -> np.ndarray:
    """(21, 3) metric landmarks, image-style axes (x right, y down, z away).

    ``extended``: which of index/middle/ring/pinky are straight (others curled).
    ``thumb``: "tucked" | "out" (sideways) | "along" (parallel to the knuckles, for
    thumbs up/down when orient is "side"/"side_down").
    ``orient``: "up" = fingers point up; "side" = knuckles point right and the
    thumb points up; "side_down" = knuckles right, thumb down.
    """
    extended = set(extended)
    if orient == "up":
        forward, across = np.array([0.0, -1.0, 0.0]), np.array([1.0, 0.0, 0.0])
    elif orient == "side":
        forward, across = np.array([1.0, 0.0, 0.0]), np.array([0.0, 1.0, 0.0])
    else:  # side_down: mirror of "side" vertically
        forward, across = np.array([1.0, 0.0, 0.0]), np.array([0.0, -1.0, 0.0])
    palm_normal = np.array([0.0, 0.0, 1.0])            # curl direction (into the image)
    bend_axis = np.cross(forward, palm_normal)          # rotating forward toward the palm
    p = np.zeros((21, 3))
    for name, offset in FINGER_MCP_OFFSETS.items():
        base = FINGER_BASE[name]
        p[base] = 0.09 * forward + offset * across
        direction = forward.copy()
        pos = p[base]
        angles = (0.0, 0.0, 0.0) if name in extended else CURL
        for j, (length, bend) in enumerate(zip(FINGER_SEGMENTS[name], angles)):
            direction = _rot(direction, bend_axis, bend)
            pos = pos + length * direction
            p[base + 1 + j] = pos
    cmc = 0.02 * forward - 0.035 * across
    p[1] = cmc
    if pinch_with_index:
        tip = p[8] + np.array([0.004, 0.0, 0.0])
        p[2] = cmc + (tip - cmc) * 0.35 - 0.01 * across
        p[3] = cmc + (tip - cmc) * 0.7 - 0.008 * across
        p[4] = tip
    elif thumb == "tucked":
        target = p[9] + 0.03 * forward * 0.2 + np.array([0.0, 0.0, 0.03])
        p[2] = cmc + 0.03 * forward
        p[3] = p[2] + 0.5 * (target - p[2]) + np.array([0.0, 0.0, 0.01])
        p[4] = target
    else:
        if thumb == "along":
            d = -across  # thumb straight "above" the index knuckle line
        else:
            d = forward * 0.7 - across * 0.7
        d = d / np.linalg.norm(d)
        p[2] = cmc + 0.04 * d
        p[3] = p[2] + 0.035 * d
        p[4] = p[3] + 0.03 * d
    return p


def to_image(world: np.ndarray, center=(0.5, 0.5), scale: float = 2.5) -> np.ndarray:
    img = world.copy()
    img[:, 0] = center[0] + world[:, 0] * scale
    img[:, 1] = center[1] + world[:, 1] * scale
    return img


def hand_at(side: str, x: float, y: float, pose: Optional[str] = "OPEN_PALM", size: float = 1.0,
            depth: Optional[float] = None) -> Hand:
    world = make_hand(extended=("index", "middle", "ring", "pinky"), thumb="out")
    lm = to_image(world * size, center=(x, y))
    # shift so the palm centre is exactly at (x, y)
    lm[:, :2] += np.array([x, y]) - lm[[0, 5, 9, 13, 17], :2].mean(axis=0)
    return Hand(side=side, score=0.99, landmarks=lm.astype(np.float32), world=world, depth_mm=depth,
                pose=pose, finger_count=5)


def frame(t: float, index: int = 0, w: int = 640, h: int = 480, source: str = "cam") -> Frame:
    return Frame(source=source, image=np.zeros((h, w, 3), np.uint8), timestamp=t, index=index)


def face_obs(t: float, index: int = 0, metrics: Optional[Dict[str, float]] = None,
             head: Optional[HeadPose] = None, blendshapes=None, source: str = "cam") -> Observation:
    m = {"eye_left": 0.05, "eye_right": 0.05, "mouth_open": 0.0, "smile": 0.0, "brows_up": 0.0}
    m.update(metrics or {})
    face = Face(landmarks=np.zeros((478, 3), np.float32), head=head or HeadPose(0, 0, 0), metrics=m,
                blendshapes=blendshapes or {})
    return Observation(source=source, frame=frame(t, index, source=source), faces=[face])


@pytest.fixture
def dry_backend():
    from gesture_control.actions import DryRunBackend

    return DryRunBackend(verbose=False)
